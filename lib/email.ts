import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(
  email: string, 
  name: string, 
  token: string
) {
  const verificationUrl = `${process.env.NEXTAUTH_URL}/api/verify-email?token=${token}`;
  
  try {
    await resend.emails.send({
      from: 'UnFiltered-AI <noreply@app.so-unfiltered-ai.com>', // YOUR VERIFIED DOMAIN!
      to: email,
      subject: 'Verify your UnFiltered-AI account',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: 'Inter', -apple-system, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .logo { width: 64px; height: 64px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; margin: 0 auto 20px; }
              .title { font-size: 24px; font-weight: 700; color: #000; margin-bottom: 10px; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
              .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
              .footer { text-align: center; font-size: 12px; color: #999; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo"></div>
                <h1 class="title">Welcome to UnFiltered-AI!</h1>
              </div>
              
              <div class="content">
                <p>Hey ${name},</p>
                <p>Thanks for signing up! Click the button below to verify your email and activate your account.</p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${verificationUrl}" class="button">Verify Email</a>
                </p>
                <p style="font-size: 13px; color: #666;">
                  Or copy and paste this link: <br>
                  <a href="${verificationUrl}" style="color: #667eea;">${verificationUrl}</a>
                </p>
                <p style="font-size: 13px; color: #999; margin-top: 20px;">
                  This link expires in 24 hours.
                </p>
              </div>
              
              <div class="footer">
                <p>If you didn't create an account, you can safely ignore this email.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return { success: false, error };
  }
}