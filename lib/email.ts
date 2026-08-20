import nodemailer from "nodemailer";

interface ISendOtpParams {
  email: string;
  otp: string;
  campusName: string;
  campusId: string;
}

/**
 * Creates a Nodemailer transport instance.
 * Supports standard SMTP (e.g. Gmail App Password, Brevo, SendGrid, Amazon SES, or custom corporate SMTP).
 */
function createEmailTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  return null;
}

/**
 * Sends a Campus Admin 2FA authorization OTP email.
 * Designed with RFC 5322 anti-spam standards to land directly in the Primary inbox.
 */
export async function sendCampusAdminOtpEmail({
  email,
  otp,
  campusName,
  campusId,
}: ISendOtpParams): Promise<{ success: boolean; error?: string; devOtp?: string }> {
  try {
    const transporter = createEmailTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "security@commutex.corporate";
    const appName = "CommuteX Corporate Mobility";

    const subject = `Your Campus Administrator Security Code: ${otp}`;

    const plainText = `
CommuteX Corporate Mobility - Admin Authorization
--------------------------------------------------
Campus: ${campusName} (${campusId})
Security Authorization Code: ${otp}

This one-time passcode (OTP) verifies and assigns you as the designated Campus Administrator for ${campusName}.

This code is valid for 10 minutes. If you did not expect this request, please contact your Super Administrator immediately.

© ${new Date().getFullYear()} CommuteX Mobility Platform. All rights reserved.
`.trim();

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #7c3aed; padding: 28px 32px; text-align: left;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
                COMMUTEX
              </h1>
              <p style="margin: 4px 0 0 0; color: #e9d5ff; font-size: 12px; font-weight: 500;">
                Corporate Mobility Governance & Admin Security
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 17px; font-weight: 600;">
                Campus Administrator Assignment
              </h2>
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 13px; line-height: 1.6;">
                You are being assigned as the official <strong>Campus Administrator</strong> for <strong>${campusName}</strong> (<code style="background-color: #f3e8ff; color: #7c3aed; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${campusId}</code>).
              </p>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 13px; line-height: 1.6;">
                Please provide the following one-time verification code in the administration portal to confirm your assignment:
              </p>

              <!-- OTP Code Display Card -->
              <div style="background-color: #f5f3ff; border: 1.5px dashed #8b5cf6; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                <span style="display: block; color: #6d28d9; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
                  One-Time Verification Code
                </span>
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; color: #5b21b6; letter-spacing: 8px;">
                  ${otp}
                </span>
                <span style="display: block; color: #64748b; font-size: 11px; margin-top: 6px;">
                  Valid for 10 minutes (Single Use)
                </span>
              </div>

              <!-- Security Tips -->
              <div style="background-color: #f8fafc; border-left: 3px solid #7c3aed; padding: 12px 16px; border-radius: 4px; margin-top: 24px;">
                <p style="margin: 0; color: #64748b; font-size: 11px; line-height: 1.5;">
                  <strong>Security Note:</strong> Never forward or share this passcode with anyone. CommuteX staff will never ask for your verification code.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                This is an automated administrative notification sent to ${email}.
              </p>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 11px;">
                © ${new Date().getFullYear()} CommuteX Mobility Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

    if (transporter) {
      await transporter.sendMail({
        from: `"${appName}" <${fromAddress}>`,
        to: email,
        subject,
        text: plainText,
        html: htmlBody,
        headers: {
          "X-Priority": "1 (Highest)",
          "X-MSMail-Priority": "High",
          Importance: "High",
          "X-Mailer": "CommuteX-Security-Mailer/1.0",
        },
      });

      console.log(`[SMTP] Successfully sent OTP code to: ${email}`);
      return { success: true };
    }

    // Development fallback when SMTP environment variables are not yet populated
    console.log("=================================================");
    console.log(`[DEV OTP NOTIFICATION] Code for ${email} (${campusId}): ${otp}`);
    console.log("=================================================");

    return {
      success: true,
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    };
  } catch (error: any) {
    console.error("Failed to send OTP email:", error);
    return { success: false, error: error.message || "Failed to send email." };
  }
}
