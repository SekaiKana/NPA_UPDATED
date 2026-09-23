import { NextResponse } from 'next/server';
import { Resend } from 'resend';

/**
 * Contact enquiries.
 *
 * Replaces the previous form, which had a no-op `onSubmit` and silently threw
 * away everything anyone typed into it.
 *
 * Needs two environment variables:
 *   RESEND_API_KEY   — from resend.com (the free tier covers this volume)
 *   CONTACT_TO       — optional; defaults to the studio address below
 *
 * With no key configured the route returns 503 and a machine-readable reason,
 * and the form falls back to showing the direct email address rather than
 * pretending the message was sent.
 */

const TO = process.env.CONTACT_TO ?? 'sekai.kanamori@npanalytica.com';
/* Resend's shared sender works without domain verification. Swap for an
   address on npanalytica.com once the domain is verified, which also stops
   these landing in spam. */
const FROM = process.env.CONTACT_FROM ?? 'NPA Website <onboarding@resend.dev>';

const MAX = { name: 120, email: 200, company: 160, message: 5000 } as const;

interface Payload {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  message?: unknown;
  /* Honeypot. Real people never fill this in; bots fill in everything. */
  website?: unknown;
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Deliberately permissive — the goal is catching typos, not policing RFC 5322. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function POST(request: Request) {
  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  // Honeypot tripped: accept silently so the bot learns nothing.
  if (str(body.website, 100) !== '') {
    return NextResponse.json({ ok: true });
  }

  const name = str(body.name, MAX.name);
  const email = str(body.email, MAX.email);
  const company = str(body.company, MAX.company);
  const message = str(body.message, MAX.message);

  if (!name || !email || !message || !looksLikeEmail(email)) {
    return NextResponse.json({ ok: false, error: 'validation' }, { status: 422 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[contact] RESEND_API_KEY is not set — enquiry not delivered.');
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 });
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [TO],
      // So hitting reply in the inbox goes to the enquirer, not to Resend.
      replyTo: email,
      subject: `Enquiry — ${name}${company ? ` (${company})` : ''}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        company ? `Company: ${company}` : null,
        '',
        message,
      ]
        .filter(Boolean)
        .join('\n'),
      html: `
        <div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.6">
          <p><strong>Name</strong><br>${escapeHtml(name)}</p>
          <p><strong>Email</strong><br>${escapeHtml(email)}</p>
          ${company ? `<p><strong>Company</strong><br>${escapeHtml(company)}</p>` : ''}
          <p><strong>Message</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
        </div>
      `,
    });

    if (error) {
      console.error('[contact] Resend rejected the message:', error);
      return NextResponse.json({ ok: false, error: 'send_failed' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (cause) {
    console.error('[contact] Unexpected failure:', cause);
    return NextResponse.json({ ok: false, error: 'send_failed' }, { status: 502 });
  }
}
