/**
 * Driving Licence Verification Service (CommuteX)
 * 
 * Provider: Way2API (https://app.way2api.com/api/v1/driving-license/verify)
 * 
 * Complies with strict security and privacy standards:
 * - Server-side only
 * - Normalizes DOB to exact DD/MM/YYYY format required by Way2API
 * - Normalizes DL numbers
 * - Validates vehicle classes (e.g. MCWG for Bike, LMV for Car)
 * - Sanitizes sensitive personal PII (omitting address, father's name from passenger views)
 */

import { executeWay2ApiCall, Way2ApiExecutionResult } from "./way2ApiClient";

export type DrivingLicenseStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "VERIFIED"
  | "FAILED"
  | "ERROR";

export interface SanitizedDLData {
  licenseNumber: string;
  state?: string;
  name?: string;
  gender?: string;
  dobFormatted?: string;
  issueDate?: string;
  expiryDate?: string;
  vehicleClasses: string[];
  mode?: "real" | "mock";
}

export interface DLVerificationResult {
  success: boolean;
  status: DrivingLicenseStatus;
  provider: string;
  referenceId: string;
  orderId?: string;
  messageCode: string;
  checkedAt: Date;
  verifiedAt?: Date;
  vehicleClasses: string[];
  isVehicleClassEligible: boolean;
  licenseVehicleClassStatus: "NOT_CHECKED" | "COMPATIBLE" | "INCOMPATIBLE";
  isExpired?: boolean;
  classEligibilityReason?: string;
  notes: string;
  rejectionReason?: string;
  dlData?: SanitizedDLData;
  error?: string;
}

/**
 * Normalizes Indian Driving Licence number.
 * Removes spaces, hyphens, and converts to uppercase.
 * Example: "MH-03 20140001234" -> "MH0320140001234"
 */
export function normalizeDrivingLicenseNumber(dlNumber: string): string {
  if (!dlNumber) return "";
  return dlNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Formats user/input date of birth strictly into DD/MM/YYYY required by Way2API.
 * Handles inputs in YYYY-MM-DD (HTML date input), DD-MM-YYYY, or DD/MM/YYYY.
 */
export function formatDobForWay2Api(dobInput: string | Date): string {
  if (!dobInput) return "";

  if (dobInput instanceof Date && !isNaN(dobInput.getTime())) {
    const day = String(dobInput.getDate()).padStart(2, "0");
    const month = String(dobInput.getMonth() + 1).padStart(2, "0");
    const year = dobInput.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const str = String(dobInput).trim();

  // If already DD/MM/YYYY: 15/06/1992
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }

  // If DD-MM-YYYY: 15-06-1992
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    return str.replace(/-/g, "/");
  }

  // If HTML input format YYYY-MM-DD: 1992-06-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-");
    return `${d}/${m}/${y}`;
  }

  // Try parsing generic string
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, "0");
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return str;
}

/**
 * Normalizes vehicle_classes returned by Way2API into a clean uppercase string array.
 */
export function extractVehicleClasses(rawClasses: any): string[] {
  if (!rawClasses) return [];

  if (Array.isArray(rawClasses)) {
    return rawClasses
      .map((item) => {
        if (typeof item === "string") return item.trim().toUpperCase();
        if (typeof item === "object" && item !== null) {
          return String(item.class || item.cov || item.vehicle_class || "").trim().toUpperCase();
        }
        return "";
      })
      .filter(Boolean);
  }

  if (typeof rawClasses === "string") {
    return rawClasses
      .split(/[,;\/]/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
  }

  return [];
}

/**
 * Checks whether the driver's licence vehicle classes cover the vehicle type they are registering.
 * 
 * Requirements:
 * - Bike / Motorcycle: Requires MCWG (Motor Cycle With Gear), MCWOG, 2W, TWO WHEELER, M-CYCLE
 * - Car / SUV / Van: Requires LMV (Light Motor Vehicle), LMV-NT, LMV-TR, 4W, MOTOR CAB
 */
export function checkDrivingLicenseVehicleClass(
  vehicleClasses: string[] | string,
  vehicleType: string
): { isEligible: boolean; matchedClasses: string[]; reason?: string } {
  const classes = Array.isArray(vehicleClasses)
    ? vehicleClasses.map((c) => c.toUpperCase())
    : extractVehicleClasses(vehicleClasses);

  const type = (vehicleType || "").toLowerCase().trim();
  const isBike = type === "bike";

  if (classes.length === 0) {
    return {
      isEligible: false,
      matchedClasses: [],
      reason: "No vehicle classes found on the verified driving licence.",
    };
  }

  if (isBike) {
    const motorcycleMatches = classes.filter(
      (c) =>
        c.includes("MCWG") ||
        c.includes("MCWOG") ||
        c.includes("2W") ||
        c.includes("TWO WHEELER") ||
        c.includes("M-CYCLE") ||
        c.includes("MOTORCYCLE")
    );

    if (motorcycleMatches.length > 0) {
      return { isEligible: true, matchedClasses: motorcycleMatches };
    }

    return {
      isEligible: false,
      matchedClasses: [],
      reason: `Licence covers [${classes.join(", ")}], which does not include motorcycle/two-wheeler privileges (e.g. MCWG).`,
    };
  } else {
    // Car, SUV, Van, etc.
    const carMatches = classes.filter(
      (c) =>
        c.includes("LMV") ||
        c.includes("LMV-NT") ||
        c.includes("LMV-TR") ||
        c.includes("4W") ||
        c.includes("MOTOR CAB") ||
        c.includes("LIGHT MOTOR")
    );

    if (carMatches.length > 0) {
      return { isEligible: true, matchedClasses: carMatches };
    }

    return {
      isEligible: false,
      matchedClasses: [],
      reason: `Licence covers [${classes.join(", ")}], which does not include Light Motor Vehicle (LMV/LMV-NT) car driving privileges.`,
    };
  }
}

/**
 * Main Driving Licence verification function via Way2API.
 */
export async function verifyDrivingLicense(
  dlNumber: string,
  dob: string | Date,
  vehicleType?: string,
  options?: { bypassCache?: boolean }
): Promise<DLVerificationResult> {
  const normalizedDL = normalizeDrivingLicenseNumber(dlNumber);
  const formattedDob = formatDobForWay2Api(dob);
  const now = new Date();

  // Basic format validation
  if (!normalizedDL || normalizedDL.length < 6 || normalizedDL.length > 20) {
    return {
      success: false,
      status: "FAILED",
      provider: "way2api",
      referenceId: "",
      messageCode: "INVALID_INPUT",
      checkedAt: now,
      vehicleClasses: [],
      licenseVehicleClassStatus: "NOT_CHECKED",
      isVehicleClassEligible: false,
      notes: "Invalid driving licence number format.",
      rejectionReason: "Invalid driving licence number format.",
    };
  }

  if (!formattedDob || !/^\d{2}\/\d{2}\/\d{4}$/.test(formattedDob)) {
    return {
      success: false,
      status: "FAILED",
      provider: "way2api",
      referenceId: "",
      messageCode: "INVALID_INPUT",
      checkedAt: now,
      vehicleClasses: [],
      licenseVehicleClassStatus: "NOT_CHECKED",
      isVehicleClassEligible: false,
      notes: "Date of birth is required in DD/MM/YYYY format.",
      rejectionReason: "Invalid date of birth format for driving licence verification.",
    };
  }

  // Execute Way2API request
  const apiResult: Way2ApiExecutionResult = await executeWay2ApiCall(
    "driving-license",
    {
      dl_number: normalizedDL,
      dob: formattedDob,
    },
    options
  );

  const orderId = apiResult.orderId || "";
  const rawData = apiResult.data || {};
  const messageCode = apiResult.messageCode;

  // Extract vehicle classes
  const vehicleClasses = extractVehicleClasses(rawData.vehicle_classes);

  // Extract expiration date and check validity
  const rawDoe = String(rawData.doe || rawData.transport_doe || rawData.expiry_date || "").trim();
  let isDlExpired = false;
  if (rawDoe) {
    let parsedExpiry: Date | null = null;
    if (/^\d{4}-\d{2}-\d{2}/.test(rawDoe)) {
      parsedExpiry = new Date(rawDoe);
    } else if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(rawDoe)) {
      const parts = rawDoe.split(/[\/\-]/);
      parsedExpiry = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
    if (parsedExpiry && !isNaN(parsedExpiry.getTime())) {
      isDlExpired = parsedExpiry.getTime() < now.getTime();
    }
  }

  // Check vehicle class eligibility if vehicleType provided
  let isVehicleClassEligible = true;
  let classEligibilityReason: string | undefined;

  if (vehicleType && apiResult.isSuccess && !isDlExpired) {
    const classCheck = checkDrivingLicenseVehicleClass(vehicleClasses, vehicleType);
    isVehicleClassEligible = classCheck.isEligible;
    classEligibilityReason = classCheck.reason;
  }

  const licenseVehicleClassStatus: "NOT_CHECKED" | "COMPATIBLE" | "INCOMPATIBLE" =
    !vehicleType || !apiResult.isSuccess || isDlExpired
      ? "NOT_CHECKED"
      : isVehicleClassEligible
      ? "COMPATIBLE"
      : "INCOMPATIBLE";

  // Map API Result to DL Status
  let dlStatus: DrivingLicenseStatus = "FAILED";

  if (apiResult.isSuccess) {
    if (isDlExpired) {
      dlStatus = "FAILED";
    } else {
      dlStatus = "VERIFIED";
    }
  } else if (apiResult.status === "ACCEPTED") {
    dlStatus = "PENDING";
  } else if (apiResult.messageCode === "RATE_LIMITED") {
    dlStatus = "ERROR";
  } else if (apiResult.status === "CONFIG_ERROR" || apiResult.status === "HTTP_ERROR") {
    dlStatus = "ERROR";
  } else {
    dlStatus = "FAILED";
  }

  // Build sanitized DL data (scrubbing sensitive address, parent info, blood group)
  const sanitizedData: SanitizedDLData = {
    licenseNumber: rawData.license_number || normalizedDL,
    state: rawData.state || "",
    name: rawData.name || "",
    gender: rawData.gender || "",
    dobFormatted: formattedDob,
    issueDate: rawData.doi || rawData.transport_doi || "",
    expiryDate: rawDoe || "",
    vehicleClasses,
    mode: apiResult.isMock ? "mock" : "real",
  };

  const isOverallSuccess = dlStatus === "VERIFIED" && isVehicleClassEligible && !isDlExpired;

  let notes = apiResult.message;
  let rejectionReason: string | undefined;

  if (isDlExpired) {
    notes = "Driving licence has expired.";
    rejectionReason = "Driving licence has expired.";
  } else if (dlStatus === "VERIFIED" && !isVehicleClassEligible) {
    notes = `Licence verified, but vehicle class mismatch: ${classEligibilityReason}`;
    rejectionReason = classEligibilityReason;
  } else if (dlStatus !== "VERIFIED") {
    rejectionReason = apiResult.message;
  }

  return {
    success: isOverallSuccess,
    status: dlStatus,
    provider: "way2api",
    referenceId: orderId,
    orderId,
    messageCode,
    checkedAt: now,
    verifiedAt: dlStatus === "VERIFIED" ? now : undefined,
    vehicleClasses,
    isVehicleClassEligible,
    licenseVehicleClassStatus,
    isExpired: isDlExpired,
    classEligibilityReason,
    notes,
    rejectionReason,
    dlData: sanitizedData,
    error: apiResult.error,
  };
}
