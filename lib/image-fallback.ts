/**
 * Intelligent image fallback system
 * Handles failed images with smart retry and caching
 */

const failedUrls = new Set<string>();
const retryCount = new Map<string, number>();
const MAX_RETRIES = 2;

/**
 * Check if URL has failed before
 */
export function hasImageFailed(url: string): boolean {
  return failedUrls.has(url);
}

/**
 * Mark URL as failed
 */
export function markImageFailed(url: string) {
  const count = (retryCount.get(url) || 0) + 1;
  retryCount.set(url, count);

  if (count >= MAX_RETRIES) {
    failedUrls.add(url);
    retryCount.delete(url);
  }
}

/**
 * Clear failed status for URL
 */
export function clearImageFailed(url: string) {
  failedUrls.delete(url);
  retryCount.delete(url);
}

/**
 * Get fallback image for vehicle
 */
export function getVehicleFallback(source?: string): string {
  // Return a data URL SVG placeholder
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e293b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#334155;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#grad)"/>
      <g transform="translate(400, 300)">
        <path d="M-60-30 L-40-30 L-30-20 L30-20 L40-30 L60-30 L60 30 L-60 30 Z" 
              fill="none" stroke="#64748b" stroke-width="3" opacity="0.3"/>
        <circle cx="-35" cy="25" r="12" fill="none" stroke="#64748b" stroke-width="3" opacity="0.3"/>
        <circle cx="35" cy="25" r="12" fill="none" stroke="#64748b" stroke-width="3" opacity="0.3"/>
        <text x="0" y="70" font-family="Arial, sans-serif" font-size="14" 
              fill="#64748b" text-anchor="middle" opacity="0.5">
          ${source ? source.toUpperCase() : "NO IMAGE"}
        </text>
      </g>
    </svg>
  `;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Try multiple image sources with fallback
 */
export async function tryImageSources(urls: string[]): Promise<string> {
  for (const url of urls) {
    if (hasImageFailed(url)) continue;

    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) {
        return url;
      }
      markImageFailed(url);
    } catch {
      markImageFailed(url);
    }
  }

  return getVehicleFallback();
}

/**
 * Preload image and return promise
 */
export function preloadImage(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (hasImageFailed(src)) {
      reject(new Error("Image previously failed"));
      return;
    }

    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => {
      markImageFailed(src);
      reject(new Error("Image failed to load"));
    };
    img.src = src;
  });
}

/**
 * Get optimized image URL (proxy through Next.js if needed)
 */
export function getOptimizedImageUrl(url: string, width?: number): string {
  if (!url) return getVehicleFallback();

  // If already a data URL or relative path, return as-is
  if (url.startsWith("data:") || url.startsWith("/")) {
    return url;
  }

  // For external URLs, use Next.js image optimization
  // This will be handled by the Image component automatically
  return url;
}
