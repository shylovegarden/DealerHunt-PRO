// Pull seller contact out of listing/dealer text so a dealer can Call / Text / Email from inside the
// app instead of bouncing to the original site. Mirrors extract-options.ts: a pure regex pass over text
// the scraper already has. Stored under options.contact (no new column) and rendered by ContactSeller.
export interface ExtractedContact {
  phone?: string; // normalized to (xxx) xxx-xxxx
  email?: string;
  listingUrl?: string; // the original listing, so "View original ↗" always works
}

// US 10-digit phone, optional country code and common separators/parens. We pull digits then format.
const PHONE_RE =
  /(?:\+?1[-.\s]?)?\(?([2-9]\d{2})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/;
const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;

// Obvious non-seller emails to skip (image/asset hosts, no-reply, the listing platform itself).
const EMAIL_BLOCKLIST =
  /(no-?reply|do-?not-?reply|example\.|sentry|wixpress|@sentry|@.*cloudfront|@.*amazonaws)/i;

export function extractContact(
  text?: string | null,
  sourceUrl?: string | null,
): ExtractedContact {
  const out: ExtractedContact = {};
  if (sourceUrl) out.listingUrl = sourceUrl;
  if (!text) return out;

  const phone = text.match(PHONE_RE);
  if (phone) {
    const area = phone[1];
    // Reject 555 placeholder/fake exchange numbers (555-01xx) commonly seen in templates.
    if (!/^555/.test(`${phone[2]}`) || phone[3] >= "0200") {
      out.phone = `(${area}) ${phone[2]}-${phone[3]}`;
    }
  }

  const email = text.match(EMAIL_RE);
  if (email && !EMAIL_BLOCKLIST.test(email[0])) {
    out.email = email[0].toLowerCase();
  }

  return out;
}

/** True when there's at least one actionable channel beyond the original-listing link. */
export function hasContact(c?: ExtractedContact | null): boolean {
  return !!(c && (c.phone || c.email));
}
