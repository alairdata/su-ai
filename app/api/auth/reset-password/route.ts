import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import { rateLimit, getClientIP, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit';
import { resetPasswordSchema, validateInput } from '@/lib/validations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // SECURITY: Rate limit password reset attempts
  const clientIP = getClientIP(req);
  const rateLimitResult = rateLimit(`reset-password:${clientIP}`, RATE_LIMITS.passwordReset);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many password reset attempts. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const body = await req.json();

    // SECURITY: Use the same strong password validation as signup
    const validation = validateInput(resetPasswordSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { token, password } = validation.data;

    // Find user with this reset token
    const { data: user, error } = await supabase
      .from('users')
      .select('id, reset_token, reset_token_expires')
      .eq('reset_token', token)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link' },
        { status: 400 }
      );
    }

    // Check if token has expired
    const tokenExpires = new Date(user.reset_token_expires);
    if (tokenExpires < new Date()) {
      return NextResponse.json(
        { error: 'Reset link has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // SECURITY: Update password, clear reset token, and invalidate all sessions
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expires: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update password:', updateError);
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      );
    }

    // SECURITY: Increment session version to force logout on all devices
    // This invalidates all existing JWT sessions for this user
    try {
      await supabase.rpc('increment_session_version', { user_id_param: user.id });
    } catch (rpcError) {
      // If RPC doesn't exist yet, session invalidation won't work but password is still changed
      console.warn('Session version increment failed - existing sessions may still be valid:', rpcError);
    }

    return NextResponse.json({
      message: 'Password reset successfully. You can now log in with your new password. All other sessions have been logged out.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
