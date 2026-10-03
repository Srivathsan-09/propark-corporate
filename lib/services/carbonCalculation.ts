import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import CarbonEmission, { ICarbonEmission } from "@/models/CarbonEmission";
import EmissionFactor, { IEmissionFactor } from "@/models/EmissionFactor";
import Ride, { IRide } from "@/models/Ride";
import Vehicle from "@/models/Vehicle";
import { ensureDefaultEmissionFactors } from "@/lib/db/seedEmissionFactors";

/**
 * Haversine formula to compute great-circle distance between two points in km,
 * scaled by an urban road detour multiplier (1.35) when driving on city roads.
 */
export function calculateRoadDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const haversineKm = R * c;

  // Apply urban road geometry factor (1.35)
  return Math.round(haversineKm * 1.35 * 100) / 100;
}

export interface ResolvedEmissionFactor {
  vehicleType: "Car" | "SUV" | "Van" | "Bike" | "Other";
  fuelType: "Petrol" | "Diesel" | "CNG" | "Electric" | "Hybrid";
  engineCategory: "<=1200cc" | ">1200cc" | "default";
  gramsCO2PerKm: number;
  source: string;
  sourceReference?: string;
  isDefault: boolean;
}

/**
 * Determine engine category ("<=1200cc", ">1200cc", or "default") from capacity string
 */
export function parseEngineCategory(
  engineCapacity?: string
): "<=1200cc" | ">1200cc" | "default" {
  if (!engineCapacity) return "default";
  const match = engineCapacity.match(/(\d+)/);
  if (!match) return "default";
  const cc = parseInt(match[1], 10);
  if (isNaN(cc) || cc <= 0) return "default";
  return cc <= 1200 ? "<=1200cc" : ">1200cc";
}

/**
 * Select the appropriate active emission factor with graceful multi-tier fallbacks:
 * 1. Exact match (vehicleType + fuelType + engineCategory)
 * 2. Category default (vehicleType + fuelType + "default")
 * 3. Vehicle type default (vehicleType + "Petrol" + "default")
 * 4. Global default (GLOBAL_DEFAULT or 130 g/km fallback)
 */
export async function getResolvedEmissionFactor(
  vehicleType: string = "Car",
  fuelType: string = "Petrol",
  engineCapacity?: string
): Promise<ResolvedEmissionFactor> {
  await connectToDatabase();
  await ensureDefaultEmissionFactors();

  const normVehicle = (
    ["Car", "SUV", "Van", "Bike", "Other"].includes(vehicleType) ? vehicleType : "Car"
  ) as "Car" | "SUV" | "Van" | "Bike" | "Other";

  const normFuel = (
    ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"].includes(fuelType) ? fuelType : "Petrol"
  ) as "Petrol" | "Diesel" | "CNG" | "Electric" | "Hybrid";

  const engineCategory = parseEngineCategory(engineCapacity);

  // 1. Exact match
  if (engineCategory !== "default") {
    const exact = await EmissionFactor.findOne({
      vehicleType: normVehicle,
      fuelType: normFuel,
      engineCategory,
      isActive: true,
    }).lean();

    if (exact) {
      return {
        vehicleType: exact.vehicleType,
        fuelType: exact.fuelType,
        engineCategory: exact.engineCategory,
        gramsCO2PerKm: exact.gramsCO2PerKm,
        source: exact.source,
        sourceReference: exact.sourceReference,
        isDefault: false,
      };
    }
  }

  // 2. Match vehicle + fuel with default category
  const fuelMatch = await EmissionFactor.findOne({
    vehicleType: normVehicle,
    fuelType: normFuel,
    engineCategory: "default",
    isActive: true,
  }).lean();

  if (fuelMatch) {
    return {
      vehicleType: fuelMatch.vehicleType,
      fuelType: fuelMatch.fuelType,
      engineCategory: fuelMatch.engineCategory,
      gramsCO2PerKm: fuelMatch.gramsCO2PerKm,
      source: fuelMatch.source,
      sourceReference: fuelMatch.sourceReference,
      isDefault: engineCategory !== "default",
    };
  }

  // 3. Match vehicle type only
  const vehicleMatch = await EmissionFactor.findOne({
    vehicleType: normVehicle,
    isActive: true,
  }).lean();

  if (vehicleMatch) {
    return {
      vehicleType: vehicleMatch.vehicleType,
      fuelType: vehicleMatch.fuelType,
      engineCategory: vehicleMatch.engineCategory,
      gramsCO2PerKm: vehicleMatch.gramsCO2PerKm,
      source: vehicleMatch.source,
      sourceReference: vehicleMatch.sourceReference,
      isDefault: true,
    };
  }

  // 4. Global default
  const globalDefault = await EmissionFactor.findOne({
    factorId: "GLOBAL_DEFAULT",
    isActive: true,
  }).lean();

  if (globalDefault) {
    return {
      vehicleType: globalDefault.vehicleType,
      fuelType: globalDefault.fuelType,
      engineCategory: globalDefault.engineCategory,
      gramsCO2PerKm: globalDefault.gramsCO2PerKm,
      source: globalDefault.source,
      sourceReference: globalDefault.sourceReference,
      isDefault: true,
    };
  }

  // Hardcoded safety net
  return {
    vehicleType: "Car",
    fuelType: "Petrol",
    engineCategory: "default",
    gramsCO2PerKm: 130.0,
    source: "IPCC 2006 / MoEFCC India GHG Platform (Default Fallback)",
    sourceReference: "Weighted National Urban Commuter Vehicle Baseline",
    isDefault: true,
  };
}

/**
 * Main Carbon Calculation Engine
 * Calculates and idempotently persists research-grade carbon emission data for a completed ride.
 */
export async function calculateRideCarbonEmissions(
  rideId: string
): Promise<ICarbonEmission | null> {
  await connectToDatabase();
  await ensureDefaultEmissionFactors();

  if (!mongoose.Types.ObjectId.isValid(rideId)) {
    throw new Error("Invalid ride identifier");
  }

  // Idempotency check: if already calculated, return existing record
  const existingRecord = await CarbonEmission.findOne({ rideId });
  if (existingRecord) {
    return existingRecord;
  }

  // Fetch ride with vehicle and passenger details
  const ride = await Ride.findById(rideId)
    .populate("vehicle")
    .populate("requests.passenger", "name email");

  if (!ride) {
    throw new Error("Ride not found");
  }

  // Only calculate for completed rides (edge case check)
  if (ride.status !== "completed") {
    console.warn(` Ride ${rideId} is not in completed status (${ride.status}). Skipping.`);
    return null;
  }

  // 1. Determine Actual Vehicle Travel Distance
  let actualCarpoolDistanceKm = ride.distanceKm || 0;
  let distanceSource: "GPS_TRACKED" | "ROUTE_ESTIMATED" = "ROUTE_ESTIMATED";

  // If ride has valid distanceKm, use it. If 0 or missing, estimate from start/end locations
  if (actualCarpoolDistanceKm <= 0) {
    const lat1 = ride.startLocation?.latitude || 0;
    const lon1 = ride.startLocation?.longitude || 0;
    const lat2 = ride.endLocation?.latitude || 0;
    const lon2 = ride.endLocation?.longitude || 0;
    actualCarpoolDistanceKm = calculateRoadDistanceKm(lat1, lon1, lat2, lon2);
  }

  // 2. Determine Driver Vehicle Emission Factor
  const vehicleObj = ride.vehicle as any;
  const vehicleType = vehicleObj?.vehicleType || ride.vehicleType || "Car";
  const fuelType = vehicleObj?.fuelType || "Petrol";
  const engineCapacity = vehicleObj?.engineCapacity || "";

  const driverFactor = await getResolvedEmissionFactor(vehicleType, fuelType, engineCapacity);

  // Actual carpool emissions: Physical distance travelled by vehicle × factor / 1000
  // Note: We do NOT divide by passenger count. The car physically drives its route!
  const actualCarpoolCO2Kg =
    Math.round(((actualCarpoolDistanceKm * driverFactor.gramsCO2PerKm) / 1000) * 1000) / 1000;

  // 3. Calculate Solo Commute Baseline for Accepted Passengers
  const acceptedRequests = (ride.requests || []).filter((r: any) => r.status === "accepted");
  const passengerCount = acceptedRequests.length;
  const occupancy = passengerCount + 1; // 1 driver + N passengers

  // Build coordinate lookup map for stops
  const stopCoordsMap = new Map<string, { lat: number; lon: number }>();
  if (ride.startLocation?.latitude && ride.startLocation?.longitude) {
    stopCoordsMap.set(ride.startingLocation?.toLowerCase().trim() || "start", {
      lat: ride.startLocation.latitude,
      lon: ride.startLocation.longitude,
    });
  }
  if (ride.endLocation?.latitude && ride.endLocation?.longitude) {
    stopCoordsMap.set(ride.destination?.toLowerCase().trim() || "end", {
      lat: ride.endLocation.latitude,
      lon: ride.endLocation.longitude,
    });
  }
  (ride.stops || []).forEach((s: any) => {
    if (s.name && s.latitude && s.longitude) {
      stopCoordsMap.set(s.name.toLowerCase().trim(), {
        lat: s.latitude,
        lon: s.longitude,
      });
    }
  });

  const passengerRecords: any[] = [];
  let soloBaselineDistanceKm = 0;
  let soloBaselineCO2Kg = 0;
  let dataCompleteness: "COMPLETE" | "INCOMPLETE" = "COMPLETE";
  const missingReasons: string[] = [];
  let dataCompletenessReason = "";

  if (actualCarpoolDistanceKm <= 0) {
    dataCompleteness = "INCOMPLETE";
    missingReasons.push("Missing vehicle route distance or valid route coordinates");
  }

  // Standard passenger baseline factor (if passenger drove solo, assumed standard petrol car)
  const passengerBaselineFactor = await getResolvedEmissionFactor("Car", "Petrol", "default");

  if (passengerCount === 0) {
    // Single-occupant trip (0 passengers carried)
    dataCompleteness = "COMPLETE";
    dataCompletenessReason = "Single-occupant trip (0 passengers). Baseline emissions are 0 kg.";
  } else {
    for (const req of acceptedRequests) {
      const pPickup = (req.pickupStop || "").toLowerCase().trim();
      const pDrop = (req.dropStop || "").toLowerCase().trim();

      const pickupCoords = stopCoordsMap.get(pPickup);
      const dropCoords = stopCoordsMap.get(pDrop);

      let pSoloDist = 0;
      if (pickupCoords && dropCoords) {
        pSoloDist = calculateRoadDistanceKm(
          pickupCoords.lat,
          pickupCoords.lon,
          dropCoords.lat,
          dropCoords.lon
        );
      }

      // Do NOT silently substitute route distance when passenger coordinates are missing
      if (pSoloDist <= 0) {
        dataCompleteness = "INCOMPLETE";
        const passengerObj = req.passenger as any;
        const passengerIdentifier =
          passengerObj?.name || passengerObj?._id || req.pickupStop || "passenger";
        missingReasons.push(`Missing valid coordinates for ${passengerIdentifier}`);
        pSoloDist = 0;
      }

      const pSoloCO2 =
        Math.round(((pSoloDist * passengerBaselineFactor.gramsCO2PerKm) / 1000) * 1000) / 1000;

      soloBaselineDistanceKm += pSoloDist;
      soloBaselineCO2Kg += pSoloCO2;

      passengerRecords.push({
        userId: req.passenger?._id || req.passenger,
        pickupStop: req.pickupStop,
        dropStop: req.dropStop,
        soloDistanceKm: pSoloDist,
        soloEmissionKg: pSoloCO2,
        emissionFactorUsed: {
          gramsCO2PerKm: passengerBaselineFactor.gramsCO2PerKm,
          source: passengerBaselineFactor.source,
          isDefault: passengerBaselineFactor.isDefault,
        },
      });
    }
  }

  soloBaselineDistanceKm = Math.round(soloBaselineDistanceKm * 100) / 100;
  soloBaselineCO2Kg = Math.round(soloBaselineCO2Kg * 1000) / 1000;

  // 4. Calculate Environmental Savings
  // Raw difference (negative when carpool emissions exceed solo baseline)
  const grossDifferenceKg = Math.round((soloBaselineCO2Kg - actualCarpoolCO2Kg) * 1000) / 1000;

  // Avoided emissions (capped at 0 so we never report negative savings)
  const co2SavedKg = Math.max(0, grossDifferenceKg);

  // Vehicle-Kilometers Reduced (VKR)
  const vehicleKilometersReduced = Math.max(
    0,
    Math.round((soloBaselineDistanceKm - actualCarpoolDistanceKm) * 100) / 100
  );

  // CO2 Reduction Percentage: (Gross Difference / Solo Baseline) * 100 when baseline > 0
  let co2ReductionPercentage = 0;
  if (soloBaselineCO2Kg > 0) {
    co2ReductionPercentage =
      Math.round((grossDifferenceKg / soloBaselineCO2Kg) * 100 * 10) / 10;
  }

  if (dataCompleteness === "INCOMPLETE") {
    dataCompletenessReason = missingReasons.join("; ");
  } else if (passengerCount === 0) {
    dataCompletenessReason = "Single-occupant trip (0 passengers). Baseline emissions are 0 kg.";
  } else {
    dataCompletenessReason = "All passenger distances and emission factors verified";
  }

  // 5. Persist to MongoDB idempotently (upsert by rideId)
  const carbonRecord = await CarbonEmission.findOneAndUpdate(
    { rideId: ride._id },
    {
      $set: {
        rideId: ride._id,
        driverId: ride.driver,
        vehicleId: ride.vehicle._id || ride.vehicle,
        campusId: ride.campusId || "CAMP001",
        passengers: passengerRecords,
        soloBaselineDistanceKm,
        actualCarpoolDistanceKm,
        soloBaselineCO2Kg,
        actualCarpoolCO2Kg,
        co2SavedKg,
        grossDifferenceKg,
        co2ReductionPercentage,
        vehicleKilometersReduced,
        occupancy,
        passengerCount,
        emissionFactor: {
          vehicleType: driverFactor.vehicleType,
          fuelType: driverFactor.fuelType,
          engineCategory: driverFactor.engineCategory,
          gramsCO2PerKm: driverFactor.gramsCO2PerKm,
          source: driverFactor.source,
          isDefault: driverFactor.isDefault,
        },
        distanceSource,
        calculationMethod: "Travel Distance (km) × Emission Factor (g CO2/km) / 1000",
        dataCompleteness,
        dataCompletenessReason,
        calculatedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return carbonRecord;
}

/**
 * Aggregate personal environmental impact statistics for an employee (as driver or passenger)
 */
export async function getUserCarbonStats(userId: string) {
  await connectToDatabase();

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user identifier");
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Match records where user is driver OR passenger
  const records = await CarbonEmission.find({
    $or: [{ driverId: userObjectId }, { "passengers.userId": userObjectId }],
  }).lean();

  if (!records || records.length === 0) {
    return {
      totalCO2SavedKg: 0,
      totalVKRKm: 0,
      carpoolRidesCount: 0,
      averageOccupancy: 0,
      averageCO2SavedPerRideKg: 0,
      averageCO2SavedPerPassengerKg: 0,
      totalActualCarpoolCO2Kg: 0,
      totalSoloBaselineCO2Kg: 0,
      overallReductionPercentage: 0,
      equivalentTreesPlanted: 0,
    };
  }

  const carpoolRidesCount = records.length;
  let totalCO2SavedKg = 0;
  let totalVKRKm = 0;
  let sumOccupancy = 0;
  let totalPassengers = 0;
  let totalActualCarpoolCO2Kg = 0;
  let totalSoloBaselineCO2Kg = 0;

  for (const r of records) {
    totalCO2SavedKg += r.co2SavedKg || 0;
    totalVKRKm += r.vehicleKilometersReduced || 0;
    sumOccupancy += r.occupancy || 1;
    totalPassengers += r.passengerCount || 0;
    totalActualCarpoolCO2Kg += r.actualCarpoolCO2Kg || 0;
    totalSoloBaselineCO2Kg += r.soloBaselineCO2Kg || 0;
  }

  const averageOccupancy = Math.round((sumOccupancy / carpoolRidesCount) * 10) / 10;
  const averageCO2SavedPerRideKg = Math.round((totalCO2SavedKg / carpoolRidesCount) * 100) / 100;
  const averageCO2SavedPerPassengerKg =
    totalPassengers > 0 ? Math.round((totalCO2SavedKg / totalPassengers) * 100) / 100 : 0;

  const overallReductionPercentage =
    totalSoloBaselineCO2Kg > 0
      ? Math.round(
          ((totalSoloBaselineCO2Kg - totalActualCarpoolCO2Kg) / totalSoloBaselineCO2Kg) * 100 * 10
        ) / 10
      : 0;

  // 1 mature tree absorbs ~21.77 kg CO2 per year (US EPA standard benchmark)
  const equivalentTreesPlanted = Math.round((totalCO2SavedKg / 21.77) * 10) / 10;

  return {
    totalCO2SavedKg: Math.round(totalCO2SavedKg * 100) / 100,
    totalVKRKm: Math.round(totalVKRKm * 100) / 100,
    carpoolRidesCount,
    averageOccupancy,
    averageCO2SavedPerRideKg,
    averageCO2SavedPerPassengerKg,
    totalActualCarpoolCO2Kg: Math.round(totalActualCarpoolCO2Kg * 100) / 100,
    totalSoloBaselineCO2Kg: Math.round(totalSoloBaselineCO2Kg * 100) / 100,
    overallReductionPercentage: Math.max(0, overallReductionPercentage),
    equivalentTreesPlanted,
  };
}

export interface DiagnosticRideItem {
  rideId: string;
  passengerCount: number;
  soloDistancePerPassenger: string;
  soloDistances: number[];
  soloBaselineCO2Kg: number;
  actualSharedVehicleDistanceKm: number;
  carpoolEmissionsKg: number;
  grossDifferenceKg: number;
  avoidedEmissionsKg: number;
  reductionPercentage: number;
  dataCompleteness: "COMPLETE" | "INCOMPLETE";
  dataCompletenessReason: string;
  calculatedAt?: Date;
}

export interface CalculationInput {
  actualCarpoolDistanceKm: number;
  driverGramsCO2PerKm: number;
  passengers: Array<{
    passengerId?: string;
    distanceKm?: number | null;
    gramsCO2PerKm?: number;
    hasValidCoordinates?: boolean;
    name?: string;
  }>;
}

export interface CalculationResult {
  soloBaselineDistanceKm: number;
  actualCarpoolDistanceKm: number;
  soloBaselineCO2Kg: number;
  actualCarpoolCO2Kg: number;
  grossDifferenceKg: number;
  co2SavedKg: number;
  co2ReductionPercentage: number;
  vehicleKilometersReduced: number;
  passengerCount: number;
  dataCompleteness: "COMPLETE" | "INCOMPLETE";
  dataCompletenessReason: string;
}

/**
 * Pure calculation logic matching IPCC 2006 guidelines and CommuteX specification
 */
export function computeSustainabilityFigures(input: CalculationInput): CalculationResult {
  const actualCarpoolDistanceKm = Math.max(0, input.actualCarpoolDistanceKm || 0);
  const driverFactor = input.driverGramsCO2PerKm || 150;
  const actualCarpoolCO2Kg =
    Math.round(((actualCarpoolDistanceKm * driverFactor) / 1000) * 1000) / 1000;

  const passengers = input.passengers || [];
  const passengerCount = passengers.length;
  let soloBaselineDistanceKm = 0;
  let soloBaselineCO2Kg = 0;
  let dataCompleteness: "COMPLETE" | "INCOMPLETE" = "COMPLETE";
  const missingReasons: string[] = [];

  if (actualCarpoolDistanceKm <= 0) {
    dataCompleteness = "INCOMPLETE";
    missingReasons.push("Missing vehicle route distance");
  }

  if (passengerCount === 0) {
    dataCompleteness = "COMPLETE";
    const dataCompletenessReason =
      "Single-occupant trip (0 passengers). Baseline emissions are 0 kg.";
    return {
      soloBaselineDistanceKm: 0,
      actualCarpoolDistanceKm,
      soloBaselineCO2Kg: 0,
      actualCarpoolCO2Kg,
      grossDifferenceKg: Math.round((0 - actualCarpoolCO2Kg) * 1000) / 1000,
      co2SavedKg: 0,
      co2ReductionPercentage: 0,
      vehicleKilometersReduced: 0,
      passengerCount: 0,
      dataCompleteness,
      dataCompletenessReason,
    };
  }

  for (let i = 0; i < passengers.length; i++) {
    const p = passengers[i];
    const pDist = p.distanceKm != null ? p.distanceKm : 0;
    const hasCoords = p.hasValidCoordinates !== false && pDist > 0;

    if (!hasCoords) {
      dataCompleteness = "INCOMPLETE";
      missingReasons.push(`Missing valid coordinates/distance for passenger ${p.name || i + 1}`);
    }

    const factor = p.gramsCO2PerKm || 150;
    const pCO2 = Math.round(((pDist * factor) / 1000) * 1000) / 1000;
    soloBaselineDistanceKm += pDist;
    soloBaselineCO2Kg += pCO2;
  }

  soloBaselineDistanceKm = Math.round(soloBaselineDistanceKm * 100) / 100;
  soloBaselineCO2Kg = Math.round(soloBaselineCO2Kg * 1000) / 1000;

  const grossDifferenceKg = Math.round((soloBaselineCO2Kg - actualCarpoolCO2Kg) * 1000) / 1000;
  const co2SavedKg = Math.max(0, grossDifferenceKg);
  const vehicleKilometersReduced = Math.max(
    0,
    Math.round((soloBaselineDistanceKm - actualCarpoolDistanceKm) * 100) / 100
  );

  let co2ReductionPercentage = 0;
  if (soloBaselineCO2Kg > 0) {
    co2ReductionPercentage =
      Math.round((grossDifferenceKg / soloBaselineCO2Kg) * 100 * 10) / 10;
  }

  let dataCompletenessReason = "";
  if (dataCompleteness === "INCOMPLETE") {
    dataCompletenessReason = missingReasons.join("; ");
  } else {
    dataCompletenessReason = "All passenger distances and emission factors verified";
  }

  return {
    soloBaselineDistanceKm,
    actualCarpoolDistanceKm,
    soloBaselineCO2Kg,
    actualCarpoolCO2Kg,
    grossDifferenceKg,
    co2SavedKg,
    co2ReductionPercentage,
    vehicleKilometersReduced,
    passengerCount,
    dataCompleteness,
    dataCompletenessReason,
  };
}

/**
 * Campus/Organization-wide Sustainability Analytics
 */
export async function getCampusSustainabilityAnalytics(campusId?: string) {
  await connectToDatabase();

  const query: any = {};
  if (campusId && campusId !== "all") {
    query.campusId = campusId.toUpperCase();
  }

  const records = await CarbonEmission.find(query).sort({ calculatedAt: -1 }).lean();

  const completedRidesCount = records.length;
  let totalPassengers = 0;
  let totalCarpoolDistanceKm = 0;
  let totalSoloBaselineDistanceKm = 0;
  let totalVKRKm = 0;
  let totalEstimatedCO2EmittedKg = 0;
  let totalEstimatedCO2AvoidedKg = 0;
  let totalSoloBaselineCO2Kg = 0;
  let sumOccupancy = 0;

  const diagnostics: DiagnosticRideItem[] = [];

  for (const r of records) {
    totalPassengers += r.passengerCount || 0;
    totalCarpoolDistanceKm += r.actualCarpoolDistanceKm || 0;
    totalSoloBaselineDistanceKm += r.soloBaselineDistanceKm || 0;
    totalVKRKm += r.vehicleKilometersReduced || 0;
    totalEstimatedCO2EmittedKg += r.actualCarpoolCO2Kg || 0;
    totalEstimatedCO2AvoidedKg += r.co2SavedKg || 0;
    totalSoloBaselineCO2Kg += r.soloBaselineCO2Kg || 0;
    sumOccupancy += r.occupancy || 1;

    // Diagnostic information for each completed ride
    const soloDistances = (r.passengers || []).map((p: any) => p.soloDistanceKm);
    const soloDistancesStr =
      soloDistances.length > 0
        ? soloDistances.map((d: number) => `${d} km`).join(", ")
        : "0 km (No passengers)";

    let completeness: "COMPLETE" | "INCOMPLETE" = r.dataCompleteness || "COMPLETE";
    let completenessReason = r.dataCompletenessReason || "";
    if (!r.dataCompleteness) {
      if ((r.passengerCount || 0) > 0 && soloDistances.some((d: number) => d <= 0)) {
        completeness = "INCOMPLETE";
        completenessReason = "Missing route coordinates for one or more passengers";
      } else {
        completeness = "COMPLETE";
        completenessReason =
          (r.passengerCount || 0) === 0
            ? "Single-occupant trip (0 passengers)"
            : "All passenger distances and emission factors verified";
      }
    }

    const rideGrossDiff =
      r.grossDifferenceKg !== undefined
        ? r.grossDifferenceKg
        : Math.round(((r.soloBaselineCO2Kg || 0) - (r.actualCarpoolCO2Kg || 0)) * 1000) / 1000;

    diagnostics.push({
      rideId: r.rideId?.toString() || r._id.toString(),
      passengerCount: r.passengerCount || 0,
      soloDistancePerPassenger: soloDistancesStr,
      soloDistances,
      soloBaselineCO2Kg: Math.round((r.soloBaselineCO2Kg || 0) * 1000) / 1000,
      actualSharedVehicleDistanceKm: Math.round((r.actualCarpoolDistanceKm || 0) * 100) / 100,
      carpoolEmissionsKg: Math.round((r.actualCarpoolCO2Kg || 0) * 1000) / 1000,
      grossDifferenceKg: Math.round(rideGrossDiff * 1000) / 1000,
      avoidedEmissionsKg: Math.round((r.co2SavedKg || 0) * 1000) / 1000,
      reductionPercentage: r.co2ReductionPercentage || 0,
      dataCompleteness: completeness,
      dataCompletenessReason: completenessReason,
      calculatedAt: r.calculatedAt || (r as any).createdAt,
    });
  }

  const averageOccupancy =
    completedRidesCount > 0 ? Math.round((sumOccupancy / completedRidesCount) * 10) / 10 : 0;
  const averageCO2SavingPerRideKg =
    completedRidesCount > 0
      ? Math.round((totalEstimatedCO2AvoidedKg / completedRidesCount) * 100) / 100
      : 0;
  const averageCO2SavingPerPassengerKg =
    totalPassengers > 0
      ? Math.round((totalEstimatedCO2AvoidedKg / totalPassengers) * 100) / 100
      : 0;

  totalSoloBaselineCO2Kg = Math.round(totalSoloBaselineCO2Kg * 1000) / 1000;
  totalEstimatedCO2EmittedKg = Math.round(totalEstimatedCO2EmittedKg * 1000) / 1000;
  totalEstimatedCO2AvoidedKg = Math.round(totalEstimatedCO2AvoidedKg * 1000) / 1000;
  const totalGrossDifferenceKg =
    Math.round((totalSoloBaselineCO2Kg - totalEstimatedCO2EmittedKg) * 1000) / 1000;

  const co2ReductionPercentage =
    totalSoloBaselineCO2Kg > 0
      ? Math.round((totalGrossDifferenceKg / totalSoloBaselineCO2Kg) * 100 * 10) / 10
      : 0;

  // Active emission factor source for transparency display
  const activeFactor = await EmissionFactor.findOne({ isActive: true }).lean();

  return {
    totalCompletedRides: completedRidesCount,
    totalPassengers,
    totalCarpoolDistanceKm: Math.round(totalCarpoolDistanceKm * 100) / 100,
    totalSoloBaselineDistanceKm: Math.round(totalSoloBaselineDistanceKm * 100) / 100,
    vehicleKilometersReducedKm: Math.round(totalVKRKm * 100) / 100,
    totalSoloBaselineCO2Kg: Math.round(totalSoloBaselineCO2Kg * 100) / 100,
    totalEstimatedCO2EmittedKg: Math.round(totalEstimatedCO2EmittedKg * 100) / 100,
    totalEstimatedCO2AvoidedKg: Math.round(totalEstimatedCO2AvoidedKg * 100) / 100,
    grossDifferenceKg: Math.round(totalGrossDifferenceKg * 100) / 100,
    averageOccupancy,
    averageCO2SavingPerRideKg,
    averageCO2SavingPerPassengerKg,
    co2ReductionPercentage,
    equivalentTreesPlanted: Math.round((totalEstimatedCO2AvoidedKg / 21.77) * 10) / 10,
    activeEmissionFactorSource: activeFactor?.source || "IPCC 2006 / MoEFCC India GHG Platform",
    activeSourceReference: activeFactor?.sourceReference || "India GHG Platform Baseline",
    diagnostics,
  };
}

/**
 * Time-series monthly analytics for charts
 */
export async function getMonthlyCarbonAnalytics(campusId?: string) {
  await connectToDatabase();

  const query: any = {};
  if (campusId && campusId !== "all") {
    query.campusId = campusId.toUpperCase();
  }

  const records = await CarbonEmission.find(query).sort({ calculatedAt: 1 }).lean();

  // Group by "YYYY-MM"
  const monthlyMap = new Map<
    string,
    {
      month: string;
      label: string;
      co2AvoidedKg: number;
      co2EmittedKg: number;
      soloCO2Kg: number;
      vkrKm: number;
      ridesCount: number;
      passengersCount: number;
    }
  >();

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  for (const r of records) {
    const d = new Date(r.calculatedAt || r.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

    const existing = monthlyMap.get(key) || {
      month: key,
      label,
      co2AvoidedKg: 0,
      co2EmittedKg: 0,
      soloCO2Kg: 0,
      vkrKm: 0,
      ridesCount: 0,
      passengersCount: 0,
    };

    existing.co2AvoidedKg += r.co2SavedKg || 0;
    existing.co2EmittedKg += r.actualCarpoolCO2Kg || 0;
    existing.soloCO2Kg += r.soloBaselineCO2Kg || 0;
    existing.vkrKm += r.vehicleKilometersReduced || 0;
    existing.ridesCount += 1;
    existing.passengersCount += r.passengerCount || 0;

    monthlyMap.set(key, existing);
  }

  const result = Array.from(monthlyMap.values()).map((item) => ({
    ...item,
    co2AvoidedKg: Math.round(item.co2AvoidedKg * 100) / 100,
    co2EmittedKg: Math.round(item.co2EmittedKg * 100) / 100,
    soloCO2Kg: Math.round(item.soloCO2Kg * 100) / 100,
    vkrKm: Math.round(item.vkrKm * 100) / 100,
  }));

  return result;
}

/**
 * Occupancy vs CO2 Per Passenger Analysis for research demonstration
 */
export async function getOccupancyCarbonAnalytics(campusId?: string) {
  await connectToDatabase();

  const query: any = {};
  if (campusId && campusId !== "all") {
    query.campusId = campusId.toUpperCase();
  }

  const records = await CarbonEmission.find(query).lean();

  // Group by occupancy (1, 2, 3, 4, 5, 6+)
  const occupancyMap = new Map<
    number,
    {
      occupancy: number;
      label: string;
      ridesCount: number;
      totalCarpoolCO2Kg: number;
      totalOccupants: number;
    }
  >();

  for (let occ = 1; occ <= 6; occ++) {
    occupancyMap.set(occ, {
      occupancy: occ,
      label: occ === 1 ? "1 (Solo Driver)" : `${occ} Occupants`,
      ridesCount: 0,
      totalCarpoolCO2Kg: 0,
      totalOccupants: 0,
    });
  }

  for (const r of records) {
    const occ = Math.min(6, Math.max(1, Math.round(r.occupancy || 1)));
    const item = occupancyMap.get(occ)!;
    item.ridesCount += 1;
    item.totalCarpoolCO2Kg += r.actualCarpoolCO2Kg || 0;
    item.totalOccupants += r.occupancy || 1;
  }

  const result = Array.from(occupancyMap.values()).map((item) => {
    const avgCO2PerOccupant =
      item.totalOccupants > 0
        ? Math.round((item.totalCarpoolCO2Kg / item.totalOccupants) * 100) / 100
        : 0;

    return {
      occupancy: item.occupancy,
      label: item.label,
      ridesCount: item.ridesCount,
      avgCO2PerOccupantKg: avgCO2PerOccupant,
    };
  });

  return result;
}
