import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['y-socket.io', 'yjs', 'y-protocols', 'y-prosemirror', 'lib0'],
};

export default nextConfig;
