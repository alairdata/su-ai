import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

const BOLT_SVG = `<svg width="40" height="40" viewBox="0 0 100 100" fill="none"><defs><linearGradient id="bg" x1="30%" y1="0%" x2="70%" y2="100%"><stop offset="0%" stop-color="#E8A04C"/><stop offset="100%" stop-color="#E8624C"/></linearGradient></defs><path d="M56 4L30 48H50L28 96L74 44H52L72 4Z" fill="url(#bg)"/></svg>`;

function buildEmail() {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;margin:0;padding:0;background:#0C0C0E;color:#F0EDE8;">
    <span style="display:none;max-height:0;overflow:hidden;">3 days left on your 45% off — expires June 10th</span>
    <div style="max-width:560px;margin:0 auto;padding:48px 24px;">

      <div style="text-align:center;margin-bottom:36px;">
        <div style="display:inline-block;margin-bottom:20px;">${BOLT_SVG}</div>
        <div style="font-size:14px;font-weight:600;letter-spacing:-0.02em;color:#8A8690;margin-bottom:8px;"><span style="color:#E8A04C;">So-UnFiltered</span> AI</div>
        <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#F0EDE8;margin:0 0 4px;line-height:1.2;">3 days left.</h1>
      </div>

      <div style="background:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;margin-bottom:24px;">
        <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey,</div>
        <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.7;">
          Your 45% off is still on the table &mdash; but <strong style="color:#F0EDE8;">June 10th is in 3 days</strong> and after that this deal is gone for good.
        </div>

        <div style="background:#0C0C0E;border:1px solid rgba(232,160,76,0.25);border-radius:14px;padding:28px;margin:0 0 24px;">
          <div style="font-size:11px;color:#E8A04C;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px;font-weight:600;text-align:center;">What you're unlocking</div>
          <table style="width:100%;" cellpadding="0" cellspacing="0">
            <tr><td style="padding:8px 0;font-size:13px;color:#8A8690;">
              <span style="color:#E8A04C;font-weight:700;margin-right:10px;">&#10003;</span>
              <strong style="color:#F0EDE8;">Pro &mdash; 100 msgs/day.</strong> 20x more than Free.
            </td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#8A8690;">
              <span style="color:#E8A04C;font-weight:700;margin-right:10px;">&#10003;</span>
              <strong style="color:#F0EDE8;">Plus &mdash; 300 msgs/day.</strong> Basically unlimited.
            </td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#8A8690;">
              <span style="color:#E8A04C;font-weight:700;margin-right:10px;">&#10003;</span>
              No interruptions. No daily walls. Just unfiltered conversations whenever you want them.
            </td></tr>
          </table>
          <div style="height:1px;background:rgba(255,255,255,0.06);margin:20px 0;"></div>
          <div style="text-align:center;">
            <div style="font-size:11px;color:#5A5660;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">Your code</div>
            <div style="font-family:'JetBrains Mono','SF Mono',Courier,monospace;font-size:24px;font-weight:700;color:#E8A04C;letter-spacing:0.12em;">A1NDG1MQ</div>
            <div style="font-size:13px;color:#5A5660;margin-top:6px;">45% off &mdash; expires June 10th</div>
          </div>
        </div>

        <div style="text-align:center;margin-top:24px;">
          <a href="https://app.so-unfiltered-ai.com/checkout" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E!important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;letter-spacing:-0.01em;">Use Code A1NDG1MQ Before It's Gone</a>
        </div>
      </div>

      <div style="text-align:center;font-size:12px;color:#5A5660;padding:0 20px;">
        You're receiving this because you've been active on So-UnFiltered AI. Questions? <a href="mailto:sounfilteredai@gmail.com" style="color:#8A8690;text-decoration:none;">sounfilteredai@gmail.com</a>
        <div style="margin-top:12px;font-size:11px;color:#3A3640;"><a href="https://sounfilteredai.com" style="color:#3A3640;text-decoration:none;">So-UnFiltered AI</a> &middot; Accra, Ghana</div>
      </div>
    </div>
  </body>
</html>`;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: users, error } = await supabase
    .from('user_message_stats')
    .select('id, email, total_messages')
    .gte('total_messages', 5);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!users?.length) return NextResponse.json({ message: 'No users found' });

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const { error: sendError } = await resend.emails.send({
        from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
        to: user.email,
        subject: "3 days left on your 45% off",
        html: buildEmail(),
      });
      if (sendError) { failed++; console.error(`Failed ${user.email}:`, sendError.message); }
      else { sent++; }
      await new Promise(r => setTimeout(r, 250));
    } catch (err) {
      failed++;
    }
  }

  console.log(`Discount Wave 2 done. Sent: ${sent}, Failed: ${failed}`);
  return NextResponse.json({ sent, failed, total: users.length });
}
