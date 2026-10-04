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
  const carpoolGrams = actualCarpoolDistanceKm * driverFactor.gramsCO2PerKm;
  const rawCarpoolKg = Math.round(carpoolGrams) / 1000;
  const actualCarpoolCO2Kg = Math.round(rawCarpoolKg * 100) / 100;

  // 3. Determine Driver Solo Journey Distance & Emissions
  // If driver commuted solo without carpooling, they would drive from origin to destination directly
  const dStartLat = ride.startLocation?.latitude || 0;
  const dStartLon = ride.startLocation?.longitude || 0;
  const dEndLat = ride.endLocation?.latitude || 0;
  const dEndLon = ride.endLocation?.longitude || 0;
  let driverSoloDistanceKm = 0;
  if (dStartLat && dStartLon && dEndLat && dEndLon) {
    driverSoloDistanceKm = calculateRoadDistanceKm(dStartLat, dStartLon, dEndLat, dEndLon);
  }
  if (driverSoloDistanceKm <= 0) {
    driverSoloDistanceKm = actualCarpoolDistanceKm;
  }
  const driverSoloGrams = driverSoloDistanceKm * driverFactor.gramsCO2PerKm;
  const driverSoloCO2Kg = Math.round(driverSoloGrams) / 1000;
  const driverSoloEmissionKg = Math.round(driverSoloCO2Kg * 100) / 100;

  // 4. Calculate Solo Commute Baseline for Driver + Accepted Passengers
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
  let soloBaselineDistanceKm = driverSoloDistanceKm;
  let rawSoloBaselineKg = driverSoloCO2Kg;
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
    dataCompletenessReason = "Single-occupant trip (0 passengers). Baseline emissions equal carpool emissions.";
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

      const pGrams = pSoloDist * passengerBaselineFactor.gramsCO2PerKm;
      const pSoloCO2 = Math.round(pGrams) / 1000;
      const pSoloCO2Display = Math.round(pSoloCO2 * 100) / 100;

      soloBaselineDistanceKm += pSoloDist;
      rawSoloBaselineKg += pSoloCO2;

      passengerRecords.push({
        userId: req.passenger?._id || req.passenger,
        pickupStop: req.pickupStop,
        dropStop: req.dropStop,
        soloDistanceKm: pSoloDist,
        soloEmissionKg: pSoloCO2Display,
        emissionFactorUsed: {
          gramsCO2PerKm: passengerBaselineFactor.gramsCO2PerKm,
          source: passengerBaselineFactor.source,
          isDefault: passengerBaselineFactor.isDefault,
        },
      });
    }
  }

  soloBaselineDistanceKm = Math.round(soloBaselineDistanceKm * 100) / 100;
  const soloBaselineCO2Kg = Math.round(rawSoloBaselineKg * 100) / 100;

  // 5. Calculate Environmental Savings
  // Net CO2 Avoided = Solo Baseline - Actual Carpool (negative when carpool emissions exceed solo baseline)
  const grossDifferenceKg = Math.round((soloBaselineCO2Kg - actualCarpoolCO2Kg) * 100) / 100;
  const co2SavedKg = grossDifferenceKg;
  const netEmissionsIncreaseKg = Math.max(0, Math.round((actualCarpoolCO2Kg - soloBaselineCO2Kg) * 100) / 100);

  // Vehicle-Kilometers Reduced (VKR)
  const vehicleKilometersReduced = Math.round(
    (soloBaselineDistanceKm - actualCarpoolDistanceKm) * 100
  ) / 100;

  // CO2 Reduction Percentage: (Net CO2 Avoided / Solo Baseline) * 100 when baseline > 0
  let co2ReductionPercentage = 0;
  if (soloBaselineCO2Kg > 0) {
    co2ReductionPercentage =
      Math.round((grossDifferenceKg / soloBaselineCO2Kg) * 100 * 100) / 100;
  }

  if (dataCompleteness === "INCOMPLETE") {
    dataCompletenessReason = missingReasons.join("; ");
  } else if (passengerCount === 0) {
    dataCompletenessReason = "Single-occupant trip (0 passengers). Baseline emissions equal carpool emissions.";
  } else {
    dataCompletenessReason = "All driver and passenger distances and emission factors verified";
  }

  // 6. Persist to MongoDB idempotently (upsert by rideId)
  const carbonRecord = await CarbonEmission.findOneAndUpdate(
    { rideId: ride._id },
    {
      $set: {
        rideId: ride._id,
        driverId: ride.driver,
        vehicleId: ride.vehicle._id || ride.vehicle,
        campusId: ride.campusId || "CAMP001",
        passengers: passengerRecords,
        driverSoloDistanceKm,
        driverSoloEmissionKg,
        soloBaselineDistanceKm,
        actualCarpoolDistanceKm,
        soloBaselineCO2Kg,
        actualCarpoolCO2Kg,
        co2SavedKg,
        grossDifferenceKg,
        netEmissionsIncreaseKg,
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
    const netAvoided =
      r.grossDifferenceKg !== undefined
        ? r.grossDifferenceKg
        : (r.soloBaselineCO2Kg || 0) - (r.actualCarpoolCO2Kg || 0);
    totalCO2SavedKg += netAvoided;
    totalVKRKm += r.vehicleKilometersReduced || 0;
    sumOccupancy += r.occupancy || 1;
    totalPassengers += r.passengerCount || 0;
    totalActualCarpoolCO2Kg += r.actualCarpoolCO2Kg || 0;
    totalSoloBaselineCO2Kg += r.soloBaselineCO2Kg || 0;
  }

  const roundedSolo = Math.round(totalSoloBaselineCO2Kg * 100) / 100;
  const roundedEmitted = Math.round(totalActualCarpoolCO2Kg * 100) / 100;
  const totalNetCO2AvoidedKg = Math.round((roundedSolo - roundedEmitted) * 100) / 100;
  const netEmissionsIncreaseKg = Math.max(0, Math.round((roundedEmitted - roundedSolo) * 100) / 100);

  const averageOccupancy = Math.round((sumOccupancy / carpoolRidesCount) * 10) / 10;
  const averageCO2SavedPerRideKg = Math.round((totalNetCO2AvoidedKg / carpoolRidesCount) * 100) / 100;
  const averageCO2SavedPerPassengerKg =
    totalPassengers > 0 ? Math.round((totalNetCO2AvoidedKg / totalPassengers) * 100) / 100 : 0;

  const overallReductionPercentage =
    roundedSolo > 0
      ? Math.round(((totalNetCO2AvoidedKg) / roundedSolo) * 100 * 100) / 100
      : 0;

  // 1 mature tree absorbs ~21.77 kg CO2 per year (US EPA standard benchmark, applicable when avoided > 0)
  const equivalentTreesPlanted = totalNetCO2AvoidedKg > 0 ? Math.round((totalNetCO2AvoidedKg / 21.77) * 10) / 10 : 0;

  return {
    totalCO2SavedKg: totalNetCO2AvoidedKg,
    netEmissionsIncreaseKg,
    totalVKRKm: Math.round(totalVKRKm * 100) / 100,
    carpoolRidesCount,
    averageOccupancy,
    averageCO2SavedPerRideKg,
    averageCO2SavedPerPassengerKg,
    totalActualCarpoolCO2Kg: roundedEmitted,
    totalSoloBaselineCO2Kg: roundedSolo,
    overallReductionPercentage,
    equivalentTreesPlanted,
  };
}

export interface DiagnosticRideItem {
  rideId: string;
  driverSoloDistanceKm?: number;
  driverSoloEmissionKg?: number;
  passengerCount: number;
  soloDistancePerPassenger: string;
  soloDistances: number[];
  soloBaselineCO2Kg: number;
  actualSharedVehicleDistanceKm: number;
  carpoolEmissionsKg: number;
  grossDifferenceKg: number;
  avoidedEmissionsKg: number;
  netEmissionsIncreaseKg: number;
  reductionPercentage: number;
  dataCompleteness: "COMPLETE" | "INCOMPLETE";
  dataCompletenessReason: string;
  calculatedAt?: Date;
}

export interface CalculationInput {
  actualCarpoolDistanceKm: number;
  driverGramsCO2PerKm: number;
  driverSoloDistanceKm?: number;
  passengers: Array<{
    passengerId?: string;
    distanceKm?: number | null;
    gramsCO2PerKm?: number;
    hasValidCoordinates?: boolean;
    name?: string;
  }>;
}

export interface CalculationResult {
  driverSoloDistanceKm: number;
  driverSoloEmissionKg: number;
  soloBaselineDistanceKm: number;
  actualCarpoolDistanceKm: number;
  soloBaselineCO2Kg: number;
  actualCarpoolCO2Kg: number;
  grossDifferenceKg: number;
  co2SavedKg: number;
  netEmissionsIncreaseKg: number;
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
  // Calculate to nearest gram (0.001 kg), then round to 2 decimal places for consistent display
  const carpoolGrams = actualCarpoolDistanceKm * driverFactor;
  const rawCarpoolKg = Math.round(carpoolGrams) / 1000;
  const actualCarpoolCO2Kg = Math.round(rawCarpoolKg * 100) / 100;

  const passengers = input.passengers || [];
  const passengerCount = passengers.length;

  // Driver solo journey: If not specified, driver would drive direct distance (actual distance)
  const driverSoloDistanceKm =
    input.driverSoloDistanceKm != null
      ? Math.max(0, input.driverSoloDistanceKm)
      : actualCarpoolDistanceKm;
  const driverSoloGrams = driverSoloDistanceKm * driverFactor;
  const driverSoloCO2Kg = Math.round(driverSoloGrams) / 1000;
  const driverSoloEmissionKg = Math.round(driverSoloCO2Kg * 100) / 100;

  let soloBaselineDistanceKm = driverSoloDistanceKm;
  let rawSoloBaselineKg = driverSoloCO2Kg;
  let dataCompleteness: "COMPLETE" | "INCOMPLETE" = "COMPLETE";
  const missingReasons: string[] = [];

  if (actualCarpoolDistanceKm <= 0) {
    dataCompleteness = "INCOMPLETE";
    missingReasons.push("Missing vehicle route distance");
  }

  if (passengerCount === 0) {
    dataCompleteness = "COMPLETE";
    const dataCompletenessReason =
      "Single-occupant trip (0 passengers). Baseline equals carpool emissions.";
    return {
      driverSoloDistanceKm,
      driverSoloEmissionKg,
      soloBaselineDistanceKm: driverSoloDistanceKm,
      actualCarpoolDistanceKm,
      soloBaselineCO2Kg: actualCarpoolCO2Kg,
      actualCarpoolCO2Kg,
      grossDifferenceKg: 0,
      co2SavedKg: 0,
      netEmissionsIncreaseKg: 0,
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
    const pGrams = pDist * factor;
    const pCO2 = Math.round(pGrams) / 1000;
    soloBaselineDistanceKm += pDist;
    rawSoloBaselineKg += pCO2;
  }

  soloBaselineDistanceKm = Math.round(soloBaselineDistanceKm * 100) / 100;
  const soloBaselineCO2Kg = Math.round(rawSoloBaselineKg * 100) / 100;

  const grossDifferenceKg = Math.round((soloBaselineCO2Kg - actualCarpoolCO2Kg) * 100) / 100;
  const co2SavedKg = grossDifferenceKg;
  const netEmissionsIncreaseKg = Math.max(0, Math.round((actualCarpoolCO2Kg - soloBaselineCO2Kg) * 100) / 100);
  const vehicleKilometersReduced = Math.round(
    (soloBaselineDistanceKm - actualCarpoolDistanceKm) * 100
  ) / 100;

  let co2ReductionPercentage = 0;
  if (soloBaselineCO2Kg > 0) {
    co2ReductionPercentage =
      Math.round((grossDifferenceKg / soloBaselineCO2Kg) * 100 * 100) / 100;
  }

  let dataCompletenessReason = "";
  if (dataCompleteness === "INCOMPLETE") {
    dataCompletenessReason = missingReasons.join("; ");
  } else {
    dataCompletenessReason = "All driver and passenger distances and emission factors verified";
  }

  return {
    driverSoloDistanceKm,
    driverSoloEmissionKg,
    soloBaselineDistanceKm,
    actualCarpoolDistanceKm,
    soloBaselineCO2Kg,
    actualCarpoolCO2Kg,
    grossDifferenceKg,
    co2SavedKg,
    netEmissionsIncreaseKg,
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

  const records = await CarbonEmission.find(query)
    .populate("rideId", "completedAt startedAt departureDate createdAt")
    .sort({ calculatedAt: -1 })
    .lean();

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

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

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

  for (const r of records) {
    totalPassengers += r.passengerCount || 0;
    totalCarpoolDistanceKm += r.actualCarpoolDistanceKm || 0;
    totalSoloBaselineDistanceKm += r.soloBaselineDistanceKm || 0;
    totalVKRKm += r.vehicleKilometersReduced || 0;
    totalEstimatedCO2EmittedKg += r.actualCarpoolCO2Kg || 0;
    totalEstimatedCO2AvoidedKg += r.co2SavedKg || 0;
    totalSoloBaselineCO2Kg += r.soloBaselineCO2Kg || 0;
    sumOccupancy += r.occupancy || 1;

    // Grouping for monthly time-series analytics (single source of truth)
    // Group ride savings by actual ride completion date, falling back to departure date or calculation date
    const rideDoc = r.rideId as any;
    const completionDate =
      rideDoc?.completedAt ||
      (rideDoc?.departureDate ? new Date(rideDoc.departureDate) : null) ||
      rideDoc?.startedAt ||
      r.calculatedAt ||
      (r as any).createdAt;
    const d = new Date(completionDate);
    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const mLabel = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

    const existingMonth = monthlyMap.get(mKey) || {
      month: mKey,
      label: mLabel,
      co2AvoidedKg: 0,
      co2EmittedKg: 0,
      soloCO2Kg: 0,
      vkrKm: 0,
      ridesCount: 0,
      passengersCount: 0,
    };

    const rideNetAvoided =
      r.grossDifferenceKg !== undefined
        ? r.grossDifferenceKg
        : (r.soloBaselineCO2Kg || 0) - (r.actualCarpoolCO2Kg || 0);

    existingMonth.co2AvoidedKg += rideNetAvoided;
    existingMonth.co2EmittedKg += r.actualCarpoolCO2Kg || 0;
    existingMonth.soloCO2Kg += r.soloBaselineCO2Kg || 0;
    existingMonth.vkrKm += r.vehicleKilometersReduced || 0;
    existingMonth.ridesCount += 1;
    existingMonth.passengersCount += r.passengerCount || 0;

    monthlyMap.set(mKey, existingMonth);

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

    const rideSoloBaseline = Math.round((r.soloBaselineCO2Kg || 0) * 100) / 100;
    const rideCarpoolEmissions = Math.round((r.actualCarpoolCO2Kg || 0) * 100) / 100;
    const rideGrossDiff = Math.round((rideSoloBaseline - rideCarpoolEmissions) * 100) / 100;
    const rideNetIncrease = Math.max(0, Math.round((rideCarpoolEmissions - rideSoloBaseline) * 100) / 100);

    const rideReductionPct =
      rideSoloBaseline > 0
        ? Math.round((rideGrossDiff / rideSoloBaseline) * 100 * 100) / 100
        : 0;

    diagnostics.push({
      rideId: (r.rideId as any)?._id?.toString() || r.rideId?.toString() || r._id.toString(),
      driverSoloDistanceKm: r.driverSoloDistanceKm || r.actualCarpoolDistanceKm,
      driverSoloEmissionKg: r.driverSoloEmissionKg || r.actualCarpoolCO2Kg,
      passengerCount: r.passengerCount || 0,
      soloDistancePerPassenger: soloDistancesStr,
      soloDistances,
      soloBaselineCO2Kg: rideSoloBaseline,
      actualSharedVehicleDistanceKm: Math.round((r.actualCarpoolDistanceKm || 0) * 100) / 100,
      carpoolEmissionsKg: rideCarpoolEmissions,
      grossDifferenceKg: rideGrossDiff,
      avoidedEmissionsKg: rideGrossDiff,
      netEmissionsIncreaseKg: rideNetIncrease,
      reductionPercentage: rideReductionPct,
      dataCompleteness: completeness,
      dataCompletenessReason: completenessReason,
      calculatedAt: r.calculatedAt || (r as any).createdAt,
    });
  }

  const totalSoloBaseline = Math.round(totalSoloBaselineCO2Kg * 100) / 100;
  const totalCarpoolEmissions = Math.round(totalEstimatedCO2EmittedKg * 100) / 100;
  // Net CO2 Avoided = Solo Baseline - Actual Carpool. Retains negative result when carpool exceeds baseline!
  const totalNetCO2AvoidedKg =
    Math.round((totalSoloBaseline - totalCarpoolEmissions) * 100) / 100;
  // Net Emissions Increase = Actual Carpool - Solo Baseline (when positive, else 0)
  const netEmissionsIncreaseKg = Math.max(0, Math.round((totalCarpoolEmissions - totalSoloBaseline) * 100) / 100);

  // Chronologically sort and reconcile monthly time-series
  const sortedMonthKeys = Array.from(monthlyMap.keys()).sort();
  const monthlyData = sortedMonthKeys.map((key) => {
    const item = monthlyMap.get(key)!;
    const mSoloCO2Kg = Math.round(item.soloCO2Kg * 100) / 100;
    const mCarpoolCO2Kg = Math.round(item.co2EmittedKg * 100) / 100;
    // Calculate actual CO2 avoided for each month using Solo Emissions - Carpool Emissions
    const mAvoidedCO2Kg = Math.round((mSoloCO2Kg - mCarpoolCO2Kg) * 100) / 100;
    const mNetIncreaseKg = Math.max(0, Math.round((mCarpoolCO2Kg - mSoloCO2Kg) * 100) / 100);
    return {
      month: item.month,
      label: item.label,
      co2AvoidedKg: mAvoidedCO2Kg,
      co2EmittedKg: mCarpoolCO2Kg,
      soloCO2Kg: mSoloCO2Kg,
      netEmissionsIncreaseKg: mNetIncreaseKg,
      vkrKm: Math.round(item.vkrKm * 100) / 100,
      ridesCount: item.ridesCount,
      passengersCount: item.passengersCount,
    };
  });

  // Reconcile sum of monthly savings with overall summary for the exact same reporting period
  if (monthlyData.length > 0) {
    const sumMonthlyAvoided = Math.round(monthlyData.reduce((acc, m) => acc + m.co2AvoidedKg, 0) * 100) / 100;
    const diff = Math.round((totalNetCO2AvoidedKg - sumMonthlyAvoided) * 100) / 100;
    if (diff !== 0 && Math.abs(diff) <= 0.05) {
      // Reconcile minor centigram rounding delta on the last active month
      const last = monthlyData[monthlyData.length - 1];
      last.co2AvoidedKg = Math.round((last.co2AvoidedKg + diff) * 100) / 100;
    }
  }

  const co2ReductionPercentage =
    totalSoloBaseline > 0
      ? Math.round((totalNetCO2AvoidedKg / totalSoloBaseline) * 100 * 100) / 100
      : 0;

  const averageOccupancy =
    completedRidesCount > 0 ? Math.round((sumOccupancy / completedRidesCount) * 10) / 10 : 0;
  const averageCO2SavingPerRideKg =
    completedRidesCount > 0
      ? Math.round((totalNetCO2AvoidedKg / completedRidesCount) * 100) / 100
      : 0;
  const averageCO2SavingPerPassengerKg =
    totalPassengers > 0
      ? Math.round((totalNetCO2AvoidedKg / totalPassengers) * 100) / 100
      : 0;

  // Active emission factor source for transparency display
  const activeFactor = await EmissionFactor.findOne({ isActive: true }).lean();

  return {
    totalCompletedRides: completedRidesCount,
    totalPassengers,
    totalCarpoolDistanceKm: Math.round(totalCarpoolDistanceKm * 100) / 100,
    totalSoloBaselineDistanceKm: Math.round(totalSoloBaselineDistanceKm * 100) / 100,
    vehicleKilometersReducedKm: Math.round(totalVKRKm * 100) / 100,
    totalSoloBaselineCO2Kg: totalSoloBaseline,
    totalEstimatedCO2EmittedKg: totalCarpoolEmissions,
    totalEstimatedCO2AvoidedKg: totalNetCO2AvoidedKg,
    grossDifferenceKg: totalNetCO2AvoidedKg,
    netEmissionsIncreaseKg,
    averageOccupancy,
    averageCO2SavingPerRideKg,
    averageCO2SavingPerPassengerKg,
    co2ReductionPercentage,
    equivalentTreesPlanted: totalNetCO2AvoidedKg > 0 ? Math.round((totalNetCO2AvoidedKg / 21.77) * 10) / 10 : 0,
    activeEmissionFactorSource: activeFactor?.source || "IPCC 2006 / MoEFCC India GHG Platform",
    activeSourceReference: activeFactor?.sourceReference || "India GHG Platform Baseline",
    diagnostics,
    monthlyData,
  };
}

/**
 * Time-series monthly analytics for charts
 * Guaranteed single source of truth: delegates to getCampusSustainabilityAnalytics
 */
export async function getMonthlyCarbonAnalytics(campusId?: string) {
  const analytics = await getCampusSustainabilityAnalytics(campusId);
  return analytics.monthlyData;
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
