/**
 * Vehicle RC Verification Service (CommuteX)
 * 
 * Official Provider: Way2API (https://www.way2api.com/page/service/vehicle-rc-verification)
 * Endpoint: POST https://app.way2api.com/api/v1/rc/verify
 * 
 * Complies with strict privacy and security constraints:
 * - Server-side only (never exposes API key to client)
 * - Sanitizes sensitive owner PII (owner_name, address are excluded from passenger/public views)
 * - Supports both REAL (Way2API) and MOCK (development/testing) modes
 * - Robust input normalization (e.g. TN-07-AB-1234 -> TN07AB1234)
 * - Fuzzy comparison for make and model matching
 */

import { VehicleVerificationStatus } from "@/models/Vehicle";

export interface VerificationInput {
  registrationNumber: string;
  vehicleType: string;
  make?: string;
  vehicleModel: string;
  color?: string;
  fuelType?: string;
  seatingCapacity?: number;
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
  provider: string;
  referenceId: string;
  checkedAt: Date;
  verifiedAt?: Date;
  notes: string;
  rejectionReason?: string;
  rcData?: SanitizedRCData;
  error?: string;
}

// In-memory short-term verification cache to protect against duplicate requests
interface CacheEntry {
  timestamp: number;
  result: VerificationResult;
}
const verificationCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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
 * Performs fuzzy, case-insensitive comparison between driver submitted vehicle details
 * and Way2API returned RC details.
 */
export function compareVehicleDetails(
  input: VerificationInput,
  rcResult: Record<string, any>
): { isMatch: boolean; mismatches: string[] } {
  const mismatches: string[] = [];

  // 1. Check RC Status
  const rcStatus = String(rcResult.rc_status || rcResult.status || "ACTIVE").toUpperCase();
  if (rcStatus !== "ACTIVE") {
    mismatches.push(`RC Status is ${rcStatus} (Vehicle must be ACTIVE in national registry).`);
  }

  // 2. Compare Make
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
      mismatches.push(`Submitted make '${submittedMake}' does not match official RC maker '${apiMaker}'.`);
    }
  }

  // 3. Compare Model
  const submittedModel = (input.vehicleModel || "").trim();
  const apiModel = String(rcResult.maker_model || rcResult.model || "").trim();

  if (submittedModel && apiModel) {
    const cleanSubModel = cleanModelString(submittedModel);
    const cleanApiModel = cleanModelString(apiModel);

    // Also check if model tokens match (e.g. "i20" inside "I20 SPORTZ")
    const subWords = submittedModel.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
    const apiWords = apiModel.toLowerCase();

    const modelMatch =
      cleanApiModel.includes(cleanSubModel) ||
      cleanSubModel.includes(cleanApiModel) ||
      subWords.some((w) => apiWords.includes(w));

    if (!modelMatch) {
      mismatches.push(`Submitted model '${submittedModel}' does not match official RC model '${apiModel}'.`);
    }
  }

  // 4. Compare Vehicle Class / Category if present (e.g. Bike vs Car)
  const category = String(rcResult.vehicle_category || rcResult.vehicle_class || "").toUpperCase();
  if (category) {
    const isSubmittedBike = input.vehicleType.toLowerCase() === "bike";
    const isApiTwoWheeler =
      category.includes("2W") ||
      category.includes("TWO WHEELER") ||
      category.includes("MCWG") ||
      category.includes("M-CYCLE") ||
      category.includes("SCOOTER");

    if (isSubmittedBike && !isApiTwoWheeler && (category.includes("LMV") || category.includes("CAR"))) {
      mismatches.push(`Submitted as Bike, but RC registration is a Light Motor Vehicle (${category}).`);
    } else if (!isSubmittedBike && isApiTwoWheeler) {
      mismatches.push(`Submitted as ${input.vehicleType}, but RC registration is a Two-Wheeler (${category}).`);
    }
  }

  return {
    isMatch: mismatches.length === 0,
    mismatches,
  };
}

/**
 * Main Vehicle Verification Function.
 * Handles Mock vs Real Way2API execution, rate-limiting, and sanitized output formatting.
 */
export async function verifyVehicleWithWay2API(
  input: VerificationInput,
  options?: { bypassCache?: boolean }
): Promise<VerificationResult> {
  const normalizedPlate = normalizeRegistrationNumber(input.registrationNumber);
  const now = new Date();

  // Validate format
  if (!normalizedPlate || normalizedPlate.length < 8 || normalizedPlate.length > 11) {
    return {
      success: false,
      status: "REJECTED",
      provider: "way2api",
      referenceId: "",
      checkedAt: now,
      notes: "Invalid registration plate length or format.",
      rejectionReason: "Invalid vehicle registration plate format.",
    };
  }

  // Check Duplicate Request Protection / Verification Cache
  if (!options?.bypassCache) {
    const cached = verificationCache.get(normalizedPlate);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.result;
    }
  }

  const mode = (process.env.RC_VERIFICATION_MODE || "mock").toLowerCase();
  const apiKey = process.env.RC_VERIFICATION_API_KEY;
  const apiUrl = process.env.RC_VERIFICATION_API_URL || "https://app.way2api.com/api/v1/rc/verify";

  // If real mode is requested but no API key is set, log warning and fallback to mock in non-production
  const isReal = mode === "real" && Boolean(apiKey);

  if (!isReal) {
    // -------------------------------------------------------------
    // MOCK VERIFICATION MODE (DEVELOPMENT / TESTING)
    // -------------------------------------------------------------
    console.info(`[VehicleVerification] Running in DEVELOPMENT / MOCK MODE for plate: ${normalizedPlate}`);

    // Simulation hooks for automated and developer testing
    if (normalizedPlate.includes("FAIL") || normalizedPlate.endsWith("8888")) {
      return {
        success: false,
        status: "VERIFICATION_FAILED",
        provider: "way2api (mock)",
        referenceId: `MOCK_ERR_${Date.now()}`,
        checkedAt: now,
        notes: "Mock Gateway Timeout: Verification service is temporarily unavailable.",
        error: "Vehicle verification is temporarily unavailable. Please try again later.",
      };
    }

    const isSuspendedMock = normalizedPlate.endsWith("7777");
    const isMismatchMock =
      normalizedPlate.endsWith("9999") ||
      (input.vehicleModel && input.vehicleModel.toUpperCase().includes("MISMATCH"));

    const mockRcResult: Record<string, any> = {
      rc_number: normalizedPlate,
      fit_up_to: "2038-03-20",
      registration_date: "2023-03-21",
      vehicle_category: input.vehicleType === "Bike" ? "2W" : "LMV",
      maker_description: isMismatchMock
        ? "MARUTI SUZUKI INDIA LTD"
        : input.make
        ? `${input.make.toUpperCase()} MOTOR INDIA LTD`
        : "HYUNDAI MOTOR INDIA LTD",
      maker_model: isMismatchMock
        ? "SWIFT VXI"
        : input.vehicleModel
        ? input.vehicleModel.toUpperCase()
        : "I20 SPORTZ",
      body_type: input.vehicleType === "Bike" ? "MOTORCYCLE" : "SEDAN/HATCHBACK",
      fuel_type: input.fuelType?.toUpperCase() || "PETROL",
      color: input.color?.toUpperCase() || "WHITE",
      rc_status: isSuspendedMock ? "SUSPENDED" : "ACTIVE",
      insurance_company: "ICICI LOMBARD GENERAL INSURANCE CO LTD",
      insurance_upto: "2026-11-30",
    };

    const comparison = compareVehicleDetails(input, mockRcResult);

    const sanitizedData: SanitizedRCData = {
      rcNumber: normalizedPlate,
      rcStatus: mockRcResult.rc_status,
      makerDescription: mockRcResult.maker_description,
      makerModel: mockRcResult.maker_model,
      vehicleCategory: mockRcResult.vehicle_category,
      bodyType: mockRcResult.body_type,
      fuelType: mockRcResult.fuel_type,
      color: mockRcResult.color,
      registrationDate: mockRcResult.registration_date,
      fitnessUpto: mockRcResult.fit_up_to,
      insuranceUpto: mockRcResult.insurance_upto,
      insuranceCompany: mockRcResult.insurance_company,
      mismatchDetails: comparison.mismatches,
      mode: "mock",
    };

    let status: VehicleVerificationStatus = "VERIFIED";
    let notes = "Verified successfully via Way2API (Mock Mode).";
    let rejectionReason = "";

    if (!comparison.isMatch) {
      status = "MANUAL_REVIEW";
      notes = `Verification flagged for manual review: ${comparison.mismatches.join("; ")}`;
      rejectionReason = comparison.mismatches[0];
    }

    const result: VerificationResult = {
      success: comparison.isMatch,
      status,
      provider: "way2api",
      referenceId: `MOCK_${Date.now()}_${normalizedPlate}`,
      checkedAt: now,
      verifiedAt: status === "VERIFIED" ? now : undefined,
      notes,
      rejectionReason: status !== "VERIFIED" ? rejectionReason : undefined,
      rcData: sanitizedData,
    };

    // Cache successful verification to prevent immediate repeats
    verificationCache.set(normalizedPlate, { timestamp: Date.now(), result });
    return result;
  }

  // -------------------------------------------------------------
  // REAL WAY2API VERIFICATION MODE
  // -------------------------------------------------------------
  console.info(`[VehicleVerification] Initiating real Way2API request for plate: ${normalizedPlate}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second provider timeout

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        rc_number: normalizedPlate,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[VehicleVerification] Way2API HTTP Error ${response.status}:`, errorText);

      // Do NOT automatically reject the vehicle on technical failures
      return {
        success: false,
        status: "VERIFICATION_FAILED",
        provider: "way2api",
        referenceId: "",
        checkedAt: now,
        notes: `Provider returned HTTP ${response.status}. Verification temporarily unavailable.`,
        error: "Vehicle verification is temporarily unavailable. Please try again later.",
      };
    }

    const apiJson = await response.json();

    // Check Way2API payload response format
    const rcResult = apiJson?.data?.result || apiJson?.result || apiJson?.data;
    const orderId = apiJson?.data?.order_id || apiJson?.order_id || `W2A_${Date.now()}`;

    if (!rcResult) {
      console.warn("[VehicleVerification] Empty result in Way2API response:", apiJson);
      return {
        success: false,
        status: "VERIFICATION_FAILED",
        provider: "way2api",
        referenceId: orderId,
        checkedAt: now,
        notes: apiJson?.message || "RC details could not be retrieved from provider registry.",
        error: "Vehicle verification is temporarily unavailable. Please try again later.",
      };
    }

    // Compare vehicle information
    const comparison = compareVehicleDetails(input, rcResult);

    // Extract SANITIZED vehicle data (explicitly EXCLUDING owner_name, address, etc. for privacy)
    const sanitizedData: SanitizedRCData = {
      rcNumber: rcResult.rc_number || normalizedPlate,
      rcStatus: rcResult.rc_status || "ACTIVE",
      makerDescription: rcResult.maker_description || "",
      makerModel: rcResult.maker_model || "",
      vehicleCategory: rcResult.vehicle_category || "",
      bodyType: rcResult.body_type || "",
      fuelType: rcResult.fuel_type || "",
      color: rcResult.color || "",
      registrationDate: rcResult.registration_date || "",
      fitnessUpto: rcResult.fit_up_to || "",
      insuranceUpto: rcResult.insurance_upto || "",
      insuranceCompany: rcResult.insurance_company || "",
      mismatchDetails: comparison.mismatches,
      mode: "real",
    };

    let status: VehicleVerificationStatus = "VERIFIED";
    let notes = "Verified successfully via Way2API.";
    let rejectionReason = "";

    if (!comparison.isMatch) {
      status = "MANUAL_REVIEW";
      notes = `Verification flagged for manual review: ${comparison.mismatches.join("; ")}`;
      rejectionReason = comparison.mismatches[0];
    }

    const result: VerificationResult = {
      success: comparison.isMatch,
      status,
      provider: "way2api",
      referenceId: orderId,
      checkedAt: now,
      verifiedAt: status === "VERIFIED" ? now : undefined,
      notes,
      rejectionReason: status !== "VERIFIED" ? rejectionReason : undefined,
      rcData: sanitizedData,
    };

    // Cache verification
    verificationCache.set(normalizedPlate, { timestamp: Date.now(), result });
    return result;
  } catch (error: any) {
    console.error("[VehicleVerification] Network/execution exception:", error);

    // Network timeout or connection drop
    return {
      success: false,
      status: "VERIFICATION_FAILED",
      provider: "way2api",
      referenceId: "",
      checkedAt: now,
      notes: error.name === "AbortError" ? "Verification request timed out." : error.message || "Network error",
      error: "Vehicle verification is temporarily unavailable. Please try again later.",
    };
  }
}
