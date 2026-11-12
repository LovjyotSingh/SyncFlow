import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Uploaded files live on Vercel Blob; browsers upload straight to it with a short-lived token.
const BLOB = "https://*.public.blob.vercel-storage.com";
const BLOB_UPLOAD = "https://vercel.com https://*.blob.vercel-storage.com";

const csp = [
  "default-src 'self'",
  // Next.js needs inline scripts for hydration; eval only in development (React Refresh).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${BLOB}`,
  "font-src 'self' data:",
  `connect-src 'self' ${BLOB_UPLOAD}${isDev ? " ws: wss:" : ""}`,
  `media-src 'self' blob: ${BLOB}`,
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // PGlite ships WASM and data files; keep it out of the server bundle and load it from node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Account and API responses are private to one user.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
