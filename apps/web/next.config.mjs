import CopyWebpackPlugin from 'copy-webpack-plugin';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  transpilePackages: ['@zenith/shared-types'],

  output: 'standalone',

  experimental: {
    turbo: {
      resolveAlias: {
        cesium: path.resolve('./node_modules/cesium'),
      },
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ion.cesium.com',
      },
    ],
  },

  webpack: (config, { isServer, webpack }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]),
        'cesium',
      ];
      return config;
    }

    config.plugins.push(
      new webpack.DefinePlugin({
        CESIUM_BASE_URL: JSON.stringify('/cesium'),
      }),
    );

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

    config.module.unknownContextCritical = false;
    config.module.unknownContextRegExp = /\/cesium\/Source\/Core\/buildModuleUrl\.js/;

    return config;
  },

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
