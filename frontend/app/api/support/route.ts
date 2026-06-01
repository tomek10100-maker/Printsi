import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/app/lib/emailService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { category, subject, message, contact } = await req.json();

    if (!category || !subject || !message || !contact) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Insert into database
    const { data: ticket, error: dbError } = await supabase
      .from('support_tickets')
      .insert({
        category,
        subject: subject.trim(),
        message: message.trim(),
        contact: contact.trim(),
        status: 'open',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database support ticket error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // 2. Send email to support@printis.store
    try {
      await sendEmail({
        to: 'support@printis.store',
        subject: `Ticket [${category.toUpperCase()}] - ${subject.trim()}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 12px; background-color: #ffffff; color: #333333;">
            <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-top: 0; text-transform: uppercase; font-size: 18px;">
              New Support Ticket Received
            </h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 120px; color: #666;">Category:</td>
                <td style="padding: 8px 0; font-weight: bold; color: #2563eb;">${category.toUpperCase()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #666;">From (Contact):</td>
                <td style="padding: 8px 0;">${contact.trim()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #666;">Subject:</td>
                <td style="padding: 8px 0; font-weight: bold;">${subject.trim()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #666;">Ticket ID:</td>
                <td style="padding: 8px 0; font-family: monospace; font-size: 12px; color: #888;">${ticket.id}</td>
              </tr>
            </table>
            <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 8px; border-left: 4px solid #2563eb;">
              <h3 style="margin-top: 0; font-size: 14px; color: #555; text-transform: uppercase;">Message:</h3>
              <p style="margin-bottom: 0; line-height: 1.6; white-space: pre-wrap;">${message.trim()}</p>
            </div>
            <p style="margin-top: 30px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eaeaea; padding-top: 15px;">
              This is an automated notification from the Printis Platform.
            </p>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('❌ Support email sending failed:', emailErr);
      // Non-fatal, we already saved the ticket in the database.
    }

    return NextResponse.json({ success: true, ticketId: ticket.id });
  } catch (error: any) {
    console.error('❌ Critical Support API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
