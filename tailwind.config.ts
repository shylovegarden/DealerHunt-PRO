import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        graphite: '#0E0F13',
        carbon: '#16181E',
        steel: '#1F2228',
        chrome: '#E8ECF2',
        amber: {
          signal: '#E8961A',
        },
        profit: {
          green: '#00B87A',
        },
        danger: '#E8344A'
      },
      fontFamily: {
        sans: ['var(--font-space-grotesk)', 'sans-serif'],
        mono: ['var(--font-space-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
