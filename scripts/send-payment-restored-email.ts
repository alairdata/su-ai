import { Resend } from 'resend';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const resend = new Resend(process.env.RESEND_API_KEY);

const BOLT_SVG = `<svg width="40" height="40" viewBox="0 0 100 100" fill="none"><defs><linearGradient id="bg" x1="30%" y1="0%" x2="70%" y2="100%"><stop offset="0%" stop-color="#E8A04C"/><stop offset="100%" stop-color="#E8624C"/></linearGradient></defs><path d="M56 4L30 48H50L28 96L74 44H52L72 4Z" fill="url(#bg)"/></svg>`;

const recipients: { email: string; name: string }[] = [
  { email: 'techgirlieprincilla@gmail.com', name: 'there' },
  { email: 'inejsdaggers@gmail.com', name: 'there' },
  { email: 'princilla0871@gmail.com', name: 'there' },
];

async function sendSpecialUpgradeEmail(email: string, name: string) {
  return resend.emails.send({
    from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
    to: email,
    subject: "You've been noticed. Here's something special.",
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
              <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#F0EDE8;margin:0 0 4px;line-height:1.2;">You've been noticed.</h1>
              <div style="font-size:15px;color:#8A8690;margin-top:8px;">Here's something special — just for you.</div>
            </div>

            <div style="background:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;margin-bottom:24px;">
              <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${name},</div>
              <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
                We see you.
                <br><br>
                You've been with So-UnFiltered AI from early on — sending feedback, flagging issues, staying patient through the rough patches. That means more than you know.
                <br><br>
                So this June, we're giving you something small to say thank you.
              </div>

              <div style="background:#0C0C0E;border:1px solid rgba(232,160,76,0.25);border-radius:14px;padding:28px;text-align:center;margin:0 0 28px;">
                <div style="font-size:11px;color:#5A5660;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:12px;">Your special access — June 2026</div>
                <div style="font-size:48px;font-weight:800;background:linear-gradient(135deg,#E8A04C,#E8624C);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;margin-bottom:8px;">10</div>
                <div style="font-size:15px;color:#F0EDE8;font-weight:600;margin-bottom:6px;">messages a day</div>
                <div style="font-size:13px;color:#8A8690;">for the entire month of June — no payment, no strings.</div>
              </div>

              <div style="font-size:14px;color:#8A8690;margin-bottom:28px;line-height:1.6;text-align:center;font-style:italic;">
                You earned it by actually caring. Most people don't.
              </div>

              <div style="text-align:center;">
                <a href="https://app.so-unfiltered-ai.com" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E!important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;letter-spacing:-0.01em;">Open So-UnFiltered AI →</a>
              </div>

              <div style="height:1px;background:rgba(255,255,255,0.06);margin:24px 0;"></div>

              <div style="font-size:12px;color:#5A5660;text-align:center;">
                Keep being honest with us. We're building this for people like you.
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
      const result = await sendSpecialUpgradeEmail(email, name);
      console.log(`✓ Sent to ${email}`, result);
    } catch (err) {
      console.error(`✗ Failed to send to ${email}`, err);
    }
  }
}

main();
