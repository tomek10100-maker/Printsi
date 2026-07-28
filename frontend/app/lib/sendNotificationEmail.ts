import { createClient } from '@supabase/supabase-js';
import { sendEmail, EmailTemplates } from './emailService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get user email and name from profile + auth.
 * Returns { email, name } or null if not found.
 */
export async function getUserEmailInfo(userId: string): Promise<{ email: string; name: string } | null> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    const { data: authData } = await supabase.auth.admin.getUserById(userId);
    const email = authData?.user?.email;

    if (!email) return null;

    return {
      email,
      name: profile?.full_name || 'User',
    };
  } catch (err) {
    console.error(`⚠️ Could not get email info for user ${userId}:`, err);
    return null;
  }
}

/**
 * Send "item liked" email to seller.
 */
export async function sendLikeEmail(sellerId: string, productTitle: string, isSelfLike?: boolean) {
  try {
    const seller = await getUserEmailInfo(sellerId);
    if (!seller?.email) return;

    await sendEmail({
      to: seller.email,
      subject: isSelfLike ? `💖 You liked your own item: ${productTitle}` : `❤️ Someone liked your item: ${productTitle}`,
      html: EmailTemplates.itemLiked(seller.name, productTitle, isSelfLike),
    });
  } catch (err) {
    console.error('❌ Failed to send like email:', err);
  }
}

/**
 * Send "product out of stock" email to seller.
 */
export async function sendOutOfStockEmail(sellerId: string, productTitle: string) {
  try {
    const seller = await getUserEmailInfo(sellerId);
    if (!seller?.email) return;

    await sendEmail({
      to: seller.email,
      subject: `⚠️ Sold Out: ${productTitle}`,
      html: EmailTemplates.productOutOfStock(seller.name, productTitle),
    });
  } catch (err) {
    console.error('❌ Failed to send out-of-stock email:', err);
  }
}

/**
 * Send "order shipped" email to buyer.
 */
export async function sendShippedEmail(buyerEmail: string, buyerName: string, productTitle: string, sellerName: string) {
  try {
    await sendEmail({
      to: buyerEmail,
      subject: `🚚 Your order has been shipped! - ${productTitle}`,
      html: EmailTemplates.orderShipped(buyerName, productTitle, sellerName),
    });
  } catch (err) {
    console.error('❌ Failed to send shipped email:', err);
  }
}

/**
 * Send "order delivered" email to seller.
 */
export async function sendDeliveredEmail(sellerId: string, buyerName: string, productTitle: string) {
  try {
    const seller = await getUserEmailInfo(sellerId);
    if (!seller?.email) return;

    await sendEmail({
      to: seller.email,
      subject: `📬 Package Delivered: ${productTitle}`,
      html: EmailTemplates.orderDelivered(seller.name, buyerName, productTitle),
    });
  } catch (err) {
    console.error('❌ Failed to send delivered email:', err);
  }
}

/**
 * Send "transaction completed" email to both parties.
 */
export async function sendCompletedEmail(
  sellerId: string,
  buyerId: string,
  productTitle: string,
  amount?: string
) {
  try {
    // Send to seller
    const seller = await getUserEmailInfo(sellerId);
    if (seller?.email) {
      await sendEmail({
        to: seller.email,
        subject: `✅ Transaction Complete: ${productTitle}`,
        html: EmailTemplates.transactionCompleted(seller.name, productTitle, 'seller', amount),
      });
    }

    // Send to buyer
    const buyer = await getUserEmailInfo(buyerId);
    if (buyer?.email) {
      await sendEmail({
        to: buyer.email,
        subject: `✅ Transaction Complete: ${productTitle}`,
        html: EmailTemplates.transactionCompleted(buyer.name, productTitle, 'buyer'),
      });
    }
  } catch (err) {
    console.error('❌ Failed to send completed email:', err);
  }
}

/**
 * Send "dispute opened" email to both parties.
 */
export async function sendDisputeEmail(
  sellerId: string,
  buyerId: string,
  productTitle: string,
  problemType: string,
  description: string
) {
  try {
    // Send to buyer
    const buyer = await getUserEmailInfo(buyerId);
    if (buyer?.email) {
      await sendEmail({
        to: buyer.email,
        subject: `⚠️ Dispute Submitted: ${productTitle}`,
        html: EmailTemplates.disputeOpened(buyer.name, productTitle, problemType, description, 'buyer'),
      });
    }

    // Send to seller
    const seller = await getUserEmailInfo(sellerId);
    if (seller?.email) {
      await sendEmail({
        to: seller.email,
        subject: `⚠️ Dispute Received: ${productTitle}`,
        html: EmailTemplates.disputeOpened(seller.name, productTitle, problemType, description, 'seller'),
      });
    }

    // Send to support
    try {
      await sendEmail({
        to: 'support@printis.store',
        subject: `⚠️ [Dispute/Problem] ${problemType} - ${productTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 12px; background-color: #ffffff; color: #333333;">
            <h2 style="color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 10px; margin-top: 0; text-transform: uppercase; font-size: 18px;">
              New Dispute / Shipping Problem Opened
            </h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 120px; color: #666;">Product:</td>
                <td style="padding: 8px 0; font-weight: bold;">${productTitle}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #666;">Problem Type:</td>
                <td style="padding: 8px 0; font-weight: bold; color: #ef4444;">${problemType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #666;">Buyer:</td>
                <td style="padding: 8px 0;">${buyer?.name || 'N/A'} (${buyer?.email || 'N/A'})</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #666;">Seller:</td>
                <td style="padding: 8px 0;">${seller?.name || 'N/A'} (${seller?.email || 'N/A'})</td>
              </tr>
            </table>
            <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 8px; border-left: 4px solid #ef4444;">
              <h3 style="margin-top: 0; font-size: 14px; color: #555; text-transform: uppercase;">Buyer Description:</h3>
              <p style="margin-bottom: 0; line-height: 1.6; white-space: pre-wrap;">${description}</p>
            </div>
            <p style="margin-top: 30px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eaeaea; padding-top: 15px;">
              This is an automated notification from the Printis Platform.
            </p>
          </div>
        `
      });
    } catch (supportErr) {
      console.error('❌ Failed to send dispute notification to support email:', supportErr);
    }
  } catch (err) {
    console.error('❌ Failed to send dispute email:', err);
  }
}

/**
 * Send "payout requested" email.
 */
export async function sendPayoutEmail(userId: string, amount: string) {
  try {
    const user = await getUserEmailInfo(userId);
    if (!user?.email) return;

    await sendEmail({
      to: user.email,
      subject: `💳 Payout Requested: ${amount}`,
      html: EmailTemplates.payoutRequested(user.name, amount),
    });
  } catch (err) {
    console.error('❌ Failed to send payout email:', err);
  }
}

/**
 * Send "new chat message" email to recipient.
 */
export async function sendNewMessageEmail(
  recipientId: string,
  senderName: string,
  productTitle: string,
  messagePreview: string
) {
  try {
    const recipient = await getUserEmailInfo(recipientId);
    if (!recipient?.email) return;

    await sendEmail({
      to: recipient.email,
      subject: `💬 New message from ${senderName} about ${productTitle}`,
      html: EmailTemplates.newMessage(recipient.name, senderName, productTitle, messagePreview),
    });
  } catch (err) {
    console.error('❌ Failed to send new message email:', err);
  }
}

/**
 * Send "welcome" email to new user.
 */
export async function sendWelcomeEmail(email: string, name: string) {
  try {
    await sendEmail({
      to: email,
      subject: `🎉 Welcome to Printis, ${name}!`,
      html: EmailTemplates.welcome(name),
    });
  } catch (err) {
    console.error('❌ Failed to send welcome email:', err);
  }
}

/**
 * Send "tracking code added" email to BOTH buyer and seller.
 */
export async function sendTrackingAddedEmails(
  buyerId: string,
  sellerId: string,
  productTitle: string,
  trackingCode: string,
  orderShippingEmail?: string,
  orderShippingName?: string
) {
  try {
    // Email to buyer
    const buyerEmail = orderShippingEmail || (await getUserEmailInfo(buyerId))?.email;
    const buyerName = orderShippingName || (await getUserEmailInfo(buyerId))?.name || 'Customer';
    if (buyerEmail) {
      await sendEmail({
        to: buyerEmail,
        subject: `📦 Tracking number added: ${productTitle}`,
        html: EmailTemplates.trackingAddedBuyer(buyerName, productTitle, trackingCode),
      });
    }

    // Email to seller
    const seller = await getUserEmailInfo(sellerId);
    if (seller?.email) {
      await sendEmail({
        to: seller.email,
        subject: `📦 Tracking assigned to your order: ${productTitle}`,
        html: EmailTemplates.trackingAddedSeller(seller.name, productTitle, trackingCode),
      });
    }
  } catch (err) {
    console.error('❌ Failed to send tracking added emails:', err);
  }
}

/**
 * Send "low filament warning" email to seller.
 * Only sends when stock_grams <= 75g.
 */
export async function sendLowFilamentWarning(
  sellerId: string,
  filamentName: string,
  remainingGrams: number
) {
  try {
    const threshold = 100; // Increased threshold for warning
    if (remainingGrams > threshold) return;

    const seller = await getUserEmailInfo(sellerId);
    
    // 1. In-App Notification
    await supabase.from('notifications').insert({
      user_id: sellerId,
      title: '🧵 Low Filament Warning',
      message: `Your filament "${filamentName}" is running low (${remainingGrams}g left). Restock soon!`,
      type: 'system',
      is_read: false,
    });

    // 2. Email Notification
    if (seller?.email) {
      await sendEmail({
        to: seller.email,
        subject: `🧵 Low filament: ${filamentName} (${remainingGrams}g left)`,
        html: EmailTemplates.lowFilamentWarning(seller.name, filamentName, remainingGrams),
      });
    }
  } catch (err) {
    console.error('❌ Failed to send low filament warning:', err);
  }
}
/**
 * Send "new offer" email to seller.
 */
export async function sendOfferEmail(sellerId: string, buyerName: string, productTitle: string, price: string) {
  try {
    const seller = await getUserEmailInfo(sellerId);
    if (!seller?.email) return;

    await sendEmail({
      to: seller.email,
      subject: `🤝 New Offer: ${price} for ${productTitle}`,
      html: EmailTemplates.newOfferReceived(seller.name, buyerName, productTitle, price),
    });
  } catch (err) {
    console.error('❌ Failed to send offer email:', err);
  }
}

/**
 * Send "counter-offer" email to buyer.
 */
/**
 * Send "counter-offer" email to recipient.
 */
export async function sendCounterOfferEmail(userId: string, senderName: string, productTitle: string, price: string) {
  try {
    const user = await getUserEmailInfo(userId);
    if (!user?.email) return;

    await sendEmail({
      to: user.email,
      subject: `⚡ Counter Offer: ${productTitle}`,
      html: EmailTemplates.counterOfferReceived(user.name, senderName, productTitle, price),
    });
  } catch (err) {
    console.error('❌ Failed to send counter-offer email:', err);
  }
}

/**
 * Send "seller offer" email to buyer.
 */
export async function sendSellerOfferEmail(userId: string, senderName: string, productTitle: string, price: string) {
  try {
    const user = await getUserEmailInfo(userId);
    if (!user?.email) return;

    await sendEmail({
      to: user.email,
      subject: `✨ Special Offer: ${productTitle}`,
      html: EmailTemplates.sellerOfferReceived(user.name, senderName, productTitle, price),
    });
  } catch (err) {
    console.error('❌ Failed to send seller offer email:', err);
  }
}

/**
 * Send "offer accepted" email to other party.
 */
export async function sendOfferAcceptedEmail(recipientId: string, senderName: string, productTitle: string, role: 'buyer' | 'seller') {
  try {
    const recipient = await getUserEmailInfo(recipientId);
    if (!recipient?.email) return;

    await sendEmail({
      to: recipient.email,
      subject: `🎉 Offer Accepted: ${productTitle}`,
      html: EmailTemplates.offerAccepted(recipient.name, senderName, productTitle, role),
    });
  } catch (err) {
    console.error('❌ Failed to send offer accepted email:', err);
  }
}

/**
 * Send "offer rejected" email to other party.
 */
export async function sendOfferRejectedEmail(recipientId: string, otherName: string, productTitle: string) {
  try {
    const recipient = await getUserEmailInfo(recipientId);
    if (!recipient?.email) return;

    await sendEmail({
      to: recipient.email,
      subject: `✖️ Offer Update: ${productTitle}`,
      html: EmailTemplates.offerRejected(recipient.name, otherName, productTitle),
    });
  } catch (err) {
    console.error('❌ Failed to send offer rejected email:', err);
  }
}

/**
 * Send "dispute resolved" email notification to both buyer and seller.
 */
export async function sendDisputeResolutionEmail(
  buyerId: string,
  sellerId: string,
  action: 'refund_buyer' | 'payout_seller',
  amountEUR: number,
  adminNotes?: string
) {
  try {
    const isRefund = action === 'refund_buyer';
    const formattedAmount = `€${Number(amountEUR).toFixed(2)}`;

    // 1. Send email to Buyer
    const buyer = await getUserEmailInfo(buyerId);
    if (buyer?.email) {
      const buyerSubject = isRefund 
        ? `🛡️ Dispute Resolved: Full Refund Credited (${formattedAmount})` 
        : `🛡️ Dispute Resolved: Decision Update`;
      
      const buyerHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 10px; font-weight: 900; letter-spacing: 2px; color: #3b82f6; text-transform: uppercase; background: #eff6ff; padding: 4px 12px; border-radius: 99px;">Official Platform Decision</span>
            <h2 style="color: #0f172a; margin-top: 10px; font-size: 20px;">Dispute Resolution Statement</h2>
          </div>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">Hello <strong>${buyer.name}</strong>,</p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Platform Administration has reviewed and finalized the dispute regarding your order item.
          </p>
          <div style="padding: 16px; background-color: ${isRefund ? '#f0fdf4' : '#f8fafc'}; border: 1px solid ${isRefund ? '#bbf7d0' : '#e2e8f0'}; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 0; font-weight: 800; font-size: 14px; color: ${isRefund ? '#15803d' : '#0f172a'};">
              ${isRefund 
                ? `Result: Full item refund of ${formattedAmount} has been credited to your Printis Wallet balance (return shipping fees excluded).` 
                : `Result: Dispute resolved in favor of the Seller.`
              }
            </p>
            ${adminNotes ? `<p style="margin-top: 8px; font-size: 13px; color: #475569; font-style: italic;">"${adminNotes}"</p>` : ''}
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            Printis Platform Support · Official Dispute Mediation
          </p>
        </div>
      `;

      await sendEmail({ to: buyer.email, subject: buyerSubject, html: buyerHtml });
    }

    // 2. Send email to Seller
    const seller = await getUserEmailInfo(sellerId);
    if (seller?.email) {
      const sellerSubject = !isRefund 
        ? `🛡️ Dispute Resolved: Payout Released (${formattedAmount})` 
        : `🛡️ Dispute Resolved: Decision Update`;

      const sellerHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 10px; font-weight: 900; letter-spacing: 2px; color: #3b82f6; text-transform: uppercase; background: #eff6ff; padding: 4px 12px; border-radius: 99px;">Official Platform Decision</span>
            <h2 style="color: #0f172a; margin-top: 10px; font-size: 20px;">Dispute Resolution Statement</h2>
          </div>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">Hello <strong>${seller.name}</strong>,</p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Platform Administration has reviewed and finalized the dispute for your order item.
          </p>
          <div style="padding: 16px; background-color: ${!isRefund ? '#f0fdf4' : '#fff1f2'}; border: 1px solid ${!isRefund ? '#bbf7d0' : '#fecdd3'}; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 0; font-weight: 800; font-size: 14px; color: ${!isRefund ? '#15803d' : '#be123c'};">
              ${!isRefund 
                ? `Result: Dispute resolved in your favor! Funds of ${formattedAmount} have been released to your Printis Wallet balance.` 
                : `Result: Dispute resolved with buyer refund.`
              }
            </p>
            ${adminNotes ? `<p style="margin-top: 8px; font-size: 13px; color: #475569; font-style: italic;">"${adminNotes}"</p>` : ''}
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            Printis Platform Support · Official Dispute Mediation
          </p>
        </div>
      `;

      await sendEmail({ to: seller.email, subject: sellerSubject, html: sellerHtml });
    }
  } catch (err) {
    console.error('❌ Failed to send dispute resolution emails:', err);
  }
}
