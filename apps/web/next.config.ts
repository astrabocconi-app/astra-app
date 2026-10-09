import type { NextConfig } from "next";

/**
 * Security headers for every response.
 *
 * The CSP deliberately lists only directives that cannot break the page: there
 * is no default-src/script-src, because Next's inline bootstrap scripts and the
 * analytics tag on the public pages would be blocked by one. What it does buy is
 * the part that matters most for a cookie-authenticated dashboard — nobody can
 * frame it (clickjacking) or point a form/base tag elsewhere.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  // Workspace packages are shipped as TypeScript source and transpiled by Next.
  transpilePackages: ["@astra/shared", "@astra/db"],
  // Keep the Prisma runtime + pg driver out of any bundle — they are required
  // at runtime on the server from node_modules, never bundled for the browser.
  // (@astra/db itself is transpiled above; it must NOT also be listed here.)
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "nodemailer"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Authenticated JSON must never sit in a shared cache. Excluded: the
        // image routes (immutable, public by design) and the few read-only feeds
        // whose handlers set their own short private max-age + ETag.
        source: "/api/:path((?!media/|avatar/|academic/catalogue|news|partners).*)",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
