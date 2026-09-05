/**
 * Way2API Client (CommuteX Driver & Vehicle Verification)
 * 
 * Official Provider: Way2API (https://www.way2api.com)
 * Endpoints:
 * - Driving Licence: POST https://app.way2api.com/api/v1/driving-license/verify
 * - Vehicle RC: POST https://app.way2api.com/api/v1/rc/verify
 * 
 * Security & Reliability Constraints:
 * - Server-side only (never exposed in client code)
 * - Strict status mapping per Way2API official documentation
 * - 429 rate limit detection and friendly messaging
 * - Duplicate request caching with configurable TTL
 * - Mock mode support for development and test harnesses
 */

export type Way2ApiEndpoint = "driving-license" | "rc";

export interface Way2ApiStandardResponse {
  status: string; // e.g. "SUCCESS", "ACCEPTED", "FAILED", "ERROR"
  status_code?: number;
  charged?: boolean;
  success: boolean; // TRUE verification outcome
  message: string;
  message_code: string; // Machine-readable e.g. "OK", "VERIFICATION_FAILED", "NO_RECORD_FOUND"
  order_id?: string;
  data?: {
    result?: Record<string, any>;
    [key: string]: any;
  };
  result?: Record<string, any>;
  [key: string]: any;
}

export interface Way2ApiExecutionResult {
  isSuccess: boolean;
  status: string;
  messageCode: string;
  message: string;
  orderId?: string;
  data?: Record<string, any>;
  isRateLimited?: boolean;
  error?: string;
  isMock?: boolean;
}

// In-memory caching for recent verifications to prevent redundant charged calls
interface CacheItem {
  timestamp: number;
  result: Way2ApiExecutionResult;
}
const requestCache = new Map<string, CacheItem>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Maps raw Way2API message codes to human-friendly CommuteX explanations.
 */
export function mapMessageCodeToExplanation(messageCode: string, serviceType: "DL" | "RC"): string {
  const code = (messageCode || "").toUpperCase();
  const label = serviceType === "DL" ? "Driving Licence" : "Vehicle RC";

  switch (code) {
    case "OK":
      return `${label} verified successfully in official registry.`;
    case "VERIFICATION_FAILED":
      return `${label} details could not be verified against the official registry.`;
    case "NO_RECORD_FOUND":
      return `No matching ${label.toLowerCase()} record was found in the government registry.`;
    case "ACCEPTED":
      return `Verification request accepted and is currently being processed.`;
    case "PROVIDER_NO_RESPONSE":
      return `Provider did not respond in time. Verification queued for review.`;
    case "SOURCE_UNAVAILABLE":
      return `The government registry source is temporarily unavailable.`;
    case "INVALID_INPUT":
      return `Invalid ${label.toLowerCase()} or input format. Please check and try again.`;
    case "MISSING_API_KEY":
    case "INVALID_API_KEY":
      return `${label} verification service configuration is invalid.`;
    case "INSUFFICIENT_BALANCE":
      return `Verification service quota exceeded. Please contact system administrator.`;
    case "NO_API_ACCESS":
      return `Verification API access not granted for this service tier.`;
    case "RATE_LIMITED":
      return `Verification service is temporarily rate limited. Please try again later.`;
    case "REQUEST_FAILED":
    case "INTERNAL_ERROR":
    case "PROVIDER_UNAVAILABLE":
      return `${label} provider service error. Please try again shortly.`;
    default:
      return `Verification finished with status code: ${messageCode || "UNKNOWN"}.`;
  }
}

/**
 * Base invoker for Way2API endpoints.
 */
export async function executeWay2ApiCall(
  endpoint: Way2ApiEndpoint,
  bodyPayload: Record<string, any>,
  options?: { bypassCache?: boolean }
): Promise<Way2ApiExecutionResult> {
  const isDL = endpoint === "driving-license";
  const serviceLabel = isDL ? "DL" : "RC";

  // Cache key based on endpoint and primary identifier
  const primaryId = isDL ? String(bodyPayload.dl_number || "") : String(bodyPayload.rc_number || "");
  const cacheKey = `${endpoint}_${primaryId.toUpperCase().replace(/[^A-Z0-9]/g, "")}`;

  if (!options?.bypassCache && primaryId) {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.result;
    }
  }

  // Determine mode and credentials
  const modeEnv = isDL
    ? process.env.DL_VERIFICATION_MODE || process.env.RC_VERIFICATION_MODE || "mock"
    : process.env.RC_VERIFICATION_MODE || "mock";
  const mode = modeEnv.toLowerCase();

  const apiKey = isDL
    ? process.env.DL_VERIFICATION_API_KEY || process.env.RC_VERIFICATION_API_KEY || process.env.WAY2API_API_KEY
    : process.env.RC_VERIFICATION_API_KEY || process.env.WAY2API_API_KEY || process.env.DL_VERIFICATION_API_KEY;

  const apiUrl = isDL
    ? process.env.DL_VERIFICATION_API_URL || "https://app.way2api.com/api/v1/driving-license/verify"
    : process.env.RC_VERIFICATION_API_URL || "https://app.way2api.com/api/v1/rc/verify";

  // Section 3: If real mode is configured but API key is missing, raise configuration error
  if (mode === "real" && !apiKey) {
    console.error(`[Way2API] Error: REAL mode configured for ${serviceLabel} but no API key is set in environment.`);
    return {
      isSuccess: false,
      status: "CONFIG_ERROR",
      messageCode: "MISSING_API_KEY",
      message: `${serviceLabel} verification service configuration is invalid. API key missing.`,
      error: "Missing API Key configuration",
    };
  }

  // --------------------------------------------------------------------------
  // MOCK MODE FOR DEVELOPMENT / TESTING
  // --------------------------------------------------------------------------
  if (mode !== "real") {
    console.info(`[Way2API] [MOCK MODE] Executing ${endpoint} for ID: ${primaryId}`);
    const mockRes = handleMockWay2ApiCall(endpoint, bodyPayload);
    if (primaryId && mockRes.isSuccess) {
      requestCache.set(cacheKey, { timestamp: Date.now(), result: mockRes });
    }
    return mockRes;
  }

  // --------------------------------------------------------------------------
  // REAL WAY2API MODE
  // --------------------------------------------------------------------------
  console.info(`[Way2API] [REAL MODE] Sending request to ${apiUrl}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle Rate Limiting (HTTP 429)
    if (response.status === 429) {
      console.warn(`[Way2API] HTTP 429 Rate Limited on ${endpoint}`);
      return {
        isSuccess: false,
        status: "RATE_LIMITED",
        messageCode: "RATE_LIMITED",
        message: "Verification service is temporarily rate limited. Please try again later.",
        isRateLimited: true,
        error: "Rate limit exceeded (5/min or 100/day).",
      };
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[Way2API] HTTP ${response.status} error from ${endpoint}:`, errText);

      if (response.status === 401 || response.status === 403) {
        return {
          isSuccess: false,
          status: "CONFIG_ERROR",
          messageCode: "INVALID_API_KEY",
          message: `${serviceLabel} verification service configuration is invalid.`,
          error: "Invalid API credentials",
        };
      }

      if (response.status === 402) {
        return {
          isSuccess: false,
          status: "PAYMENT_REQUIRED",
          messageCode: "INSUFFICIENT_BALANCE",
          message: "Verification service is temporarily unavailable.",
          error: "Insufficient Way2API balance",
        };
      }

      return {
        isSuccess: false,
        status: "HTTP_ERROR",
        messageCode: "REQUEST_FAILED",
        message: `${serviceLabel} verification service is temporarily unavailable.`,
        error: `HTTP ${response.status}`,
      };
    }

    const apiJson: Way2ApiStandardResponse = await response.json();

    // Section 9: Status & Success Evaluation Logic
    const apiSuccess = Boolean(apiJson.success);
    const messageCode = String(apiJson.message_code || "").toUpperCase();
    const orderId = apiJson.order_id || apiJson.data?.order_id || `W2A_${Date.now()}`;
    const resultData = apiJson.data?.result || apiJson.result || apiJson.data || {};

    const isVerified = apiSuccess && messageCode === "OK";

    const executionResult: Way2ApiExecutionResult = {
      isSuccess: isVerified,
      status: apiJson.status || (isVerified ? "SUCCESS" : "FAILED"),
      messageCode: messageCode || (isVerified ? "OK" : "UNKNOWN"),
      message: apiJson.message || mapMessageCodeToExplanation(messageCode, serviceLabel),
      orderId,
      data: resultData,
      isRateLimited: messageCode === "RATE_LIMITED",
    };

    if (isVerified && primaryId) {
      requestCache.set(cacheKey, { timestamp: Date.now(), result: executionResult });
    }

    return executionResult;
  } catch (err: any) {
    console.error(`[Way2API] Exception during ${endpoint} call:`, err);
    const isTimeout = err.name === "AbortError";

    return {
      isSuccess: false,
      status: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
      messageCode: isTimeout ? "PROVIDER_NO_RESPONSE" : "INTERNAL_ERROR",
      message: isTimeout
        ? "Verification service timed out. Please try again shortly."
        : "Network connection error while contacting verification provider.",
      error: err.message || "Network exception",
    };
  }
}

/**
 * Comprehensive Mock Handler implementing test cases A through O
 */
function handleMockWay2ApiCall(
  endpoint: Way2ApiEndpoint,
  bodyPayload: Record<string, any>
): Way2ApiExecutionResult {
  const isDL = endpoint === "driving-license";
  const serviceLabel = isDL ? "DL" : "RC";
  const idStr = String(isDL ? bodyPayload.dl_number || "" : bodyPayload.rc_number || "").toUpperCase();

  // Test Case: Rate Limited
  if (idStr.includes("RATELIMIT") || idStr.endsWith("429")) {
    return {
      isSuccess: false,
      status: "RATE_LIMITED",
      messageCode: "RATE_LIMITED",
      message: "Verification service is temporarily rate limited. Please try again later.",
      isRateLimited: true,
      isMock: true,
    };
  }

  // Test Case: Insufficient Balance
  if (idStr.includes("NOBAL") || idStr.endsWith("402")) {
    return {
      isSuccess: false,
      status: "PAYMENT_REQUIRED",
      messageCode: "INSUFFICIENT_BALANCE",
      message: "Vehicle verification service is temporarily unavailable.",
      isMock: true,
    };
  }

  // Test Case: Invalid API Key simulation
  if (idStr.includes("BADKEY")) {
    return {
      isSuccess: false,
      status: "CONFIG_ERROR",
      messageCode: "INVALID_API_KEY",
      message: `${serviceLabel} verification service configuration is invalid.`,
      isMock: true,
    };
  }

  // Test Case: Provider Unavailable / Timeout
  if (idStr.includes("UNAVAIL") || idStr.endsWith("503")) {
    return {
      isSuccess: false,
      status: "PROVIDER_UNAVAILABLE",
      messageCode: "PROVIDER_UNAVAILABLE",
      message: "The verification source is temporarily unavailable.",
      isMock: true,
    };
  }

  // Test Case: Accepted / Pending
  if (idStr.includes("PENDING") || idStr.endsWith("202")) {
    return {
      isSuccess: false,
      status: "ACCEPTED",
      messageCode: "ACCEPTED",
      message: "Verification is still being processed.",
      orderId: `MOCK_PEND_${Date.now()}`,
      isMock: true,
    };
  }

  // Test Case: Verification Failed (Valid lookup, but unverified / negative)
  if (idStr.includes("FAIL") || idStr.endsWith("8888")) {
    return {
      isSuccess: false,
      status: "SUCCESS",
      messageCode: "VERIFICATION_FAILED",
      message: `The ${serviceLabel} details could not be verified.`,
      orderId: `MOCK_FAIL_${Date.now()}`,
      isMock: true,
    };
  }

  // Test Case: No Record Found
  if (idStr.includes("NOTFOUND") || idStr.endsWith("404") || idStr.length < 5) {
    return {
      isSuccess: false,
      status: "SUCCESS",
      messageCode: "NO_RECORD_FOUND",
      message: `No matching ${serviceLabel.toLowerCase()} record was found.`,
      orderId: `MOCK_NF_${Date.now()}`,
      isMock: true,
    };
  }

  // --------------------------------------------------------------------------
  // SUCCESSFUL MOCK RECORDS
  // --------------------------------------------------------------------------
  if (isDL) {
    const isBikeOnlyMock = idStr.includes("BIKEONLY") || idStr.endsWith("1111");
    const isCarOnlyMock = idStr.includes("CARONLY") || idStr.endsWith("2222");

    let vehicleClasses = ["MCWG", "LMV-NT"];
    if (isBikeOnlyMock) {
      vehicleClasses = ["MCWG"]; // Bike only (Motor Cycle With Gear)
    } else if (isCarOnlyMock) {
      vehicleClasses = ["LMV-NT"]; // Car only (Light Motor Vehicle - Non Transport)
    }

    return {
      isSuccess: true,
      status: "SUCCESS",
      messageCode: "OK",
      message: "Driving licence verified successfully in national registry.",
      orderId: `MOCK_DL_${Date.now()}`,
      isMock: true,
      data: {
        license_number: idStr,
        state: "TAMIL NADU",
        name: "SRIVATHSAN M",
        gender: "MALE",
        dob: bodyPayload.dob || "15/06/1995",
        doe: "2038-12-31",
        doi: "2018-01-10",
        vehicle_classes: vehicleClasses,
        // Sensitive PII mocked but excluded in production views:
        permanent_address: "Tech Park Campus, Chennai, TN",
        father_or_husband_name: "Mock Parent Name",
      },
    };
  }

  // RC Mock Record
  const isBikePlateMock = idStr.includes("BIKE") || idStr.endsWith("3333");
  const isSuspendedMock = idStr.endsWith("7777");
  const isMismatchMock = idStr.includes("MISMATCH") || idStr.endsWith("9999");

  return {
    isSuccess: true,
    status: "SUCCESS",
    messageCode: "OK",
    message: "RC verified successfully in national registry.",
    orderId: `MOCK_RC_${Date.now()}`,
    isMock: true,
    data: {
      rc_number: idStr,
      rc_status: isSuspendedMock ? "SUSPENDED" : "ACTIVE",
      vehicle_category: isBikePlateMock ? "2W" : "LMV",
      maker_description: isMismatchMock ? "MARUTI SUZUKI INDIA LTD" : "HYUNDAI MOTOR INDIA LTD",
      maker_model: isMismatchMock ? "SWIFT VXI" : "I20 SPORTZ 1.2",
      body_type: isBikePlateMock ? "MOTORCYCLE" : "SEDAN / HATCHBACK",
      fuel_type: "PETROL",
      color: "WHITE",
      fit_up_to: "2038-03-20",
      registration_date: "2023-03-21",
      insurance_company: "ICICI LOMBARD GENERAL INSURANCE CO LTD",
      insurance_upto: "2026-11-30",
      // Sensitive owner fields:
      owner_name: "COMMUTEX FLEET OWNER",
      vehicle_chasi_number: "MDH45920384729103",
      vehicle_engine_number: "ENG920194820",
    },
  };
}
