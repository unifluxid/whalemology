/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: false,
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.stockbit.com',
      },
    ],
  },
};

export default config;
