import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/mobile-auth';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message } = await req.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    await resend.emails.send({
      from: 'So-UnFiltered AI <support@so-unfiltered-ai.com>',
      to: 'sounfilteredai@gmail.com',
      subject: `Support request from ${session.user.email}`,
      html: `
        <p><strong>From:</strong> ${session.user.name} (${session.user.email})</p>
        <p><strong>Plan:</strong> ${(session.user as { plan?: string }).plan || 'Free'}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-wrap;">${message.trim()}</p>
      `,
      replyTo: session.user.email ?? undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Support email error:', error);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
