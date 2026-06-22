/**
 * Generate blur placeholder data URLs for progressive image loading
 */

/**
 * Generate a simple blur placeholder from a color
 */
export function generateBlurDataURL(color: string = "#1a1a1a"): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="30">
      <filter id="blur">
        <feGaussianBlur stdDeviation="2"/>
      </filter>
      <rect width="40" height="30" fill="${color}" filter="url(#blur)"/>
    </svg>
  `;
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Generate a gradient blur placeholder
 */
export function generateGradientBlur(
  color1: string = "#1a1a1a",
  color2: string = "#2a2a2a",
): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="30">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
        </linearGradient>
        <filter id="blur">
          <feGaussianBlur stdDeviation="2"/>
        </filter>
      </defs>
      <rect width="40" height="30" fill="url(#grad)" filter="url(#blur)"/>
    </svg>
  `;
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Default vehicle image placeholder
 */
export const VEHICLE_PLACEHOLDER = generateGradientBlur("#1e293b", "#334155");

/**
 * Shimmer effect placeholder
 */
export function generateShimmerPlaceholder(): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
      <defs>
        <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1">
            <animate attributeName="offset" values="-2;1" dur="2s" repeatCount="indefinite"/>
          </stop>
          <stop offset="50%" style="stop-color:#2a2a2a;stop-opacity:1">
            <animate attributeName="offset" values="-1;2" dur="2s" repeatCount="indefinite"/>
          </stop>
          <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1">
            <animate attributeName="offset" values="0;3" dur="2s" repeatCount="indefinite"/>
          </stop>
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#shimmer)"/>
    </svg>
  `;
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
