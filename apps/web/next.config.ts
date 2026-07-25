import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages are shipped as TypeScript source and transpiled by Next.
  transpilePackages: ["@astra/shared", "@astra/db"],
  // Keep the Prisma runtime + pg driver out of any bundle — they are required
  // at runtime on the server from node_modules, never bundled for the browser.
  // (@astra/db itself is transpiled above; it must NOT also be listed here.)
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "nodemailer"],
};

export default nextConfig;
