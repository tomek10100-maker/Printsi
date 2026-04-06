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
