/**
 * Driver & Vehicle Verification Orchestration Service (CommuteX)
 * 
 * Orchestrates dual independent verification:
 * 1. Driving Licence Verification (via Way2API DL API) + Vehicle Class Compatibility
 * 2. Vehicle RC Verification (via Way2API RC API) + Vehicle Details Cross-Check
 * 
 * Rules:
 * - Granular 4-state architecture:
 *   - DRIVING_LICENSE_STATUS
 *   - RC_STATUS
 *   - VEHICLE_MATCH_STATUS
 *   - FINAL_DRIVER_STATUS
 * - DO NOT automatically grant driver privileges upon API success.
 * - API success transitions the driver into PENDING_ADMIN_REVIEW.
 * - Super Admin / Campus Admin provides the final approval.
 */

import {
  verifyDrivingLicense,
  DLVerificationResult,
  DrivingLicenseStatus,
  SanitizedDLData,
} from "./drivingLicenseVerification";
import {
  verifyVehicleWithWay2API,
  VerificationResult as RCVerificationResult,
  RCVerificationStatus,
  VehicleMatchStatus,
  SanitizedRCData,
  VerificationInput,
} from "./vehicleVerification";

export type FinalDriverStatus =
  | "NOT_SUBMITTED"
  | "PENDING_VERIFICATION"
  | "PENDING_ADMIN_REVIEW"
  | "VERIFIED"
  | "REJECTED";

export interface DriverVerificationInput extends VerificationInput {
  drivingLicenseNumber?: string;
  drivingLicenseDob?: string | Date;
}

export interface CombinedVerificationResult {
  isFullyEligibleForReview: boolean;
  drivingLicenseStatus: DrivingLicenseStatus;
  rcStatus: RCVerificationStatus;
  vehicleMatchStatus: VehicleMatchStatus;
  finalDriverStatus: FinalDriverStatus;
  isApproved: boolean; // True ONLY after Admin explicitly approves
  summaryNotes: string;
  rejectionReason?: string;
  checkedAt: Date;
  dlResult: DLVerificationResult;
  rcResult: RCVerificationResult;
  dlData?: SanitizedDLData;
  rcData?: SanitizedRCData;
}

/**
 * Orchestrates complete verification for a driver and vehicle submission.
 */
export async function verifyDriverAndVehicle(
  input: DriverVerificationInput,
  options?: { bypassCache?: boolean }
): Promise<CombinedVerificationResult> {
  const now = new Date();

  // 1. Driving Licence Verification
  let dlResult: DLVerificationResult;
  if (input.drivingLicenseNumber && input.drivingLicenseDob) {
    dlResult = await verifyDrivingLicense(
      input.drivingLicenseNumber,
      input.drivingLicenseDob,
      input.vehicleType,
      options
    );
  } else {
    dlResult = {
      success: false,
      status: "NOT_STARTED",
      provider: "way2api",
      referenceId: "",
      messageCode: "NOT_PROVIDED",
      checkedAt: now,
      vehicleClasses: [],
      isVehicleClassEligible: false,
      notes: "Driving licence details not provided.",
    };
  }

  // 2. Vehicle RC Verification
  const rcResult = await verifyVehicleWithWay2API(input, options);

  // 3. Determine Overall Granular Statuses
  const dlStatus = dlResult.status;
  const rcStatus = rcResult.rcStatus;
  let vehicleMatchStatus: VehicleMatchStatus = rcResult.vehicleMatchStatus;

  // If DL vehicle class is incompatible, mark vehicle match status as MISMATCH
  if (dlStatus === "VERIFIED" && !dlResult.isVehicleClassEligible) {
    vehicleMatchStatus = "MISMATCH";
  }

  // Evaluate Final Driver Status
  let finalDriverStatus: FinalDriverStatus = "NOT_SUBMITTED";
  let isFullyEligibleForReview = false;
  let summaryNotes = "";
  let rejectionReason: string | undefined;

  const isDLSuccess = dlStatus === "VERIFIED" && dlResult.isVehicleClassEligible;
  const isRCSuccess = rcStatus === "VERIFIED" && rcResult.vehicleMatchStatus === "MATCHED";

  if (isDLSuccess && isRCSuccess) {
    // Both DL and RC verified, classes match, vehicle details match!
    // Section 17 & 19: Transitions to PENDING_ADMIN_REVIEW (NOT automatically verified!)
    isFullyEligibleForReview = true;
    finalDriverStatus = "PENDING_ADMIN_REVIEW";
    summaryNotes = "Driving licence and vehicle RC verified successfully. Awaiting administrator review.";
  } else if (
    vehicleMatchStatus === "MANUAL_REVIEW" ||
    rcResult.status === "MANUAL_REVIEW" ||
    dlStatus === "PENDING" ||
    rcStatus === "PENDING" ||
    dlStatus === "ERROR" ||
    rcStatus === "ERROR"
  ) {
    finalDriverStatus = "PENDING_ADMIN_REVIEW";
    summaryNotes = rcResult.rejectionReason || dlResult.notes || "Verification flagged for administrator manual review.";
    rejectionReason = rcResult.rejectionReason || dlResult.rejectionReason;
  } else if (
    vehicleMatchStatus === "MISMATCH" ||
    !dlResult.isVehicleClassEligible ||
    rcResult.status === "REJECTED" ||
    dlStatus === "FAILED" ||
    rcStatus === "FAILED"
  ) {
    finalDriverStatus = "REJECTED";
    rejectionReason =
      (!dlResult.isVehicleClassEligible && dlResult.classEligibilityReason) ||
      rcResult.rejectionReason ||
      dlResult.rejectionReason ||
      "Verification failed due to mismatched vehicle or licence details.";
    summaryNotes = rejectionReason;
  } else {
    finalDriverStatus = "PENDING_VERIFICATION";
    summaryNotes = "Verification in progress.";
  }

  return {
    isFullyEligibleForReview,
    drivingLicenseStatus: dlStatus,
    rcStatus,
    vehicleMatchStatus,
    finalDriverStatus,
    isApproved: false, // Remains false until explicit Admin approval action
    summaryNotes,
    rejectionReason,
    checkedAt: now,
    dlResult,
    rcResult,
    dlData: dlResult.dlData,
    rcData: rcResult.rcData,
  };
}
