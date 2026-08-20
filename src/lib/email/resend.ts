/**
 * Resend client, kept to the two calls this app makes.
 *
 * Written against fetch rather than the SDK so the email channel adds no
 * dependency, and so failures surface as plain values the caller can act on.
 */

const API = 'https://api.resend.com';

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.RESEND_INBOUND_DOMAIN;
}

/** The address a merchant forwards their support inbox to. */
export function inboundAddress(token: string): string {
  return `${token}@${process.env.RESEND_INBOUND_DOMAIN}`;
}

/**
 * Fetch a received email's body.
 *
 * The inbound webhook carries only metadata — no body, headers or attachments —
 * so this second call is required, not an optimisation.
 */
export async function fetchReceivedEmail(id: string): Promise<{
  text: string;
  subject: string;
  from: string;
  to: string[];
} | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(`${API}/emails/receiving/${id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const d = await res.json();

    // Prefer plain text; fall back to stripping the HTML part.
    const text: string = d?.text || stripHtml(d?.html || '');
    return {
      text: text.trim(),
      subject: d?.subject ?? '(no subject)',
      from: extractAddress(d?.from ?? ''),
      to: Array.isArray(d?.to) ? d.to.map(extractAddress) : [extractAddress(d?.to ?? '')],
    };
  } catch {
    return null;
  }
}

/** Send a reply. Returns null on success, or a message describing the failure. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return 'Email is not configured.';

  try {
    const res = await fetch(`${API}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        // Replies should reach the merchant's own inbox, not ours.
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    if (res.ok) return null;
    const d = await res.json().catch(() => ({}));
    return d?.message ?? `Resend returned ${res.status}.`;
  } catch (e: any) {
    return e?.message ?? 'Could not reach the email provider.';
  }
}

/** "Name <a@b.com>" -> "a@b.com" */
function extractAddress(s: string): string {
  const m = /<([^>]+)>/.exec(s);
  return (m ? m[1] : s).trim().toLowerCase();
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Strip quoted history from a reply so the model and the merchant see only the
 * new text. Conservative on purpose: an over-eager cut would hide what the
 * customer actually said.
 */
export function stripQuotedReply(text: string): string {
  const markers = [
    /^On .+ wrote:$/m,
    /^-----Original Message-----$/m,
    /^_{10,}$/m,
    /^From: .+$/m,
  ];
  let cut = text.length;
  for (const re of markers) {
    const m = re.exec(text);
    if (m && m.index < cut) cut = m.index;
  }
  const trimmed = text.slice(0, cut).trim();
  // Keep the original only if stripping consumed everything — that means the
  // marker was the message ("On Monday I wrote…"), not a quote. Short replies
  // are still replies: "Thanks!" above a quoted thread is completely normal.
  return trimmed.length > 0 ? trimmed : text.trim();
}
