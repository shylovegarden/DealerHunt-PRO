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

module.exports = nextConfig
