import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  // SECURITY: Rate limit verification attempts to prevent brute force
  const clientIP = getClientIP(request);
  const rateLimitResult = rateLimit(`verify-email:${clientIP}`, { limit: 10, windowSeconds: 60 * 15 }); // 10 per 15 min

  if (!rateLimitResult.success) {
    return NextResponse.redirect(new URL('/?error=too-many-attempts', request.url));
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/?error=invalid-token', request.url));
  }

  try {
    // Find pending user with this token
    const { data: pendingUser, error } = await supabase
      .from('pending_users')
      .select('*')
      .eq('verification_token', token)
      .single();

    if (error || !pendingUser) {
      return NextResponse.redirect(new URL('/?error=invalid-token', request.url));
    }

    // Check if token expired
    if (new Date(pendingUser.verification_token_expires) < new Date()) {
      // Delete expired pending user
      await supabase
        .from('pending_users')
        .delete()
        .eq('id', pendingUser.id);

      return NextResponse.redirect(new URL('/?error=token-expired', request.url));
    }

    // SECURITY: Delete from pending_users FIRST to prevent race condition/token reuse
    // This ensures the token can only be used once even with concurrent requests
    const { data: deletedUser, error: deleteError } = await supabase
      .from('pending_users')
      .delete()
      .eq('id', pendingUser.id)
      .eq('verification_token', token) // Double-check token matches
      .select()
      .single();

    // If deletion failed or returned no data, token was already used (race condition)
    if (deleteError || !deletedUser) {
      console.log('Token already used or race condition detected:', token);
      return NextResponse.redirect(new URL('/?error=token-already-used', request.url));
    }

    // Now create user - token is consumed, safe from race condition
    const { error: createError } = await supabase
      .from('users')
      .insert([
        {
          name: deletedUser.name,
          original_name: deletedUser.name, // Store original name at signup
          email: deletedUser.email,
          password_hash: deletedUser.password_hash,
          plan: 'Free',
          messages_used_today: 0,
          email_verified: true, // Already verified!
        },
      ])
      .select()
      .single();

    if (createError) {
      console.error('Failed to create verified user:', createError);
      // Re-insert pending user since we deleted it but couldn't create the user
      try {
        await supabase.from('pending_users').insert([deletedUser]);
      } catch (reinsertError) {
        console.error('Failed to re-insert pending user:', reinsertError);
      }
      return NextResponse.redirect(new URL('/?error=verification-failed', request.url));
    }

    // User created successfully - pending user already deleted above

    // Redirect to login with success message
    return NextResponse.redirect(new URL('/?verified=true', request.url));
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.redirect(new URL('/?error=verification-failed', request.url));
  }
}