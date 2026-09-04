/**
 * Automated Verification Test Suite for Dynamic Route Recalculation (Real-Time Rerouting)
 *
 * Tests the 5 Core Acceptance Scenarios and geometric utilities:
 * Scenario 1: Normal navigation (no unnecessary reroute)
 * Scenario 2: Missed turn / deviation (automatic reroute starting from current GPS)
 * Scenario 3: Multiple deviations (sequential recalculation, polyline replacement)
 * Scenario 4: GPS fluctuation / noise (filtering accuracy, jitter, stationary)
 * Scenario 5: Routing API failure (resilient handling, no crash, trip preserved)
 */

import {
  calculatePerpendicularDistanceToSegmentMeters,
  calculateMinDistanceToPolylineMeters,
  calculateHaversineDistanceMeters,
  isHeadingAligned,
  evaluateDeviation,
  DynamicRerouteEngine,
  DEFAULT_REROUTING_CONFIG,
} from "../lib/services/rerouting";
import { routingService, LatLngPoint, RouteResult } from "../lib/services/routing";

interface TestResult {
  testNumber: string;
  name: string;
  passed: boolean;
  expected?: any;
  actual?: any;
  error?: string;
}

const testResults: TestResult[] = [];

function assert(testNumber: string, name: string, condition: boolean, actual?: any, expected?: any) {
  testResults.push({ testNumber, name, passed: Boolean(condition), actual, expected });
  const icon = condition ? "[PASS]" : "[FAIL]";
  console.log(` ${icon} | [${testNumber}] ${name}`);
  if (!condition) {
    console.error(`       Expected: ${JSON.stringify(expected)}`);
    console.error(`       Actual:   ${JSON.stringify(actual)}`);
  }
}

async function runDynamicReroutingTestSuite() {
  console.log("\n=======================================================");
  console.log(" Running CommuteX Dynamic Route Recalculation Tests");
  console.log("=======================================================\n");

  // -------------------------------------------------------------
  // Section 1: Geometric Utilities & Perpendicular Distance Tests
  // -------------------------------------------------------------
  console.log("--- 1. Geometric Utilities & Distance Math ---");

  // Segment from (13.0000, 80.2000) to (13.0000, 80.2100) -> East-West horizontal line
  const segA = { latitude: 13.0000, longitude: 80.2000 };
  const segB = { latitude: 13.0000, longitude: 80.2100 };

  // Point on segment
  const ptOn = { latitude: 13.0000, longitude: 80.2050 };
  const matchOn = calculatePerpendicularDistanceToSegmentMeters(ptOn, segA, segB);
  assert("GEO-1", "Point directly on segment has ~0m distance", matchOn.distanceMeters < 1, matchOn.distanceMeters, 0);

  // Point 100m North of midpoint
  // 1 degree latitude ~ 111,000m -> 100m ~ 0.00090 degrees lat
  const ptNorth = { latitude: 13.0009, longitude: 80.2050 };
  const matchNorth = calculatePerpendicularDistanceToSegmentMeters(ptNorth, segA, segB);
  assert("GEO-2", "Point 100m North of segment measures ~100m distance", Math.abs(matchNorth.distanceMeters - 100) < 5, Math.round(matchNorth.distanceMeters), 100);

  // Point beyond segment endpoint (clamping test)
  const ptPastEnd = { latitude: 13.0000, longitude: 80.2150 }; // 0.005 deg East of B (~540m)
  const matchPast = calculatePerpendicularDistanceToSegmentMeters(ptPastEnd, segA, segB);
  assert("GEO-3", "Point beyond endpoint clamps to endpoint B", matchPast.t === 1, matchPast.t, 1);
  assert("GEO-4", "Clamped distance is distance to endpoint B", matchPast.distanceMeters > 500, matchPast.distanceMeters, ">500");

  // Heading alignment
  assert("GEO-5", "Heading 90 matches bearing 90 (aligned)", isHeadingAligned(90, 90, 45) === true);
  assert("GEO-6", "Heading 270 does NOT match bearing 90 (opposite direction)", isHeadingAligned(270, 90, 45) === false);

  // -------------------------------------------------------------
  // Section 2: Scenario 1 — Normal Navigation
  // Route: A (12.9249, 80.1472) -> B (12.9349, 80.1572) -> C (12.9449, 80.1672) -> D (12.9549, 80.1772)
  // User follows route normally within 5-15 meters
  // -------------------------------------------------------------
  console.log("\n--- Scenario 1: Normal Navigation (A -> B -> C -> D) ---");

  const routeCoordinates: [number, number][] = [
    [12.9249, 80.1472], // A (Origin)
    [12.9349, 80.1572], // B
    [12.9449, 80.1672], // C
    [12.9549, 80.1772], // D (Destination)
  ];

  const destination: LatLngPoint = { latitude: 12.9549, longitude: 80.1772, name: "Destination Campus" };

  const engine = new DynamicRerouteEngine({
    deviationThresholdMeters: 35,
    consecutiveDeviationsRequired: 2,
    cooldownSeconds: 4,
  });
  engine.setActivePolyline(routeCoordinates);

  // Fix 1: Exactly on A->B
  const normalFix1 = { latitude: 12.9299, longitude: 80.1522, accuracy: 10, speed: 30 };
  const res1 = await engine.onPositionUpdate(normalFix1, destination);
  assert("SC1-1", "Normal driving on segment produces no reroute", res1.shouldReroute === false);
  assert("SC1-2", "Deviation distance is near 0m", (res1.deviationDistanceMeters || 0) < 5);

  // Fix 2: Slight 8m offset (well within 35m threshold)
  // ~0.00007 deg lat is ~8m
  const normalFix2 = { latitude: 12.9300, longitude: 80.1522, accuracy: 8, speed: 32 };
  const res2 = await engine.onPositionUpdate(normalFix2, destination);
  assert("SC1-3", "Minor 8m road offset does not trigger deviation", res2.shouldReroute === false);
  assert("SC1-4", "Still on planned route", engine.getHasRerouted() === false);

  // -------------------------------------------------------------
  // Section 3: Scenario 2 — Missed Turn / Deviation
  // Original: A -> B -> C -> D
  // Driver misses turn at B and travels towards E: (12.9349, 80.1700) (~1.3 km away)
  // -------------------------------------------------------------
  console.log("\n--- Scenario 2: Missed Turn / Deviation (A -> B -> E) ---");

  // Point E: driver missed the turn and is now 60m away from route
  // From segment (12.9349, 80.1572) -> (12.9449, 80.1672), let's place E perpendicular ~65m away
  const pointE_1 = { latitude: 12.9349, longitude: 80.1582, accuracy: 12, speed: 28 }; // ~100m off route
  const evalE1 = evaluateDeviation(pointE_1, routeCoordinates, engine.getConfig());
  assert("SC2-1", "evaluateDeviation correctly flags 100m distance as deviated", evalE1.isDeviated === true);
  assert("SC2-2", "Evaluated distance exceeds 35m threshold", evalE1.distanceMeters > 35);

  // First deviated fix: engine notes deviation but requires confirmation
  const resE1 = await engine.onPositionUpdate(pointE_1, destination);
  assert("SC2-3", "First deviated fix awaits confirmation (consecutive check)", resE1.shouldReroute === false);

  // Second deviated fix: confirms driver is committed to the new road
  const pointE_2 = { latitude: 12.9355, longitude: 80.1590, accuracy: 10, speed: 30 };
  const resE2 = await engine.onPositionUpdate(pointE_2, destination);
  assert("SC2-4", "Second consecutive deviated fix triggers route recalculation", resE2.shouldReroute === true);
  assert("SC2-5", "Recalculated route result is provided", resE2.newRoute !== null && resE2.newRoute !== undefined);
  assert("SC2-6", "New route starts at current GPS coordinates (Point E)",
    Math.abs(resE2.newRoute!.coordinates[0][0] - pointE_2.latitude) < 0.001 &&
    Math.abs(resE2.newRoute!.coordinates[0][1] - pointE_2.longitude) < 0.001
  );
  assert("SC2-7", "New route ends at unchanged destination (Campus)",
    Math.abs(resE2.newRoute!.coordinates[resE2.newRoute!.coordinates.length - 1][0] - destination.latitude) < 0.001 &&
    Math.abs(resE2.newRoute!.coordinates[resE2.newRoute!.coordinates.length - 1][1] - destination.longitude) < 0.001
  );
  assert("SC2-8", "Engine marks hasRerouted = true", engine.getHasRerouted() === true);

  // -------------------------------------------------------------
  // Section 4: Scenario 3 — Multiple Deviations
  // Driver is now on the recalculated route (E -> ... -> D).
  // Driver then deviates AGAIN towards a different bypass (Point H).
  // -------------------------------------------------------------
  console.log("\n--- Scenario 3: Multiple Deviations ---");

  // Advance clock beyond cooldown
  const reroutedPolyline = engine.getActivePolyline();
  assert("SC3-1", "Active polyline in engine was updated to new route", reroutedPolyline.length >= 2);

  // Simulate cooldown passing by creating a fresh engine instance initialized with the rerouted polyline
  const engine2 = new DynamicRerouteEngine({
    deviationThresholdMeters: 35,
    consecutiveDeviationsRequired: 2,
    cooldownSeconds: 0, // no cooldown for this test step
  });
  engine2.setActivePolyline(reroutedPolyline);

  // Driver follows new route for one fix
  const onNewRoute = {
    latitude: reroutedPolyline[0][0],
    longitude: reroutedPolyline[0][1],
    accuracy: 8,
    speed: 25,
  };
  const resNewRoute = await engine2.onPositionUpdate(onNewRoute, destination);
  assert("SC3-2", "Driver initially on new route does not trigger reroute", resNewRoute.shouldReroute === false);

  // Driver deviates again (Point H: far away from the new route)
  const pointH_1 = {
    latitude: reroutedPolyline[0][0] + 0.002, // ~220m away
    longitude: reroutedPolyline[0][1] + 0.002,
    accuracy: 10,
    speed: 25,
  };
  const pointH_2 = {
    latitude: reroutedPolyline[0][0] + 0.003,
    longitude: reroutedPolyline[0][1] + 0.003,
    accuracy: 9,
    speed: 28,
  };

  const resH1 = await engine2.onPositionUpdate(pointH_1, destination);
  assert("SC3-3", "Second deviation: fix 1 awaits confirmation", resH1.shouldReroute === false);

  const resH2 = await engine2.onPositionUpdate(pointH_2, destination);
  assert("SC3-4", "Second deviation: fix 2 triggers 2nd recalculation", resH2.shouldReroute === true);
  assert("SC3-5", "2nd recalculated route starts at latest GPS position (Point H)",
    Math.abs(resH2.newRoute!.coordinates[0][0] - pointH_2.latitude) < 0.001
  );

  // -------------------------------------------------------------
  // Section 5: Scenario 4 — GPS Fluctuation & Noise Rejection
  // -------------------------------------------------------------
  console.log("\n--- Scenario 4: GPS Fluctuation & Noise Rejection ---");

  const engineNoise = new DynamicRerouteEngine({
    deviationThresholdMeters: 35,
    maxGpsAccuracyMeters: 45,
    consecutiveDeviationsRequired: 2,
  });
  engineNoise.setActivePolyline(routeCoordinates);

  // Test 4A: Small position fluctuation (15 meters off route)
  const smallFluctuation = {
    latitude: 12.9299 + 0.0001, // ~11 meters
    longitude: 80.1522,
    accuracy: 10,
    speed: 25,
  };
  const resFluct = await engineNoise.onPositionUpdate(smallFluctuation, destination);
  assert("SC4-1", "Small 11m position fluctuation is within threshold and ignored", resFluct.shouldReroute === false);

  // Test 4B: Low accuracy fix (accuracy = 80m > max 45m)
  const lowAccuracyFix = {
    latitude: 12.9299 + 0.001, // ~110m away
    longitude: 80.1522,
    accuracy: 80, // Poor GPS fix
    speed: 25,
  };
  const evalNoise = evaluateDeviation(lowAccuracyFix, routeCoordinates, engineNoise.getConfig());
  assert("SC4-2", "Low accuracy fix (80m) is flagged as isIgnoredDueToNoise", evalNoise.isIgnoredDueToNoise === true);

  const resNoise = await engineNoise.onPositionUpdate(lowAccuracyFix, destination);
  assert("SC4-3", "Low accuracy fix does not trigger rerouting", resNoise.shouldReroute === false);

  // Test 4C: Transient single-ping jump that immediately recovers
  const jumpFix = { latitude: 12.9299 + 0.0008, longitude: 80.1522, accuracy: 12, speed: 30 }; // 90m jump
  await engineNoise.onPositionUpdate(jumpFix, destination); // consecutive = 1

  const backOnRouteFix = { latitude: 12.9349, longitude: 80.1572, accuracy: 8, speed: 30 }; // back on route
  const resBack = await engineNoise.onPositionUpdate(backOnRouteFix, destination);
  assert("SC4-4", "Returning to route immediately resets consecutive counter", resBack.shouldReroute === false);

  // Test 4D: Destination proximity (within 35m of destination)
  const nearDestFix = {
    latitude: destination.latitude + 0.0001, // ~11m from destination
    longitude: destination.longitude + 0.0001,
    accuracy: 10,
    speed: 5,
  };
  const evalNearDest = evaluateDeviation(nearDestFix, routeCoordinates, engineNoise.getConfig());
  assert("SC4-5", "User near destination is NOT marked deviated", evalNearDest.isDeviated === false);

  // -------------------------------------------------------------
  // Section 6: Scenario 5 — Routing API Failure / Network Resilience
  // -------------------------------------------------------------
  console.log("\n--- Scenario 5: Routing API Failure Graceful Resilience ---");

  // Temporarily stub calculateRoute to throw an error
  const originalCalculate = routingService.calculateRoute;
  (routingService as any).calculateRoute = async () => {
    throw new Error("Network timeout: 504 Gateway Timeout");
  };

  const engineResilience = new DynamicRerouteEngine({
    deviationThresholdMeters: 35,
    consecutiveDeviationsRequired: 1, // trigger immediately
  });
  engineResilience.setActivePolyline(routeCoordinates);

  const deviatedPoint = { latitude: 12.9900, longitude: 80.2500, accuracy: 10, speed: 30 };

  let didThrow = false;
  let resError: any;
  try {
    resError = await engineResilience.onPositionUpdate(deviatedPoint, destination);
  } catch (e) {
    didThrow = true;
  }

  // Restore original method
  (routingService as any).calculateRoute = originalCalculate;

  assert("SC5-1", "API failure does NOT throw an uncaught exception", didThrow === false);
  assert("SC5-2", "API failure returns shouldReroute = false", resError?.shouldReroute === false);
  assert("SC5-3", "Existing route polyline remains preserved", engineResilience.getActivePolyline().length === routeCoordinates.length);

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log("\n=======================================================");
  console.log(` Test Summary: ${passed} / ${total} assertions passed.`);
  if (failed === 0) {
    console.log(" Overall Result: ALL DYNAMIC REROUTING TESTS PASSED!");
  } else {
    console.log(` Overall Result: [FAIL] ${failed} TESTS FAILED.`);
  }
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runDynamicReroutingTestSuite().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
