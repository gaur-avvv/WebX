import type { NextConfig } from 'next';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import path from 'path';

const nextConfig: NextConfig = {
  // Enable React strict mode for catching issues early
  reactStrictMode: true,

  // Transpile shared monorepo packages
  transpilePackages: ['@zenith/shared-types'],

  // Output standalone for Docker multi-stage builds
  output: 'standalone',

  // Enable experimental features
  experimental: {
    // Server actions are stable in Next 15+
    turbo: {
      // Turbopack-specific config (for `next dev --turbo`)
      resolveAlias: {
        cesium: path.resolve('./node_modules/cesium'),
      },
    },
  },

  // Image domains allowed for next/image
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ion.cesium.com',
      },
    ],
  },

  // Webpack config for CesiumJS
  // CesiumJS requires special handling: it uses AMD modules and
  // needs its static assets (Workers, Assets, Widgets) copied to public/
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // CesiumJS is a heavy client-only library — exclude from server bundle
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]),
        'cesium',
      ];
      return config;
    }

    // Define CESIUM_BASE_URL so CesiumJS can find its static assets
    config.plugins.push(
      new webpack.DefinePlugin({
        CESIUM_BASE_URL: JSON.stringify('/cesium'),
      }),
    );

    // Copy CesiumJS static assets to public/cesium/
    config.plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(
              path.dirname(require.resolve('cesium/package.json')),
              'Build/Cesium/Workers',
            ),
            to: path.join(__dirname, 'public/cesium/Workers'),
          },
          {
            from: path.join(
              path.dirname(require.resolve('cesium/package.json')),
              'Build/Cesium/ThirdParty',
            ),
            to: path.join(__dirname, 'public/cesium/ThirdParty'),
          },
          {
            from: path.join(
              path.dirname(require.resolve('cesium/package.json')),
              'Build/Cesium/Assets',
            ),
            to: path.join(__dirname, 'public/cesium/Assets'),
          },
          {
            from: path.join(
              path.dirname(require.resolve('cesium/package.json')),
              'Build/Cesium/Widgets',
            ),
            to: path.join(__dirname, 'public/cesium/Widgets'),
          },
        ],
      }),
    );

    // Prevent webpack from trying to process CesiumJS workers
    config.module.unknownContextCritical = false;
    config.module.unknownContextRegExp = /\/cesium\/Source\/Core\/buildModuleUrl\.js/;

    return config;
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/app',
        destination: '/',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
