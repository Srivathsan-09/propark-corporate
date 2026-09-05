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
  licenseVehicleClassStatus: "NOT_CHECKED" | "COMPATIBLE" | "INCOMPATIBLE";
  rcProviderStatus: "NOT_STARTED" | "PENDING" | "VERIFIED" | "FAILED" | "ERROR";
  rcStatus: string;
  vehicleMatchStatus: VehicleMatchStatus;
  commutexVehicleVerificationStatus: "PENDING" | "MANUAL_REVIEW" | "VERIFIED" | "REJECTED" | "FAILED";
  adminApprovalStatus: "PENDING" | "APPROVED" | "REJECTED";
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
      licenseVehicleClassStatus: "NOT_CHECKED",
      isVehicleClassEligible: false,
      notes: "Driving licence details not provided.",
    };
  }

  // 2. Vehicle RC Verification
  const rcResult = await verifyVehicleWithWay2API(input, options);

  // 3. Determine Overall Granular Statuses
  const dlStatus = dlResult.status;
  const rcProviderStatus: "NOT_STARTED" | "PENDING" | "VERIFIED" | "FAILED" | "ERROR" =
    rcResult.rcProviderStatus ||
    (rcResult.status === "VERIFIED"
      ? "VERIFIED"
      : rcResult.status === "PENDING"
      ? "PENDING"
      : rcResult.status === "VERIFICATION_FAILED" || rcResult.status === "REJECTED"
      ? "FAILED"
      : "ERROR");
  const rcStatus = rcResult.rcStatus;
  let vehicleMatchStatus: VehicleMatchStatus = rcResult.vehicleMatchStatus;

  const licenseVehicleClassStatus: "NOT_CHECKED" | "COMPATIBLE" | "INCOMPATIBLE" =
    dlResult.licenseVehicleClassStatus ||
    (dlResult.isVehicleClassEligible
      ? "COMPATIBLE"
      : dlStatus === "VERIFIED"
      ? "INCOMPATIBLE"
      : "NOT_CHECKED");

  // If DL vehicle class is incompatible, flag vehicle match status as MISMATCH
  if (dlStatus === "VERIFIED" && !dlResult.isVehicleClassEligible) {
    vehicleMatchStatus = "MISMATCH";
  }

  // CommuteX Vehicle Verification Status calculation
  let commutexVehicleVerificationStatus: "PENDING" | "MANUAL_REVIEW" | "VERIFIED" | "REJECTED" | "FAILED" = "PENDING";

  if (
    rcProviderStatus === "VERIFIED" &&
    rcStatus === "ACTIVE" &&
    vehicleMatchStatus === "MATCHED" &&
    dlStatus === "VERIFIED" &&
    licenseVehicleClassStatus === "COMPATIBLE"
  ) {
    commutexVehicleVerificationStatus = "VERIFIED";
  } else if (
    vehicleMatchStatus === "MANUAL_REVIEW" ||
    vehicleMatchStatus === "MISMATCH" ||
    rcResult.status === "MANUAL_REVIEW" ||
    licenseVehicleClassStatus === "INCOMPATIBLE"
  ) {
    commutexVehicleVerificationStatus = "MANUAL_REVIEW";
  } else if (
    rcProviderStatus === "FAILED" ||
    dlStatus === "FAILED" ||
    rcStatus === "SUSPENDED" ||
    rcStatus === "CANCELLED"
  ) {
    commutexVehicleVerificationStatus = "FAILED";
  } else if (rcProviderStatus === "PENDING" || dlStatus === "PENDING") {
    commutexVehicleVerificationStatus = "PENDING";
  } else {
    commutexVehicleVerificationStatus = "MANUAL_REVIEW";
  }

  // Admin Approval Status (remains PENDING until admin approves)
  const adminApprovalStatus: "PENDING" | "APPROVED" | "REJECTED" = "PENDING";

  // Evaluate Final Driver Status
  let finalDriverStatus: FinalDriverStatus = "NOT_SUBMITTED";
  let isFullyEligibleForReview = false;
  let summaryNotes = "";
  let rejectionReason: string | undefined;

  const isDLSuccess = dlStatus === "VERIFIED" && dlResult.isVehicleClassEligible;
  const isRCSuccess = rcProviderStatus === "VERIFIED" && rcStatus === "ACTIVE" && rcResult.vehicleMatchStatus === "MATCHED";

  if (isDLSuccess && isRCSuccess) {
    // Both DL and RC verified, classes match, vehicle details match!
    // Transitions to PENDING_ADMIN_REVIEW (NOT automatically verified!)
    isFullyEligibleForReview = true;
    finalDriverStatus = "PENDING_ADMIN_REVIEW";
    summaryNotes = "Driving licence and vehicle RC verified successfully. Awaiting administrator review.";
  } else if (
    commutexVehicleVerificationStatus === "MANUAL_REVIEW" ||
    vehicleMatchStatus === "MANUAL_REVIEW" ||
    vehicleMatchStatus === "MISMATCH" ||
    licenseVehicleClassStatus === "INCOMPATIBLE" ||
    rcResult.status === "MANUAL_REVIEW" ||
    dlStatus === "PENDING" ||
    rcStatus === "PENDING" ||
    dlStatus === "ERROR" ||
    rcStatus === "ERROR"
  ) {
    finalDriverStatus = "PENDING_ADMIN_REVIEW";
    summaryNotes =
      rcResult.rejectionReason ||
      dlResult.classEligibilityReason ||
      dlResult.notes ||
      "Verification flagged for administrator manual review.";
    rejectionReason = rcResult.rejectionReason || dlResult.classEligibilityReason || dlResult.rejectionReason;
  } else if (
    rcResult.status === "REJECTED" ||
    dlStatus === "FAILED" ||
    rcStatus === "FAILED"
  ) {
    finalDriverStatus = "REJECTED";
    rejectionReason =
      (!dlResult.isVehicleClassEligible && dlResult.classEligibilityReason) ||
      rcResult.rejectionReason ||
      dlResult.rejectionReason ||
      "Verification failed due to invalid licence or registration details.";
    summaryNotes = rejectionReason;
  } else {
    finalDriverStatus = "PENDING_VERIFICATION";
    summaryNotes = "Verification in progress.";
  }

  return {
    isFullyEligibleForReview,
    drivingLicenseStatus: dlStatus,
    licenseVehicleClassStatus,
    rcProviderStatus,
    rcStatus,
    vehicleMatchStatus,
    commutexVehicleVerificationStatus,
    adminApprovalStatus,
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
