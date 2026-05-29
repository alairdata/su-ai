import { Resend } from 'resend';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const resend = new Resend(process.env.RESEND_API_KEY);

const BOLT_SVG = `<svg width="40" height="40" viewBox="0 0 100 100" fill="none"><defs><linearGradient id="bg" x1="30%" y1="0%" x2="70%" y2="100%"><stop offset="0%" stop-color="#E8A04C"/><stop offset="100%" stop-color="#E8624C"/></linearGradient></defs><path d="M56 4L30 48H50L28 96L74 44H52L72 4Z" fill="url(#bg)"/></svg>`;

const recipients: { email: string; name: string }[] = [
  { email: 'a.c.doub018@gmail.com', name: 'there' },
  { email: 'glecoinsurancellc@gmail.com', name: 'there' },
  { email: 'datawithprincilla@gmail.com', name: 'there' },
  { email: 'abenatimescapes@gmail.com', name: 'there' },
];

async function sendDiscountEmail(email: string, name: string) {
  return resend.emails.send({
    from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
    to: email,
    subject: "We're sorry. Here's 20% off — just for you.",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;margin:0;padding:0;background:#0C0C0E;color:#F0EDE8;">
          <div style="max-width:560px;margin:0 auto;padding:48px 24px;">

            <div style="text-align:center;margin-bottom:36px;">
              <div style="display:inline-block;margin-bottom:20px;">${BOLT_SVG}</div>
              <div style="font-size:14px;font-weight:600;letter-spacing:-0.02em;color:#8A8690;margin-bottom:8px;">
                <span style="color:#E8A04C;">So-UnFiltered</span> AI
              </div>
              <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#F0EDE8;margin:0 0 4px;line-height:1.2;">We're sorry. Really.</h1>
              <div style="font-size:15px;color:#8A8690;margin-top:8px;">So here's something to make it right.</div>
            </div>

            <div style="background:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;margin-bottom:24px;">
              <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${name},</div>
              <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
                You tried to upgrade on So-UnFiltered AI and our payment system let you down. We know that's frustrating — and we hate that it happened to you specifically.
                <br><br>
                We've sorted it out. New payment provider, global cards, no more friction. And to say sorry properly — here's 20% off, just for you.
              </div>

              <div style="background:#0C0C0E;border:2px dashed rgba(232,160,76,0.4);border-radius:14px;padding:28px;text-align:center;margin:0 0 28px;">
                <div style="font-size:11px;color:#5A5660;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">Your discount code</div>
                <div style="font-family:'JetBrains Mono','SF Mono',Courier,monospace;font-size:32px;font-weight:800;letter-spacing:0.1em;background:linear-gradient(135deg,#E8A04C,#E8624C);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">MYNDQYMA</div>
                <div style="font-size:13px;color:#8A8690;margin-top:10px;">20% off any plan</div>
                <div style="font-size:12px;color:#5A5660;margin-top:6px;">Expires <strong style="color:#E8A04C;">June 1, 2026</strong> — don't sit on it.</div>
              </div>

              <div style="text-align:center;">
                <a href="https://app.so-unfiltered-ai.com/checkout" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E!important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;letter-spacing:-0.01em;">Claim Your Discount →</a>
              </div>

              <div style="height:1px;background:rgba(255,255,255,0.06);margin:24px 0;"></div>

              <div style="font-size:12px;color:#5A5660;text-align:center;">
                Apply the code at checkout. You already tried once — we just want to make it easier this time.
              </div>
            </div>

            <div style="text-align:center;font-size:12px;color:#5A5660;padding:0 20px;">
              Questions? Hit us at <a href="mailto:sounfilteredai@gmail.com" style="color:#8A8690;text-decoration:none;">sounfilteredai@gmail.com</a>
              <div style="margin-top:12px;font-size:11px;color:#3A3640;">
                <a href="https://sounfilteredai.com" style="color:#3A3640;text-decoration:none;">So-UnFiltered AI</a> &middot; Accra, Ghana
              </div>
            </div>

          </div>
        </body>
      </html>
    `,
  });
}

async function main() {
  for (const { email, name } of recipients) {
    try {
      const result = await sendDiscountEmail(email, name);
      console.log(`✓ Sent to ${email}`, result);
    } catch (err) {
      console.error(`✗ Failed to send to ${email}`, err);
    }
  }
}

main();
