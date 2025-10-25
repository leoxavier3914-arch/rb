/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    serverActions: {
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') ?? []
    }
  }
};

export default nextConfig;
