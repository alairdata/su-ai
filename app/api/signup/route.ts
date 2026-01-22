import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { isDisposableEmail } from '@/lib/disposable-emails';
import { sendVerificationEmail } from '@/lib/email';
import { rateLimit, getClientIP, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  // Rate limiting - 5 signups per hour per IP
  const clientIP = getClientIP(request);
  const rateLimitResult = rateLimit(`signup:${clientIP}`, RATE_LIMITS.signup);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const { name, email: rawEmail, password } = await request.json();

    // Validate inputs
    if (!name || !rawEmail || !password) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Normalize email to lowercase for consistent storage and lookup
    const email = rawEmail.toLowerCase().trim();

    // Block disposable emails
    if (isDisposableEmail(email)) {
      return NextResponse.json(
        { error: 'Disposable email addresses are not allowed. Please use a real email address.' },
        { status: 400 }
      );
    }

    // Check if email already exists in users table (verified users)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered and verified' },
        { status: 400 }
      );
    }

    // Check if email already in pending_users
    const { data: pendingUser } = await supabase
      .from('pending_users')
      .select('id')
      .eq('email', email)
      .single();

    if (pendingUser) {
      // Delete old pending user and create new one (resend verification)
      await supabase
        .from('pending_users')
        .delete()
        .eq('email', email);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 24); // 24 hour expiry

    // Save to PENDING users (not real users yet!)
    const { data: newPendingUser, error: createError } = await supabase
      .from('pending_users')
      .insert([
        {
          name,
          email,
          password_hash: hashedPassword,
          verification_token: verificationToken,
          verification_token_expires: tokenExpires.toISOString(),
        },
      ])
      .select()
      .single();

    if (createError) {
      console.error('Failed to create pending user:', createError);
      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 500 }
      );
    }

    // Send verification email
    const emailResult = await sendVerificationEmail(email, name, verificationToken);

    if (!emailResult.success) {
      // Delete pending user if email fails
      await supabase
        .from('pending_users')
        .delete()
        .eq('id', newPendingUser.id);

      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Account created! Check your email to verify your account. The link expires in 24 hours.',
      success: true,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}