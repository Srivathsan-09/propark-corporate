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

  // ── Method 2: Gmail App Password Service ──
  const gmailUser = process.env.GMAIL_USER || (process.env.SMTP_USER?.includes("@gmail.com") ? process.env.SMTP_USER : undefined);
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

  if (gmailUser && gmailPass) {
    try {
      const gmailTransporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser.trim(),
          pass: gmailPass.trim().replace(/\s+/g, ""), // Remove any accidental spaces in app password
        },
      });

      await gmailTransporter.sendMail({
        from: `"${appName}" <${gmailUser.trim()}>`,
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

      console.log(`✅ [Gmail SMTP] Successfully delivered OTP code to: ${email}`);
      return { success: true, method: "gmail" };
    } catch (gmailErr: any) {
      console.error("❌ [Gmail SMTP Error]:", gmailErr?.message || gmailErr);
      return {
        success: false,
        error: `Gmail delivery failed: ${gmailErr?.message || "Check Gmail App Password"}`,
        devOtp: otp,
      };
    }
  }

  // ── Method 3: Generic Custom SMTP ──
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
  const fromAddress = process.env.SMTP_FROM || smtpUser || "security@commutex.corporate";

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const customTransporter = nodemailer.createTransport({
        host: smtpHost.trim(),
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser.trim(),
          pass: smtpPass.trim(),
        },
        tls: { rejectUnauthorized: false },
      });

      await customTransporter.sendMail({
        from: `"${appName}" <${fromAddress}>`,
        to: email,
        subject,
        text: textBody,
        html: htmlBody,
      });

      console.log(`✅ [Custom SMTP] Delivered OTP code to: ${email}`);
      return { success: true, method: "smtp" };
    } catch (smtpErr: any) {
      console.error("❌ [Custom SMTP Error]:", smtpErr?.message || smtpErr);
      return {
        success: false,
        error: `SMTP delivery failed: ${smtpErr?.message}`,
        devOtp: otp,
      };
    }
  }

  // ── Method 4: No Credentials Configured (Fallback & Developer preview) ──
  console.warn("⚠️ [Email Notice] No RESEND_API_KEY, GMAIL_USER/GMAIL_APP_PASSWORD, or SMTP credentials found in environment variables.");
  console.log(`[OTP CODE GENERATED] For: ${email} | Campus: ${campusId} | Code: ${otp}`);

  return {
    success: true,
    method: "unconfigured",
    devOtp: otp,
  };
}

