import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import User from "@/models/User";
import Vehicle from "@/models/Vehicle";
import EmployeeActivity, { ActivityType } from "@/models/EmployeeActivity";

export interface CommuteSummary {
  totalRides: number;
  ridesAsDriver: number;
  ridesAsPassenger: number;
  completed: number;
  cancelled: number;
  totalDistanceKm: number;
  averageRideDistanceKm: number | null;
  mostFrequentOrigin: string | null;
  mostFrequentDestination: string | null;
  typicalDepartureTime: string | null;
  lastCommuteActivity: string | null;
}

export interface CommutePattern {
  hasSufficientData: boolean;
  message?: string;
  primaryRoute?: string;
  typicalDeparture?: string;
  typicalArrival?: string;
  averageWeeklyRides?: number;
  mostFrequentStop?: string;
  mostFrequentDays?: string;
  averageDistance?: string;
}

export interface RouteHistoryItem {
  origin: string;
  stops: string[];
  destination: string;
  trips: number;
  averageDistanceKm: number;
  averageDeparture: string;
  lastUsed: string;
}

export interface VehicleHistoryItem {
  _id: string;
  vehicleModel: string;
  vehicleType: string;
  registrationNumber: string;
  seatingCapacity: number;
  fuelType?: string;
  status: string;
  verificationStatus: string;
  addedDate: string;
  lastUsed: string | null;
  ridesCount: number;
}

export interface FormattedRideItem {
  id: string;
  rideCode: string;
  date: string;
  departureTime: string;
  role: "Driver" | "Passenger";
  from: string;
  to: string;
  stops: string[];
  stopsText: string;
  distanceKm: number;
  durationMinutes: number;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  vehicleModel: string;
  vehicleRegistration: string;
  vehicleType: string;
  seatsOffered: number;
  passengersCount: number;
  driverName?: string;
  driverId?: string;
  cancellation?: {
    cancelledBy?: string;
    cancelledByRole?: string;
    cancelledAt?: string;
    reason?: string;
    previousStatus?: string;
  } | null;
  startLocation?: { address: string; latitude: number; longitude: number };
  endLocation?: { address: string; latitude: number; longitude: number };
  stopsList: { name: string; address?: string; latitude?: number; longitude?: number; price: number }[];
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface FormattedActivityItem {
  id: string;
  activityType: ActivityType;
  entityType: string;
  entityId: string;
  description: string;
  metadata: Record<string, any>;
  timestamp: string;
  formattedTime: string;
  formattedDate: string;
  badgeColor: "emerald" | "rose" | "blue" | "amber" | "purple";
  iconName: string;
}

export interface EmployeeHistoryFilters {
  dateFrom?: string;
  dateTo?: string;
  role?: "all" | "driver" | "passenger";
  status?: "all" | "completed" | "cancelled" | "upcoming" | "ongoing";
  activityType?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Format raw HH:mm string or parse into minutes since midnight
 */
function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[3]?.toUpperCase();

  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function formatMinutesToTimeString(totalMinutes: number): string {
  let hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.floor(totalMinutes % 60);
  const period = hours >= 12 ? "PM" : "AM";
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export async function getEmployeeCompleteHistory(
  employeeId: string,
  filters: EmployeeHistoryFilters = {}
) {
  await connectToDatabase();

  const user = await User.findById(employeeId).select("-passwordHash").lean();
  if (!user) {
    throw new Error("Employee not found");
  }

  const userIdObj = new mongoose.Types.ObjectId(employeeId);

  // 1. Fetch All CommuteX Rides involving this employee
  const rides = await Ride.find({
    $or: [
      { driver: userIdObj },
      { "requests.passenger": userIdObj },
      { acceptedPassengers: userIdObj },
    ],
  })
    .populate("driver", "name email employeeId companyName department profileImage")
    .populate("vehicle", "vehicleModel vehicleType registrationNumber vehiclePhoto seatingCapacity")
    .populate("requests.passenger", "name email employeeId department profileImage")
    .sort({ departureDate: -1, createdAt: -1 })
    .lean();

  // 2. Fetch All Vehicles owned by this employee
  const vehicles = await Vehicle.find({ owner: userIdObj }).sort({ createdAt: -1 }).lean();

  // 3. Process & categorize all rides
  const allFormattedRides: FormattedRideItem[] = [];
  const driverRides: FormattedRideItem[] = [];
  const passengerRides: FormattedRideItem[] = [];

  let completedRidesCount = 0;
  let cancelledRidesCount = 0;
  let totalDistanceKm = 0;
  const originCounts: Record<string, number> = {};
  const destinationCounts: Record<string, number> = {};
  const departureTimesMinutes: number[] = [];
  const routeGroups: Record<string, {
    origin: string;
    stops: string[];
    destination: string;
    count: number;
    totalDistance: number;
    departureMinutes: number[];
    lastUsedDate: string;
  }> = {};

  const vehicleRideCounts: Record<string, { count: number; lastUsed: string }> = {};

  rides.forEach((r: any) => {
    const isDriver = r.driver?._id?.toString() === employeeId || r.driver?.toString() === employeeId;
    const isPassenger = (r.requests || []).some(
      (req: any) =>
        (req.passenger?._id?.toString() === employeeId || req.passenger?.toString() === employeeId) &&
        req.status !== "rejected"
    );

    if (!isDriver && !isPassenger) return;

    // Determine role in this ride
    const role: "Driver" | "Passenger" = isDriver ? "Driver" : "Passenger";

    // Effective vehicle resolution (immutability check: snapshot takes precedence over current vehicle)
    const vehicleModel =
      r.vehicleSnapshot?.vehicleModel ||
      r.vehicle?.vehicleModel ||
      (isDriver ? "Registered Vehicle" : "Driver's Vehicle");
    const vehicleReg =
      r.vehicleSnapshot?.registrationNumber ||
      r.vehicle?.registrationNumber ||
      "";
    const vehicleType =
      r.vehicleSnapshot?.vehicleType ||
      r.vehicle?.vehicleType ||
      r.vehicleType ||
      "Car";

    // Track vehicle usage for employee's own vehicles
    if (isDriver && r.vehicle) {
      const vId = r.vehicle._id ? r.vehicle._id.toString() : r.vehicle.toString();
      if (!vehicleRideCounts[vId]) {
        vehicleRideCounts[vId] = { count: 0, lastUsed: r.departureDate };
      }
      vehicleRideCounts[vId].count += 1;
      if (r.departureDate > vehicleRideCounts[vId].lastUsed) {
        vehicleRideCounts[vId].lastUsed = r.departureDate;
      }
    }

    const stopsNames = (r.stops || []).map((s: any) => s.name?.trim()).filter(Boolean);
    const stopsText = stopsNames.length > 0 ? stopsNames.join(", ") : "Direct (No Stops)";

    // Determine passenger request status if employee is passenger
    let effectiveStatus = r.status;
    let myPassengerReq: any = null;
    if (!isDriver && isPassenger) {
      myPassengerReq = (r.requests || []).find(
        (req: any) =>
          req.passenger?._id?.toString() === employeeId || req.passenger?.toString() === employeeId
      );
      if (myPassengerReq && myPassengerReq.status === "cancelled") {
        effectiveStatus = "cancelled";
      }
    }

    const dist = Number(r.distanceKm) || 0;
    const dur = Number(r.durationMinutes) || 0;

    if (effectiveStatus === "completed") {
      completedRidesCount++;
      totalDistanceKm += dist;
    } else if (effectiveStatus === "cancelled") {
      cancelledRidesCount++;
    }

    // Accumulate Origin & Destination counts
    const originClean = (r.startingLocation || "").trim();
    const destClean = (r.destination || "").trim();
    if (originClean) originCounts[originClean] = (originCounts[originClean] || 0) + 1;
    if (destClean) destinationCounts[destClean] = (destinationCounts[destClean] || 0) + 1;

    // Track departure times
    const mins = parseTimeToMinutes(r.departureTime);
    if (mins !== null) {
      departureTimesMinutes.push(mins);
    }

    // Accumulate Route History
    const routeKey = `${originClean} -> ${stopsNames.join(" -> ")} -> ${destClean}`;
    if (!routeGroups[routeKey]) {
      routeGroups[routeKey] = {
        origin: originClean,
        stops: stopsNames,
        destination: destClean,
        count: 0,
        totalDistance: 0,
        departureMinutes: [],
        lastUsedDate: r.departureDate || "",
      };
    }
    routeGroups[routeKey].count += 1;
    routeGroups[routeKey].totalDistance += dist;
    if (mins !== null) routeGroups[routeKey].departureMinutes.push(mins);
    if (r.departureDate > routeGroups[routeKey].lastUsedDate) {
      routeGroups[routeKey].lastUsedDate = r.departureDate;
    }

    const acceptedCount = (r.requests || []).filter((req: any) => req.status === "accepted" || req.isBoarded).length;

    const rideItem: FormattedRideItem = {
      id: r._id.toString(),
      rideCode: `RIDE-${r._id.toString().slice(-6).toUpperCase()}`,
      date: r.departureDate || "",
      departureTime: r.departureTime || "",
      role,
      from: originClean,
      to: destClean,
      stops: stopsNames,
      stopsText,
      distanceKm: dist,
      durationMinutes: dur,
      status: effectiveStatus,
      vehicleModel,
      vehicleRegistration: vehicleReg,
      vehicleType,
      seatsOffered: r.totalSeats || 0,
      passengersCount: acceptedCount,
      driverName: r.driver?.name || "Corporate Driver",
      driverId: r.driver?._id?.toString() || r.driver?.toString(),
      cancellation: r.cancellation
        ? {
            cancelledBy: r.cancellation.cancelledBy?.toString(),
            cancelledByRole: r.cancellation.cancelledByRole,
            cancelledAt: r.cancellation.cancelledAt ? new Date(r.cancellation.cancelledAt).toISOString() : undefined,
            reason: r.cancellation.reason,
            previousStatus: r.cancellation.previousStatus,
          }
        : null,
      startLocation: r.startLocation || { address: originClean, latitude: 0, longitude: 0 },
      endLocation: r.endLocation || { address: destClean, latitude: 0, longitude: 0 },
      stopsList: (r.stops || []).map((s: any) => ({
        name: s.name,
        address: s.address || s.name,
        latitude: s.latitude || 0,
        longitude: s.longitude || 0,
        price: s.price || 0,
      })),
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "",
      startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : null,
      completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
    };

    allFormattedRides.push(rideItem);
    if (role === "Driver") {
      driverRides.push(rideItem);
    } else {
      passengerRides.push(rideItem);
    }
  });

  // Calculate Most Frequent Origin & Destination
  const topOrigin = Object.entries(originCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const topDestination = Object.entries(destinationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Calculate Typical Departure Time Window (e.g. 8:15–8:30 AM)
  let typicalDepartureWindow: string | null = null;
  if (departureTimesMinutes.length >= 2) {
    const sortedMins = [...departureTimesMinutes].sort((a, b) => a - b);
    const medianMin = sortedMins[Math.floor(sortedMins.length / 2)];
    const lowerBound = Math.floor(medianMin / 15) * 15;
    const upperBound = lowerBound + 15;
    typicalDepartureWindow = `${formatMinutesToTimeString(lowerBound)}–${formatMinutesToTimeString(upperBound)}`;
  }

  // Calculate Commute Summary
  const summary: CommuteSummary = {
    totalRides: allFormattedRides.length,
    ridesAsDriver: driverRides.length,
    ridesAsPassenger: passengerRides.length,
    completed: completedRidesCount,
    cancelled: cancelledRidesCount,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    averageRideDistanceKm: completedRidesCount > 0 ? Math.round((totalDistanceKm / completedRidesCount) * 10) / 10 : null,
    mostFrequentOrigin: topOrigin,
    mostFrequentDestination: topDestination,
    typicalDepartureTime: typicalDepartureWindow,
    lastCommuteActivity: allFormattedRides[0]?.date || null,
  };

  // Calculate Commute Route History
  const routeHistory: RouteHistoryItem[] = Object.values(routeGroups)
    .map((g) => {
      const avgMins =
        g.departureMinutes.length > 0
          ? Math.round(g.departureMinutes.reduce((a, b) => a + b, 0) / g.departureMinutes.length)
          : 510; // default 8:30 AM
      return {
        origin: g.origin,
        stops: g.stops,
        destination: g.destination,
        trips: g.count,
        averageDistanceKm: Math.round((g.totalDistance / g.count) * 10) / 10,
        averageDeparture: formatMinutesToTimeString(avgMins),
        lastUsed: g.lastUsedDate,
      };
    })
    .sort((a, b) => b.trips - a.trips);

  // Calculate Commute Pattern (Requires at least 3 historical rides)
  let pattern: CommutePattern;
  if (allFormattedRides.length >= 3 && topOrigin && topDestination) {
    const allStops = allFormattedRides.flatMap((r) => r.stops);
    const stopFreq: Record<string, number> = {};
    allStops.forEach((s) => (stopFreq[s] = (stopFreq[s] || 0) + 1));
    const topStop = Object.entries(stopFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "Direct corridor";

    // Estimate arrival time
    const avgDuration =
      allFormattedRides.reduce((sum, r) => sum + (r.durationMinutes || 35), 0) / allFormattedRides.length;
    let typicalArrivalWindow = "9:00–9:15 AM";
    if (departureTimesMinutes.length >= 2) {
      const sortedMins = [...departureTimesMinutes].sort((a, b) => a - b);
      const medianArrival = sortedMins[Math.floor(sortedMins.length / 2)] + avgDuration;
      const arrLower = Math.floor(medianArrival / 15) * 15;
      const arrUpper = arrLower + 15;
      typicalArrivalWindow = `${formatMinutesToTimeString(arrLower)}–${formatMinutesToTimeString(arrUpper)}`;
    }

    // Weekly rides estimate
    const uniqueDates = new Set(allFormattedRides.map((r) => r.date));
    const estimatedWeekly = Math.max(1, Math.min(Math.round(uniqueDates.size / 2) || 3, 7));

    pattern = {
      hasSufficientData: true,
      primaryRoute: `${topOrigin} → ${topDestination}`,
      typicalDeparture: typicalDepartureWindow || "8:15–8:30 AM",
      typicalArrival: typicalArrivalWindow,
      averageWeeklyRides: estimatedWeekly,
      mostFrequentStop: topStop,
      mostFrequentDays: "Monday to Friday",
      averageDistance: `${summary.averageRideDistanceKm || 18.2} km`,
    };
  } else {
    pattern = {
      hasSufficientData: false,
      message: "Insufficient historical data to determine a reliable pattern.",
    };
  }

  // Format Vehicles History
  const vehicleHistory: VehicleHistoryItem[] = vehicles.map((v: any) => {
    const vId = v._id.toString();
    const stats = vehicleRideCounts[vId] || { count: 0, lastUsed: null };
    return {
      _id: vId,
      vehicleModel: v.vehicleModel,
      vehicleType: v.vehicleType,
      registrationNumber: v.registrationNumber,
      seatingCapacity: v.seatingCapacity,
      fuelType: v.fuelType || "Petrol",
      status: v.status,
      verificationStatus: v.verificationStatus,
      addedDate: v.createdAt ? new Date(v.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
      lastUsed: stats.lastUsed ? stats.lastUsed : (stats.count > 0 ? "Recent" : "Never Used"),
      ridesCount: stats.count,
    };
  });

  // 4. Fetch Structured Activity Timeline
  const dbActivities = await EmployeeActivity.find({ employee: userIdObj })
    .sort({ timestamp: -1 })
    .limit(200)
    .lean();

  const formattedActivities: FormattedActivityItem[] = dbActivities.map((act: any) => {
    const ts = act.timestamp ? new Date(act.timestamp) : new Date();
    let badgeColor: "emerald" | "rose" | "blue" | "amber" | "purple" = "emerald";
    let iconName = "CheckCircle2";

    if (act.activityType.includes("CANCELLED") || act.activityType.includes("REMOVED") || act.activityType.includes("LEFT")) {
      badgeColor = "rose";
      iconName = "XCircle";
    } else if (act.activityType.includes("UPDATED")) {
      badgeColor = "blue";
      iconName = "RefreshCw";
    } else if (act.activityType.includes("STARTED")) {
      badgeColor = "purple";
      iconName = "Play";
    }

    return {
      id: act._id.toString(),
      activityType: act.activityType,
      entityType: act.entityType,
      entityId: act.entityId,
      description: act.description,
      metadata: act.metadata || {},
      timestamp: ts.toISOString(),
      formattedTime: ts.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      formattedDate: ts.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      badgeColor,
      iconName,
    };
  });

  // Synthesize timeline if few activities exist (guarantees historical completeness for past rides)
  if (formattedActivities.length < allFormattedRides.length) {
    allFormattedRides.forEach((ride) => {
      const alreadyHas = formattedActivities.some((a) => a.entityId === ride.id);
      if (!alreadyHas) {
        const rideDate = new Date(ride.createdAt || ride.date);
        formattedActivities.push({
          id: `syn-${ride.id}-created`,
          activityType: "RIDE_CREATED",
          entityType: "RIDE",
          entityId: ride.id,
          description: `${ride.role === "Driver" ? "Offered" : "Booked"} ride from ${ride.from} to ${ride.to}`,
          metadata: {
            origin: ride.from,
            destination: ride.to,
            role: ride.role,
            status: ride.status,
            rideCode: ride.rideCode,
          },
          timestamp: rideDate.toISOString(),
          formattedTime: ride.departureTime || "08:15 AM",
          formattedDate: ride.date || "Past Ride",
          badgeColor: "emerald",
          iconName: "CheckCircle2",
        });

        if (ride.status === "completed") {
          formattedActivities.push({
            id: `syn-${ride.id}-completed`,
            activityType: "RIDE_COMPLETED",
            entityType: "RIDE",
            entityId: ride.id,
            description: `Ride ${ride.rideCode} completed successfully`,
            metadata: {
              origin: ride.from,
              destination: ride.to,
              status: "completed",
              rideCode: ride.rideCode,
            },
            timestamp: new Date(rideDate.getTime() + 45 * 60000).toISOString(),
            formattedTime: "09:00 AM",
            formattedDate: ride.date || "Past Ride",
            badgeColor: "emerald",
            iconName: "CheckCircle2",
          });
        } else if (ride.status === "cancelled") {
          formattedActivities.push({
            id: `syn-${ride.id}-cancelled`,
            activityType: "RIDE_CANCELLED",
            entityType: "RIDE",
            entityId: ride.id,
            description: `Ride ${ride.rideCode} cancelled`,
            metadata: {
              origin: ride.from,
              destination: ride.to,
              status: "cancelled",
              rideCode: ride.rideCode,
            },
            timestamp: rideDate.toISOString(),
            formattedTime: ride.departureTime || "08:15 AM",
            formattedDate: ride.date || "Past Ride",
            badgeColor: "rose",
            iconName: "XCircle",
          });
        }
      }
    });

    // Re-sort chronological newest first
    formattedActivities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // 5. Apply filters to rides and activities
  let filteredRides = [...allFormattedRides];

  if (filters.role && filters.role !== "all") {
    filteredRides = filteredRides.filter((r) => r.role.toLowerCase() === filters.role?.toLowerCase());
  }

  if (filters.status && filters.status !== "all") {
    if (filters.status === "completed") {
      filteredRides = filteredRides.filter((r) => r.status === "completed");
    } else if (filters.status === "cancelled") {
      filteredRides = filteredRides.filter((r) => r.status === "cancelled");
    } else if (filters.status === "upcoming") {
      filteredRides = filteredRides.filter((r) => r.status === "scheduled");
    } else if (filters.status === "ongoing") {
      filteredRides = filteredRides.filter((r) => r.status === "in_progress");
    }
  }

  if (filters.dateFrom) {
    filteredRides = filteredRides.filter((r) => r.date >= (filters.dateFrom as string));
  }
  if (filters.dateTo) {
    filteredRides = filteredRides.filter((r) => r.date <= (filters.dateTo as string));
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    filteredRides = filteredRides.filter(
      (r) =>
        r.rideCode.toLowerCase().includes(q) ||
        r.from.toLowerCase().includes(q) ||
        r.to.toLowerCase().includes(q) ||
        r.vehicleModel.toLowerCase().includes(q)
    );
  }

  // Activity filter
  let filteredActivities = [...formattedActivities];
  if (filters.activityType && filters.activityType !== "all") {
    filteredActivities = filteredActivities.filter((a) => a.activityType === filters.activityType);
  }
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    filteredActivities = filteredActivities.filter(
      (a) =>
        a.description.toLowerCase().includes(q) ||
        a.entityId.toLowerCase().includes(q) ||
        (a.metadata?.rideCode && a.metadata.rideCode.toLowerCase().includes(q))
    );
  }

  // Pagination for rides
  const page = Math.max(1, filters.page || 1);
  const limit = Math.max(5, filters.limit || 20);
  const totalRidesCount = filteredRides.length;
  const paginatedRides = filteredRides.slice((page - 1) * limit, page * limit);

  return {
    employee: {
      _id: user._id.toString(),
      name: user.name,
      employeeId: user.employeeId,
      email: user.email,
      phone: user.phone || "—",
      campusId: user.campusId || "CAMP001",
      campusName: user.campusName || "Tech Park Chennai",
      department: user.department || "General",
      role: user.role,
      verificationStatus: user.verificationStatus || (user.isApproved ? "approved" : "pending"),
      isApproved: Boolean(user.isApproved),
      profileImage: user.profileImage || "",
      homeLocation: user.homeLocation || "",
      createdAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
    },
    summary,
    pattern,
    routeHistory,
    vehicleHistory,
    driverRides,
    passengerRides,
    rides: paginatedRides,
    pagination: {
      total: totalRidesCount,
      page,
      limit,
      totalPages: Math.ceil(totalRidesCount / limit) || 1,
    },
    activities: filteredActivities.slice(0, 100),
  };
}
