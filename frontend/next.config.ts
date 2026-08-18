import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['y-socket.io', 'yjs'],
};

export default nextConfig;
