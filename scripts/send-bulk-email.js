require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = 'https://app.so-unfiltered-ai.com';

const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0C0C0E;" bgcolor="#0C0C0E">
<!--[if mso]><table width="100%" bgcolor="#0C0C0E"><tr><td><![endif]-->
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0C0C0E" style="background-color:#0C0C0E;margin:0;padding:0;">
<tr><td align="center" bgcolor="#0C0C0E" style="background-color:#0C0C0E;padding:48px 24px;">
<table width="560" cellpadding="0" cellspacing="0" border="0">

<!-- Header -->
<tr><td align="center" style="padding-bottom:32px">
  <table cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="font-size:24px;padding-right:8px">&#9889;</td>
    <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#8A8690"><span style="color:#E8A04C">So-UnFiltered</span> AI</td>
  </tr></table>
</td></tr>

<!-- Intro Card -->
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#141416" style="background-color:#141416;border:1px solid #1E1E22;border-radius:16px">
<tr><td style="padding:32px">

  <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#F0EDE8;margin:0 0 16px">Hey &#128075;</div>

  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#8A8690;line-height:1.8;margin:0 0 20px">
    Real talk — we had some bugs. Messages weren't resetting properly and some of you got locked out. <strong style="color:#69F0AE">We fixed all of it.</strong>
  </div>

  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#8A8690;line-height:1.7;margin:0">
    But we didn't just fix bugs. We shipped something big:
  </div>

</td></tr></table>
</td></tr>

<tr><td height="12"></td></tr>

<!-- BUG FIXES -->
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#141416" style="background-color:#141416;border:1px solid #1E1E22;border-radius:16px">
<tr><td style="padding:28px 32px">

  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#69F0AE;margin:0 0 18px">&#128295; WHAT WE FIXED</div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px"><tr>
    <td width="28" valign="top" style="font-size:14px;line-height:1.4">&#9989;</td>
    <td style="font-family:Arial,Helvetica,sans-serif">
      <div style="font-size:14px;font-weight:bold;color:#F0EDE8;margin-bottom:3px">Daily message limits now reset properly</div>
      <div style="font-size:12px;color:#5A5660;line-height:1.5">No more getting locked out. Your free messages reset every 24 hours like they should.</div>
    </td>
  </tr></table>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px"><tr>
    <td width="28" valign="top" style="font-size:14px;line-height:1.4">&#9989;</td>
    <td style="font-family:Arial,Helvetica,sans-serif">
      <div style="font-size:14px;font-weight:bold;color:#F0EDE8;margin-bottom:3px">Faster responses</div>
      <div style="font-size:12px;color:#5A5660;line-height:1.5">Less waiting, more talking.</div>
    </td>
  </tr></table>

  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="28" valign="top" style="font-size:14px;line-height:1.4">&#9989;</td>
    <td style="font-family:Arial,Helvetica,sans-serif">
      <div style="font-size:14px;font-weight:bold;color:#F0EDE8;margin-bottom:3px">General stability improvements</div>
      <div style="font-size:12px;color:#5A5660;line-height:1.5">Smoother experience across the board.</div>
    </td>
  </tr></table>

</td></tr></table>
</td></tr>

<tr><td height="12"></td></tr>

<!-- CHAT CHARACTERS -->
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1A1330" style="background-color:#1A1330;border:1px solid #2D1B4E;border-radius:16px">
<tr><td style="padding:28px 32px">

  <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px"><tr>
    <td style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#B388FF;padding:4px 10px;border-radius:6px">NEW FEATURE</td>
  </tr></table>

  <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#F0EDE8;margin:0 0 12px">&#128172; Chat Characters</div>

  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#B0A8C0;line-height:1.7;margin:0 0 20px">
    Add up to <strong style="color:#F0EDE8">5 AI personalities</strong> to any conversation. A tough love coach, a hype person, a devil's advocate — whatever you need. They have their own names, their own vibe, and they'll even argue with each other.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#120E20" style="background-color:#120E20;border-radius:12px;margin-bottom:16px">
  <tr><td style="padding:16px 16px 12px">

    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px"><tr>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#5A5060;padding-right:10px">Active:</td>
      <td style="width:22px;height:22px;background-color:#7C4DFF;border-radius:50%;text-align:center;line-height:22px;font-size:9px;font-weight:bold;color:white;font-family:Arial,sans-serif">D</td>
      <td width="4"></td>
      <td style="width:22px;height:22px;background-color:#00BCD4;border-radius:50%;text-align:center;line-height:22px;font-size:9px;font-weight:bold;color:white;font-family:Arial,sans-serif">S</td>
      <td width="4"></td>
      <td style="width:22px;height:22px;background-color:#FF7043;border-radius:50%;text-align:center;line-height:22px;font-size:9px;font-weight:bold;color:white;font-family:Arial,sans-serif">R</td>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#5A5060;padding-left:8px">Danny, Sarah, Rico</td>
    </tr></table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px">
    <tr><td align="right">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="border-radius:12px 12px 4px 12px;padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#E0D8C8">@Danny what do you think about my business idea?</td>
      </tr></table>
    </td></tr></table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px">
    <tr>
      <td width="28" valign="top">
        <div style="width:24px;height:24px;background-color:#7C4DFF;border-radius:50%;text-align:center;line-height:24px;font-size:10px;font-weight:bold;color:white;font-family:Arial,sans-serif">D</div>
      </td>
      <td style="padding-left:8px">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#7C4DFF;margin-bottom:4px">Danny <span style="font-size:8px;color:#5A5060;font-weight:normal;padding:2px 5px;border-radius:3px;margin-left:4px">CHARACTER</span></div>
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="#1E1830" style="background-color:#1E1830;border:1px solid #2A2040;border-radius:4px 12px 12px 12px;padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#D0C8E0;line-height:1.6">Honestly? You're overcomplicating it. Strip it down to the one thing people will actually pay for. Everything else is a distraction.</td>
        </tr></table>
      </td>
    </tr></table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="28" valign="top">
        <div style="width:24px;height:24px;background-color:#00BCD4;border-radius:50%;text-align:center;line-height:24px;font-size:10px;font-weight:bold;color:white;font-family:Arial,sans-serif">S</div>
      </td>
      <td style="padding-left:8px">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:#00BCD4;margin-bottom:4px">Sarah <span style="font-size:8px;color:#5A5060;font-weight:normal;padding:2px 5px;border-radius:3px;margin-left:4px">CHARACTER</span></div>
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="#0E1E22" style="background-color:#0E1E22;border:1px solid #1A2A30;border-radius:4px 12px 12px 12px;padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#D0C8E0;line-height:1.6">I disagree with Danny. Your idea has layers and that's a strength. But you do need a clearer entry point.</td>
        </tr></table>
      </td>
    </tr></table>

  </td></tr></table>

  <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8A7AA0;text-align:center;line-height:1.6">
    Type <strong style="color:#E8A04C">@name</strong> in any chat to talk to a character<br>
    <span style="font-size:11px;color:#5A5060">Click the person+ icon in the header to create one</span>
  </div>

</td></tr></table>
</td></tr>

<tr><td height="12"></td></tr>

<!-- ALSO NEW -->
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#141416" style="background-color:#141416;border:1px solid #1E1E22;border-radius:16px">
<tr><td style="padding:28px 32px">

  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#5A5660;margin:0 0 14px">&#127381; ALSO NEW</div>

  <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8A8690;line-height:2.4;padding-left:2px">
    <span style="color:#64D2FF">&#9679;</span>&nbsp; <strong style="color:#F0EDE8">File uploads</strong> — drop docs, PDFs, code and get real feedback<br>
    <span style="color:#69F0AE">&#9679;</span>&nbsp; <strong style="color:#F0EDE8">Image uploads</strong> — share images, get honest reactions<br>
    <span style="color:#FF80AB">&#9679;</span>&nbsp; <strong style="color:#F0EDE8">Image generation</strong> — describe what you want, AI creates it
  </div>

</td></tr></table>
</td></tr>

<tr><td height="12"></td></tr>

<!-- CTA -->
<tr><td>
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#141416" style="background-color:#141416;border:1px solid #1E1E22;border-radius:16px">
<tr><td style="padding:28px 32px;text-align:center">

  <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#8A8690;line-height:1.7;margin:0 0 6px">
    If you tried us before and it felt off — <strong style="color:#F0EDE8">that's on us.</strong>
  </div>
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#F0EDE8;font-weight:bold;margin:0 0 24px">
    Come back. It's a different app now.
  </div>

  <table cellpadding="0" cellspacing="0" border="0" align="center"><tr>
    <td align="center" bgcolor="#E8A04C" style="background-color:#E8A04C;border-radius:12px;padding:16px 44px">
      <a href="${APP_URL}" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0C0C0E;text-decoration:none;display:block">Try the new So-UnFiltered &#8594;</a>
    </td>
  </tr></table>

</td></tr></table>
</td></tr>

<!-- Footer -->
<tr><td align="center" style="padding:32px 0 16px">
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#3A3640;margin-bottom:6px">So-UnFiltered AI by SeedFest Technologies</div>
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#2A2630">Don't want these? <a href="mailto:support@so-unfiltered-ai.com?subject=Unsubscribe" style="color:#5A5660;text-decoration:underline">Unsubscribe</a></div>
</td></tr>

</table>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`;

async function main() {
  // Get active users (1+ messages)
  const { data: stats, error } = await supabase
    .from('user_message_stats')
    .select('id, email, total_messages')
    .gt('total_messages', 0);

  if (error) { console.error('DB Error:', error); return; }

  console.log(`Sending to ${stats.length} active users...`);
  console.log('');

  let sent = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < stats.length; i++) {
    const user = stats[i];
    try {
      const { data, error: sendError } = await resend.emails.send({
        from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
        to: user.email,
        subject: "We broke some things. Then we made it way better.",
        html: emailHtml,
      });

      if (sendError) {
        console.log(`  ✗ ${i + 1}. ${user.email} — ERROR: ${sendError.message}`);
        failed++;
        failures.push({ email: user.email, error: sendError.message });
      } else {
        console.log(`  ✓ ${i + 1}. ${user.email} — sent (${data.id})`);
        sent++;
      }

      // Small delay to avoid rate limits (200ms between sends)
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      console.log(`  ✗ ${i + 1}. ${user.email} — EXCEPTION: ${err.message}`);
      failed++;
      failures.push({ email: user.email, error: err.message });
    }
  }

  console.log('');
  console.log(`Done! Sent: ${sent}, Failed: ${failed}`);
  if (failures.length > 0) {
    console.log('');
    console.log('Failed emails:');
    failures.forEach(f => console.log(`  - ${f.email}: ${f.error}`));
  }
}

main();
