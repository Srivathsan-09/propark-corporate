import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Hub from "@/models/Hub";
import Ride from "@/models/Ride";
import Campus from "@/models/Campus";
import { routingService } from "@/lib/services/routing";
import { resolvePlaceCoordinates } from "@/lib/services/geocoding";
import { snapPointToRoute } from "@/lib/services/routeCorridor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const filterStatus = searchParams.get("status"); // "active" | "inactive" | "all"
    const filterCampus = searchParams.get("campusId");
    const search = searchParams.get("search");

    const query: Record<string, any> = {};

    const isSuperAdmin = session.user.role === "admin";
    const isCampusAdmin = session.user.role === "campus_admin";
    const isEmployee = !isSuperAdmin && !isCampusAdmin;

    // Role-based campus restrictions
    if (isEmployee) {
      // Employees only see active hubs for their campus
      query.status = "active";
      if (session.user.campusId) {
        query.campusId = new RegExp(`^${session.user.campusId}$`, "i");
      }
    } else if (isCampusAdmin) {
      // Campus Admins only manage hubs for their campus
      if (session.user.campusId) {
        query.campusId = new RegExp(`^${session.user.campusId}$`, "i");
      }
      if (filterStatus && filterStatus !== "all") {
        query.status = filterStatus;
      }
    } else if (isSuperAdmin) {
      // Super Admin can filter by campus if provided
      if (filterCampus && filterCampus !== "all") {
        query.campusId = new RegExp(`^${filterCampus}$`, "i");
      }
      if (filterStatus && filterStatus !== "all") {
        query.status = filterStatus;
      }
    }

    // Search query filter
    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { name: { $regex: s, $options: "i" } },
        { corridor: { $regex: s, $options: "i" } },
        { "origin.name": { $regex: s, $options: "i" } },
        { "destination.name": { $regex: s, $options: "i" } },
        { campusName: { $regex: s, $options: "i" } },
      ];
    }

    const hubs = await Hub.find(query).sort({ createdAt: -1 }).lean();

    // Aggregate active rides and commuter metrics per hub
    const hubIds = hubs.map((h) => h._id);
    const activeRides = await Ride.find({
      hubId: { $in: hubIds },
      status: "scheduled",
    })
      .select("hubId driver acceptedPassengers requests")
      .lean();

    const ridesCountMap: Record<string, number> = {};
    const commutersMap: Record<string, Set<string>> = {};

    activeRides.forEach((ride: any) => {
      const hId = ride.hubId?.toString();
      if (!hId) return;

      ridesCountMap[hId] = (ridesCountMap[hId] || 0) + 1;

      if (!commutersMap[hId]) {
        commutersMap[hId] = new Set();
      }
      if (ride.driver) commutersMap[hId].add(ride.driver.toString());
      (ride.acceptedPassengers || []).forEach((p: any) => {
        commutersMap[hId].add(p.toString());
      });
    });

    const enrichedHubs = hubs.map((hub) => {
      const hId = hub._id.toString();
      return {
        ...hub,
        activeRidesCount: ridesCountMap[hId] || 0,
        commutersCount: commutersMap[hId]?.size || 0,
      };
    });

    return NextResponse.json({
      success: true,
      hubs: enrichedHubs,
    });
  } catch (error: any) {
    console.error("CommuteHub GET Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load hubs." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const isSuperAdmin = session.user.role === "admin";
    const isCampusAdmin = session.user.role === "campus_admin";

    if (!isSuperAdmin && !isCampusAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const body = await req.json();
    const {
      name,
      corridor,
      origin,
      commonPoint,
      intermediatePoints,
      destination,
      status = "active",
    } = body;

    // Determine target campus
    let targetCampusId = body.campusId;
    if (isCampusAdmin) {
      // Force Campus Admin's own campus
      targetCampusId = session.user.campusId;
    }

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Hub name is required (e.g. 'Hub 1')." },
        { status: 400 }
      );
    }

    if (!origin || !origin.name || typeof origin.latitude !== "number" || typeof origin.longitude !== "number") {
      return NextResponse.json(
        { success: false, error: "Valid origin with coordinates is required." },
        { status: 400 }
      );
    }

    if (!destination || !destination.name || typeof destination.latitude !== "number" || typeof destination.longitude !== "number") {
      return NextResponse.json(
        { success: false, error: "Valid destination with coordinates is required." },
        { status: 400 }
      );
    }

    if (
      Math.abs(origin.latitude - destination.latitude) < 0.0001 &&
      Math.abs(origin.longitude - destination.longitude) < 0.0001
    ) {
      return NextResponse.json(
        { success: false, error: "Origin and Destination cannot be the exact same location." },
        { status: 400 }
      );
    }

    if (!targetCampusId) {
      return NextResponse.json(
        { success: false, error: "Campus ID is required." },
        { status: 400 }
      );
    }

    // Resolve campus name
    const campusDoc = await Campus.findOne({
      campusId: new RegExp(`^${targetCampusId.trim()}$`, "i"),
    }).lean();

    const campusName = campusDoc?.name || targetCampusId;

    // Normalize intermediate corridor stops (between Origin and Destination)
    let normalizedIntermediatePoints: Array<{
      name: string;
      address?: string;
      latitude: number;
      longitude: number;
    }> = [];

    if (Array.isArray(intermediatePoints) && intermediatePoints.length > 0) {
      normalizedIntermediatePoints = intermediatePoints
        .filter(
          (p: any) =>
            p &&
            p.name &&
            typeof p.latitude === "number" &&
            typeof p.longitude === "number" &&
            Math.abs(p.latitude) > 0.01 &&
            Math.abs(p.longitude) > 0.01
        )
        .map((p: any) => ({
          name: p.name.trim(),
          address: p.address || p.name,
          latitude: p.latitude,
          longitude: p.longitude,
        }));
    } else if (
      commonPoint &&
      commonPoint.name &&
      typeof commonPoint.latitude === "number" &&
      typeof commonPoint.longitude === "number" &&
      Math.abs(commonPoint.latitude) > 0.01 &&
      Math.abs(commonPoint.longitude) > 0.01
    ) {
      normalizedIntermediatePoints = [
        {
          name: commonPoint.name.trim(),
          address: commonPoint.address || commonPoint.name,
          latitude: commonPoint.latitude,
          longitude: commonPoint.longitude,
        },
      ];
    }

    // Resolve Origin and Destination on authoritative main road / highway coordinates
    const originCoords = resolvePlaceCoordinates(
      origin.name || origin.address,
      origin.latitude,
      origin.longitude,
      true,
      true
    );
    const destCoords = resolvePlaceCoordinates(
      destination.name || destination.address,
      destination.latitude,
      destination.longitude,
      false,
      true
    );

    const mainRoadOrigin = {
      name: origin.name.trim(),
      address: origin.address || origin.name,
      latitude: originCoords.latitude,
      longitude: originCoords.longitude,
    };

    const mainRoadDest = {
      name: destination.name.trim(),
      address: destination.address || destination.name,
      latitude: destCoords.latitude,
      longitude: destCoords.longitude,
    };

    // Calculate direct highway corridor between Origin and Destination
    let baseHighwayRoute: any = null;
    try {
      baseHighwayRoute = await routingService.calculateRoute([
        { latitude: mainRoadOrigin.latitude, longitude: mainRoadOrigin.longitude },
        { latitude: mainRoadDest.latitude, longitude: mainRoadDest.longitude },
      ]);
    } catch (e) {
      console.warn("Base highway calculation failed, will use direct waypoints:", e);
    }

    // Snap each intermediate point directly to the main road highway corridor polyline
    const mainRoadIntermediatePoints = normalizedIntermediatePoints.map((p) => {
      const resolved = resolvePlaceCoordinates(p.name || p.address, p.latitude, p.longitude, false, true);
      let lat = resolved.latitude;
      let lng = resolved.longitude;

      if (baseHighwayRoute?.coordinates && baseHighwayRoute.coordinates.length >= 2) {
        const snapped = snapPointToRoute(lat, lng, baseHighwayRoute.coordinates, 6.0);
        if (!snapped.isTooFar) {
          lat = snapped.snappedLatitude;
          lng = snapped.snappedLongitude;
        }
      }

      return {
        name: p.name.trim(),
        address: p.address || p.name,
        latitude: lat,
        longitude: lng,
      };
    });

    // Calculate route geometry and travel statistics along the main road corridor
    let routeCoordinates: [number, number][] = [];
    let distanceKm = 0;
    let durationMinutes = 0;

    const waypoints = [
      { latitude: mainRoadOrigin.latitude, longitude: mainRoadOrigin.longitude },
      ...mainRoadIntermediatePoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
      { latitude: mainRoadDest.latitude, longitude: mainRoadDest.longitude },
    ];

    try {
      const routeResult = await routingService.calculateRoute(waypoints);

      if (routeResult) {
        routeCoordinates = routeResult.coordinates || [];
        distanceKm = routeResult.distanceKm || 0;
        durationMinutes = routeResult.durationMinutes || 0;
      }
    } catch (routeErr) {
      console.warn("Hub route calculation warning:", routeErr);
      // Fallback straight segments if routing service unavailable
      routeCoordinates = waypoints.map((w) => [w.latitude, w.longitude] as [number, number]);
    }

    // Auto-generate hub ID
    const count = await Hub.countDocuments();
    const formattedHubId = `HUB-${String(count + 1).padStart(3, "0")}`;
    const autoCorridor =
      mainRoadIntermediatePoints.length > 0
        ? `${mainRoadOrigin.name} → ${mainRoadIntermediatePoints.map((p) => p.name).join(" → ")} → ${mainRoadDest.name}`
        : `${mainRoadOrigin.name} → ${mainRoadDest.name}`;
    const corridorLabel = corridor?.trim() || autoCorridor;

    const newHub = await Hub.create({
      hubId: formattedHubId,
      name: name.trim(),
      corridor: corridorLabel,
      origin: mainRoadOrigin,
      commonPoint: mainRoadIntermediatePoints[0] || null,
      intermediatePoints: mainRoadIntermediatePoints,
      destination: mainRoadDest,
      campusId: targetCampusId.toUpperCase().trim(),
      campusName,
      routeCoordinates,
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationMinutes: Math.round(durationMinutes),
      status: status === "inactive" ? "inactive" : "active",
      createdBy: session.user.id,
      createdByName: session.user.name || "Admin",
      createdByRole: isSuperAdmin ? "admin" : "campus_admin",
    });

    return NextResponse.json({
      success: true,
      message: `Hub "${newHub.name}" created successfully.`,
      hub: newHub,
    });
  } catch (error: any) {
    console.error("CommuteHub POST Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to create hub." },
      { status: 500 }
    );
  }
}
