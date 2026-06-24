export const dynamic = "force-dynamic";

// GET /api/image/proxy?url=... — fetch a listing photo server-side with browser-like headers so
// hotlink-protected sources (Craigslist, Copart, IAA CDNs) load, cache it at the edge, and fall back
// to a clean placeholder on any failure. $0 — no storage needed for the on-demand path.

const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" fill="none"><rect width="400" height="240" fill="#1b1722"/><path d="M80 158h240v30H80zM104 158l24-46h144l24 46" stroke="#3a3346" stroke-width="2" fill="none"/><circle cx="132" cy="190" r="16" stroke="#3a3346" stroke-width="2"/><circle cx="268" cy="190" r="16" stroke="#3a3346" stroke-width="2"/><text x="200" y="120" text-anchor="middle" fill="#6b6276" font-size="12" font-family="system-ui">No photo</text></svg>`;

function placeholder() {
  return new Response(PLACEHOLDER, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get("url");
  if (!target || !/^https?:\/\//.test(target)) return placeholder();

  let origin = "";
  try {
    origin = new URL(target).origin;
    const hostname = new URL(target).hostname;
    const ALLOWED_DOMAINS = [
      "images.craigslist.org",
      "photos.drive2.ru",
      "images.autotrader.com",
      "photos.dealer.com",
      "i.ebayimg.com",
    ];
    const allowed = ALLOWED_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith("." + d),
    );
    if (!allowed && !hostname.includes("craigslist")) {
      return placeholder();
    }
  } catch {
    return placeholder();
  }

  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Referer: origin,
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return placeholder();
    const type = res.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return placeholder();
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return placeholder();
  }
}
