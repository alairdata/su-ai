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
      '60x more than Free',
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

export async function sendPaymentFailedEmail(
  email: string,
  name: string,
  plan: string,
  retryAttempt: number,
  maxRetries: number,
  userId?: string
) {
  const isLastAttempt = retryAttempt >= maxRetries;
  const subject = isLastAttempt
    ? 'Action required: Your subscription is about to expire'
    : 'Heads up: Your payment failed';

  const mainMessage = isLastAttempt
    ? `We&apos;ve tried charging your card ${maxRetries} times for your ${plan} plan, but it keeps failing. Your subscription will be downgraded to the Free plan in 1 day unless you update your payment method.`
    : `We tried to renew your ${plan} plan but your card was declined. We&apos;ll retry automatically, but you may want to check your card details.`;

  const urgencyNote = isLastAttempt
    ? `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15);padding:14px 16px;border-radius:10px;margin-top:20px;font-size:13px;color:#8A8690;display:flex;align-items:flex-start;gap:10px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div>
          <strong style="color:#ef4444;font-weight:600;">Last notice</strong><br>
          If we can&apos;t collect payment within 1 day, your plan will be downgraded to Free (5 messages/day).
        </div>
      </div>`
    : `<div style="font-size:12px;color:#5A5660;text-align:center;margin-top:16px;">
        Retry attempt ${retryAttempt} of ${maxRetries} &mdash; we&apos;ll try again tomorrow.
      </div>`;

  // Notify admins about payment failures
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length > 0) {
    try {
      await resend.emails.send({
        from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
        to: adminEmails,
        subject: `[Admin] Payment failed for ${email} (attempt ${retryAttempt}/${maxRetries})`,
        html: `<p><strong>User:</strong> ${name} (${email})</p>
               <p><strong>Plan:</strong> ${plan}</p>
               <p><strong>Retry:</strong> ${retryAttempt} of ${maxRetries}${isLastAttempt ? ' — FINAL ATTEMPT, entering grace period' : ''}</p>
               ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ''}`,
      });
    } catch (adminEmailError) {
      console.error('Failed to send admin payment alert:', adminEmailError);
    }
  }

  try {
    await resend.emails.send({
      from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
      to: email,
      subject: `So-UnFiltered AI — ${subject}`,
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
                <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#F0EDE8;margin:0 0 4px;line-height:1.2;">Payment failed.</h1>
              </div>

              <div style="background:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;margin-bottom:24px;">
                <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${name},</div>
                <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
                  ${mainMessage}
                </div>

                <div style="text-align:center;margin:28px 0;">
                  <a href="${process.env.NEXTAUTH_URL}/settings" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E!important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Update Payment Method</a>
                </div>

                <div style="height:1px;background:rgba(255,255,255,0.06);margin:24px 0;"></div>

                ${urgencyNote}
              </div>

              ${EMAIL_FOOTER.replace('{{FOOTER_TEXT}}', 'Questions? Hit us at <a href="mailto:sounfilteredai@gmail.com" style="color:#8A8690;text-decoration:none;">sounfilteredai@gmail.com</a>')}
            </div>
          </body>
        </html>
      `,
    });

    if (userId) trackServerEvent(userId, EVENTS.EMAIL_SENT, { email_type: 'payment_failed', retry_attempt: retryAttempt });
    return { success: true };
  } catch (error) {
    console.error('Failed to send payment failed email:', error);
    return { success: false, error };
  }
}

export async function sendAbandonedPaymentEmail(
  email: string,
  name: string,
  plan: string,
  userId?: string
) {
  try {
    await resend.emails.send({
      from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
      to: email,
      subject: `So-UnFiltered AI — You were so close to upgrading!`,
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
                <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#F0EDE8;margin:0 0 4px;line-height:1.2;">You were so close.</h1>
              </div>

              <div style="background:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;margin-bottom:24px;">
                <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${name},</div>
                <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
                  You started upgrading to the <strong style="color:#E8A04C;">${plan} plan</strong> but didn&apos;t finish. No worries &mdash; your upgrade is still waiting for you.
                </div>

                <div style="background:#0C0C0E;border:1px solid rgba(232,160,76,0.15);border-radius:14px;padding:24px;text-align:center;margin:24px 0;">
                  <div style="font-size:14px;color:#8A8690;line-height:1.6;">
                    With <strong style="color:#F0EDE8;">${plan}</strong> you get:<br>
                    <span style="color:#E8A04C;">${plan === 'Plus' ? '300' : '100'} messages/day</span> instead of 5
                  </div>
                </div>

                <div style="text-align:center;margin:28px 0;">
                  <a href="${process.env.NEXTAUTH_URL}/settings" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E!important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Complete Your Upgrade</a>
                </div>

                <div style="font-size:12px;color:#5A5660;text-align:center;margin-top:16px;">
                  Having trouble paying? Reply to this email and we&apos;ll help.
                </div>
              </div>

              ${EMAIL_FOOTER.replace('{{FOOTER_TEXT}}', 'You&apos;re receiving this because you started an upgrade on So-UnFiltered AI.')}
            </div>
          </body>
        </html>
      `,
    });

    if (userId) trackServerEvent(userId, EVENTS.EMAIL_SENT, { email_type: 'abandoned_payment', plan });
    return { success: true };
  } catch (error) {
    console.error('Failed to send abandoned payment email:', error);
    return { success: false, error };
  }
}

export async function sendWelcomeEmail(
  email: string,
  name: string,
  userId?: string
) {
  try {
    await resend.emails.send({
      from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
      to: email,
      subject: "You're in. Let's go.",
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
                <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#F0EDE8;margin:0 0 4px;line-height:1.2;">Welcome to the unfiltered side.</h1>
              </div>

              <div style="background:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;margin-bottom:24px;">
                <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${name},</div>
                <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
                  You&apos;re verified and ready to go. No corporate AI speak. No &quot;I can&apos;t help with that.&quot; Just straight answers.
                </div>

                <div style="background:#0C0C0E;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:20px;margin:0 0 24px;">
                  <div style="font-size:11px;color:#5A5660;margin-bottom:12px;letter-spacing:0.05em;text-transform:uppercase;">Not sure where to start? Try one of these:</div>
                  ${[
                    'Am I overthinking this?',
                    'Give me the honest truth about [my situation].',
                    'What would you do if you were me?',
                  ].map(p => `
                  <div style="padding:10px 14px;border-radius:10px;background:#141416;border:1px solid rgba(255,255,255,0.06);font-size:13px;color:#8A8690;margin-bottom:8px;font-style:italic;">
                    &ldquo;${p}&rdquo;
                  </div>`).join('')}
                </div>

                <div style="font-size:13px;color:#5A5660;margin-bottom:24px;">
                  You&apos;re on the <strong style="color:#F0EDE8;">Free plan</strong> — 5 messages per day. Upgrade anytime if you need more.
                </div>

                <div style="text-align:center;">
                  <a href="${process.env.NEXTAUTH_URL}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E!important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Start Your First Chat</a>
                </div>
              </div>

              ${EMAIL_FOOTER.replace('{{FOOTER_TEXT}}', 'Questions? Hit us at <a href="mailto:support@so-unfiltered-ai.com" style="color:#8A8690;text-decoration:none;">support@so-unfiltered-ai.com</a>')}
            </div>
          </body>
        </html>
      `,
    });

    if (userId) trackServerEvent(userId, EVENTS.EMAIL_SENT, { email_type: 'welcome' });
    return { success: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error };
  }
}

export async function sendUpgradeNudgeEmail(
  email: string,
  name: string,
  totalMessages: number,
  userId?: string
) {
  try {
    await resend.emails.send({
      from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
      to: email,
      subject: "You keep coming back. We noticed.",
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
                <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#F0EDE8;margin:0 0 4px;line-height:1.2;">5 a day isn&apos;t enough for you.</h1>
              </div>

              <div style="background:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;margin-bottom:24px;">
                <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${name},</div>
                <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
                  You&apos;ve sent <strong style="color:#F0EDE8;">${totalMessages} messages</strong> this week on the Free plan. That&apos;s a 5-per-day cap — and you keep hitting it and coming back.
                  <br><br>
                  That tells us you&apos;re actually using this. So here&apos;s the deal:
                </div>

                <div style="background:#0C0C0E;border:1px solid rgba(232,160,76,0.2);border-radius:14px;padding:24px;margin:0 0 24px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <div style="text-align:center;flex:1;">
                      <div style="font-size:11px;color:#5A5660;margin-bottom:4px;letter-spacing:0.05em;text-transform:uppercase;">Free</div>
                      <div style="font-size:28px;font-weight:800;color:#5A5660;">5</div>
                      <div style="font-size:11px;color:#5A5660;">msgs/day</div>
                    </div>
                    <div style="font-size:20px;color:#3A3640;">→</div>
                    <div style="text-align:center;flex:1;">
                      <div style="font-size:11px;color:#E8A04C;margin-bottom:4px;letter-spacing:0.05em;text-transform:uppercase;">Pro</div>
                      <div style="font-size:28px;font-weight:800;background:linear-gradient(135deg,#E8A04C,#E8624C);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">100</div>
                      <div style="font-size:11px;color:#8A8690;">msgs/day &mdash; $4.99/mo</div>
                    </div>
                  </div>
                  <div style="height:1px;background:rgba(255,255,255,0.06);margin:16px 0;"></div>
                  <div style="font-size:12px;color:#5A5660;text-align:center;">That&apos;s 20&times; more room. Same unfiltered answers.</div>
                </div>

                <div style="text-align:center;">
                  <a href="${process.env.NEXTAUTH_URL}/settings" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E!important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Upgrade to Pro</a>
                </div>
              </div>

              ${EMAIL_FOOTER.replace('{{FOOTER_TEXT}}', 'You&apos;re receiving this because you&apos;ve been active on So-UnFiltered AI.')}
            </div>
          </body>
        </html>
      `,
    });

    if (userId) trackServerEvent(userId, EVENTS.EMAIL_SENT, { email_type: 'upgrade_nudge' });
    return { success: true };
  } catch (error) {
    console.error('Failed to send upgrade nudge email:', error);
    return { success: false, error };
  }
}

export async function sendCheckInEmail(
  email: string,
  name: string,
  userId?: string
) {
  try {
    await resend.emails.send({
      from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
      to: email,
      subject: "Hey — you still around?",
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
                <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#F0EDE8;margin:0 0 4px;line-height:1.2;">It&apos;s been a week.</h1>
              </div>

              <div style="background:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;margin-bottom:24px;">
                <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${name},</div>
                <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
                  You signed up a week ago and never said a word. No judgment — maybe the timing wasn&apos;t right, or you just weren&apos;t sure where to start.
                  <br><br>
                  But if now&apos;s a better time: we&apos;re still here. Same as always — no filter, no fluff.
                </div>

                <div style="background:#0C0C0E;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:20px;margin:0 0 24px;">
                  <div style="font-size:13px;color:#8A8690;line-height:1.6;text-align:center;">
                    You still have <strong style="color:#E8A04C;">5 free messages</strong> waiting every day.<br>
                    <span style="font-size:12px;color:#5A5660;">They reset at midnight. Use them whenever you&apos;re ready.</span>
                  </div>
                </div>

                <div style="text-align:center;">
                  <a href="${process.env.NEXTAUTH_URL}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E!important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">Come Back</a>
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

    if (userId) trackServerEvent(userId, EVENTS.EMAIL_SENT, { email_type: 'check_in' });
    return { success: true };
  } catch (error) {
    console.error('Failed to send check-in email:', error);
    return { success: false, error };
  }
}

export async function sendDiscountEmail(
  email: string,
  name: string,
  totalMessages: number,
  emailNumber: 1 | 2 | 3,
  userId?: string
) {
  const subjects = {
    1: 'we noticed you keep hitting your limit 👀',
    2: '3 days left on the most unhinged deal we\'ve ever run',
    3: 'tonight it\'s gone. for real.',
  };

  const preheaders = {
    1: 'here\'s 45% off to fix that — but not for long',
    2: '45% off expires June 10th. just saying.',
    3: 'last chance — code A1NDG1MQ expires tonight',
  };

  const bodies = {
    1: `
      <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${name},</div>
      <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
        You&apos;ve sent <strong style="color:#F0EDE8;">${totalMessages} messages</strong> on So-UnFiltered AI &mdash;
        and you keep running into that 5-per-day limit.
        <br><br>
        So instead of watching you get cut off mid-conversation, we&apos;re making you an offer
        that honestly shouldn&apos;t be this good.
      </div>

      <div style="background:#0C0C0E;border:1px solid rgba(232,160,76,0.25);border-radius:14px;padding:28px;text-align:center;margin:0 0 24px;">
        <div style="font-size:11px;color:#E8A04C;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;font-weight:600;">Limited Offer &mdash; Ends June 10th</div>
        <div style="font-size:52px;font-weight:800;background:linear-gradient(135deg,#E8A04C,#E8624C);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;letter-spacing:-0.04em;">45% OFF</div>
        <div style="font-size:14px;color:#8A8690;margin-top:8px;">every plan. no catch.</div>
        <div style="margin:20px 0;padding:14px 20px;background:#141416;border-radius:10px;border:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:11px;color:#5A5660;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Your discount code</div>
          <div style="font-family:'JetBrains Mono','SF Mono',Courier,monospace;font-size:22px;font-weight:700;color:#E8A04C;letter-spacing:0.12em;">A1NDG1MQ</div>
        </div>
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

      <div style="font-size:13px;color:#5A5660;text-align:center;margin-bottom:24px;">
        This deal expires <strong style="color:#F0EDE8;">June 10th</strong> and we&apos;re not bringing it back.
      </div>`,

    2: `
      <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${name},</div>
      <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
        Still hitting that limit every day?<br><br>
        Your 45% off is still waiting &mdash; but <strong style="color:#F0EDE8;">June 10th is in 3 days</strong> and after that this deal is gone.
      </div>

      <div style="background:#0C0C0E;border:1px solid rgba(232,160,76,0.25);border-radius:14px;padding:28px;margin:0 0 24px;">
        <div style="font-size:11px;color:#E8A04C;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px;font-weight:600;text-align:center;">What you&apos;re unlocking</div>
        <table style="width:100%;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#8A8690;vertical-align:top;">
              <span style="color:#E8A04C;font-weight:700;margin-right:10px;">&#10003;</span>
              <strong style="color:#F0EDE8;">Pro &mdash; 100 msgs/day</strong> &mdash; 20x more than Free
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#8A8690;vertical-align:top;">
              <span style="color:#E8A04C;font-weight:700;margin-right:10px;">&#10003;</span>
              <strong style="color:#F0EDE8;">Plus &mdash; 300 msgs/day</strong> &mdash; basically unlimited
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#8A8690;vertical-align:top;">
              <span style="color:#E8A04C;font-weight:700;margin-right:10px;">&#10003;</span>
              No interruptions. No daily walls. Just unfiltered conversations.
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

    3: `
      <div style="font-size:15px;color:#F0EDE8;margin-bottom:8px;font-weight:600;">Hey ${name},</div>
      <div style="font-size:14px;color:#8A8690;margin-bottom:24px;line-height:1.6;">
        Today&apos;s the last day. The 45% off expires <strong style="color:#F0EDE8;">tonight at midnight</strong> and we mean it &mdash; no extensions, no exceptions.
      </div>

      <div style="background:#0C0C0E;border:1px solid rgba(232,98,76,0.3);border-radius:14px;padding:28px;text-align:center;margin:0 0 24px;">
        <div style="font-size:11px;color:#E8624C;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;font-weight:600;">⏰ Expires Tonight</div>
        <div style="font-family:'JetBrains Mono','SF Mono',Courier,monospace;font-size:28px;font-weight:700;color:#E8A04C;letter-spacing:0.12em;margin-bottom:8px;">A1NDG1MQ</div>
        <div style="font-size:14px;color:#8A8690;">45% off any plan</div>
        <div style="height:1px;background:rgba(255,255,255,0.06);margin:20px 0;"></div>
        <div style="font-size:14px;color:#8A8690;line-height:1.6;">
          You&apos;ve sent <strong style="color:#F0EDE8;">${totalMessages} messages</strong> on the free plan.<br>
          You clearly like it here. Stop letting a 5-message limit get in the way.
        </div>
      </div>

      <div style="font-size:13px;color:#5A5660;text-align:center;margin-bottom:24px;">
        That&apos;s it. That&apos;s the email.
      </div>`,
  };

  const ctaLabels = {
    1: 'Claim 45% Off — Code A1NDG1MQ',
    2: 'Use Code A1NDG1MQ Before It\'s Gone',
    3: 'Claim 45% Off Before Midnight',
  };

  try {
    await resend.emails.send({
      from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
      to: email,
      subject: subjects[emailNumber],
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;margin:0;padding:0;background:#0C0C0E;color:#F0EDE8;">
            <!-- preheader -->
            <span style="display:none;max-height:0;overflow:hidden;">${preheaders[emailNumber]}</span>
            <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
              ${EMAIL_HEADER}
                <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.04em;color:#F0EDE8;margin:0 0 4px;line-height:1.2;">${emailNumber === 1 ? 'Here&apos;s a deal that shouldn&apos;t exist.' : emailNumber === 2 ? '3 days. Then it&apos;s gone.' : 'Last chance.'}</h1>
              </div>

              <div style="background:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;margin-bottom:24px;">
                ${bodies[emailNumber]}

                <div style="text-align:center;margin-top:8px;">
                  <a href="https://app.so-unfiltered-ai.com?upgrade=true" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#E8A04C,#E8624C);color:#0C0C0E!important;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;letter-spacing:-0.01em;">${ctaLabels[emailNumber]}</a>
                </div>

                ${emailNumber === 1 ? '<div style="font-size:12px;color:#5A5660;text-align:center;margin-top:16px;">p.s. yes, 45% is absurd. that&apos;s kind of the point.</div>' : ''}
              </div>

              ${EMAIL_FOOTER.replace('{{FOOTER_TEXT}}', 'You&apos;re receiving this because you&apos;ve been active on So-UnFiltered AI. Questions? <a href="mailto:sounfilteredai@gmail.com" style="color:#8A8690;text-decoration:none;">sounfilteredai@gmail.com</a>')}
            </div>
          </body>
        </html>
      `,
    });

    if (userId) trackServerEvent(userId, EVENTS.EMAIL_SENT, { email_type: `discount_email_${emailNumber}` });
    return { success: true };
  } catch (error) {
    console.error(`Failed to send discount email ${emailNumber}:`, error);
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
