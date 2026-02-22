import { Resend } from 'resend';
import { trackServerEvent, EVENTS } from '@/lib/analytics';

const resend = new Resend(process.env.RESEND_API_KEY);

const BOLT_SVG = `<svg width="40" height="40" viewBox="0 0 100 100" fill="none"><defs><linearGradient id="bg" x1="30%" y1="0%" x2="70%" y2="100%"><stop offset="0%" stop-color="#E8A04C"/><stop offset="100%" stop-color="#E8624C"/></linearGradient></defs><path d="M56 4L30 48H50L28 96L74 44H52L72 4Z" fill="url(#bg)"/></svg>`;

const EMAIL_HEADER = `
  <div style="text-align:center;margin-bottom:36px;">
    <div style="display:inline-block;margin-bottom:20px;">${BOLT_SVG}</div>
    <div style="font-size:14px;font-weight:600;letter-spacing:-0.02em;color:#8A8690;margin-bottom:8px;">
      <span style="color:#E8A04C;">So-UnFiltered</span> AI
    </div>`;

const EMAIL_FOOTER = `
  <div style="text-align:center;font-size:12px;color:#5A5660;padding:0 20px;">
    {{FOOTER_TEXT}}
    <div style="margin-top:12px;font-size:11px;color:#3A3640;">
      <a href="https://sounfilteredai.com" style="color:#3A3640;text-decoration:none;">So-UnFiltered AI</a> &middot; Accra, Ghana
    </div>
  </div>`;

export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string,
  userId?: string
) {
  const verificationUrl = `${process.env.NEXTAUTH_URL}/api/verify-email?token=${token}`;

  try {
    await resend.emails.send({
      from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
      to: email,
      subject: 'Verify your So-UnFiltered AI account',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;margin:0;padding:0;background:#0C0C0E;color:#F0EDE8;">
            <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
              ${EMAIL_HEADER}
                <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#F0EDE8;margin:0 0 4px;line-height:1.2;">Welcome aboard.</h1>
              </div>

              <div style="background:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;margin-bottom:24px;">
                <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${name},</div>
                <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
                  You just signed up for something different. No sugar-coating, no corporate AI speak &mdash; just real talk.
                  <br><br>
                  Hit the button below to verify your email and get started.
                </div>

                <div style="text-align:center;margin:28px 0;">
                  <a href="${verificationUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E!important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;letter-spacing:-0.01em;">Verify My Email</a>
                </div>

                <div style="font-size:12px;color:#5A5660;word-break:break-all;margin-top:16px;">
                  Or paste this link: <br>
                  <a href="${verificationUrl}" style="color:#E8A04C;text-decoration:none;">${verificationUrl}</a>
                </div>

                <div style="height:1px;background:rgba(255,255,255,0.06);margin:24px 0;"></div>

                <div style="font-size:12px;color:#5A5660;text-align:center;margin-top:16px;display:flex;align-items:center;justify-content:center;gap:6px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A5660" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  This link expires in 24 hours
                </div>
              </div>

              ${EMAIL_FOOTER.replace('{{FOOTER_TEXT}}', "Didn&apos;t sign up? Just ignore this email &mdash; nothing will happen.")}
            </div>
          </body>
        </html>
      `,
    });

    if (userId) trackServerEvent(userId, EVENTS.EMAIL_SENT, { email_type: 'verification' });
    return { success: true };
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return { success: false, error };
  }
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string,
  userId?: string
) {
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  try {
    await resend.emails.send({
      from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
      to: email,
      subject: 'Reset your So-UnFiltered AI password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;margin:0;padding:0;background:#0C0C0E;color:#F0EDE8;">
            <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
              ${EMAIL_HEADER}
                <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#F0EDE8;margin:0 0 4px;line-height:1.2;">Reset your password.</h1>
              </div>

              <div style="background:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;margin-bottom:24px;">
                <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${name},</div>
                <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
                  Someone (hopefully you) requested a password reset. No stress &mdash; just click below to set a new one.
                </div>

                <div style="text-align:center;margin:28px 0;">
                  <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E!important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Reset Password</a>
                </div>

                <div style="font-size:12px;color:#5A5660;word-break:break-all;margin-top:16px;">
                  Or paste this link: <br>
                  <a href="${resetUrl}" style="color:#E8A04C;text-decoration:none;">${resetUrl}</a>
                </div>

                <div style="height:1px;background:rgba(255,255,255,0.06);margin:24px 0;"></div>

                <div style="font-size:12px;color:#5A5660;text-align:center;margin-top:16px;display:flex;align-items:center;justify-content:center;gap:6px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A5660" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  This link expires in 1 hour
                </div>

                <div style="background:rgba(232,160,76,0.08);border:1px solid rgba(232,160,76,0.15);padding:14px 16px;border-radius:10px;margin-top:20px;font-size:13px;color:#8A8690;display:flex;align-items:flex-start;gap:10px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8A04C" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div>
                    <strong style="color:#E8A04C;font-weight:600;">Didn&apos;t request this?</strong><br>
                    No worries. Just ignore this email and your password stays the same.
                  </div>
                </div>
              </div>

              ${EMAIL_FOOTER.replace('{{FOOTER_TEXT}}', 'This is an automated email from So-UnFiltered AI.')}
            </div>
          </body>
        </html>
      `,
    });

    if (userId) trackServerEvent(userId, EVENTS.EMAIL_SENT, { email_type: 'password_reset' });
    return { success: true };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error };
  }
}

export async function sendSubscriptionEmail(
  email: string,
  name: string,
  plan: string,
  type: 'subscribed' | 'cancelled' | 'upgraded' | 'downgraded',
  periodEnd?: string,
  userId?: string
) {
  const titles: Record<string, string> = {
    subscribed: 'You just leveled up.',
    cancelled: 'Subscription cancelled.',
    upgraded: 'You just leveled up.',
    downgraded: 'Plan changed.',
  };

  const messages: Record<string, string> = {
    subscribed: `Your ${plan} plan is confirmed. More messages, better models, and the full unfiltered experience.`,
    cancelled: `Your subscription has been cancelled. You'll continue to have access until ${periodEnd ? new Date(periodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'the end of your billing period'}.`,
    upgraded: `Your upgrade to ${plan} is confirmed. More messages, better models, and the full unfiltered experience.`,
    downgraded: `Your plan will change to ${plan} at the end of your current billing period.`,
  };

  const closingMessages: Record<string, string> = {
    subscribed: 'Your messages have already been upgraded. Go use them.',
    cancelled: 'If you change your mind, you can resubscribe anytime from your account settings.',
    upgraded: 'Your messages have already been upgraded. Go use them.',
    downgraded: 'Your current plan stays active until the billing period ends.',
  };

  const planLimits: Record<string, string> = {
    Pro: '100',
    Plus: '300',
  };

  const planPrices: Record<string, string> = {
    Pro: '$4.99/mo',
    Plus: '$9.99/mo',
  };

  const planFeatures: Record<string, string[]> = {
    Pro: [
      '20x more than Free',
      'Expanded memory &amp; context',
      'Early access to new features',
      'Advanced reasoning models',
      'Memory across conversations',
    ],
    Plus: [
      '30x more than Free',
      'Maximum memory &amp; context',
      'Priority access to new features',
      'All advanced models',
      'Memory across conversations',
      'Priority support',
    ],
  };

  const showPlanCard = type !== 'cancelled';
  const features = planFeatures[plan] || planFeatures['Pro'];

  try {
    await resend.emails.send({
      from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
      to: email,
      subject: `So-UnFiltered AI — ${plan} ${type === 'cancelled' ? 'Cancelled' : 'Plan'}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;margin:0;padding:0;background:#0C0C0E;color:#F0EDE8;">
            <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
              ${EMAIL_HEADER}
                <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#F0EDE8;margin:0 0 4px;line-height:1.2;">${titles[type]}</h1>
              </div>

              <div style="background:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;margin-bottom:24px;">
                <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${name},</div>
                <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
                  ${messages[type]}
                </div>

                ${showPlanCard ? `
                <div style="background:#0C0C0E;border:1px solid rgba(232,160,76,0.2);border-radius:14px;padding:24px;text-align:center;margin:24px 0;">
                  <div style="display:inline-block;padding:6px 20px;border-radius:100px;font-weight:700;font-size:14px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E;margin-bottom:12px;">${plan} Plan</div>
                  <div style="font-size:13px;color:#8A8690;margin:4px 0;"><strong style="color:#E8A04C;">${planLimits[plan] || '100'}</strong> messages per day</div>
                  <div style="font-size:13px;color:#8A8690;margin:4px 0;">Billed at <strong style="color:#E8A04C;">${planPrices[plan] || '$4.99/mo'}</strong></div>
                  <table style="margin:20px 0 0;text-align:left;width:100%;" cellpadding="0" cellspacing="0">
                    ${features.map(f => `
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#8A8690;">
                        <span style="color:#E8A04C;font-weight:700;font-size:12px;margin-right:8px;">&#10003;</span>${f}
                      </td>
                    </tr>`).join('')}
                  </table>
                </div>
                ` : ''}

                <div style="height:1px;background:rgba(255,255,255,0.06);margin:24px 0;"></div>

                <div style="font-size:14px;color:#8A8690;margin-bottom:0;line-height:1.6;">
                  ${closingMessages[type]}
                </div>

                <div style="text-align:center;margin:24px 0 0;">
                  <a href="${process.env.NEXTAUTH_URL}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E!important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Open So-UnFiltered AI</a>
                </div>
              </div>

              ${EMAIL_FOOTER.replace('{{FOOTER_TEXT}}', 'Questions? Hit us at <a href="mailto:sounfilteredai@gmail.com" style="color:#8A8690;text-decoration:none;">sounfilteredai@gmail.com</a>')}
            </div>
          </body>
        </html>
      `,
    });

    if (userId) trackServerEvent(userId, EVENTS.EMAIL_SENT, { email_type: `subscription_${type}` });
    return { success: true };
  } catch (error) {
    console.error('Failed to send subscription email:', error);
    return { success: false, error };
  }
}

export async function sendFollowUpEmail(
  email: string,
  name: string,
  messagesRemaining: number = 10,
  userId?: string
) {
  try {
    await resend.emails.send({
      from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
      to: email,
      subject: "Your messages are going to waste — So-UnFiltered AI",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;margin:0;padding:0;background:#0C0C0E;color:#F0EDE8;">
            <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
              ${EMAIL_HEADER}
                <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#F0EDE8;margin:0 0 4px;line-height:1.2;">Your messages are going to waste.</h1>
                <div style="font-size:15px;color:#8A8690;margin-top:8px;">You signed up but never said a word.</div>
              </div>

              <div style="background:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;margin-bottom:24px;">
                <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${name},</div>
                <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
                  You signed up but haven&apos;t sent a single message yet. No judgment &mdash; but you have free messages sitting there doing nothing.
                </div>

                <div style="background:#0C0C0E;border:1px solid rgba(232,160,76,0.15);border-radius:14px;padding:24px;text-align:center;margin:24px 0;">
                  <div style="font-family:'JetBrains Mono','SF Mono',monospace;font-size:48px;font-weight:700;background:linear-gradient(135deg,#E8A04C,#E8624C);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;">${messagesRemaining}</div>
                  <div style="font-size:13px;color:#5A5660;margin-top:8px;">unused messages today</div>
                  <div style="font-size:11px;color:#5A5660;margin-top:4px;">They reset at midnight. Use them or lose them.</div>
                </div>

                <div style="font-size:14px;color:#8A8690;margin-bottom:16px;line-height:1.6;">
                  Not sure what to say? Here&apos;s how other people start:
                </div>

                <div style="background:#0C0C0E;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:20px;margin:24px 0;">
                  <div style="font-size:11px;color:#5A5660;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
                    <svg width="12" height="12" viewBox="0 0 100 100" fill="none"><path d="M56 4L30 48H50L28 96L74 44H52L72 4Z" fill="#E8A04C"/></svg>
                    So-UnFiltered AI is ready...
                  </div>
                  <div style="padding:10px 14px;border-radius:14px 14px 14px 4px;background:#1A1A1E;border:1px solid rgba(255,255,255,0.06);font-size:13px;color:#8A8690;line-height:1.5;max-width:90%;">
                    &quot;Am I overthinking this?&quot; &mdash; that&apos;s literally all you have to type. I&apos;ll handle the rest. No filter, no fluff.
                  </div>
                </div>

                <div style="height:1px;background:rgba(255,255,255,0.06);margin:24px 0;"></div>

                <div style="text-align:center;margin:28px 0 0;">
                  <a href="${process.env.NEXTAUTH_URL}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E!important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Start Chatting</a>
                </div>
              </div>

              <div style="text-align:center;font-size:12px;color:#5A5660;padding:0 20px;">
                You&apos;re receiving this because you signed up for So-UnFiltered AI.
                <div style="margin-top:12px;font-size:11px;color:#3A3640;">
                  <a href="#" style="color:#3A3640;text-decoration:none;">Unsubscribe</a> &middot; <a href="https://sounfilteredai.com" style="color:#3A3640;text-decoration:none;">So-UnFiltered AI</a> &middot; Accra, Ghana
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (userId) trackServerEvent(userId, EVENTS.EMAIL_SENT, { email_type: 'follow_up' });
    return { success: true };
  } catch (error) {
    console.error('Failed to send follow-up email:', error);
    return { success: false, error };
  }
}
