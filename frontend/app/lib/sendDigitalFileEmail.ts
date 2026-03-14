import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

export interface DigitalFileEmailOptions {
  buyerEmail: string;
  buyerName: string;
  productTitle: string;
  fileUrl: string;
  orderId: string;
}

export async function sendDigitalFileEmail(opts: DigitalFileEmailOptions): Promise<void> {
  const { buyerEmail, buyerName, productTitle, fileUrl, orderId } = opts;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your 3D File is Ready – Printsi</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:40px 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-1px;">🖨️ Printsi</span>
                    <p style="margin:8px 0 0;color:#94a3b8;font-size:13px;font-weight:500;letter-spacing:0.5px;">3D File Marketplace</p>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:100px;padding:6px 14px;color:#e2e8f0;font-size:12px;font-weight:700;">ORDER CONFIRMED</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Celebration Banner -->
          <tr>
            <td style="background:linear-gradient(90deg,#6366f1,#8b5cf6);padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:22px;font-weight:900;">🎉 Your file is ready to download!</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;color:#374151;font-size:16px;">Hi <strong>${buyerName}</strong>,</p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
                Thank you for your purchase on <strong>Printsi</strong>! 🎊<br/>
                Your 3D file is now ready. Click the button below to download it.
              </p>

              <!-- Product Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;color:#9ca3af;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Product</p>
                    <p style="margin:0 0 12px;color:#111827;font-size:18px;font-weight:800;">📦 ${productTitle}</p>
                    <p style="margin:0;color:#9ca3af;font-size:11px;font-weight:600;">Order ID: <span style="color:#6366f1;font-family:monospace;">${orderId}</span></p>
                  </td>
                </tr>
              </table>

              <!-- Download Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <a href="${fileUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;font-size:16px;font-weight:900;padding:16px 48px;border-radius:100px;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(99,102,241,0.4);">
                      ⬇️ Download Your 3D File
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;color:#1e40af;font-size:13px;font-weight:800;">💡 Tips for your 3D file:</p>
                    <ul style="margin:0;padding-left:20px;color:#3b82f6;font-size:13px;line-height:1.8;">
                      <li>The link is a direct download from secure storage</li>
                      <li>Compatible with slicers: Cura, PrusaSlicer, Bambu Studio</li>
                      <li>Save the file to a safe location before printing</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px;color:#6b7280;font-size:14px;line-height:1.6;">
                Having trouble with the button? Copy and paste this link into your browser:
              </p>
              <p style="margin:0;background:#f1f5f9;border-radius:8px;padding:10px 14px;word-break:break-all;">
                <a href="${fileUrl}" style="color:#6366f1;font-size:12px;text-decoration:none;font-family:monospace;">${fileUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;color:#111827;font-size:13px;font-weight:800;">🖨️ Printsi</p>
                    <p style="margin:0;color:#9ca3af;font-size:12px;">The marketplace for 3D printing enthusiasts</p>
                  </td>
                  <td align="right">
                    <p style="margin:0;color:#d1d5db;font-size:11px;">
                      Questions? Visit <a href="https://printsi.com" style="color:#6366f1;text-decoration:none;">printsi.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const { error } = await resend.emails.send({
    from: 'Printsi <noreply@printis.store>',
    to: buyerEmail,
    subject: `⬇️ Your 3D File is Ready – ${productTitle}`,
    html,
  });

  if (error) {
    console.error(`❌ Failed to send digital file email to ${buyerEmail}:`, error);
    throw new Error(`Email send failed: ${JSON.stringify(error)}`);
  }

  console.log(`✅ Digital file email sent to ${buyerEmail} for product: ${productTitle}`);
}
