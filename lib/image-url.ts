// Route external listing photos through our proxy so hotlink-protected sources load and get cached.
// Local/already-proxied/data URLs pass through untouched.
export function proxiedImage(url?: string | null): string {
  if (!url) return "";
  if (
    url.startsWith("/") ||
    url.startsWith("data:") ||
    url.includes("/api/image/proxy")
  )
    return url;
  if (!/^https?:\/\//.test(url)) return url;
  return `/api/image/proxy?url=${encodeURIComponent(url)}`;
}
