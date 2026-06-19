/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  transpilePackages: ['@supabase/supabase-js'],
}

module.exports = nextConfig
