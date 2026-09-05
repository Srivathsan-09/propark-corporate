/**
 * Vehicle RC Verification Service (CommuteX)
 * 
 * Provider: Way2API (https://app.way2api.com/api/v1/rc/verify)
 * 
 * Complies with strict privacy and security constraints:
 * - Server-side only (never exposes API key to client)
 * - Sanitizes sensitive owner PII (owner_name, addresses, chassis/engine are excluded from passenger views)
 * - Robust input normalization (e.g. TN-07-AB-1234 -> TN07AB1234)
 * - Strict vehicle category check (e.g. Two-Wheeler vs Light Motor Vehicle)
 * - Fuzzy comparison for make and model matching
 */

import { executeWay2ApiCall, Way2ApiExecutionResult } from "./way2ApiClient";
import { VehicleVerificationStatus } from "@/models/Vehicle";

export type RCVerificationStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "VERIFIED"
  | "FAILED"
  | "ERROR";

export type VehicleMatchStatus =
  | "NOT_CHECKED"
  | "MATCHED"
  | "MISMATCH"
  | "MANUAL_REVIEW";

export interface VerificationInput {
  registrationNumber: string;
  vehicleType: string;
  make?: string;
  vehicleModel: string;
  color?: string;
  fuelType?: string;
  seatingCapacity?: number;
  chassisNumber?: string;
  engineNumber?: string;
}

export interface SanitizedRCData {
  rcNumber: string;
  rcStatus: string;
  makerDescription: string;
  makerModel: string;
  vehicleCategory?: string;
  bodyType?: string;
  fuelType?: string;
  color?: string;
  registrationDate?: string;
  fitnessUpto?: string;
  insuranceUpto?: string;
  insuranceCompany?: string;
  mismatchDetails?: string[];
  mode?: "real" | "mock";
}

export interface VerificationResult {
  success: boolean;
  status: VehicleVerificationStatus;
  rcStatus: string;
  rcProviderStatus: RCVerificationStatus;
  vehicleMatchStatus: VehicleMatchStatus;
  commutexVehicleVerificationStatus: "PENDING" | "MANUAL_REVIEW" | "VERIFIED" | "REJECTED" | "FAILED";
  provider: string;
  referenceId: string;
  orderId?: string;
  messageCode: string;
  checkedAt: Date;
  verifiedAt?: Date;
  notes: string;
  rejectionReason?: string;
  rcData?: SanitizedRCData;
  verifiedCategory?: string;
  verifiedMaker?: string;
  verifiedModel?: string;
  verifiedCapacity?: number | string;
  verifiedBodyType?: string;
  verifiedRCStatus?: string;
  verifiedRegistrationNumber?: string;
  error?: string;
}

/**
 * Normalizes an Indian vehicle registration plate to standard alphanumeric uppercase.
 * Example: "tn 07-ab-1234" -> "TN07AB1234"
 */
export function normalizeRegistrationNumber(plate: string): string {
  if (!plate) return "";
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Formats a normalized or raw plate into readable Indian display format.
 * Example: "TN07AB1234" -> "TN 07 AB 1234"
 */
export function formatIndianPlateNumber(plate: string): string {
  const clean = normalizeRegistrationNumber(plate);
  const match = clean.match(/^([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{1,4})$/);
  if (match) {
    return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
  }
  return plate.toUpperCase().trim();
}

/**
 * Strips common manufacturer corporate noise from company names for comparison.
 */
function cleanCompanyNoise(str: string): string {
  return str
    .toUpperCase()
    .replace(/MOTOR\s*INDIA|PVT\s*LTD|PRIVATE\s*LIMITED|LIMITED|LTD|MOTORS|INDIA|CORP/gi, "")
    .replace(/[^A-Z0-9]/gi, "")
    .trim();
}

/**
 * Cleans a model name (e.g. "I20 SPORTZ 1.2" -> "I20SPORTZ")
 */
function cleanModelString(str: string): string {
  return str.toUpperCase().replace(/[^A-Z0-9]/gi, "");
}

/**
 * Calculates Levenshtein edit distance for typo tolerance (e.g. Jupyter vs Jupiter)
 */
function calculateLevenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export type RegisteredVehicleCategory =
  | "TWO_WHEELER"
  | "FOUR_WHEELER_PASSENGER"
  | "VAN"
  | "THREE_WHEELER"
  | "COMMERCIAL_HEAVY"
  | "UNKNOWN";

export interface RegisteredVehicleInference {
  category: RegisteredVehicleCategory;
  description: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  details: string;
}

/**
 * Normalizes and infers the registered vehicle category by synthesizing ALL available RC fields:
 * - vehicle_category (e.g. 2W, 2WN, L1, L2, LMV, M1, 3W, N1)
 * - vehicle_category_description (e.g. Two Wheeler (Non Transport), Motor Car (LMV))
 * - vehicle_class (e.g. M-CYCLE/SCOOTER(2WN), MOTOR CAR(LMV), OMNI BUS, LIGHT MOTOR VEHICLE)
 * - body_type (e.g. SOLO, SALOON, SEDAN, HATCHBACK, STATION WAGON, SUV, MUV, JEEP, OMNI)
 * - maker_description & maker_model (e.g. HERO MOTOCORP, HYUNDAI MOTOR, SPLENDOR, I20, CRETA)
 * - seating_capacity (1-2 for bike, 4-8 for car/SUV, 6-10 for van)
 * - unladen_weight & gross_vehicle_weight
 * 
 * Never blindly trusts a single field; uses the complete RC verification result.
 */
export function inferRegisteredVehicleCategory(rcResult: Record<string, any>): RegisteredVehicleInference {
  if (!rcResult || typeof rcResult !== "object") {
    return {
      category: "UNKNOWN",
      description: "Unspecified Registry Category",
      confidence: "LOW",
      details: "No RC data available",
    };
  }

  const catRaw = String(rcResult.vehicle_category || "").toUpperCase().trim();
  const catDesc = String(rcResult.vehicle_category_description || "").toUpperCase().trim();
  const vClass = String(rcResult.vehicle_class || "").toUpperCase().trim();
  const bodyType = String(rcResult.body_type || "").toUpperCase().trim();
  const maker = String(rcResult.maker_description || rcResult.maker || "").toUpperCase().trim();
  const model = String(rcResult.maker_model || rcResult.model || "").toUpperCase().trim();

  const seating = Number(rcResult.seating_capacity);
  const weight = Number(rcResult.unladen_weight);

  const allText = `${catRaw} ${catDesc} ${vClass} ${bodyType} ${maker} ${model}`;

  let twoWheelerScore = 0;
  let fourWheelerScore = 0;
  let vanScore = 0;
  let threeWheelerScore = 0;
  let heavyScore = 0;

  // 1. Two-Wheeler Signals
  if (/\b(2W|2WN|2WT|L1|L2|MCWG|MCWOG)\b/.test(catRaw)) twoWheelerScore += 4;
  if (catRaw.includes("TWO WHEELER")) twoWheelerScore += 4;

  if (
    vClass.includes("M-CYCLE") ||
    vClass.includes("MOTOR CYCLE") ||
    vClass.includes("MOTORCYCLE") ||
    vClass.includes("SCOOTER") ||
    vClass.includes("MOPED") ||
    vClass.includes("TWO WHEELER")
  ) {
    twoWheelerScore += 5;
  }
  if (catDesc.includes("TWO WHEELER") || catDesc.includes("MOTORCYCLE") || catDesc.includes("SCOOTER")) {
    twoWheelerScore += 4;
  }
  if (
    bodyType.includes("SOLO") ||
    bodyType.includes("PILLION") ||
    bodyType.includes("SCOOTER") ||
    bodyType.includes("MOTOR CYCLE") ||
    bodyType.includes("MOTORCYCLE") ||
    bodyType.includes("2 WHEELER")
  ) {
    twoWheelerScore += 4;
  }

  // Major 2W Manufacturers & Popular Models
  if (
    maker.includes("HERO") ||
    maker.includes("BAJAJ") ||
    maker.includes("TVS") ||
    maker.includes("ROYAL ENFIELD") ||
    maker.includes("YAMAHA") ||
    maker.includes("KTM") ||
    maker.includes("ATHER") ||
    maker.includes("OLA ELECTRIC") ||
    maker.includes("HONDA MOTORCYCLE") ||
    maker.includes("SUZUKI MOTORCYCLE") ||
    maker.includes("PIAGGIO") ||
    maker.includes("JAWA")
  ) {
    twoWheelerScore += 2;
  }
  if (
    /\b(SPLENDOR|PASSION|ACTIVA|DIO|SHINE|PULSAR|PLATINA|JUPITER|APACHE|CLASSIC 350|BULLET|ACCESS|BURGMEN|CHETAK|S1|450X|DOMINAR|RAIDER|AVENGER)\b/.test(
      model
    )
  ) {
    twoWheelerScore += 3;
  }

  if (seating === 1 || seating === 2) {
    twoWheelerScore += 2;
  }
  if (!isNaN(weight) && weight > 0 && weight < 350) {
    twoWheelerScore += 2;
  }

  // 2. Four-Wheeler Passenger (Car / SUV / Sedan / Hatchback) Signals
  if (/\b(LMV|LMV-NT|LMV-TR|M1|4W)\b/.test(catRaw)) fourWheelerScore += 4;
  if (catRaw.includes("CAR") || catRaw.includes("MOTOR CAR")) fourWheelerScore += 4;

  if (
    vClass.includes("MOTOR CAR") ||
    vClass.includes("LIGHT MOTOR") ||
    vClass.includes("LMV") ||
    vClass.includes("STATION WAGON") ||
    vClass.includes("MOTOR CAB") ||
    vClass.includes("ADAPTED VEHICLE")
  ) {
    fourWheelerScore += 5;
  }
  if (catDesc.includes("MOTOR CAR") || catDesc.includes("LIGHT MOTOR") || catDesc.includes("PASSENGER CAR")) {
    fourWheelerScore += 4;
  }
  if (
    bodyType.includes("SALOON") ||
    bodyType.includes("SEDAN") ||
    bodyType.includes("HATCHBACK") ||
    bodyType.includes("STATION WAGON") ||
    bodyType.includes("SUV") ||
    bodyType.includes("MUV") ||
    bodyType.includes("ESTATE") ||
    bodyType.includes("JEEP") ||
    bodyType.includes("HARD TOP") ||
    bodyType.includes("SOFT TOP") ||
    bodyType.includes("COUPE") ||
    bodyType.includes("CROSSOVER")
  ) {
    fourWheelerScore += 4;
  }

  // Major Car & SUV Manufacturers & Popular Models
  if (
    maker.includes("HYUNDAI") ||
    maker.includes("MARUTI") ||
    maker.includes("TATA MOTORS") ||
    maker.includes("MAHINDRA") ||
    maker.includes("TOYOTA") ||
    maker.includes("KIA") ||
    maker.includes("HONDA CARS") ||
    maker.includes("VOLKSWAGEN") ||
    maker.includes("SKODA") ||
    maker.includes("RENAULT") ||
    maker.includes("NISSAN") ||
    maker.includes("MG MOTOR") ||
    maker.includes("FORD")
  ) {
    fourWheelerScore += 2;
  }
  if (
    /\b(SWIFT|DZIRE|BALENO|WAGON R|ALTO|BREZZA|ERTIGA|I10|I20|VERNA|VENUE|CRETA|NEXON|PUNCH|TIAGO|HARRIER|SCORPIO|THAR|BOLERO|XUV|CITY|AMAZE|INNOVA|FORTUNER|SELTOS|SONET|POLO|KIGER|TRIBER)\b/.test(
      model
    )
  ) {
    fourWheelerScore += 3;
  }

  if (seating >= 4 && seating <= 8) {
    fourWheelerScore += 2;
  }
  if (!isNaN(weight) && weight >= 600) {
    fourWheelerScore += 2;
  }

  // 3. Van / Minivan Signals
  if (
    vClass.includes("OMNI BUS") ||
    vClass.includes("MAXI CAB") ||
    bodyType.includes("OMNI") ||
    bodyType.includes("VAN") ||
    bodyType.includes("MINIVAN") ||
    bodyType.includes("MICROBUS") ||
    /\b(EECO|OMNI|WINGER|MAGIC|CARNIVAL|TOUR V)\b/.test(model)
  ) {
    vanScore += 5;
    fourWheelerScore += 2; // In India vans are also light motor passenger vehicles
  }

  // 4. Three-Wheeler Signals
  if (
    /\b(3W|3WT|3WN|L5)\b/.test(catRaw) ||
    vClass.includes("AUTO RICKSHAW") ||
    vClass.includes("THREE WHEELER") ||
    bodyType.includes("AUTO RICKSHAW") ||
    allText.includes("E-RICKSHAW")
  ) {
    threeWheelerScore += 6;
  }

  // 5. Heavy / Commercial Signals
  if (
    /\b(HGV|HMV|MGV|N2|N3)\b/.test(catRaw) ||
    vClass.includes("GOODS CARRIER") ||
    vClass.includes("HEAVY GOODS") ||
    vClass.includes("STAGE CARRIAGE") ||
    vClass.includes("TRUCK") ||
    (vClass.includes("BUS") && !vClass.includes("OMNI BUS"))
  ) {
    heavyScore += 6;
  }

  // Score Decision
  const detailsParts: string[] = [];
  if (catRaw) detailsParts.push(`Category: ${catRaw}`);
  if (vClass) detailsParts.push(`Class: ${vClass}`);
  if (bodyType) detailsParts.push(`Body: ${bodyType}`);
  if (maker) detailsParts.push(`Maker: ${maker}`);
  if (!isNaN(seating) && seating > 0) detailsParts.push(`Seats: ${seating}`);
  const detailsStr = detailsParts.join(", ") || "No category fields";

  const maxScore = Math.max(twoWheelerScore, fourWheelerScore, vanScore, threeWheelerScore, heavyScore);

  if (maxScore < 2) {
    return {
      category: "UNKNOWN",
      description: "Unspecified Registry Category",
      confidence: "LOW",
      details: detailsStr,
    };
  }

  if (heavyScore >= 5 && heavyScore >= fourWheelerScore) {
    return {
      category: "COMMERCIAL_HEAVY",
      description: "Commercial / Heavy Vehicle",
      confidence: "HIGH",
      details: detailsStr,
    };
  }

  if (threeWheelerScore >= 5 && threeWheelerScore >= twoWheelerScore) {
    return {
      category: "THREE_WHEELER",
      description: "Three-Wheeler / Auto Rickshaw",
      confidence: "HIGH",
      details: detailsStr,
    };
  }

  if (twoWheelerScore > fourWheelerScore && twoWheelerScore >= 3) {
    return {
      category: "TWO_WHEELER",
      description: "Two-Wheeler (Motorcycle / Scooter)",
      confidence: twoWheelerScore >= 5 ? "HIGH" : "MEDIUM",
      details: detailsStr,
    };
  }

  if (vanScore >= 5 && vanScore >= fourWheelerScore) {
    return {
      category: "VAN",
      description: "Van / Minivan / Omni",
      confidence: "HIGH",
      details: detailsStr,
    };
  }

  if (fourWheelerScore >= 3) {
    return {
      category: "FOUR_WHEELER_PASSENGER",
      description: "Light Motor Vehicle (Car / SUV / Passenger Vehicle)",
      confidence: fourWheelerScore >= 5 ? "HIGH" : "MEDIUM",
      details: detailsStr,
    };
  }

  return {
    category: "UNKNOWN",
    description: "Unspecified Registry Category",
    confidence: "LOW",
    details: detailsStr,
  };
}

/**
 * Evaluates compatibility between CommuteX dropdown vehicle type and the official RC classification.
 * 
 * Rules:
 * 1. CommuteX "Bike" (Bike / Two-Wheeler) -> Compatible with TWO_WHEELER.
 *    Do NOT flag mismatch merely because terminology differs (e.g. M-CYCLE/SCOOTER, 2W, SOLO, MCWG).
 * 2. CommuteX "Car" (Car: Sedan / Hatchback) -> Compatible with FOUR_WHEELER_PASSENGER and VAN.
 *    Do NOT flag mismatch for LMV, MOTOR CAR, SALOON, STATION WAGON, M1, etc.
 * 3. CommuteX "SUV" (SUV / Compact SUV) -> Compatible with FOUR_WHEELER_PASSENGER and VAN.
 *    In India, SUVs are registered as LMV, MOTOR CAR(LMV), or STATION WAGON. Do NOT flag mismatch!
 * 4. CommuteX "Van" (Van / Minivan) -> Compatible with VAN and FOUR_WHEELER_PASSENGER (LMV/Omni).
 * 5. CommuteX "Other" -> Flexible compatibility.
 * 
 * Genuine Conflict:
 * - Driver submitted "Bike" but RC is conclusively a Four-Wheeler (Car/SUV/Van) or 3W or Heavy vehicle.
 * - Driver submitted "Car" / "SUV" / "Van", but RC is conclusively a Two-Wheeler.
 * - RC is a Commercial Heavy vehicle or 3W auto while driver submitted a private Car/Bike.
 * In these cases: Flag for MANUAL_REVIEW with clear explanation.
 */
export function evaluateCategoryCompatibility(
  submittedType: string,
  inference: RegisteredVehicleInference
): { isCompatible: boolean; isGenuineConflict: boolean; reason?: string } {
  const normType = (submittedType || "").toLowerCase().trim();

  // If RC category is unknown/unspecified, never blindly reject; allow through without false conflict
  if (inference.category === "UNKNOWN") {
    return { isCompatible: true, isGenuineConflict: false };
  }

  // 1. Submitted: Bike / Two-Wheeler
  if (normType === "bike") {
    if (inference.category === "TWO_WHEELER") {
      return { isCompatible: true, isGenuineConflict: false };
    }

    return {
      isCompatible: false,
      isGenuineConflict: true,
      reason: `Vehicle Category Conflict: Submitted as 'Bike / Two-Wheeler', but verified vehicle information records a ${inference.description} (${inference.details}). Flagged for administrator manual review.`,
    };
  }

  // 2. Submitted: Car (Sedan / Hatchback)
  if (normType === "car") {
    if (inference.category === "FOUR_WHEELER_PASSENGER" || inference.category === "VAN") {
      return { isCompatible: true, isGenuineConflict: false };
    }

    return {
      isCompatible: false,
      isGenuineConflict: true,
      reason: `Vehicle Category Conflict: Submitted as 'Car (Sedan / Hatchback)', but verified vehicle information records a ${inference.description} (${inference.details}). Flagged for administrator manual review.`,
    };
  }

  // 3. Submitted: SUV / Compact SUV
  if (normType === "suv") {
    if (inference.category === "FOUR_WHEELER_PASSENGER" || inference.category === "VAN") {
      return { isCompatible: true, isGenuineConflict: false };
    }

    return {
      isCompatible: false,
      isGenuineConflict: true,
      reason: `Vehicle Category Conflict: Submitted as 'SUV / Compact SUV', but verified vehicle information records a ${inference.description} (${inference.details}). Flagged for administrator manual review.`,
    };
  }

  // 4. Submitted: Van / Minivan
  if (normType === "van") {
    if (inference.category === "VAN" || inference.category === "FOUR_WHEELER_PASSENGER") {
      return { isCompatible: true, isGenuineConflict: false };
    }

    return {
      isCompatible: false,
      isGenuineConflict: true,
      reason: `Vehicle Category Conflict: Submitted as 'Van / Minivan', but verified vehicle information records a ${inference.description} (${inference.details}). Flagged for administrator manual review.`,
    };
  }

  // 5. Submitted: Other
  if (inference.category === "COMMERCIAL_HEAVY" || inference.category === "THREE_WHEELER") {
    return {
      isCompatible: false,
      isGenuineConflict: true,
      reason: `Vehicle Category Conflict: Vehicle registered as ${inference.description} (${inference.details}). Flagged for administrator manual review.`,
    };
  }

  return { isCompatible: true, isGenuineConflict: false };
}

/**
 * Performs comparison between driver submitted vehicle details
 * and Way2API returned official RC details.
 * 
 * Rules:
 * 1. Checks RC active status
 * 2. Normalizes vehicle category and checks genuine conflict vs terminology differences
 * 3. Performs fuzzy Make and Model matching
 * 4. Flags genuine discrepancies for MANUAL_REVIEW rather than auto-rejecting
 */
export function compareVehicleDetails(
  input: VerificationInput,
  rcResult: Record<string, any>
): {
  isMatch: boolean;
  mismatches: string[];
  isCategoryMismatch: boolean;
  categoryInference: RegisteredVehicleInference;
} {
  const mismatches: string[] = [];
  let isCategoryMismatch = false;

  // 1. Check RC Status (Must be ACTIVE)
  const rcStatus = String(rcResult.rc_status || rcResult.status || "ACTIVE").toUpperCase();
  if (rcStatus !== "ACTIVE") {
    mismatches.push(`RC Status is '${rcStatus}' in verified vehicle records (Vehicle must be ACTIVE).`);
  }

  // 2. Multi-field Category Normalization & Comparison
  const inference = inferRegisteredVehicleCategory(rcResult);
  const catCheck = evaluateCategoryCompatibility(input.vehicleType, inference);

  if (!catCheck.isCompatible && catCheck.isGenuineConflict) {
    isCategoryMismatch = true;
    mismatches.push(catCheck.reason || "Vehicle category conflict detected.");
  }

  // 3. Compare Make (Fuzzy manufacturer check)
  const submittedMake = (input.make || "").trim();
  const apiMaker = String(rcResult.maker_description || rcResult.maker || "").trim();

  if (submittedMake && apiMaker) {
    const cleanSubMake = cleanCompanyNoise(submittedMake);
    const cleanApiMaker = cleanCompanyNoise(apiMaker);

    const makeMatch =
      cleanApiMaker.includes(cleanSubMake) ||
      cleanSubMake.includes(cleanApiMaker) ||
      cleanModelString(rcResult.maker_model || "").includes(cleanSubMake);

    if (!makeMatch) {
      mismatches.push(
        `Manufacturer Mismatch: Submitted '${submittedMake}' does not match official maker '${apiMaker}'.`
      );
    }
  }

  // 4. Compare Model (Fuzzy model check)
  const submittedModel = (input.vehicleModel || "").trim();
  const apiModel = String(rcResult.maker_model || rcResult.model || "").trim();

  if (submittedModel && apiModel) {
    const cleanSubModel = cleanModelString(submittedModel);
    const cleanApiModel = cleanModelString(apiModel);

    const subWords = submittedModel.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
    const apiWords = apiModel.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);

    const isFuzzyTypoMatch =
      calculateLevenshteinDistance(cleanSubModel, cleanApiModel) <= (cleanApiModel.length >= 6 ? 2 : 1) ||
      subWords.some((sw) => apiWords.some((aw) => calculateLevenshteinDistance(sw, aw) <= (aw.length >= 6 ? 2 : 1)));

    const modelMatch =
      cleanApiModel.includes(cleanSubModel) ||
      cleanSubModel.includes(cleanApiModel) ||
      subWords.some((w) => apiModel.toLowerCase().includes(w)) ||
      isFuzzyTypoMatch;

    if (!modelMatch) {
      mismatches.push(
        `Model Mismatch: Submitted '${submittedModel}' does not match official model '${apiModel}'.`
      );
    }
  }

  return {
    isMatch: mismatches.length === 0,
    mismatches,
    isCategoryMismatch,
    categoryInference: inference,
  };
}

/**
 * Main Vehicle RC Verification Function using Way2API.
 */
export async function verifyVehicleWithWay2API(
  input: VerificationInput,
  options?: { bypassCache?: boolean }
): Promise<VerificationResult> {
  const normalizedPlate = normalizeRegistrationNumber(input.registrationNumber);
  const now = new Date();

  // Validate plate length
  if (!normalizedPlate || normalizedPlate.length < 6 || normalizedPlate.length > 15) {
    return {
      success: false,
      status: "REJECTED",
      rcStatus: "FAILED",
      rcProviderStatus: "FAILED",
      vehicleMatchStatus: "NOT_CHECKED",
      commutexVehicleVerificationStatus: "FAILED",
      provider: "way2api",
      referenceId: "",
      messageCode: "INVALID_INPUT",
      checkedAt: now,
      notes: "Invalid vehicle registration plate format.",
      rejectionReason: "Invalid vehicle registration plate format.",
    };
  }

  const payload: Record<string, any> = {
    rc_number: normalizedPlate,
  };
  if (input.chassisNumber?.trim()) {
    payload.chassis_number = input.chassisNumber.trim().toUpperCase();
  }
  if (input.engineNumber?.trim()) {
    payload.engine_number = input.engineNumber.trim().toUpperCase();
  }

  // Execute Way2API request
  const apiResult: Way2ApiExecutionResult = await executeWay2ApiCall("rc", payload, options);

  const orderId = apiResult.orderId || "";
  const rcResult = apiResult.data || {};
  const messageCode = apiResult.messageCode;

  // Map RC provider status
  let rcProviderStatus: RCVerificationStatus = "FAILED";
  if (apiResult.isSuccess) {
    rcProviderStatus = "VERIFIED";
  } else if (apiResult.status === "ACCEPTED") {
    rcProviderStatus = "PENDING";
  } else if (
    apiResult.messageCode === "RATE_LIMITED" ||
    apiResult.status === "CONFIG_ERROR" ||
    apiResult.status === "PAYMENT_REQUIRED" ||
    apiResult.messageCode === "INSUFFICIENT_BALANCE"
  ) {
    rcProviderStatus = "ERROR";
  } else {
    rcProviderStatus = "FAILED";
  }

  // STEP 3 — STRICT REQUEST/RESPONSE MATCH (Step 3 compliance)
  // Confirm that: REQUEST rc_number == RESPONSE data.result.rc_number
  const returnedPlate = normalizeRegistrationNumber(
    rcResult.rc_number || rcResult.registration_number || ""
  );

  if (apiResult.isSuccess && returnedPlate && returnedPlate !== normalizedPlate) {
    console.warn(
      `[Way2API RC Mismatch] Strict match failed: Requested '${normalizedPlate}' != Returned '${returnedPlate}'. Aborting.`
    );
    return {
      success: false,
      status: "MANUAL_REVIEW",
      rcStatus: "MISMATCH",
      rcProviderStatus: "FAILED",
      vehicleMatchStatus: "MANUAL_REVIEW",
      commutexVehicleVerificationStatus: "MANUAL_REVIEW",
      provider: "way2api",
      referenceId: orderId,
      orderId,
      messageCode: "VERIFICATION_DATA_MISMATCH",
      checkedAt: now,
      notes: `Verification data mismatch: Provider returned registration '${returnedPlate}' for requested plate '${normalizedPlate}'. Flagged for administrator review.`,
      rejectionReason: "VERIFICATION_DATA_MISMATCH: Registration number mismatch between request and provider response.",
      error: "VERIFICATION_DATA_MISMATCH",
      verifiedRegistrationNumber: returnedPlate,
    };
  }

  // STEP 7: If RC is not found or provider failed/unavailable, return immediately without fake data
  if (rcProviderStatus !== "VERIFIED") {
    const isUnavailableOrPayment =
      apiResult.status === "PAYMENT_REQUIRED" ||
      apiResult.status === "MANUAL_REVIEW" ||
      messageCode === "INSUFFICIENT_BALANCE" ||
      messageCode === "VERIFICATION_DATA_UNAVAILABLE";

    return {
      success: false,
      status: isUnavailableOrPayment
        ? "MANUAL_REVIEW"
        : rcProviderStatus === "PENDING"
        ? "PENDING"
        : rcProviderStatus === "ERROR"
        ? "VERIFICATION_FAILED"
        : "REJECTED",
      rcStatus: isUnavailableOrPayment ? "UNAVAILABLE" : "NOT_FOUND",
      rcProviderStatus,
      vehicleMatchStatus: "NOT_CHECKED",
      commutexVehicleVerificationStatus: isUnavailableOrPayment ? "MANUAL_REVIEW" : "FAILED",
      provider: "way2api",
      referenceId: orderId,
      orderId,
      messageCode,
      checkedAt: now,
      notes: isUnavailableOrPayment
        ? "Verification data unavailable — manual review required."
        : apiResult.message || "Verification failed.",
      rejectionReason: isUnavailableOrPayment
        ? "Verification data unavailable — manual review required."
        : apiResult.message,
      error: apiResult.error,
    };
  }

  // RC Provider lookup succeeded!
  const registryRcStatus = String(rcResult.rc_status || rcResult.status || "ACTIVE").toUpperCase();
  const comparison = compareVehicleDetails(input, rcResult);

  // Build sanitized RC data (Scrubbing owner address, owner name, chassis, engine from public view)
  const sanitizedData: SanitizedRCData = {
    rcNumber: rcResult.rc_number || normalizedPlate,
    rcStatus: registryRcStatus,
    makerDescription: rcResult.maker_description || "",
    makerModel: rcResult.maker_model || "",
    vehicleCategory:
      rcResult.vehicle_category_description ||
      rcResult.vehicle_category ||
      comparison.categoryInference?.description ||
      "",
    bodyType: rcResult.body_type || "",
    fuelType: rcResult.fuel_type || "",
    color: rcResult.color || "",
    registrationDate: rcResult.registration_date || "",
    fitnessUpto: rcResult.fit_up_to || "",
    insuranceUpto: rcResult.insurance_upto || "",
    insuranceCompany: rcResult.insurance_company || "",
    mismatchDetails: comparison.mismatches,
    mode: apiResult.isMock ? "mock" : "real",
  };

  let vehicleMatchStatus: VehicleMatchStatus = "MATCHED";
  let commutexVehicleVerificationStatus: "PENDING" | "MANUAL_REVIEW" | "VERIFIED" | "REJECTED" | "FAILED" = "VERIFIED";
  let status: VehicleVerificationStatus = "VERIFIED";
  let notes = "Vehicle RC verified successfully.";
  let rejectionReason: string | undefined;

  if (!comparison.isMatch || registryRcStatus !== "ACTIVE") {
    vehicleMatchStatus = "MISMATCH";
    commutexVehicleVerificationStatus = "MANUAL_REVIEW";
    status = "MANUAL_REVIEW";
    notes = `Vehicle details flagged for administrator review: ${comparison.mismatches.join("; ")}`;
    rejectionReason = comparison.mismatches[0];
  }

  return {
    success: comparison.isMatch && registryRcStatus === "ACTIVE",
    status,
    rcStatus: registryRcStatus,
    rcProviderStatus,
    vehicleMatchStatus,
    commutexVehicleVerificationStatus,
    provider: "way2api",
    referenceId: orderId,
    orderId,
    messageCode,
    checkedAt: now,
    verifiedAt: comparison.isMatch && registryRcStatus === "ACTIVE" ? now : undefined,
    notes,
    rejectionReason,
    rcData: sanitizedData,
    verifiedCategory: comparison.categoryInference?.description || rcResult.vehicle_category || "",
    verifiedMaker: rcResult.maker_description || "",
    verifiedModel: rcResult.maker_model || "",
    verifiedCapacity: rcResult.seating_capacity || "",
    verifiedBodyType: rcResult.body_type || "",
    verifiedRCStatus: registryRcStatus,
    verifiedRegistrationNumber: rcResult.rc_number || normalizedPlate,
  };
}
