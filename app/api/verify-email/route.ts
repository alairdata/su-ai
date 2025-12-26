import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
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

    // Move user from pending_users to users table
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([
        {
          name: pendingUser.name,
          email: pendingUser.email,
          password_hash: pendingUser.password_hash,
          plan: 'Free',
          messages_used_today: 0,
          email_verified: true, // Already verified!
        },
      ])
      .select()
      .single();

    if (createError) {
      console.error('Failed to create verified user:', createError);
      return NextResponse.redirect(new URL('/?error=verification-failed', request.url));
    }

    // Delete from pending_users
    await supabase
      .from('pending_users')
      .delete()
      .eq('id', pendingUser.id);

    // Redirect to login with success message
    return NextResponse.redirect(new URL('/?verified=true', request.url));
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.redirect(new URL('/?error=verification-failed', request.url));
  }
}