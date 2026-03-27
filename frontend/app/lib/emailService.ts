import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM_EMAIL = 'Printsi <noreply@printis.store>';
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('❌ Resend Error:', error);
      throw new Error(`Email failed: ${error.message}`);
    }

    console.log(`✅ Email sent to ${to}: ${subject}`);
    return data;
  } catch (err: any) {
    console.error('❌ Email Service Error:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Shared layout helpers
// ─────────────────────────────────────────────────────────────

function emailWrapper(headerBg: string, headerTitle: string, headerSubtitle: string, bodyHtml: string, footerExtra?: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerSubtitle} - Printsi</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.05);border:1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background:${headerBg};padding:48px 40px;text-align:center;">
              <div style="font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-1.5px;margin-bottom:8px;">🖨️ Printsi</div>
              <div style="color:rgba(255,255,255,0.8);font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">${headerSubtitle}</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:32px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              ${footerExtra || ''}
              <p style="margin:0;color:#94a3b8;font-size:12px;">© 2025 Printsi. The 3D Printing Marketplace.</p>
              <p style="margin:8px 0 0;color:#cbd5e1;font-size:11px;">
                <a href="${SITE_URL}" style="color:#94a3b8;text-decoration:none;">printis.store</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, href: string, color: string = '#4f46e5') {
  return `
    <div style="text-align:center;margin:28px 0;">
      <a href="${href}" style="display:inline-block;background-color:${color};color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 32px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.15);">
        ${text}
      </a>
    </div>`;
}

function infoBox(title: string, value: string, color: string = '#4f46e5') {
  return `
    <div style="background-color:#f8fafc;border-radius:16px;padding:24px;margin:24px 0;border:1px solid #e2e8f0;text-align:center;">
      <div style="color:#64748b;font-size:14px;font-weight:600;margin-bottom:8px;">${title}</div>
      <div style="color:${color};font-size:36px;font-weight:900;">${value}</div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Email Templates
// ─────────────────────────────────────────────────────────────

export const EmailTemplates = {

  // ────────────────────────────────────────
  // 1. ORDER CONFIRMATION (buyer)
  // ────────────────────────────────────────
  orderConfirmation: (buyerName: string, orderId: string, items: any[], totalPrice: string) => {
    const itemsRows = items.map(item => `
      <tr>
        <td style="padding-bottom:12px;color:#334155;font-size:15px;font-weight:500;">
          ${item.quantity}x ${item.title}
        </td>
      </tr>
    `).join('');

    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Hi ${buyerName},</p>
      <p style="margin:0 0 32px;color:#64748b;font-size:16px;line-height:1.6;">
        Thank you for your order! We've received your payment and the sellers have been notified. Your order ID is <span style="color:#4f46e5;font-weight:700;font-family:monospace;">#${orderId.slice(0, 8)}</span>.
      </p>
      
      <div style="background-color:#f1f5f9;border-radius:16px;padding:24px;margin-bottom:32px;">
        <h3 style="margin:0 0 16px;color:#0f172a;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Order Details</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${itemsRows}
          <tr>
            <td style="padding-top:16px;border-top:1px solid #e2e8f0;color:#0f172a;font-size:18px;font-weight:800;">
              Total: <span style="color:#4f46e5;">${totalPrice}</span>
            </td>
          </tr>
        </table>
      </div>

      ${ctaButton('View Order Status', `${SITE_URL}/profile/messages`)}

      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.5;">
        Need help? Reply to this email or contact support. Sellers of physical items have 4 days to ship your order.
      </p>
    `;

    return emailWrapper(
      'linear-gradient(135deg,#1e1b4b 0%,#312e81 100%)',
      'Order Confirmation',
      'Order Confirmation',
      body
    );
  },

  // ────────────────────────────────────────
  // 2. SALE NOTIFICATION (seller)
  // ────────────────────────────────────────
  saleNotification: (sellerName: string, buyerName: string, productTitle: string, amount: string) => {
    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Congratulations ${sellerName}!</p>
      <p style="margin:0 0 32px;color:#64748b;font-size:16px;line-height:1.6;">
        <strong>${buyerName}</strong> just purchased your item: <strong>${productTitle}</strong>. 
      </p>
      
      ${infoBox('You earned', amount, '#166534')}

      <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
        Please check the chat threads in your profile to provide any necessary updates or track shipping.
      </p>

      ${ctaButton('View in My Store', `${SITE_URL}/profile`, '#166534')}
    `;

    return emailWrapper(
      'linear-gradient(135deg,#14532d 0%,#166534 100%)',
      '🎉 New Sale!',
      'New Sale',
      body
    );
  },

  // ────────────────────────────────────────
  // 3. ITEM LIKED (seller)
  // ────────────────────────────────────────
  itemLiked: (sellerName: string, productTitle: string) => {
    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Hey ${sellerName}! ❤️</p>
      <p style="margin:0 0 8px;color:#64748b;font-size:16px;line-height:1.6;">
        Someone just liked your listing:
      </p>

      <div style="background:linear-gradient(135deg,#fef2f2,#fff1f2);border-radius:16px;padding:24px;margin:24px 0;border:1px solid #fecdd3;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">❤️</div>
        <div style="color:#e11d48;font-size:20px;font-weight:900;">${productTitle}</div>
        <div style="color:#fb7185;font-size:13px;font-weight:600;margin-top:8px;">is gaining attention!</div>
      </div>

      <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
        Likes mean potential buyers are interested. Keep your listing updated and stock ready!
      </p>

      ${ctaButton('View My Listings', `${SITE_URL}/profile`, '#e11d48')}
    `;

    return emailWrapper(
      'linear-gradient(135deg,#881337 0%,#be123c 100%)',
      '❤️ New Like!',
      'Someone Liked Your Item',
      body
    );
  },

  // ────────────────────────────────────────
  // 4. PRODUCT OUT OF STOCK (seller)
  // ────────────────────────────────────────
  productOutOfStock: (sellerName: string, productTitle: string) => {
    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Heads up, ${sellerName}!</p>
      <p style="margin:0 0 8px;color:#64748b;font-size:16px;line-height:1.6;">
        Your product has just sold out:
      </p>

      <div style="background:linear-gradient(135deg,#fefce8,#fef9c3);border-radius:16px;padding:24px;margin:24px 0;border:1px solid #fde68a;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">📦</div>
        <div style="color:#a16207;font-size:20px;font-weight:900;">${productTitle}</div>
        <div style="color:#ca8a04;font-size:14px;font-weight:700;margin-top:8px;background:#fefce8;display:inline-block;padding:6px 16px;border-radius:100px;border:1px solid #fde68a;">STOCK: 0</div>
      </div>

      <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
        Customers won't be able to purchase this item anymore. Restock it as soon as possible to keep the sales flowing!
      </p>

      ${ctaButton('Manage My Products', `${SITE_URL}/profile`, '#a16207')}
    `;

    return emailWrapper(
      'linear-gradient(135deg,#78350f 0%,#a16207 100%)',
      '⚠️ Sold Out!',
      'Product Out of Stock',
      body
    );
  },

  // ────────────────────────────────────────
  // 5. ORDER SHIPPED (buyer) — Premium template
  // ────────────────────────────────────────
  orderShipped: (buyerName: string, productTitle: string, sellerName: string) => {
    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Good news, ${buyerName}! 🚚</p>
      <p style="margin:0 0 8px;color:#64748b;font-size:16px;line-height:1.6;">
        Your order is on its way!
      </p>

      <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:16px;padding:24px;margin:24px 0;border:1px solid #93c5fd;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom:12px;">
              <span style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Item</span><br>
              <span style="color:#1e293b;font-size:16px;font-weight:800;">${productTitle}</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:12px;">
              <span style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Seller</span><br>
              <span style="color:#1e293b;font-size:16px;font-weight:800;">${sellerName}</span>
            </td>
          </tr>
          <tr>
            <td>
              <span style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Status</span><br>
              <span style="display:inline-block;background:#2563eb;color:white;font-size:12px;font-weight:900;padding:6px 14px;border-radius:100px;margin-top:4px;">📦 SHIPPED</span>
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
        You'll be able to confirm delivery once the package arrives. Check your chat for updates from the seller.
      </p>

      ${ctaButton('Track in Chat', `${SITE_URL}/profile/messages`, '#2563eb')}
    `;

    return emailWrapper(
      'linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)',
      '🚚 Shipped!',
      'Your Order Has Been Shipped',
      body
    );
  },

  // ────────────────────────────────────────
  // 6. ORDER DELIVERED (seller)
  // ────────────────────────────────────────
  orderDelivered: (sellerName: string, buyerName: string, productTitle: string) => {
    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Great news, ${sellerName}! 📬</p>
      <p style="margin:0 0 24px;color:#64748b;font-size:16px;line-height:1.6;">
        <strong>${buyerName}</strong> has confirmed receiving your item: <strong>${productTitle}</strong>.
      </p>

      <div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:16px;padding:24px;margin:24px 0;border:1px solid #6ee7b7;text-align:center;">
        <div style="font-size:40px;margin-bottom:8px;">📬</div>
        <div style="color:#065f46;font-size:16px;font-weight:800;">Package Delivered Successfully</div>
        <div style="color:#059669;font-size:13px;margin-top:4px;">Waiting for buyer's final confirmation</div>
      </div>

      <p style="margin:0;color:#475569;font-size:15px;line-height:1.6;">
        Once the buyer confirms everything is OK, the funds will be released to your available balance.
      </p>

      ${ctaButton('View Chat', `${SITE_URL}/profile/messages`, '#059669')}
    `;

    return emailWrapper(
      'linear-gradient(135deg,#064e3b 0%,#059669 100%)',
      '📬 Delivered!',
      'Package Has Been Delivered',
      body
    );
  },

  // ────────────────────────────────────────
  // 7. TRANSACTION COMPLETED (both buyer & seller)
  // ────────────────────────────────────────
  transactionCompleted: (userName: string, productTitle: string, role: 'buyer' | 'seller', amount?: string) => {
    const roleMessage = role === 'seller'
      ? `The buyer confirmed everything is perfect. <strong>${amount || ''}</strong> has been released to your available balance!`
      : `Your transaction for <strong>${productTitle}</strong> has been finalized. We hope you enjoy your purchase!`;

    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Awesome, ${userName}! 🎉</p>
      <p style="margin:0 0 24px;color:#64748b;font-size:16px;line-height:1.6;">
        ${roleMessage}
      </p>

      <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:16px;padding:28px;margin:24px 0;border:1px solid #86efac;text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">✅</div>
        <div style="color:#166534;font-size:18px;font-weight:900;">Transaction Complete</div>
        <div style="color:#15803d;font-size:14px;font-weight:600;margin-top:4px;">${productTitle}</div>
      </div>

      ${role === 'seller'
        ? ctaButton('View My Balance', `${SITE_URL}/profile/billing`, '#166534')
        : ctaButton('Browse More Items', `${SITE_URL}/gallery`, '#166534')
      }
    `;

    return emailWrapper(
      'linear-gradient(135deg,#14532d 0%,#15803d 100%)',
      '✅ Complete!',
      'Transaction Completed',
      body
    );
  },

  // ────────────────────────────────────────
  // 8. DISPUTE OPENED (both buyer & seller)
  // ────────────────────────────────────────
  disputeOpened: (userName: string, productTitle: string, problemType: string, description: string, role: 'buyer' | 'seller') => {
    const intro = role === 'buyer'
      ? `Your dispute for <strong>${productTitle}</strong> has been submitted. Our team will review it shortly.`
      : `A buyer has opened a dispute regarding your product: <strong>${productTitle}</strong>.`;

    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Dispute Notice, ${userName}</p>
      <p style="margin:0 0 24px;color:#64748b;font-size:16px;line-height:1.6;">
        ${intro}
      </p>

      <div style="background:linear-gradient(135deg,#fef2f2,#fee2e2);border-radius:16px;padding:24px;margin:24px 0;border:1px solid #fca5a5;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom:12px;">
              <span style="color:#991b1b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Problem Type</span><br>
              <span style="color:#dc2626;font-size:16px;font-weight:800;">${problemType}</span>
            </td>
          </tr>
          <tr>
            <td>
              <span style="color:#991b1b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Description</span><br>
              <span style="color:#374151;font-size:14px;font-weight:500;line-height:1.6;">${description}</span>
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 8px;color:#dc2626;font-size:14px;font-weight:700;">⚠️ Funds are on hold until the dispute is resolved.</p>
      <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
        Use the chat to communicate about the issue. Our support team will mediate if needed.
      </p>

      ${ctaButton('View Dispute Chat', `${SITE_URL}/profile/messages`, '#dc2626')}
    `;

    return emailWrapper(
      'linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%)',
      '⚠️ Dispute',
      'Dispute Opened',
      body
    );
  },

  // ────────────────────────────────────────
  // 9. PAYOUT REQUESTED (seller)
  // ────────────────────────────────────────
  payoutRequested: (sellerName: string, amount: string) => {
    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Payout Initiated, ${sellerName}!</p>
      <p style="margin:0 0 24px;color:#64748b;font-size:16px;line-height:1.6;">
        Your payout request has been received and is being processed.
      </p>

      ${infoBox('Payout Amount', amount, '#7c3aed')}

      <div style="background:#f5f3ff;border-radius:12px;padding:16px;margin:24px 0;border:1px solid #ddd6fe;">
        <p style="margin:0;color:#6d28d9;font-size:13px;font-weight:700;">📋 Processing Timeline</p>
        <ul style="margin:8px 0 0;padding-left:20px;color:#7c3aed;font-size:13px;line-height:1.8;">
          <li>Payouts are processed within <strong>3 business days</strong></li>
          <li>You'll receive funds via your connected Stripe account</li>
          <li>Status updates are visible on your Billing page</li>
        </ul>
      </div>

      ${ctaButton('View Billing', `${SITE_URL}/profile/billing`, '#7c3aed')}
    `;

    return emailWrapper(
      'linear-gradient(135deg,#4c1d95 0%,#7c3aed 100%)',
      '💳 Payout',
      'Payout Requested',
      body
    );
  },

  // ────────────────────────────────────────
  // 10. NEW CHAT MESSAGE (recipient)
  // ────────────────────────────────────────
  newMessage: (recipientName: string, senderName: string, productTitle: string, messagePreview: string) => {
    const preview = messagePreview.length > 120 ? messagePreview.slice(0, 120) + '…' : messagePreview;

    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Hey ${recipientName}! 💬</p>
      <p style="margin:0 0 24px;color:#64748b;font-size:16px;line-height:1.6;">
        You have a new message from <strong>${senderName}</strong> about <strong>${productTitle}</strong>.
      </p>

      <div style="background:#f8fafc;border-radius:16px;padding:20px;margin:24px 0;border-left:4px solid #3b82f6;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;">
        <div style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${senderName} wrote:</div>
        <div style="color:#1e293b;font-size:15px;font-weight:500;line-height:1.6;font-style:italic;">"${preview}"</div>
      </div>

      ${ctaButton('Reply Now', `${SITE_URL}/profile/messages`, '#3b82f6')}

      <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
        Don't miss messages — check your Printsi account regularly!
      </p>
    `;

    return emailWrapper(
      'linear-gradient(135deg,#1e3a5f 0%,#3b82f6 100%)',
      '💬 New Message',
      'New Message',
      body
    );
  },

  // ────────────────────────────────────────
  // 11. WELCOME EMAIL (new user)
  // ────────────────────────────────────────
  welcome: (userName: string) => {
    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:22px;font-weight:900;">Welcome to Printsi, ${userName}! 🎊</p>
      <p style="margin:0 0 32px;color:#64748b;font-size:16px;line-height:1.7;">
        You've just joined the marketplace for 3D printing enthusiasts. Here's what you can do:
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr>
          <td style="padding:16px;background:#f0f9ff;border-radius:12px;margin-bottom:12px;border:1px solid #bae6fd;">
            <div style="font-size:20px;margin-bottom:4px;">🛒</div>
            <div style="color:#0369a1;font-size:14px;font-weight:800;">Buy 3D Prints & Files</div>
            <div style="color:#0284c7;font-size:12px;margin-top:4px;">Browse physical items and digital 3D files from sellers worldwide.</div>
          </td>
        </tr>
        <tr><td style="height:12px;"></td></tr>
        <tr>
          <td style="padding:16px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;">
            <div style="font-size:20px;margin-bottom:4px;">💰</div>
            <div style="color:#166534;font-size:14px;font-weight:800;">Sell Your Creations</div>
            <div style="color:#15803d;font-size:12px;margin-top:4px;">List your 3D printed items or digital files and start earning.</div>
          </td>
        </tr>
        <tr><td style="height:12px;"></td></tr>
        <tr>
          <td style="padding:16px;background:#fefce8;border-radius:12px;border:1px solid #fde68a;">
            <div style="font-size:20px;margin-bottom:4px;">🖨️</div>
            <div style="color:#a16207;font-size:14px;font-weight:800;">Print on Demand</div>
            <div style="color:#ca8a04;font-size:12px;margin-top:4px;">Offer your 3D printing services and fulfill orders from others.</div>
          </td>
        </tr>
      </table>

      ${ctaButton('Start Exploring', `${SITE_URL}/gallery`, '#4f46e5')}

      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;text-align:center;">
        Complete your profile to unlock all features and start selling.
      </p>
    `;

    return emailWrapper(
      'linear-gradient(135deg,#312e81 0%,#4f46e5 50%,#6366f1 100%)',
      '🎉 Welcome!',
      'Welcome to Printsi',
      body
    );
  },
  // ────────────────────────────────────────
  // 12. TRACKING NUMBER ADDED (buyer)
  // ────────────────────────────────────────
  trackingAddedBuyer: (buyerName: string, productTitle: string, trackingCode: string) => {
    const dhlUrl = `https://www.dhl.com/pl-pl/home/tracking/tracking-parcel.html?submit=1&tracking-id=${trackingCode}`;
    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Your package has a tracking number! 📦</p>
      <p style="margin:0 0 24px;color:#64748b;font-size:16px;line-height:1.6;">
        We've assigned a DHL tracking number to your order: <strong>${productTitle}</strong>.
      </p>

      <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border-radius:16px;padding:28px;margin:24px 0;border:1px solid #fcd34d;text-align:center;">
        <div style="font-size:40px;margin-bottom:8px;">🚚</div>
        <div style="color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">DHL Tracking Number</div>
        <div style="color:#d97706;font-size:28px;font-weight:900;font-family:monospace;letter-spacing:2px;">${trackingCode}</div>
      </div>

      <div style="text-align:center;margin:28px 0;">
        <a href="${dhlUrl}" style="display:inline-block;background-color:#ffcc00;color:#1a1a1a;text-decoration:none;font-size:16px;font-weight:900;padding:16px 32px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.15);">
          🔍 Track on DHL
        </a>
      </div>

      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.5;text-align:center;">
        Tracking may take a few hours to become active on the DHL website after the package is handed to the courier.
      </p>
    `;
    return emailWrapper(
      'linear-gradient(135deg,#78350f 0%,#d97706 100%)',
      '📦 Tracking Added!',
      'Your Tracking Number is Ready',
      body
    );
  },

  // ────────────────────────────────────────
  // 13. TRACKING NUMBER ADDED (seller)
  // ────────────────────────────────────────
  trackingAddedSeller: (sellerName: string, productTitle: string, trackingCode: string) => {
    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Tracking number assigned, ${sellerName}!</p>
      <p style="margin:0 0 24px;color:#64748b;font-size:16px;line-height:1.6;">
        A DHL tracking number has been added to the order: <strong>${productTitle}</strong>. The buyer has been notified.
      </p>

      <div style="background:#f8fafc;border-radius:16px;padding:24px;margin:24px 0;border:1px solid #e2e8f0;text-align:center;">
        <div style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Tracking Code</div>
        <div style="color:#0f172a;font-size:24px;font-weight:900;font-family:monospace;letter-spacing:2px;">${trackingCode}</div>
      </div>

      <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
        The buyer can now track the package through DHL directly from their chat. Once they confirm delivery, funds will be released to your balance.
      </p>

      ${ctaButton('View Chat', `${SITE_URL}/profile/messages`, '#2563eb')}
    `;
    return emailWrapper(
      'linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)',
      '📦 Tracking Assigned',
      'Tracking Number Added to Order',
      body
    );
  },

  // ────────────────────────────────────────
  // 14. LOW FILAMENT WARNING (seller)
  // ────────────────────────────────────────
  lowFilamentWarning: (sellerName: string, filamentName: string, remainingGrams: number) => {
    const urgency = remainingGrams <= 20 ? '🚨 CRITICAL' : remainingGrams <= 50 ? '⚠️ LOW' : '⚡ WARNING';
    const urgencyColor = remainingGrams <= 20 ? '#dc2626' : remainingGrams <= 50 ? '#d97706' : '#f59e0b';
    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:700;">Filament Running Low, ${sellerName}!</p>
      <p style="margin:0 0 24px;color:#64748b;font-size:16px;line-height:1.6;">
        One of your filaments is running low. Restock soon to avoid orders failing!
      </p>

      <div style="background:linear-gradient(135deg,#fef2f2,#fee2e2);border-radius:16px;padding:28px;margin:24px 0;border:1px solid #fca5a5;text-align:center;">
        <div style="font-size:40px;margin-bottom:8px;">🧵</div>
        <div style="color:#991b1b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${urgency}</div>
        <div style="color:#1e293b;font-size:20px;font-weight:900;margin-bottom:8px;">${filamentName}</div>
        <div style="display:inline-block;background:${urgencyColor};color:white;font-size:18px;font-weight:900;padding:8px 24px;border-radius:100px;">
          ${remainingGrams}g remaining
        </div>
      </div>

      <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
        Products that depend on this filament may go out of stock automatically. Please restock your filament supply.
      </p>

      ${ctaButton('Manage Filaments', `${SITE_URL}/profile/filaments`, '#dc2626')}
    `;
    return emailWrapper(
      'linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%)',
      '🧵 Low Filament!',
      'Filament Running Low',
      body
    );
  },
  // ────────────────────────────────────────
  // 15. VERIFICATION LINK (new user)
  // ────────────────────────────────────────
  verification: (userName: string, link: string) => {
    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:22px;font-weight:900;">Account Verification, ${userName}! 🛡️</p>
      <p style="margin:0 0 32px;color:#64748b;font-size:16px;line-height:1.7;">
        Thank you for joining Printsi. This is your official verification link. Click the button below to activate your account.
      </p>

      ${ctaButton('VERIFY ACCOUNT', link, '#000000')}

      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;text-align:center;">
        If the button doesn't work, copy and paste the following link into your browser:<br>
        <span style="color:#6366f1;font-size:11px;">${link}</span>
      </p>
    `;

    return emailWrapper(
      'linear-gradient(135deg,#000000 0%,#1e293b 100%)',
      'Verification',
      'Verification Link',
      body
    );
  },

  // ────────────────────────────────────────
  // 16. RESET PASSWORD
  // ────────────────────────────────────────
  resetPassword: (userName: string, link: string) => {
    const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:22px;font-weight:900;">Reset Your Password, ${userName}! 🔒</p>
      <p style="margin:0 0 32px;color:#64748b;font-size:16px;line-height:1.7;">
        We received a request to reset your Printsi account password. Click the button below to set a new password. 
        If you didn't request this, you can safely ignore this email.
      </p>

      ${ctaButton('RESET PASSWORD', link, '#4f46e5')}

      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;text-align:center;">
        For security, this link will expire in 24 hours.
      </p>
    `;

    return emailWrapper(
      'linear-gradient(135deg,#312e81 0%,#4f46e5 100%)',
      'Password Reset',
      'Reset Your Password',
      body
    );
  },
};

