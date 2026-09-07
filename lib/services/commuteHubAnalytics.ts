import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import Campus from "@/models/Campus";
import User from "@/models/User";

export interface ICommuteHubOverview {
  totalCarpoolsAnalyzed: number;
  scheduledActiveRides: number;
  completedRides: number;
  totalCommuters: number;
  totalDrivers: number;
  totalPassengers: number;
  avgOccupancyRate: number; // percentage, e.g. 74
  totalPassengerDistanceKm: number;
  totalFareGenerated: number;
  estimatedCo2SavedKg: number;
  estimatedCostSavedInr: number;
  activeCorridorsCount: number;
  topCorridorName: string;
}

export interface ICorridorMetric {
  id: string;
  name: string;
  description: string;
  totalRides: number;
  scheduledRides: number;
  completedRides: number;
  totalSeatsOffered: number;
  totalSeatsBooked: number;
  occupancyRate: number; // percentage
  uniqueDrivers: number;
  uniquePassengers: number;
  totalFare: number;
  avgDistanceKm: number;
  avgDurationMins: number;
  frequentStops: { name: string; count: number; avgPrice: number }[];
  status: "high_demand" | "balanced" | "underserved";
}

export interface IPatternMetric {
  rushHourDistribution: {
    hour: string; // "07:00", "08:00", etc.
    pickupRides: number;
    dropRides: number;
    totalRides: number;
    passengers: number;
  }[];
  dayOfWeekDistribution: {
    day: string; // "Monday", "Tuesday", etc.
    ridesCount: number;
    occupancyRate: number;
  }[];
  directionalSplit: {
    pickupCount: number;
    dropCount: number;
    pickupPercent: number;
    dropPercent: number;
  };
  peakMorningWindow: string;
  peakEveningWindow: string;
}

export interface IDemandMetric {
  topBoardingStops: {
    stopName: string;
    totalRequests: number;
    confirmedPassengers: number;
    rejectedOrPending: number;
    corridorName: string;
  }[];
  unmetDemandSpots: {
    location: string;
    unmetRequestsCount: number;
    deficitSeverity: "critical" | "moderate" | "low";
    suggestedAction: string;
  }[];
  fullyBookedRidesCount: number;
  totalRejectedRequests: number;
}

export interface ISmartRecommendation {
  id: string;
  type: "supply_incentive" | "stop_optimization" | "timing_shift" | "shuttle_candidate";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  impactMetric: string;
  suggestedAction: string;
  corridorOrArea: string;
}

// Helper to determine natural corridor from locations
function detectCorridorName(origin: string, destination: string, stops: string[]): string {
  const combined = `${origin} ${destination} ${stops.join(" ")}`.toLowerCase();

  if (combined.includes("omr") || combined.includes("sholinganallur") || combined.includes("siruseri") || combined.includes("navallur") || combined.includes("kelambakkam") || combined.includes("perungudi") || combined.includes("thoraipakkam")) {
    return "OMR IT Express Corridor";
  }
  if (combined.includes("gst") || combined.includes("tambaram") || combined.includes("chromepet") || combined.includes("pallavaram") || combined.includes("guindy") || combined.includes("airport")) {
    return "GST Road Arterial Corridor";
  }
  if (combined.includes("porur") || combined.includes("poonamallee") || combined.includes("iyyappanthangal") || combined.includes("mount-poonamallee") || combined.includes("karayanchavadi")) {
    return "Mount-Poonamallee West Corridor";
  }
  if (combined.includes("ecr") || combined.includes("thiruvanmiyur") || combined.includes("kottivakkam") || combined.includes("palavakkam") || combined.includes("neelankarai") || combined.includes("injambakkam")) {
    return "ECR Coastal Commute Corridor";
  }
  if (combined.includes("adyar") || combined.includes("velachery") || combined.includes("saidapet") || combined.includes("little mount") || combined.includes("anna nagar") || combined.includes("central")) {
    return "Central Metro Link Corridor";
  }
  
  // Dynamic fallback based on non-campus keyword
  const nonCampus = origin.toLowerCase().includes("tech park") || origin.toLowerCase().includes("campus") ? destination : origin;
  const cleanName = nonCampus.split(",")[0].trim();
  return cleanName ? `${cleanName} Express Corridor` : "Regional Campus Commute Corridor";
}

// 1. OVERVIEW ANALYTICS
export async function getCommuteHubOverview(campusId?: string): Promise<ICommuteHubOverview> {
  await connectToDatabase();

  const query: Record<string, any> = {};
  if (campusId && campusId !== "all") {
    query.campusId = new RegExp(`^${campusId}$`, "i");
  }

  const rides = await Ride.find(query).lean();

  const totalCarpoolsAnalyzed = rides.length;
  const scheduledActiveRides = rides.filter((r) => r.status === "scheduled" || r.status === "in_progress").length;
  const completedRides = rides.filter((r) => r.status === "completed").length;

  const driverSet = new Set<string>();
  const passengerSet = new Set<string>();

  let totalSeatsOffered = 0;
  let totalSeatsBooked = 0;
  let totalFareGenerated = 0;
  let totalDistanceKm = 0;

  const corridorCountMap: Record<string, number> = {};

  for (const r of rides) {
    if (r.driver) driverSet.add(r.driver.toString());

    const bookedInRide = (r.requests || []).filter((req: any) => req.status === "accepted");
    for (const p of bookedInRide) {
      if (p.passenger) passengerSet.add(p.passenger.toString());
    }

    const seatsOffered = r.totalSeats || 3;
    const seatsBooked = Math.max(0, seatsOffered - (r.availableSeats !== undefined ? r.availableSeats : 0));
    totalSeatsOffered += seatsOffered;
    totalSeatsBooked += seatsBooked;

    const fareSumRide = bookedInRide.reduce((sum: number, req: any) => sum + (req.fare || 0), 0);
    totalFareGenerated += fareSumRide;
    totalDistanceKm += (r.distanceKm || 15) * Math.max(1, seatsBooked);

    const corridor = detectCorridorName(
      r.startingLocation || "",
      r.destination || "",
      (r.stops || []).map((s: any) => s.name || "")
    );
    corridorCountMap[corridor] = (corridorCountMap[corridor] || 0) + 1;
  }

  const totalDrivers = driverSet.size;
  const totalPassengers = passengerSet.size;
  const totalCommuters = new Set([...Array.from(driverSet), ...Array.from(passengerSet)]).size;

  const avgOccupancyRate = totalSeatsOffered > 0 ? Math.min(100, Math.round((totalSeatsBooked / totalSeatsOffered) * 100)) : 0;

  // Environmental and Financial savings derived from CommuteX real passenger distance
  // ~0.16 kg CO2 saved per passenger-km compared to single-occupancy driving
  const estimatedCo2SavedKg = Math.round(totalDistanceKm * 0.16);
  // ~₹8 saved per passenger-km compared to private solo travel
  const estimatedCostSavedInr = Math.round(totalDistanceKm * 8);

  const corridorEntries = Object.entries(corridorCountMap);
  const activeCorridorsCount = corridorEntries.length;
  const topCorridorEntry = corridorEntries.sort((a, b) => b[1] - a[1])[0];
  const topCorridorName = topCorridorEntry ? topCorridorEntry[0] : "Primary Campus Arterial";

  return {
    totalCarpoolsAnalyzed,
    scheduledActiveRides,
    completedRides,
    totalCommuters,
    totalDrivers,
    totalPassengers,
    avgOccupancyRate,
    totalPassengerDistanceKm: Math.round(totalDistanceKm),
    totalFareGenerated,
    estimatedCo2SavedKg,
    estimatedCostSavedInr,
    activeCorridorsCount,
    topCorridorName,
  };
}

// 2. CORRIDOR INTELLIGENCE
export async function getCorridorIntelligence(campusId?: string): Promise<ICorridorMetric[]> {
  await connectToDatabase();

  const query: Record<string, any> = {};
  if (campusId && campusId !== "all") {
    query.campusId = new RegExp(`^${campusId}$`, "i");
  }

  const rides = await Ride.find(query).lean();

  const corridorBuckets: Record<string, {
    name: string;
    rides: any[];
    drivers: Set<string>;
    passengers: Set<string>;
    stopsMap: Record<string, { count: number; prices: number[] }>;
  }> = {};

  for (const r of rides) {
    const stopNames = (r.stops || []).map((s: any) => s.name || "");
    const cName = detectCorridorName(r.startingLocation || "", r.destination || "", stopNames);

    if (!corridorBuckets[cName]) {
      corridorBuckets[cName] = {
        name: cName,
        rides: [],
        drivers: new Set<string>(),
        passengers: new Set<string>(),
        stopsMap: {},
      };
    }

    const bucket = corridorBuckets[cName];
    bucket.rides.push(r);
    if (r.driver) bucket.drivers.add(r.driver.toString());

    for (const req of (r.requests || [])) {
      if (req.status === "accepted" && req.passenger) {
        bucket.passengers.add(req.passenger.toString());
      }
    }

    for (const st of (r.stops || [])) {
      const sName = (st.name || "").trim();
      if (!sName) continue;
      if (!bucket.stopsMap[sName]) {
        bucket.stopsMap[sName] = { count: 0, prices: [] };
      }
      bucket.stopsMap[sName].count += 1;
      if (st.price) bucket.stopsMap[sName].prices.push(st.price);
    }
  }

  const results: ICorridorMetric[] = [];

  for (const [key, bucket] of Object.entries(corridorBuckets)) {
    const totalRides = bucket.rides.length;
    const scheduledRides = bucket.rides.filter((r) => r.status === "scheduled" || r.status === "in_progress").length;
    const completedRides = bucket.rides.filter((r) => r.status === "completed").length;

    let seatsOffered = 0;
    let seatsBooked = 0;
    let fareSum = 0;
    let distanceSum = 0;
    let durationSum = 0;

    for (const r of bucket.rides) {
      const so = r.totalSeats || 3;
      const sb = Math.max(0, so - (r.availableSeats !== undefined ? r.availableSeats : 0));
      seatsOffered += so;
      seatsBooked += sb;
      const fareInRide = (r.requests || [])
        .filter((q: any) => q.status === "accepted")
        .reduce((sum: number, req: any) => sum + (req.fare || 0), 0);
      fareSum += fareInRide;
      distanceSum += r.distanceKm || 18;
      durationSum += r.durationMinutes || 25;
    }

    const occupancyRate = seatsOffered > 0 ? Math.min(100, Math.round((seatsBooked / seatsOffered) * 100)) : 0;

    const frequentStops = Object.entries(bucket.stopsMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgPrice: data.prices.length > 0 ? Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length) : 50,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    let status: "high_demand" | "balanced" | "underserved" = "balanced";
    if (occupancyRate >= 75) status = "high_demand";
    else if (occupancyRate < 35 && totalRides > 2) status = "underserved";

    results.push({
      id: key.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: bucket.name,
      description: `High-frequency commuter trajectory connecting campus with key residential and commercial clusters.`,
      totalRides,
      scheduledRides,
      completedRides,
      totalSeatsOffered: seatsOffered,
      totalSeatsBooked: seatsBooked,
      occupancyRate,
      uniqueDrivers: bucket.drivers.size,
      uniquePassengers: bucket.passengers.size,
      totalFare: fareSum,
      avgDistanceKm: totalRides > 0 ? Number((distanceSum / totalRides).toFixed(1)) : 0,
      avgDurationMins: totalRides > 0 ? Math.round(durationSum / totalRides) : 0,
      frequentStops,
      status,
    });
  }

  // Sort by volume
  return results.sort((a, b) => b.totalRides - a.totalRides);
}

// 3. COMMUTE PATTERNS (Temporal & Spatial)
export async function getCommutePatterns(campusId?: string): Promise<IPatternMetric> {
  await connectToDatabase();

  const query: Record<string, any> = {};
  if (campusId && campusId !== "all") {
    query.campusId = new RegExp(`^${campusId}$`, "i");
  }

  const rides = await Ride.find(query).lean();

  const hoursList = ["06:00", "07:00", "08:00", "09:00", "10:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
  const hourMap: Record<string, { pickup: number; drop: number; passengers: number }> = {};
  hoursList.forEach((h) => {
    hourMap[h] = { pickup: 0, drop: 0, passengers: 0 };
  });

  const daysList = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const dayMap: Record<string, { rides: number; seatsOffered: number; seatsBooked: number }> = {};
  daysList.forEach((d) => {
    dayMap[d] = { rides: 0, seatsOffered: 0, seatsBooked: 0 };
  });

  let pickupCount = 0;
  let dropCount = 0;

  for (const r of rides) {
    const isPickup = r.rideType !== "drop";
    if (isPickup) pickupCount++;
    else dropCount++;

    // Hour
    const timeStr = r.departureTime || "08:00";
    const hourPart = timeStr.split(":")[0];
    const normalizedHour = `${hourPart.padStart(2, "0")}:00`;
    
    if (hourMap[normalizedHour]) {
      if (isPickup) hourMap[normalizedHour].pickup += 1;
      else hourMap[normalizedHour].drop += 1;

      const confirmedPax = (r.requests || []).filter((q: any) => q.status === "accepted").length;
      hourMap[normalizedHour].passengers += confirmedPax;
    }

    // Day of week from departureDate (YYYY-MM-DD)
    if (r.departureDate) {
      try {
        const d = new Date(r.departureDate);
        if (!isNaN(d.getTime())) {
          const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
          if (dayMap[dayName]) {
            dayMap[dayName].rides += 1;
            dayMap[dayName].seatsOffered += r.totalSeats || 3;
            dayMap[dayName].seatsBooked += (r.requests || []).filter((q: any) => q.status === "accepted").length;
          }
        }
      } catch (e) {
        // ignore date parse error
      }
    }
  }

  const rushHourDistribution = hoursList.map((h) => ({
    hour: h,
    pickupRides: hourMap[h].pickup,
    dropRides: hourMap[h].drop,
    totalRides: hourMap[h].pickup + hourMap[h].drop,
    passengers: hourMap[h].passengers,
  }));

  const dayOfWeekDistribution = daysList.map((day) => {
    const d = dayMap[day];
    const occ = d.seatsOffered > 0 ? Math.min(100, Math.round((d.seatsBooked / d.seatsOffered) * 100)) : 0;
    return {
      day,
      ridesCount: d.rides,
      occupancyRate: occ,
    };
  });

  const totalRides = Math.max(1, pickupCount + dropCount);
  const pickupPercent = Math.round((pickupCount / totalRides) * 100);
  const dropPercent = Math.round((dropCount / totalRides) * 100);

  // Peak windows
  const morningPeaks = rushHourDistribution.filter((h) => parseInt(h.hour) <= 12).sort((a, b) => b.totalRides - a.totalRides);
  const eveningPeaks = rushHourDistribution.filter((h) => parseInt(h.hour) > 12).sort((a, b) => b.totalRides - a.totalRides);

  return {
    rushHourDistribution,
    dayOfWeekDistribution,
    directionalSplit: {
      pickupCount,
      dropCount,
      pickupPercent,
      dropPercent,
    },
    peakMorningWindow: morningPeaks[0]?.totalRides > 0 ? `${morningPeaks[0].hour} – 09:30 AM` : "08:00 – 09:30 AM",
    peakEveningWindow: eveningPeaks[0]?.totalRides > 0 ? `${eveningPeaks[0].hour} – 19:30 PM` : "17:30 – 19:00 PM",
  };
}

// 4. DEMAND & CAPACITY DEFICIT
export async function getDemandAndDeficit(campusId?: string): Promise<IDemandMetric> {
  await connectToDatabase();

  const query: Record<string, any> = {};
  if (campusId && campusId !== "all") {
    query.campusId = new RegExp(`^${campusId}$`, "i");
  }

  const rides = await Ride.find(query).lean();

  const stopDemandMap: Record<string, {
    totalRequests: number;
    confirmedPassengers: number;
    rejectedOrPending: number;
    corridorName: string;
  }> = {};

  let fullyBookedRidesCount = 0;
  let totalRejectedRequests = 0;

  for (const r of rides) {
    if (r.availableSeats === 0 && (r.totalSeats || 0) > 0) {
      fullyBookedRidesCount += 1;
    }

    const corridor = detectCorridorName(
      r.startingLocation || "",
      r.destination || "",
      (r.stops || []).map((s: any) => s.name || "")
    );

    for (const req of (r.requests || [])) {
      const stop = (req.pickupStop || "Direct Origin").trim();
      if (!stopDemandMap[stop]) {
        stopDemandMap[stop] = {
          totalRequests: 0,
          confirmedPassengers: 0,
          rejectedOrPending: 0,
          corridorName: corridor,
        };
      }

      stopDemandMap[stop].totalRequests += 1;
      if (req.status === "accepted") {
        stopDemandMap[stop].confirmedPassengers += 1;
      } else {
        stopDemandMap[stop].rejectedOrPending += 1;
        if (req.status === "rejected") totalRejectedRequests += 1;
      }
    }
  }

  const topBoardingStops = Object.entries(stopDemandMap)
    .map(([stopName, data]) => ({
      stopName,
      totalRequests: data.totalRequests,
      confirmedPassengers: data.confirmedPassengers,
      rejectedOrPending: data.rejectedOrPending,
      corridorName: data.corridorName,
    }))
    .sort((a, b) => b.totalRequests - a.totalRequests)
    .slice(0, 8);

  const unmetDemandSpots = topBoardingStops
    .filter((s) => s.rejectedOrPending > 0 || s.totalRequests >= 3)
    .map((s) => ({
      location: s.stopName,
      unmetRequestsCount: s.rejectedOrPending,
      deficitSeverity: s.rejectedOrPending >= 3 ? ("critical" as const) : s.rejectedOrPending >= 1 ? ("moderate" as const) : ("low" as const),
      suggestedAction: `Incentivize colleague drivers along ${s.corridorName} to add ${s.stopName} as an intermediate boarding point.`,
    }));

  return {
    topBoardingStops,
    unmetDemandSpots,
    fullyBookedRidesCount,
    totalRejectedRequests,
  };
}

// 5. SMART RECOMMENDATIONS FOR ADMINS
export async function getSmartRecommendations(campusId?: string): Promise<ISmartRecommendation[]> {
  const [overview, corridors, patterns, demand] = await Promise.all([
    getCommuteHubOverview(campusId),
    getCorridorIntelligence(campusId),
    getCommutePatterns(campusId),
    getDemandAndDeficit(campusId),
  ]);

  const recommendations: ISmartRecommendation[] = [];

  // 1. High Occupancy Corridors -> Driver Incentives
  const highDemandCorridor = corridors.find((c) => c.occupancyRate >= 70);
  if (highDemandCorridor) {
    recommendations.push({
      id: "rec-supply-1",
      type: "supply_incentive",
      severity: "high",
      title: `Promote Driver Carpools on ${highDemandCorridor.name}`,
      description: `${highDemandCorridor.name} operates at ${highDemandCorridor.occupancyRate}% seat occupancy. Passenger interest is high and available seats are being claimed rapidly.`,
      impactMetric: `+${Math.round(highDemandCorridor.totalSeatsBooked * 0.4)} potential passenger seats accommodated`,
      suggestedAction: "Broadcast a campus carpool notification inviting employees residing in this sector to post rides.",
      corridorOrArea: highDemandCorridor.name,
    });
  }

  // 2. High-Density Intermediate Boarding Points
  const topBoarding = demand.topBoardingStops[0];
  if (topBoarding && topBoarding.totalRequests >= 2) {
    recommendations.push({
      id: "rec-stop-1",
      type: "stop_optimization",
      severity: "medium",
      title: `Designate Official Commute Stop at ${topBoarding.stopName}`,
      description: `${topBoarding.stopName} has accumulated ${topBoarding.totalRequests} boarding requests. Adding it as a recommended corporate stop will streamline pickups.`,
      impactMetric: `${topBoarding.confirmedPassengers} confirmed passenger commutes`,
      suggestedAction: `Verify safe curb pickup access at ${topBoarding.stopName} and suggest it to drivers on ${topBoarding.corridorName}.`,
      corridorOrArea: topBoarding.stopName,
    });
  }

  // 3. Peak Shift / Timing Optimization
  recommendations.push({
    id: "rec-time-1",
    type: "timing_shift",
    severity: "low",
    title: `Align Departure Schedules with Peak Window (${patterns.peakMorningWindow})`,
    description: `Morning commute demand surges between ${patterns.peakMorningWindow}. Staggering departure times slightly improves colleague carpool matching.`,
    impactMetric: "Reduces peak waiting times by ~15 mins",
    suggestedAction: "Encourage drivers to set departure time slots within the peak 30-minute band for maximum occupancy.",
    corridorOrArea: "Campus-Wide",
  });

  // 4. Corporate Shuttle / High Volume Evaluation
  const topCorridor = corridors[0];
  if (topCorridor && topCorridor.totalRides >= 3) {
    recommendations.push({
      id: "rec-shuttle-1",
      type: "shuttle_candidate",
      severity: topCorridor.totalSeatsBooked >= 8 ? "high" : "medium",
      title: `Candidate for Dedicated Micro-Transit: ${topCorridor.name}`,
      description: `With ${topCorridor.totalRides} regular carpools and ${topCorridor.uniquePassengers + topCorridor.uniqueDrivers} active commuters, this corridor exhibits high recurring density.`,
      impactMetric: `Estimated ₹${Math.round(topCorridor.avgDistanceKm * 8 * 20)} monthly fleet savings`,
      suggestedAction: "Review for potential corporate vanpool sponsorship or hybrid micro-shuttle feeder routes.",
      corridorOrArea: topCorridor.name,
    });
  }

  return recommendations;
}
