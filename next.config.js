const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@supabase/supabase-js'],
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
