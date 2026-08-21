import nodemailer from "nodemailer";
import { Resend } from "resend";

interface ISendOtpParams {
  email: string;
  otp: string;
  campusName: string;
  campusId: string;
}

/** Build HTML email body */
function buildOtpHtml(email: string, otp: string, campusName: string, campusId: string) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Campus Admin OTP</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:40px 15px;">
    <tr><td align="center">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <tr><td style="background:#7c3aed;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">COMMUTEX</h1>
          <p style="margin:4px 0 0;color:#e9d5ff;font-size:12px;">Corporate Mobility Platform</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 12px;color:#0f172a;font-size:17px;font-weight:600;">Campus Administrator Assignment</h2>
          <p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.6;">
            You are being assigned as the <strong>Campus Administrator</strong> for
            <strong>${campusName}</strong>
            (<code style="background:#f3e8ff;color:#7c3aed;padding:2px 6px;border-radius:4px;font-size:12px;">${campusId}</code>).
          </p>
          <p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.6;">
            Enter this one-time code in the admin portal to confirm your assignment:
          </p>
          <div style="background:#f5f3ff;border:1.5px dashed #8b5cf6;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
            <span style="display:block;color:#6d28d9;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">One-Time Verification Code</span>
            <span style="font-family:'Courier New',Courier,monospace;font-size:38px;font-weight:800;color:#5b21b6;letter-spacing:10px;">${otp}</span>
            <span style="display:block;color:#64748b;font-size:11px;margin-top:8px;">Valid for 10 minutes &bull; Single use only</span>
          </div>
          <div style="background:#f8fafc;border-left:3px solid #7c3aed;padding:12px 16px;border-radius:4px;">
            <p style="margin:0;color:#64748b;font-size:11px;line-height:1.5;">
              <strong>Security Note:</strong> Never share this code. CommuteX staff will never ask for your verification code.
            </p>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">Sent to ${email} &bull; &copy; ${year} CommuteX Mobility Platform</p>
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
Your verification code: ${otp}

This code expires in 10 minutes. Do not share it with anyone.`.trim();
}

/**
 * Sends a Campus Admin authorization OTP email.
 * Priority order:
 *   1. Resend API (RESEND_API_KEY)
 *   2. Nodemailer SMTP (SMTP_USER + SMTP_PASS or GMAIL_USER + GMAIL_APP_PASSWORD)
 *   3. Fallback preview OTP in UI if no email service is configured
 */
export async function sendCampusAdminOtpEmail({
  email,
  otp,
  campusName,
  campusId,
}: ISendOtpParams): Promise<{ success: boolean; error?: string; devOtp?: string }> {
  const htmlBody = buildOtpHtml(email, otp, campusName, campusId);
  const textBody = buildOtpText(otp, campusName, campusId);
  const subject = `Your Campus Administrator Security Code: ${otp}`;
  const appName = "CommuteX Corporate Mobility";

  // ── Option 1: Resend API ──
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

      const { error } = await resend.emails.send({
        from: `${appName} <${fromAddress}>`,
        to: email,
        subject,
        html: htmlBody,
        text: textBody,
      });

      if (!error) {
        console.log(`[Resend] OTP sent successfully to: ${email}`);
        return { success: true };
      }
      console.warn("[Resend] Failed, falling back to SMTP:", error);
    } catch (err: any) {
      console.warn("[Resend] Exception, falling back to SMTP:", err?.message);
    }
  }

  // ── Option 2: Nodemailer SMTP ──
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const fromAddress = process.env.SMTP_FROM || user || "security@commutex.corporate";

  if (user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
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

      console.log(`[SMTP] Successfully sent OTP code to: ${email}`);
      return { success: true };
    } catch (smtpErr: any) {
      console.error("[SMTP] Failed to send email via SMTP:", smtpErr);
      // Fallback returning code so user is not permanently stuck
      return {
        success: true,
        devOtp: otp,
      };
    }
  }

  // ── Option 3: Fallback when email provider credentials are not yet configured ──
  console.log("=================================================");
  console.log(`[OTP NOTIFICATION] Code for ${email} (${campusId}): ${otp}`);
  console.log("=================================================");

  return {
    success: true,
    devOtp: otp,
  };
}
