import type { Metadata } from 'next'
import './globals.css'
import { ResponsiveProvider } from '@/components/ui/responsive-design-system'

const geist = 'var(--fn)'

export const metadata: Metadata = {
  title: 'DealerHunt - Vehicle Sourcing Intelligence',
  description: 'Smart vehicle sourcing platform for dealers with real-time market intelligence and profit optimization',
  viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
  themeColor: '#0a0a0c',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DealerHunt',
  },
  openGraph: {
    title: 'DealerHunt - Vehicle Sourcing Intelligence',
    description: 'Smart vehicle sourcing platform for dealers',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full bg-[#0a0a0c]">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0a0a0c" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body style={{ fontFamily: geist }} className="h-full bg-[#07070A] text-[#FAFAFA] antialiased overflow-hidden">
        <ResponsiveProvider>
          {children}
        </ResponsiveProvider>
      </body>
    </html>
  )
}
