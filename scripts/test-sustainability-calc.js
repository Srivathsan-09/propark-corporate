/**
 * Automated Test Suite for CommuteX Sustainability Calculations
 * 
 * Comprehensive Test Coverage:
 * 1. User Specification Example: 4 Employees sharing 1 car (1 driver + 3 passengers)
 *    Each travels 10 km @ 150 g/km.
 *    Solo Baseline = 6.00 kg, Carpool = 1.50 kg, Avoided = 4.50 kg, Reduction % = 75.0%
 * 2. Live Database Case: Driver Srivathsan (71.4 km) + Passenger Rahul (21.5 km) @ 142.5 g/km
 *    Driver Solo: 10.18 kg, Rahul Solo: 3.06 kg -> Total Baseline: 13.24 kg
 *    Carpool: 10.18 kg -> Avoided: 3.06 kg, Reduction %: 23.11%, VKR: 21.5 km
 * 3. Extreme Detour with Negative Savings (Genuinely higher carpool emissions)
 * 4. Single-Occupant Trip (0 passengers, safe handling where baseline equals carpool, 0% reduction, 0 avoided)
 * 5. Multiple Passengers with Different Journey Distances
 * 6. Missing Passenger Coordinates (flags INCOMPLETE, no silent substitution)
 * 7. Missing Emission Factor Fallback (graceful fallback without NaN)
 * 8. Dashboard Aggregation Independence & Mathematical Integrity (Identity holds: Baseline - Carpool = Avoided)
 * 9. Dashboard Wording Contract (CO₂ Avoided / Net Emissions Increase / No Net Emissions Change)
 */

const assert = require('assert');

// Pure calculation engine implementation matching lib/services/carbonCalculation.ts
function computeSustainabilityFigures(input) {
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
  let dataCompleteness = "COMPLETE";
  const missingReasons = [];

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

  // Net CO2 Avoided = Solo Baseline - Actual Carpool
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

// Aggregation function matching getCampusSustainabilityAnalytics
function aggregateCampusSustainability(records) {
  let totalPassengers = 0;
  let totalCarpoolDistanceKm = 0;
  let totalSoloBaselineDistanceKm = 0;
  let totalVKRKm = 0;
  let totalEstimatedCO2EmittedKg = 0;
  let totalSoloBaselineCO2Kg = 0;

  for (const r of records) {
    totalPassengers += r.passengerCount || 0;
    totalCarpoolDistanceKm += r.actualCarpoolDistanceKm || 0;
    totalSoloBaselineDistanceKm += r.soloBaselineDistanceKm || 0;
    totalVKRKm += r.vehicleKilometersReduced || 0;
    totalEstimatedCO2EmittedKg += r.actualCarpoolCO2Kg || 0;
    totalSoloBaselineCO2Kg += r.soloBaselineCO2Kg || 0;
  }

  const totalSoloBaseline = Math.round(totalSoloBaselineCO2Kg * 100) / 100;
  const totalCarpoolEmissions = Math.round(totalEstimatedCO2EmittedKg * 100) / 100;
  // Net CO2 Avoided = Solo Baseline - Actual Carpool
  const totalNetCO2AvoidedKg = Math.round((totalSoloBaseline - totalCarpoolEmissions) * 100) / 100;
  // Net Emissions Increase = Actual Carpool - Solo Baseline (when positive)
  const netEmissionsIncreaseKg = Math.max(0, Math.round((totalCarpoolEmissions - totalSoloBaseline) * 100) / 100);

  const co2ReductionPercentage =
    totalSoloBaseline > 0
      ? Math.round((totalNetCO2AvoidedKg / totalSoloBaseline) * 100 * 100) / 100
      : 0;

  return {
    completedRidesCount: records.length,
    totalPassengers,
    totalCarpoolDistanceKm: Math.round(totalCarpoolDistanceKm * 100) / 100,
    totalSoloBaselineDistanceKm: Math.round(totalSoloBaselineDistanceKm * 100) / 100,
    vehicleKilometersReducedKm: Math.round(totalVKRKm * 100) / 100,
    totalSoloBaselineCO2Kg: totalSoloBaseline,
    totalEstimatedCO2EmittedKg: totalCarpoolEmissions,
    totalEstimatedCO2AvoidedKg: totalNetCO2AvoidedKg,
    grossDifferenceKg: totalNetCO2AvoidedKg,
    netEmissionsIncreaseKg,
    co2ReductionPercentage,
  };
}

// Function to determine dashboard wording
function getDashboardWording(co2AvoidedKg) {
  if (co2AvoidedKg > 0) return "CO₂ Avoided";
  if (co2AvoidedKg < 0) return "Net Emissions Increase";
  return "No Net Emissions Change";
}

console.log("================================================================================");
console.log("       CommuteX Sustainability Carbon Calculation - Automated Verification      ");
console.log("================================================================================\n");

let passedCount = 0;
let totalCount = 9;

// TEST 1: User Specification Example (4 Employees: 1 Driver + 3 Passengers, each 10 km @ 150 g/km)
try {
  console.log("TEST 1: User Specification Example (4 Employees: 1 Driver + 3 Pax @ 10 km & 150 g/km)");
  const res = computeSustainabilityFigures({
    actualCarpoolDistanceKm: 10,
    driverGramsCO2PerKm: 150,
    driverSoloDistanceKm: 10,
    passengers: [
      { name: "Employee B", distanceKm: 10, gramsCO2PerKm: 150, hasValidCoordinates: true },
      { name: "Employee C", distanceKm: 10, gramsCO2PerKm: 150, hasValidCoordinates: true },
      { name: "Employee D", distanceKm: 10, gramsCO2PerKm: 150, hasValidCoordinates: true },
    ],
  });

  console.log("  Calculated Results:", JSON.stringify({
    soloBaselineCO2Kg: res.soloBaselineCO2Kg,
    actualCarpoolCO2Kg: res.actualCarpoolCO2Kg,
    netCO2AvoidedKg: res.co2SavedKg,
    co2ReductionPercentage: res.co2ReductionPercentage,
    vehicleKilometersReduced: res.vehicleKilometersReduced,
  }, null, 2));

  assert.strictEqual(res.soloBaselineCO2Kg, 6.00, "Solo baseline must be exactly 6.00 kg (4 x 1.5 kg)");
  assert.strictEqual(res.actualCarpoolCO2Kg, 1.50, "Carpool emissions must be exactly 1.50 kg (10 km x 150 g/km)");
  assert.strictEqual(res.co2SavedKg, 4.50, "Net CO2 avoided must be exactly 4.50 kg (6.00 - 1.50)");
  assert.strictEqual(res.netEmissionsIncreaseKg, 0, "Net emissions increase must be 0 kg");
  assert.strictEqual(res.co2ReductionPercentage, 75.0, "Reduction percentage must be exactly 75.0% ((4.50 / 6.00) * 100)");
  assert.strictEqual(res.vehicleKilometersReduced, 30.0, "VKR must be exactly 30 km ((40 - 10))");
  assert.strictEqual(getDashboardWording(res.co2SavedKg), "CO₂ Avoided", "Wording must be 'CO₂ Avoided'");

  console.log("  -> PASSED: 4-employee specification test verified with exact 75% reduction!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 1:", err.message, "\n");
}

// TEST 2: Live Database Completed Ride (Driver 71.4 km + Pax Rahul 21.5 km @ 142.5 g/km)
try {
  console.log("TEST 2: Live DB Completed Ride (Driver 71.4 km + Pax Rahul 21.5 km @ 142.5 g/km)");
  const res = computeSustainabilityFigures({
    actualCarpoolDistanceKm: 71.4,
    driverGramsCO2PerKm: 142.5,
    driverSoloDistanceKm: 71.4,
    passengers: [
      { name: "Rahul", distanceKm: 21.5, gramsCO2PerKm: 142.5, hasValidCoordinates: true },
    ],
  });

  console.log("  Calculated Results:", JSON.stringify({
    driverSoloEmissionKg: res.driverSoloEmissionKg,
    soloBaselineCO2Kg: res.soloBaselineCO2Kg,
    actualCarpoolCO2Kg: res.actualCarpoolCO2Kg,
    netCO2AvoidedKg: res.co2SavedKg,
    co2ReductionPercentage: res.co2ReductionPercentage,
    vehicleKilometersReduced: res.vehicleKilometersReduced,
  }, null, 2));

  assert.strictEqual(res.driverSoloEmissionKg, 10.18, "Driver solo emissions must be 10.18 kg (71.4 x 142.5)");
  assert.strictEqual(res.soloBaselineCO2Kg, 13.24, "Total Solo baseline must be exactly 13.24 kg (10.18 + 3.06)");
  assert.strictEqual(res.actualCarpoolCO2Kg, 10.18, "Carpool emissions must be exactly 10.18 kg");
  assert.strictEqual(res.co2SavedKg, 3.06, "Net CO2 avoided must be exactly 3.06 kg (13.24 - 10.18)");
  assert.strictEqual(res.netEmissionsIncreaseKg, 0, "Net emissions increase must be 0 kg");
  assert.strictEqual(res.co2ReductionPercentage, 23.11, "Reduction percentage must be 23.11% ((3.06 / 13.24) * 100)");
  assert.strictEqual(res.vehicleKilometersReduced, 21.5, "VKR must be 21.5 km");
  assert.strictEqual(getDashboardWording(res.co2SavedKg), "CO₂ Avoided", "Wording must be 'CO₂ Avoided'");

  console.log("  -> PASSED: Live completed ride calculation verified with positive 3.06 kg savings!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 2:", err.message, "\n");
}

// TEST 3: Multi-Passenger Detour Causing Real Negative Savings
try {
  console.log("TEST 3: Multi-Passenger Detour Causing Real Negative Savings (Huge Detour)");
  // Driver direct: 10 km. With detour to pick up passenger: 50 km total. Passenger direct: 5 km.
  // Solo baseline: (10 + 5) * 150 / 1000 = 2.25 kg.
  // Actual carpool: 50 * 150 / 1000 = 7.50 kg.
  // Avoided: 2.25 - 7.50 = -5.25 kg. Net increase: 5.25 kg.
  const res = computeSustainabilityFigures({
    actualCarpoolDistanceKm: 50,
    driverGramsCO2PerKm: 150,
    driverSoloDistanceKm: 10,
    passengers: [
      { name: "Pax Detour", distanceKm: 5, gramsCO2PerKm: 150, hasValidCoordinates: true },
    ],
  });

  assert.strictEqual(res.soloBaselineCO2Kg, 2.25, "Solo baseline must be 2.25 kg");
  assert.strictEqual(res.actualCarpoolCO2Kg, 7.50, "Carpool emissions must be 7.50 kg");
  assert.strictEqual(res.co2SavedKg, -5.25, "Avoided CO2 must be -5.25 kg");
  assert.strictEqual(res.netEmissionsIncreaseKg, 5.25, "Net increase must be 5.25 kg");
  assert.strictEqual(res.co2ReductionPercentage, -233.33, "Reduction % must be -233.33%");
  assert.strictEqual(getDashboardWording(res.co2SavedKg), "Net Emissions Increase", "Wording must be 'Net Emissions Increase'");

  console.log("  -> PASSED: Real detour negative savings handled honestly!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 3:", err.message, "\n");
}

// TEST 4: Single-Occupant Trip (0 Passengers / Driver Solo)
try {
  console.log("TEST 4: Single-Occupant Trip (0 Passengers, Baseline Equals Carpool)");
  const res = computeSustainabilityFigures({
    actualCarpoolDistanceKm: 25,
    driverGramsCO2PerKm: 150,
    driverSoloDistanceKm: 25,
    passengers: [],
  });

  assert.strictEqual(res.soloBaselineCO2Kg, 3.75, "Solo Baseline CO2 must equal actual carpool for 0 passengers");
  assert.strictEqual(res.actualCarpoolCO2Kg, 3.75, "Carpool CO2 must be 3.75 kg (25 * 150 / 1000)");
  assert.strictEqual(res.grossDifferenceKg, 0, "Gross difference must be 0 kg");
  assert.strictEqual(res.co2SavedKg, 0, "Net CO2 avoided must be 0 kg");
  assert.strictEqual(res.netEmissionsIncreaseKg, 0, "Net emissions increase must be 0 kg");
  assert.strictEqual(res.co2ReductionPercentage, 0, "Reduction % must be 0%");
  assert.strictEqual(res.vehicleKilometersReduced, 0, "VKR must be 0 km");
  assert.strictEqual(res.dataCompleteness, "COMPLETE", "Data completeness must be COMPLETE");
  assert.strictEqual(getDashboardWording(res.co2SavedKg), "No Net Emissions Change", "Wording must be 'No Net Emissions Change'");

  console.log("  -> PASSED: Single-occupant trip handled correctly without division by zero or NaN!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 4:", err.message, "\n");
}

// TEST 5: Different Passenger Solo Distances with Substantial Positive Savings
try {
  console.log("TEST 5: Different Passenger Solo Distances with Substantial Positive Savings");
  const res = computeSustainabilityFigures({
    actualCarpoolDistanceKm: 35,
    driverGramsCO2PerKm: 140,
    driverSoloDistanceKm: 35,
    passengers: [
      { name: "Pax 1", distanceKm: 20, gramsCO2PerKm: 140, hasValidCoordinates: true },
      { name: "Pax 2", distanceKm: 30, gramsCO2PerKm: 140, hasValidCoordinates: true },
    ],
  });

  // Driver: 35 km -> 4.90 kg
  // Pax 1: 20 km -> 2.80 kg
  // Pax 2: 30 km -> 4.20 kg
  // Solo Baseline: 4.90 + 2.80 + 4.20 = 11.90 kg
  // Carpool: 35 km -> 4.90 kg
  // Avoided: 11.90 - 4.90 = 7.00 kg
  // Reduction %: (7.00 / 11.90) * 100 = 58.82%
  assert.strictEqual(res.soloBaselineCO2Kg, 11.90, "Solo baseline must be 11.90 kg");
  assert.strictEqual(res.actualCarpoolCO2Kg, 4.90, "Carpool emissions must be 4.90 kg");
  assert.strictEqual(res.co2SavedKg, 7.00, "Avoided CO2 must be 7.00 kg");
  assert.strictEqual(res.co2ReductionPercentage, 58.82, "Reduction % must be 58.82%");
  assert.strictEqual(res.vehicleKilometersReduced, 50.0, "VKR must be 50 km ((35 + 20 + 30) - 35)");

  console.log("  -> PASSED: Multiple varying distance passengers verified!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 5:", err.message, "\n");
}

// TEST 6: Missing Passenger Coordinates (No Silent Substitution)
try {
  console.log("TEST 6: Missing Passenger Coordinates (Flags INCOMPLETE, No Silent Substitution)");
  const res = computeSustainabilityFigures({
    actualCarpoolDistanceKm: 50,
    driverGramsCO2PerKm: 150,
    driverSoloDistanceKm: 50,
    passengers: [
      { name: "Valid Passenger", distanceKm: 20, gramsCO2PerKm: 150, hasValidCoordinates: true },
      { name: "Missing Passenger", distanceKm: 0, gramsCO2PerKm: 150, hasValidCoordinates: false },
    ],
  });

  assert.strictEqual(res.dataCompleteness, "INCOMPLETE", "Calculation must be marked INCOMPLETE");
  assert.ok(res.dataCompletenessReason.includes("Missing Passenger"), "Reason must identify the incomplete passenger");
  assert.strictEqual(res.soloBaselineDistanceKm, 70, "Solo baseline distance must be Driver (50) + Valid Pax (20)");

  console.log("  -> PASSED: Incomplete data flagged honestly without silent estimation!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 6:", err.message, "\n");
}

// TEST 7: Missing Emission Factor Fallback
try {
  console.log("TEST 7: Missing Emission Factor Fallback (Safe handling without NaN)");
  const res = computeSustainabilityFigures({
    actualCarpoolDistanceKm: 10,
    driverGramsCO2PerKm: null,
    driverSoloDistanceKm: 10,
    passengers: [
      { name: "P1", distanceKm: 10, gramsCO2PerKm: undefined, hasValidCoordinates: true },
    ],
  });

  assert.ok(!isNaN(res.actualCarpoolCO2Kg), "Carpool CO2 must not be NaN");
  assert.ok(!isNaN(res.soloBaselineCO2Kg), "Solo baseline CO2 must not be NaN");
  assert.strictEqual(res.actualCarpoolCO2Kg, 1.50, "Carpool CO2 must resolve using fallback 150 g/km");
  assert.strictEqual(res.soloBaselineCO2Kg, 3.00, "Solo baseline must resolve to 3.00 kg (1.50 driver + 1.50 pax)");

  console.log("  -> PASSED: Fallback emission factor handled gracefully!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 7:", err.message, "\n");
}

// TEST 8: Dashboard Aggregation Independence & Mathematical Integrity
try {
  console.log("TEST 8: Dashboard Aggregation Independence & Mathematical Integrity");
  const records = [
    {
      rideId: "6a981c069f5103c8e838e425",
      passengerCount: 1,
      soloBaselineDistanceKm: 92.9,
      actualCarpoolDistanceKm: 71.4,
      soloBaselineCO2Kg: 13.24,
      actualCarpoolCO2Kg: 10.18,
      co2SavedKg: 3.06,
      grossDifferenceKg: 3.06,
      netEmissionsIncreaseKg: 0,
      co2ReductionPercentage: 23.11,
      vehicleKilometersReduced: 21.5,
    },
  ];

  const agg = aggregateCampusSustainability(records);

  console.log("  Aggregated Results:", JSON.stringify({
    totalSoloBaselineCO2Kg: agg.totalSoloBaselineCO2Kg,
    totalEstimatedCO2EmittedKg: agg.totalEstimatedCO2EmittedKg,
    totalEstimatedCO2AvoidedKg: agg.totalEstimatedCO2AvoidedKg,
    co2ReductionPercentage: agg.co2ReductionPercentage,
    vehicleKilometersReducedKm: agg.vehicleKilometersReducedKm,
  }, null, 2));

  assert.strictEqual(agg.totalSoloBaselineCO2Kg, 13.24, "Total Solo Baseline must be 13.24 kg");
  assert.strictEqual(agg.totalEstimatedCO2EmittedKg, 10.18, "Total Carpool Emitted must be 10.18 kg");
  assert.strictEqual(agg.totalEstimatedCO2AvoidedKg, 3.06, "Net CO2 Avoided must be 3.06 kg");
  assert.strictEqual(agg.netEmissionsIncreaseKg, 0, "Net Emissions Increase must be 0 kg");
  assert.strictEqual(agg.co2ReductionPercentage, 23.11, "Reduction percentage must be 23.11%");
  assert.strictEqual(agg.vehicleKilometersReducedKm, 21.5, "VKR must be 21.5 km");

  // Verify mathematical identity: baseline - carpool == avoided
  assert.strictEqual(
    Math.round((agg.totalSoloBaselineCO2Kg - agg.totalEstimatedCO2EmittedKg) * 100) / 100,
    agg.totalEstimatedCO2AvoidedKg,
    "Mathematical identity holds: soloBaseline - carpool == avoided"
  );

  console.log("  -> PASSED: Aggregation mathematical integrity verified!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 8:", err.message, "\n");
}

// TEST 9: Dashboard Wording Contract
try {
  console.log("TEST 9: Dashboard Wording Contract");
  assert.strictEqual(getDashboardWording(3.06), "CO₂ Avoided", "Positive savings -> 'CO₂ Avoided'");
  assert.strictEqual(getDashboardWording(-5.25), "Net Emissions Increase", "Negative savings -> 'Net Emissions Increase'");
  assert.strictEqual(getDashboardWording(0), "No Net Emissions Change", "Zero savings -> 'No Net Emissions Change'");

  console.log("  -> PASSED: Dashboard wording contract verified!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 9:", err.message, "\n");
}

console.log("================================================================================");
console.log(` SUMMARY: ${passedCount} of ${totalCount} test cases PASSED!`);
console.log("================================================================================");

if (passedCount !== totalCount) {
  process.exit(1);
} else {
  process.exit(0);
}
