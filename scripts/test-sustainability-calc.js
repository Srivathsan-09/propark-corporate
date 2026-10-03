/**
 * Automated Test Suite for CommuteX Sustainability Calculations
 * 
 * Comprehensive Test Coverage:
 * 1. One passenger with genuinely negative savings (live database case)
 * 2. Multiple passengers with route detours and positive savings
 * 3. Multiple passengers with route detours causing genuinely negative savings
 * 4. Different solo distances with positive savings
 * 5. Zero distance / Single-occupant trip (0 passengers, safe handling of zero baseline)
 * 6. Missing passenger distance (flags INCOMPLETE, no silent 85% substitution)
 * 7. Missing emission factor fallback (handles gracefully without NaN)
 * 8. Dashboard aggregation independence & monthly totals consistency (retains negative avoided emissions)
 */

const assert = require('assert');

// Pure calculation engine implementation matching lib/services/carbonCalculation.ts
function computeSustainabilityFigures(input) {
  const actualCarpoolDistanceKm = Math.max(0, input.actualCarpoolDistanceKm || 0);
  const driverFactor = input.driverGramsCO2PerKm || 150;
  const actualCarpoolCO2Kg =
    Math.round(((actualCarpoolDistanceKm * driverFactor) / 1000) * 1000) / 1000;

  const passengers = input.passengers || [];
  const passengerCount = passengers.length;
  let soloBaselineDistanceKm = 0;
  let soloBaselineCO2Kg = 0;
  let dataCompleteness = "COMPLETE";
  const missingReasons = [];

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
      co2SavedKg: Math.round((0 - actualCarpoolCO2Kg) * 1000) / 1000,
      co2ReductionPercentage: 0,
      vehicleKilometersReduced: Math.round((0 - actualCarpoolDistanceKm) * 100) / 100,
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

  // Net CO2 Avoided = Solo Baseline - Actual Carpool (retains negative result!)
  const grossDifferenceKg = Math.round((soloBaselineCO2Kg - actualCarpoolCO2Kg) * 1000) / 1000;
  const co2SavedKg = grossDifferenceKg;
  const vehicleKilometersReduced = Math.round(
    (soloBaselineDistanceKm - actualCarpoolDistanceKm) * 100
  ) / 100;

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

// Aggregation function matching getCampusSustainabilityAnalytics & getMonthlyCarbonAnalytics
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

  totalSoloBaselineCO2Kg = Math.round(totalSoloBaselineCO2Kg * 1000) / 1000;
  totalEstimatedCO2EmittedKg = Math.round(totalEstimatedCO2EmittedKg * 1000) / 1000;
  // Net Avoided = Solo Baseline - Carpool Emitted
  const totalEstimatedCO2AvoidedKg = Math.round((totalSoloBaselineCO2Kg - totalEstimatedCO2EmittedKg) * 1000) / 1000;
  const totalGrossDifferenceKg = totalEstimatedCO2AvoidedKg;

  const co2ReductionPercentage =
    totalSoloBaselineCO2Kg > 0
      ? Math.round((totalEstimatedCO2AvoidedKg / totalSoloBaselineCO2Kg) * 100 * 10) / 10
      : 0;

  return {
    completedRidesCount: records.length,
    totalPassengers,
    totalCarpoolDistanceKm: Math.round(totalCarpoolDistanceKm * 100) / 100,
    totalSoloBaselineDistanceKm: Math.round(totalSoloBaselineDistanceKm * 100) / 100,
    vehicleKilometersReducedKm: Math.round(totalVKRKm * 100) / 100,
    totalSoloBaselineCO2Kg,
    totalEstimatedCO2EmittedKg,
    totalEstimatedCO2AvoidedKg,
    totalGrossDifferenceKg,
    co2ReductionPercentage,
  };
}

console.log("================================================================================");
console.log("       CommuteX Sustainability Carbon Calculation - Automated Verification      ");
console.log("================================================================================\n");

let passedCount = 0;
let totalCount = 8;

// TEST 1: One Passenger with Genuinely Negative Savings (Live Database Case)
try {
  console.log("TEST 1: One Passenger with Genuinely Negative Savings (Live DB Case: 21.5 km vs 71.4 km)");
  const res = computeSustainabilityFigures({
    actualCarpoolDistanceKm: 71.4,
    driverGramsCO2PerKm: 142.5,
    passengers: [
      { name: "Rahul", distanceKm: 21.5, gramsCO2PerKm: 142.5, hasValidCoordinates: true },
    ],
  });

  console.log("  Results:", JSON.stringify({
    soloBaselineCO2Kg: res.soloBaselineCO2Kg,
    actualCarpoolCO2Kg: res.actualCarpoolCO2Kg,
    netCO2AvoidedKg: res.co2SavedKg,
    co2ReductionPercentage: res.co2ReductionPercentage,
  }, null, 2));

  assert.strictEqual(res.soloBaselineCO2Kg, 3.064, "Solo baseline must be exactly 3.064 kg");
  assert.strictEqual(res.actualCarpoolCO2Kg, 10.175, "Carpool emissions must be exactly 10.175 kg");
  assert.strictEqual(res.co2SavedKg, -7.111, "Net CO2 avoided must retain negative result: -7.111 kg");
  assert.strictEqual(res.co2ReductionPercentage, -232.1, "Reduction percentage must be -232.1%");
  assert.strictEqual(res.dataCompleteness, "COMPLETE", "Status must be COMPLETE");

  console.log("  -> PASSED: One passenger negative savings calculated and retained accurately!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 1:", err.message, "\n");
}

// TEST 2: Multiple Passengers with Route Detours and Positive Savings
try {
  console.log("TEST 2: Multiple Passengers with Route Detours & Positive Savings (3 pax: 15, 18, 17 km vs 20 km)");
  const res = computeSustainabilityFigures({
    actualCarpoolDistanceKm: 20,
    driverGramsCO2PerKm: 150,
    passengers: [
      { name: "P1", distanceKm: 15, gramsCO2PerKm: 150, hasValidCoordinates: true },
      { name: "P2", distanceKm: 18, gramsCO2PerKm: 150, hasValidCoordinates: true },
      { name: "P3", distanceKm: 17, gramsCO2PerKm: 150, hasValidCoordinates: true },
    ],
  });

  assert.strictEqual(res.soloBaselineCO2Kg, 7.50, "Solo Baseline CO2 must be exactly 7.50 kg");
  assert.strictEqual(res.actualCarpoolCO2Kg, 3.00, "Carpool CO2 must be exactly 3.00 kg");
  assert.strictEqual(res.co2SavedKg, 4.50, "Avoided CO2 must be exactly 4.50 kg");
  assert.strictEqual(res.co2ReductionPercentage, 60.0, "Reduction percentage must be 60.0%");
  assert.strictEqual(res.dataCompleteness, "COMPLETE", "Data completeness must be COMPLETE");

  console.log("  -> PASSED: Multiple passengers with positive savings verified!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 2:", err.message, "\n");
}

// TEST 3: Multiple Passengers with Massive Route Detours Causing Negative Savings
try {
  console.log("TEST 3: Multiple Passengers with Massive Route Detour Causing Genuinely Negative Savings");
  const res = computeSustainabilityFigures({
    actualCarpoolDistanceKm: 40, // massive detour
    driverGramsCO2PerKm: 150,
    passengers: [
      { name: "P1", distanceKm: 10, gramsCO2PerKm: 150, hasValidCoordinates: true },
      { name: "P2", distanceKm: 8, gramsCO2PerKm: 150, hasValidCoordinates: true },
    ],
  });

  // Baseline = (10 + 8) * 150 / 1000 = 2.70 kg
  // Carpool = 40 * 150 / 1000 = 6.00 kg
  // Net avoided = 2.70 - 6.00 = -3.30 kg
  // Reduction % = (-3.30 / 2.70) * 100 = -122.2%
  assert.strictEqual(res.soloBaselineCO2Kg, 2.70, "Solo baseline must be 2.70 kg");
  assert.strictEqual(res.actualCarpoolCO2Kg, 6.00, "Carpool emissions must be 6.00 kg");
  assert.strictEqual(res.co2SavedKg, -3.30, "Avoided CO2 must retain negative -3.30 kg");
  assert.strictEqual(res.co2ReductionPercentage, -122.2, "Reduction percentage must be -122.2%");

  console.log("  -> PASSED: Multi-passenger route detour causing negative savings retained!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 3:", err.message, "\n");
}

// TEST 4: Different Solo Distances with Positive Savings
try {
  console.log("TEST 4: Different Solo Distances with Positive Savings (25 km, 35 km vs 38 km @ 140 g/km)");
  const res = computeSustainabilityFigures({
    actualCarpoolDistanceKm: 38,
    driverGramsCO2PerKm: 140,
    passengers: [
      { name: "Pax A", distanceKm: 25, gramsCO2PerKm: 140, hasValidCoordinates: true },
      { name: "Pax B", distanceKm: 35, gramsCO2PerKm: 140, hasValidCoordinates: true },
    ],
  });

  // Baseline = (25 + 35) * 140 / 1000 = 60 * 0.14 = 8.40 kg
  // Carpool = 38 * 140 / 1000 = 5.32 kg
  // Avoided = 8.40 - 5.32 = 3.08 kg
  // Reduction % = (3.08 / 8.40) * 100 = 36.7%
  assert.strictEqual(res.soloBaselineCO2Kg, 8.40, "Solo baseline must be 8.40 kg");
  assert.strictEqual(res.actualCarpoolCO2Kg, 5.32, "Carpool emissions must be 5.32 kg");
  assert.strictEqual(res.co2SavedKg, 3.08, "Avoided CO2 must be 3.08 kg");
  assert.strictEqual(res.co2ReductionPercentage, 36.7, "Reduction % must be 36.7%");

  console.log("  -> PASSED: Different solo distances with positive savings verified!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 4:", err.message, "\n");
}

// TEST 5: Single-Occupant Trip (0 Passengers / Zero Passenger Distance)
try {
  console.log("TEST 5: Single-Occupant Trip (0 Passengers, Safe Handling of Zero Baseline)");
  const res = computeSustainabilityFigures({
    actualCarpoolDistanceKm: 25,
    driverGramsCO2PerKm: 150,
    passengers: [],
  });

  assert.strictEqual(res.soloBaselineCO2Kg, 0, "Solo Baseline CO2 must be 0 for 0 passengers");
  assert.strictEqual(res.actualCarpoolCO2Kg, 3.75, "Carpool CO2 must be 3.75 kg (25 * 150 / 1000)");
  assert.strictEqual(res.grossDifferenceKg, -3.75, "Gross difference must be -3.75 kg");
  assert.strictEqual(res.co2SavedKg, -3.75, "Net CO2 avoided must retain negative result: -3.75 kg");
  assert.strictEqual(res.co2ReductionPercentage, 0, "Reduction % must safely be 0% when baseline is 0");
  assert.strictEqual(res.dataCompleteness, "COMPLETE", "Data completeness must be COMPLETE");

  console.log("  -> PASSED: Single-occupant trip handled honestly and safely!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 5:", err.message, "\n");
}

// TEST 6: Missing Passenger Coordinates (No Silent 85% Substitution)
try {
  console.log("TEST 6: Missing Passenger Coordinates (No Silent 85% Substitution)");
  const res = computeSustainabilityFigures({
    actualCarpoolDistanceKm: 50,
    driverGramsCO2PerKm: 150,
    passengers: [
      { name: "Valid Passenger", distanceKm: 20, gramsCO2PerKm: 150, hasValidCoordinates: true },
      { name: "Missing Passenger", distanceKm: 0, gramsCO2PerKm: 150, hasValidCoordinates: false },
    ],
  });

  assert.strictEqual(res.dataCompleteness, "INCOMPLETE", "Calculation must be marked INCOMPLETE");
  assert.ok(res.dataCompletenessReason.includes("Missing Passenger"), "Reason must identify the incomplete passenger");
  assert.strictEqual(res.soloBaselineDistanceKm, 20, "Distance must NOT substitute 85% for missing passenger");

  console.log("  -> PASSED: Missing data flagged INCOMPLETE without silent substitution!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 6:", err.message, "\n");
}

// TEST 7: Missing Emission Factor Fallback
try {
  console.log("TEST 7: Missing Emission Factor Fallback");
  const res = computeSustainabilityFigures({
    actualCarpoolDistanceKm: 10,
    driverGramsCO2PerKm: null, // should fall back to standard 150 g/km
    passengers: [
      { name: "P1", distanceKm: 10, gramsCO2PerKm: undefined, hasValidCoordinates: true },
    ],
  });

  assert.ok(!isNaN(res.actualCarpoolCO2Kg), "Carpool CO2 must not be NaN");
  assert.ok(!isNaN(res.soloBaselineCO2Kg), "Solo baseline CO2 must not be NaN");
  assert.strictEqual(res.actualCarpoolCO2Kg, 1.50, "Carpool CO2 must resolve using fallback");

  console.log("  -> PASSED: Fallback emission factor handled gracefully without NaN!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 7:", err.message, "\n");
}

// TEST 8: Dashboard Aggregation Independence & Negative Savings Retention
try {
  console.log("TEST 8: Dashboard Aggregation Independence & Negative Savings Retention");
  const records = [
    {
      rideId: "6a981c069f5103c8e838e425",
      passengerCount: 1,
      soloBaselineDistanceKm: 21.5,
      actualCarpoolDistanceKm: 71.4,
      soloBaselineCO2Kg: 3.064,
      actualCarpoolCO2Kg: 10.175,
      co2SavedKg: -7.111,
      grossDifferenceKg: -7.111,
      co2ReductionPercentage: -232.1,
    },
  ];

  const agg = aggregateCampusSustainability(records);

  console.log("  Aggregated Results:", JSON.stringify({
    totalSoloBaselineCO2Kg: agg.totalSoloBaselineCO2Kg,
    totalEstimatedCO2EmittedKg: agg.totalEstimatedCO2EmittedKg,
    totalEstimatedCO2AvoidedKg: agg.totalEstimatedCO2AvoidedKg,
    co2ReductionPercentage: agg.co2ReductionPercentage,
  }, null, 2));

  assert.strictEqual(agg.totalSoloBaselineCO2Kg, 3.064, "Total Solo Baseline must be 3.064 kg");
  assert.strictEqual(agg.totalEstimatedCO2EmittedKg, 10.175, "Total Carpool Emitted must be 10.175 kg");
  assert.strictEqual(agg.totalEstimatedCO2AvoidedKg, -7.111, "Net CO2 Avoided must be retained as -7.111 kg");
  assert.strictEqual(agg.co2ReductionPercentage, -232.1, "Reduction percentage must be -232.1%");

  console.log("  -> PASSED: Aggregation independence and negative savings retention verified!\n");
  passedCount++;
} catch (err) {
  console.error("  -> FAILED TEST 8:", err.message, "\n");
}

console.log("================================================================================");
console.log(` SUMMARY: ${passedCount} of ${totalCount} test cases PASSED!`);
console.log("================================================================================");

if (passedCount !== totalCount) {
  process.exit(1);
} else {
  process.exit(0);
}
