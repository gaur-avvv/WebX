import type { Metadata, Viewport } from 'next';
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google';

import './globals.css';
import { Providers } from './providers';
import { StarsBackground } from '@/components/ui/stars-background';

// ─── Google Fonts ───────────────────────────────────────────────────────────

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

// ─── Metadata ───────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    default: 'Project Zenith — The Celestial Eye',
    template: '%s | Project Zenith',
  },
  description:
    'Real-time cosmic radar platform. Track the ISS, satellites, and planetary bodies live on an interactive 3D globe.',
  keywords: [
    'satellite tracking', 'ISS tracker', 'real-time orbit', 'space visualization',
    'CesiumJS globe', 'NASA Horizons', 'TLE propagation', 'SGP4', 'planetary ephemeris',
  ],
  authors: [{ name: 'Project Zenith Team' }],
  creator: 'Project Zenith',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://zenith.example.com',
    title: 'Project Zenith — The Celestial Eye',
    description: 'Real-time cosmic radar: track satellites and planets on a live 3D globe.',
    siteName: 'Project Zenith',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Project Zenith — The Celestial Eye',
    description: 'Real-time cosmic radar: track satellites and planets on a live 3D globe.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export const viewport: Viewport = {
  themeColor: '#03040a',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

// ─── Root Layout ─────────────────────────────────────────────────────────────

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        {/* Preload Cesium base URL for faster globe load */}
        <link rel="preconnect" href="https://ion.cesium.com" />
        <link rel="dns-prefetch" href="https://ion.cesium.com" />
      </head>
      <body className="antialiased">
        <StarsBackground>
          <Providers>{children}</Providers>
        </StarsBackground>
      </body>
    </html>
  );
}
