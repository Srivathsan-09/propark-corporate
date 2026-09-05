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
  rcStatus: RCVerificationStatus;
  vehicleMatchStatus: VehicleMatchStatus;
  provider: string;
  referenceId: string;
  orderId?: string;
  messageCode: string;
  checkedAt: Date;
  verifiedAt?: Date;
  notes: string;
  rejectionReason?: string;
  rcData?: SanitizedRCData;
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
 * Performs comparison between driver submitted vehicle details
 * and Way2API returned official RC details.
 * 
 * Strict check for:
 * 1. RC status (must be ACTIVE)
 * 2. Vehicle category (Car vs Bike mismatch detection)
 * 3. Fuzzy Make and Model matching
 */
export function compareVehicleDetails(
  input: VerificationInput,
  rcResult: Record<string, any>
): { isMatch: boolean; mismatches: string[]; isCategoryMismatch: boolean } {
  const mismatches: string[] = [];
  let isCategoryMismatch = false;

  // 1. Check RC Status
  const rcStatus = String(rcResult.rc_status || rcResult.status || "ACTIVE").toUpperCase();
  if (rcStatus !== "ACTIVE") {
    mismatches.push(`RC Status is '${rcStatus}' in national registry (Vehicle must be ACTIVE).`);
  }

  // 2. Compare Vehicle Category / Type (Bike vs Car mismatch detection)
  const rawCategory = String(
    rcResult.vehicle_category || rcResult.vehicle_class || rcResult.body_type || ""
  ).toUpperCase();

  const submittedType = (input.vehicleType || "").toLowerCase().trim();
  const isSubmittedBike = submittedType === "bike";

  const isApiTwoWheeler =
    rawCategory.includes("2W") ||
    rawCategory.includes("TWO WHEELER") ||
    rawCategory.includes("MCWG") ||
    rawCategory.includes("M-CYCLE") ||
    rawCategory.includes("MOTORCYCLE") ||
    rawCategory.includes("SCOOTER");

  const isApiFourWheeler =
    rawCategory.includes("LMV") ||
    rawCategory.includes("CAR") ||
    rawCategory.includes("MOTOR CAB") ||
    rawCategory.includes("SEDAN") ||
    rawCategory.includes("HATCHBACK") ||
    rawCategory.includes("4W");

  if (isSubmittedBike && !isApiTwoWheeler && isApiFourWheeler) {
    isCategoryMismatch = true;
    mismatches.push(
      `Vehicle Type Mismatch: Submitted as 'Bike', but government registry records a Light Motor Vehicle (${rawCategory || "LMV"}).`
    );
  } else if (!isSubmittedBike && isApiTwoWheeler) {
    isCategoryMismatch = true;
    mismatches.push(
      `Vehicle Type Mismatch: Submitted as '${input.vehicleType}', but government registry records a Two-Wheeler (${rawCategory || "2W"}).`
    );
  }

  // 3. Compare Make
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

  // 4. Compare Model
  const submittedModel = (input.vehicleModel || "").trim();
  const apiModel = String(rcResult.maker_model || rcResult.model || "").trim();

  if (submittedModel && apiModel) {
    const cleanSubModel = cleanModelString(submittedModel);
    const cleanApiModel = cleanModelString(apiModel);

    const subWords = submittedModel.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
    const apiWords = apiModel.toLowerCase();

    const modelMatch =
      cleanApiModel.includes(cleanSubModel) ||
      cleanSubModel.includes(cleanApiModel) ||
      subWords.some((w) => apiWords.includes(w));

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
  if (!normalizedPlate || normalizedPlate.length < 8 || normalizedPlate.length > 11) {
    return {
      success: false,
      status: "REJECTED",
      rcStatus: "FAILED",
      vehicleMatchStatus: "NOT_CHECKED",
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

  // Map RC status
  let rcStatus: RCVerificationStatus = "FAILED";
  if (apiResult.isSuccess) {
    rcStatus = "VERIFIED";
  } else if (apiResult.status === "ACCEPTED") {
    rcStatus = "PENDING";
  } else if (apiResult.messageCode === "RATE_LIMITED" || apiResult.status === "CONFIG_ERROR") {
    rcStatus = "ERROR";
  } else {
    rcStatus = "FAILED";
  }

  // If RC is not found or failed, return immediately
  if (rcStatus !== "VERIFIED") {
    return {
      success: false,
      status: rcStatus === "PENDING" ? "PENDING" : rcStatus === "ERROR" ? "VERIFICATION_FAILED" : "REJECTED",
      rcStatus,
      vehicleMatchStatus: "NOT_CHECKED",
      provider: "way2api",
      referenceId: orderId,
      orderId,
      messageCode,
      checkedAt: now,
      notes: apiResult.message,
      rejectionReason: apiResult.message,
      error: apiResult.error,
    };
  }

  // Cross-check vehicle details against returned official RC
  const comparison = compareVehicleDetails(input, rcResult);

  // Build sanitized RC data (Scrubbing owner address, owner name, chassis, engine from public view)
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
    mode: apiResult.isMock ? "mock" : "real",
  };

  let vehicleMatchStatus: VehicleMatchStatus = "MATCHED";
  let status: VehicleVerificationStatus = "VERIFIED";
  let notes = "Vehicle RC verified successfully via Way2API.";
  let rejectionReason: string | undefined;

  if (!comparison.isMatch) {
    vehicleMatchStatus = comparison.isCategoryMismatch ? "MISMATCH" : "MANUAL_REVIEW";
    status = comparison.isCategoryMismatch ? "REJECTED" : "MANUAL_REVIEW";
    notes = `Vehicle details flagged: ${comparison.mismatches.join("; ")}`;
    rejectionReason = comparison.mismatches[0];
  }

  return {
    success: comparison.isMatch,
    status,
    rcStatus,
    vehicleMatchStatus,
    provider: "way2api",
    referenceId: orderId,
    orderId,
    messageCode,
    checkedAt: now,
    verifiedAt: comparison.isMatch ? now : undefined,
    notes,
    rejectionReason,
    rcData: sanitizedData,
  };
}
