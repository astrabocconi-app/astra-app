// Branded HTML for the OTP email. Table-based layout with fully inlined styles
// for broad mail-client compatibility (Gmail, Outlook, Apple Mail, studbocconi).
// The logo is referenced via CID (see auth.ts, which attaches it inline).

export const OTP_LOGO_CID = "astra-logo";
export const OTP_SUBJECT = "Your ASTRA sign-in code";

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function otpEmailText(otp: string): string {
  return (
    `Your ASTRA sign-in code is ${otp}.\n` +
    `It expires in 10 minutes.\n\n` +
    `If you didn't request this code, you can safely ignore this email.`
  );
}

export function otpEmailHtml(otp: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f3f4f6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;font-family:${FONT};">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:16px;border:1px solid #eceef3;">
            <tr>
              <td style="padding:36px 40px 4px 40px;text-align:center;">
                <img src="cid:${OTP_LOGO_CID}" alt="ASTRA" width="168" style="display:block;margin:0 auto;width:168px;max-width:60%;height:auto;" />
              </td>
            </tr>
            <tr>
              <td style="padding:22px 40px 0 40px;text-align:center;">
                <h1 style="margin:0;font-family:${FONT};font-size:20px;font-weight:700;color:#111827;">Your sign-in code</h1>
                <p style="margin:8px 0 0 0;font-family:${FONT};font-size:14px;line-height:20px;color:#6b7280;">Enter this code in the ASTRA app to sign in.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 4px 40px;">
                <div style="background:#f3f5ff;border:1px solid #e0e4ff;border-radius:12px;padding:20px 0;text-align:center;">
                  <span style="font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:38px;font-weight:700;color:#04107e;letter-spacing:14px;padding-left:14px;">${otp}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 40px 0 40px;text-align:center;">
                <p style="margin:0;font-family:${FONT};font-size:13px;color:#9ca3af;">This code expires in <strong style="color:#6b7280;">10 minutes</strong>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 40px 34px 40px;text-align:center;">
                <div style="border-top:1px solid #f0f1f5;padding-top:18px;">
                  <p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:#9ca3af;">If you didn't request this code, you can safely ignore this email.<br />© ASTRA · Bocconi</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
