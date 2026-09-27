/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@durgapandals/ui", "@durgapandals/maps", "@durgapandals/types"],
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.next/**", "**/.turbo/**", "**/.git/**"],
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
};

export default nextConfig;
