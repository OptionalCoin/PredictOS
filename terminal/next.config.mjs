/** @type {import('next').NextConfig} */
const nextConfig = {
  // Externalize ws and its native dependencies to prevent webpack bundling issues
  // This fixes "bufferUtil.mask is not a function" error when using ws in API routes
  experimental: {
    serverComponentsExternalPackages: ['ws', 'bufferutil', 'utf-8-validate'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark ws and its native dependencies as external
      config.externals = config.externals || [];
      config.externals.push({
        'bufferutil': 'commonjs bufferutil',
        'utf-8-validate': 'commonjs utf-8-validate',
      });
    }
    return config;
  },
};

export default nextConfig;

