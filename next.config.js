const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  transpilePackages: ['@supabase/supabase-js'],
  // Scraping runs on GitHub Actions, not Vercel serverless. Keep heavy browser/scraper
  // packages external so the Next build never tries to bundle Chromium into functions.
  serverExternalPackages: [
    'playwright',
    'playwright-extra',
    'patchright',
    'puppeteer-extra-plugin-stealth',
    'bullmq',
    'ioredis',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.copart.com' },
      { protocol: 'https', hostname: 'cs.copart.com' },
      { protocol: 'https', hostname: 'iaai-img-web.azureedge.net' },
      { protocol: 'https', hostname: '*.craigslist.org' },
      { protocol: 'https', hostname: 'i.ebayimg.com' },
      { protocol: 'https', hostname: '*.fbcdn.net' },
      { protocol: 'https', hostname: 'media.ed.edmunds-media.com' },
      { protocol: 'https', hostname: 'vehicle-photos.carmax.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  async redirects() {
    return [
      { source: '/deals', destination: '/find', permanent: false },
      { source: '/scanner', destination: '/scan', permanent: false },
      { source: '/map', destination: '/find', permanent: false },
      { source: '/syndicate', destination: '/list', permanent: false },
      { source: '/watchlist', destination: '/fleet', permanent: false },
    ]
  },
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  transpileClientSDK: true,
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
})
