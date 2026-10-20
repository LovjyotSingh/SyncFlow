import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM and data files; keep it out of the server bundle and load it from node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
