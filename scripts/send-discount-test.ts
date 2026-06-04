import { Resend } from 'resend';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const resend = new Resend(process.env.RESEND_API_KEY);

const BOLT_SVG = `<svg width="40" height="40" viewBox="0 0 100 100" fill="none"><defs><linearGradient id="bg" x1="30%" y1="0%" x2="70%" y2="100%"><stop offset="0%" stop-color="#E8A04C"/><stop offset="100%" stop-color="#E8624C"/></linearGradient></defs><path d="M56 4L30 48H50L28 96L74 44H52L72 4Z" fill="url(#bg)"/></svg>`;

const EMAIL_HEADER = (headline: string) => `
  <div style="text-align:center;margin-bottom:36px;">
    <div style="display:inline-block;margin-bottom:20px;">${BOLT_SVG}</div>
    <div style="font-size:14px;font-weight:600;letter-spacing:-0.02em;color:#8A8690;margin-bottom:8px;">
      <span style="color:#E8A04C;">So-UnFiltered</span> AI
    </div>
    <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#F0EDE8;margin:0 0 4px;line-height:1.2;">${headline}</h1>
  </div>`;

const EMAIL_FOOTER = `
  <div style="text-align:center;font-size:12px;color:#5A5660;padding:0 20px;">
    You&apos;re receiving this because you&apos;ve been active on So-UnFiltered AI. Questions? <a href="mailto:sounfilteredai@gmail.com" style="color:#8A8690;text-decoration:none;">sounfilteredai@gmail.com</a>
    <div style="margin-top:12px;font-size:11px;color:#3A3640;">
      <a href="https://sounfilteredai.com" style="color:#3A3640;text-decoration:none;">So-UnFiltered AI</a> &middot; Accra, Ghana
    </div>
  </div>`;

const CODE_BLOCK = `
  <div style="margin:20px 0;padding:14px 20px;background:#0C0C0E;border-radius:10px;border:1px solid rgba(255,255,255,0.08);text-align:center;">
    <div style="font-size:11px;color:#5A5660;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Your discount code</div>
    <div style="font-family:'JetBrains Mono','SF Mono',Courier,monospace;font-size:22px;font-weight:700;color:#E8A04C;letter-spacing:0.12em;">A1NDG1MQ</div>
  </div>`;

const CTA = (label: string) => `
  <div style="text-align:center;margin-top:24px;">
    <a href="https://app.so-unfiltered-ai.com?upgrade=true" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E!important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;letter-spacing:-0.01em;">${label}</a>
  </div>`;

function buildEmail(preheader: string, headline: string, body: string, ctaLabel: string) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;margin:0;padding:0;background:#0C0C0E;color:#F0EDE8;">
    <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
    <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
      ${EMAIL_HEADER(headline)}
      <div style="background:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;margin-bottom:24px;">
        ${body}
        ${CTA(ctaLabel)}
      </div>
      ${EMAIL_FOOTER}
    </div>
  </body>
</html>`;
}

const TEST_NAME = 'Princilla';
const TEST_MESSAGES = 93;

const email1 = buildEmail(
  "here's 45% off to fix that — but not for long",
  "Here&apos;s a deal that shouldn&apos;t exist.",
  `<div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${TEST_NAME},</div>
  <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
    You&apos;ve sent <strong style="color:#F0EDE8;">${TEST_MESSAGES} messages</strong> on So-UnFiltered AI &mdash;
    and you keep running into that 5-per-day limit.
    <br><br>
    So instead of watching you get cut off mid-conversation, we&apos;re making you an offer
    that honestly shouldn&apos;t be this good.
  </div>

  <div style="background:#0C0C0E;border:1px solid rgba(232,160,76,0.25);border-radius:14px;padding:28px;text-align:center;margin:0 0 24px;">
    <div style="font-size:11px;color:#E8A04C;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;font-weight:600;">Limited Offer &mdash; Ends June 10th</div>
    <div style="font-size:52px;font-weight:800;background:linear-gradient(135deg,#E8A04C,#E8624C);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;letter-spacing:-0.04em;">45% OFF</div>
    <div style="font-size:14px;color:#8A8690;margin-top:8px;">every plan. no catch.</div>
    ${CODE_BLOCK}
    <table style="width:100%;margin-top:8px;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="text-align:center;padding:8px;">
          <div style="font-size:11px;color:#5A5660;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Pro</div>
          <div style="font-size:13px;color:#8A8690;text-decoration:line-through;">$4.99/mo</div>
          <div style="font-size:16px;font-weight:700;color:#E8A04C;">$2.74/mo</div>
          <div style="font-size:11px;color:#5A5660;margin-top:2px;">100 msgs/day</div>
        </td>
        <td style="width:1px;background:rgba(255,255,255,0.06);"></td>
        <td style="text-align:center;padding:8px;">
          <div style="font-size:11px;color:#5A5660;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Plus</div>
          <div style="font-size:13px;color:#8A8690;text-decoration:line-through;">$9.99/mo</div>
          <div style="font-size:16px;font-weight:700;color:#E8A04C;">$5.49/mo</div>
          <div style="font-size:11px;color:#5A5660;margin-top:2px;">300 msgs/day</div>
        </td>
      </tr>
    </table>
  </div>

  <div style="font-size:12px;color:#5A5660;text-align:center;">
    This deal expires <strong style="color:#F0EDE8;">June 10th</strong> and we&apos;re not bringing it back.
    <br><br>
    p.s. yes, 45% is absurd. that&apos;s kind of the point.
  </div>`,
  'Claim 45% Off — Use Code A1NDG1MQ'
);

const email2 = buildEmail(
  "45% off expires June 10th. just saying.",
  "3 days. Then it&apos;s gone.",
  `<div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${TEST_NAME},</div>
  <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
    Still hitting that limit every day?<br><br>
    Your 45% off is still on the table &mdash; but <strong style="color:#F0EDE8;">June 10th is in 3 days</strong> and after that this deal is gone for good.
  </div>

  <div style="background:#0C0C0E;border:1px solid rgba(232,160,76,0.25);border-radius:14px;padding:28px;margin:0 0 24px;">
    <div style="font-size:11px;color:#E8A04C;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px;font-weight:600;text-align:center;">What you&apos;re unlocking</div>
    <table style="width:100%;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#8A8690;">
          <span style="color:#E8A04C;font-weight:700;margin-right:10px;">&#10003;</span>
          <strong style="color:#F0EDE8;">Pro &mdash; 100 msgs/day.</strong> 20x more than Free.
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#8A8690;">
          <span style="color:#E8A04C;font-weight:700;margin-right:10px;">&#10003;</span>
          <strong style="color:#F0EDE8;">Plus &mdash; 300 msgs/day.</strong> Basically unlimited.
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#8A8690;">
          <span style="color:#E8A04C;font-weight:700;margin-right:10px;">&#10003;</span>
          No interruptions. No daily walls. Just unfiltered conversations whenever you want them.
        </td>
      </tr>
    </table>
    <div style="height:1px;background:rgba(255,255,255,0.06);margin:20px 0;"></div>
    <div style="text-align:center;">
      <div style="font-size:11px;color:#5A5660;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">Your code</div>
      <div style="font-family:'JetBrains Mono','SF Mono',Courier,monospace;font-size:24px;font-weight:700;color:#E8A04C;letter-spacing:0.12em;">A1NDG1MQ</div>
      <div style="font-size:13px;color:#5A5660;margin-top:6px;">45% off &mdash; expires June 10th</div>
    </div>
  </div>`,
  "Use Code A1NDG1MQ Before It&apos;s Gone"
);

const email3 = buildEmail(
  "last chance — code A1NDG1MQ expires tonight",
  "Last chance.",
  `<div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${TEST_NAME},</div>
  <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
    Today&apos;s the last day. The 45% off expires <strong style="color:#F0EDE8;">tonight at midnight</strong> &mdash; no extensions, no exceptions.
  </div>

  <div style="background:#0C0C0E;border:1px solid rgba(232,98,76,0.3);border-radius:14px;padding:28px;text-align:center;margin:0 0 24px;">
    <div style="font-size:11px;color:#E8624C;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;font-weight:600;">Expires Tonight</div>
    <div style="font-family:'JetBrains Mono','SF Mono',Courier,monospace;font-size:28px;font-weight:700;color:#E8A04C;letter-spacing:0.12em;margin-bottom:8px;">A1NDG1MQ</div>
    <div style="font-size:14px;color:#8A8690;">45% off any plan</div>
    <div style="height:1px;background:rgba(255,255,255,0.06);margin:20px 0;"></div>
    <div style="font-size:14px;color:#8A8690;line-height:1.6;">
      You&apos;ve sent <strong style="color:#F0EDE8;">${TEST_MESSAGES} messages</strong> on the free plan.<br>
      You clearly like it here. Stop letting a 5-message limit get in the way.
    </div>
  </div>

  <div style="font-size:13px;color:#5A5660;text-align:center;">
    That&apos;s it. That&apos;s the email.
  </div>`,
  'Claim 45% Off Before Midnight'
);

async function main() {
  const TEST_EMAIL = 'sounfilteredai@gmail.com';

  const emails = [
    { subject: '[TEST - Email 1] we noticed you keep hitting your limit 👀', html: email1 },
    { subject: '[TEST - Email 2] 3 days left on the most unhinged deal we\'ve ever run', html: email2 },
    { subject: '[TEST - Email 3] tonight it\'s gone. for real.', html: email3 },
  ];

  for (const { subject, html } of emails) {
    try {
      const result = await resend.emails.send({
        from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
        to: TEST_EMAIL,
        subject,
        html,
      });
      console.log(`✓ Sent: "${subject}"`, result);
    } catch (err) {
      console.error(`✗ Failed: "${subject}"`, err);
    }
  }
}

main();
