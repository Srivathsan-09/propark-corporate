import nodemailer from "nodemailer";
import { Resend } from "resend";

interface ISendOtpParams {
  email: string;
  otp: string;
  campusName: string;
  campusId: string;
}

export interface ISendEmailResult {
  success: boolean;
  error?: string;
  devOtp?: string;
  method?: "resend" | "gmail" | "smtp" | "unconfigured";
}

/** Build HTML email body */
function buildOtpHtml(email: string, otp: string, campusName: string, campusId: string) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Campus Admin Authorization Code</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 12px;">
    <tr><td align="center">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr><td style="background:#7c3aed;padding:24px 28px;text-align:left;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">COMMUTEX</h1>
          <p style="margin:3px 0 0;color:#e9d5ff;font-size:12px;font-weight:500;">Corporate Mobility Governance & Admin Security</p>
        </td></tr>

        <!-- Content -->
        <tr><td style="padding:28px 28px 24px;">
          <h2 style="margin:0 0 12px;color:#0f172a;font-size:16px;font-weight:700;">Campus Administrator Assignment</h2>
          <p style="margin:0 0 16px;color:#475569;font-size:13px;line-height:1.6;">
            You are being assigned as the official <strong>Campus Administrator</strong> for 
            <strong>${campusName}</strong> (<code style="background:#f3e8ff;color:#7c3aed;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:600;">${campusId}</code>).
          </p>
          <p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.6;">
            Please provide this one-time verification code in the administration portal to authorize your role:
          </p>

          <!-- OTP Box -->
          <div style="background:#f5f3ff;border:1.5px dashed #8b5cf6;border-radius:12px;padding:20px;text-align:center;margin:0 0 20px;">
            <span style="display:block;color:#6d28d9;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">6-Digit Authorization Passcode</span>
            <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;color:#5b21b6;letter-spacing:8px;display:block;">${otp}</span>
            <span style="display:block;color:#64748b;font-size:11px;margin-top:6px;">Valid for 10 minutes &bull; Single-use only</span>
          </div>

          <div style="background:#f8fafc;border-left:3px solid #7c3aed;padding:10px 14px;border-radius:4px;">
            <p style="margin:0;color:#64748b;font-size:11px;line-height:1.5;">
              <strong>Security Notice:</strong> Never share this code with anyone. CommuteX staff will never ask for your verification code.
            </p>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">Sent to ${email} &bull; &copy; ${year} CommuteX Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

function buildOtpText(otp: string, campusName: string, campusId: string) {
  return `CommuteX Corporate Mobility - Campus Admin Assignment
------------------------------------------------------
Campus: ${campusName} (${campusId})
Your 6-Digit Authorization Code: ${otp}

This code expires in 10 minutes. Do not share it with anyone.
© ${new Date().getFullYear()} CommuteX Mobility Platform.`.trim();
}

/**
 * Dispatches a Campus Admin authorization OTP email.
 * Evaluates configured mail services in order:
 *   1. Resend API (via RESEND_API_KEY)
 *   2. Gmail Service (via GMAIL_USER + GMAIL_APP_PASSWORD)
 *   3. Custom SMTP (via SMTP_HOST + SMTP_USER + SMTP_PASS)
 *   4. Fallback devOtp if no service is configured
 */
export async function sendCampusAdminOtpEmail({
  email,
  otp,
  campusName,
  campusId,
}: ISendOtpParams): Promise<ISendEmailResult> {
  const htmlBody = buildOtpHtml(email, otp, campusName, campusId);
  const textBody = buildOtpText(otp, campusName, campusId);
  const subject = `Your Campus Administrator Security Code: ${otp}`;
  const appName = "CommuteX Corporate Mobility";

  // ── Method 1: Resend Cloud Email API ──
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey.trim().length > 0) {
    try {
      const resend = new Resend(resendKey.trim());
      const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

      const resendResult = await resend.emails.send({
        from: `${appName} <${fromEmail}>`,
        to: email,
        subject,
        html: htmlBody,
        text: textBody,
      });

      if (resendResult.error) {
        console.error("[Resend Error]:", resendResult.error);
      } else {
        console.log(`✅ [Resend] Successfully dispatched OTP email to: ${email}`);
        return { success: true, method: "resend" };
      }
    } catch (resendErr: any) {
      console.error("❌ [Resend Exception]:", resendErr?.message || resendErr);
    }
  }

  // ── Method 2: SMTP / Gmail (Supports Paperless EMAIL_*, GMAIL_*, and SMTP_* vars) ──
  const emailUser = (process.env.EMAIL_USER || process.env.GMAIL_USER || process.env.SMTP_USER)?.trim();
  const emailPass = (process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS)?.trim();
  const emailHost = (process.env.EMAIL_HOST || process.env.SMTP_HOST)?.trim();
  const emailPort = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || "465", 10);
  const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || emailUser || "security@commutex.corporate";

  if (emailUser && emailPass) {
    try {
      const isGmail = !emailHost || emailHost === "smtp.gmail.com" || emailUser.includes("@gmail.com");
      
      const transporter = isGmail
        ? nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: emailUser,
              pass: emailPass.replace(/\s+/g, ""), // Clean any spaces in 16-letter App password
            },
          })
        : nodemailer.createTransport({
            host: emailHost,
            port: emailPort,
            secure: emailPort === 465,
            auth: {
              user: emailUser,
              pass: emailPass,
            },
            tls: { rejectUnauthorized: false },
          });

      await transporter.sendMail({
        from: `"${appName}" <${fromAddress}>`,
        to: email,
        subject,
        text: textBody,
        html: htmlBody,
        headers: {
          "X-Priority": "1 (Highest)",
          "X-MSMail-Priority": "High",
          Importance: "High",
        },
      });

      console.log(`✅ [Email Service] Delivered OTP code to: ${email} (via ${isGmail ? "Gmail" : emailHost})`);
      return { success: true, method: isGmail ? "gmail" : "smtp" };
    } catch (mailErr: any) {
      console.error("❌ [Email Service Error]:", mailErr?.message || mailErr);
      return {
        success: false,
        error: `Email delivery failed: ${mailErr?.message}`,
        devOtp: otp,
      };
    }
  }

  // ── Method 3: Fallback when credentials are not yet added in Vercel ──
  console.warn("⚠️ [Email Notice] No EMAIL_USER/EMAIL_PASSWORD, GMAIL_USER/GMAIL_APP_PASSWORD, or RESEND_API_KEY found.");
  console.log(`[OTP CODE GENERATED] For: ${email} | Campus: ${campusId} | Code: ${otp}`);

  return {
    success: true,
    method: "unconfigured",
    devOtp: otp,
  };
}

export interface ISendRegistrationOtpParams {
  email: string;
  otp: string;
  name: string;
  campusName?: string;
}

function buildRegistrationOtpHtml(email: string, otp: string, name: string, campusName?: string) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CommuteX Email Verification</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 12px;">
    <tr><td align="center">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr><td style="background:#059669;padding:24px 28px;text-align:left;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">COMMUTEX</h1>
          <p style="margin:3px 0 0;color:#d1fae5;font-size:12px;font-weight:500;">Corporate Commute & Enterprise Carpooling</p>
        </td></tr>

        <!-- Content -->
        <tr><td style="padding:28px 28px 24px;">
          <h2 style="margin:0 0 12px;color:#0f172a;font-size:16px;font-weight:700;">Welcome to CommuteX, ${name}!</h2>
          <p style="margin:0 0 16px;color:#475569;font-size:13px;line-height:1.6;">
            Thank you for registering your corporate account${campusName ? ` for <strong>${campusName}</strong>` : ""}. Please verify your email address to complete your registration:
          </p>

          <!-- OTP Box -->
          <div style="background:#ecfdf5;border:1.5px dashed #10b981;border-radius:12px;padding:20px;text-align:center;margin:0 0 20px;">
            <span style="display:block;color:#047857;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">6-Digit Verification Code</span>
            <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;color:#065f46;letter-spacing:8px;display:block;">${otp}</span>
            <span style="display:block;color:#64748b;font-size:11px;margin-top:6px;">Valid for 10 minutes &bull; Single-use only</span>
          </div>

          <div style="background:#f8fafc;border-left:3px solid #059669;padding:10px 14px;border-radius:4px;">
            <p style="margin:0;color:#64748b;font-size:11px;line-height:1.5;">
              <strong>Security Notice:</strong> Never share this code with anyone. If you did not request this registration, you can safely ignore this email.
            </p>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">Sent to ${email} &bull; &copy; ${year} CommuteX Corporate Mobility Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

function buildRegistrationOtpText(otp: string, name: string, campusName?: string) {
  return `Welcome to CommuteX Corporate Mobility, ${name}!
------------------------------------------------------
Your 6-Digit Email Verification Code: ${otp}

This code expires in 10 minutes. Enter it on the registration page to activate your account.
© ${new Date().getFullYear()} CommuteX Platform.`.trim();
}

/**
 * Dispatches an employee registration verification OTP email.
 */
export async function sendRegistrationOtpEmail({
  email,
  otp,
  name,
  campusName,
}: ISendRegistrationOtpParams): Promise<ISendEmailResult> {
  const htmlBody = buildRegistrationOtpHtml(email, otp, name, campusName);
  const textBody = buildRegistrationOtpText(otp, name, campusName);
  const subject = `Your CommuteX Verification Code: ${otp}`;
  const appName = "CommuteX Corporate Mobility";

  // ── Method 1: Resend Cloud Email API ──
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey.trim().length > 0) {
    try {
      const resend = new Resend(resendKey.trim());
      const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

      const resendResult = await resend.emails.send({
        from: `${appName} <${fromEmail}>`,
        to: email,
        subject,
        html: htmlBody,
        text: textBody,
      });

      if (resendResult.error) {
        console.error("[Resend Error]:", resendResult.error);
      } else {
        console.log(`✅ [Resend] Successfully dispatched registration OTP email to: ${email}`);
        return { success: true, method: "resend" };
      }
    } catch (resendErr: any) {
      console.error("❌ [Resend Exception]:", resendErr?.message || resendErr);
    }
  }

  // ── Method 2: SMTP / Gmail ──
  const emailUser = (process.env.EMAIL_USER || process.env.GMAIL_USER || process.env.SMTP_USER)?.trim();
  const emailPass = (process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS)?.trim();
  const emailHost = (process.env.EMAIL_HOST || process.env.SMTP_HOST)?.trim();
  const emailPort = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || "465", 10);
  const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || emailUser || "security@commutex.corporate";

  if (emailUser && emailPass) {
    try {
      const isGmail = !emailHost || emailHost === "smtp.gmail.com" || emailUser.includes("@gmail.com");
      
      const transporter = isGmail
        ? nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: emailUser,
              pass: emailPass.replace(/\s+/g, ""),
            },
          })
        : nodemailer.createTransport({
            host: emailHost,
            port: emailPort,
            secure: emailPort === 465,
            auth: {
              user: emailUser,
              pass: emailPass,
            },
            tls: { rejectUnauthorized: false },
          });

      await transporter.sendMail({
        from: `"${appName}" <${fromAddress}>`,
        to: email,
        subject,
        text: textBody,
        html: htmlBody,
        headers: {
          "X-Priority": "1 (Highest)",
          "X-MSMail-Priority": "High",
          Importance: "High",
        },
      });

      console.log(`✅ [Email Service] Delivered registration OTP to: ${email}`);
      return { success: true, method: isGmail ? "gmail" : "smtp" };
    } catch (mailErr: any) {
      console.error("❌ [Email Service Error]:", mailErr?.message || mailErr);
      return {
        success: false,
        error: `Email delivery failed: ${mailErr?.message}`,
        devOtp: otp,
      };
    }
  }

  // ── Method 3: Fallback ──
  console.warn("⚠️ [Email Notice] No email service configured. OTP logged for testing.");
  console.log(`[REGISTRATION OTP] For: ${email} | Code: ${otp}`);

  return {
    success: true,
    method: "unconfigured",
    devOtp: otp,
  };
}

