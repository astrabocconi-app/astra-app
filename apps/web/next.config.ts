import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages are shipped as TypeScript source and transpiled by Next.
  transpilePackages: ["@astra/shared", "@astra/db"],
  // Keep server-only packages (Prisma) out of any client bundle — they are
  // required at runtime on the server, never bundled for the browser.
  serverExternalPackages: ["@prisma/client", "@astra/db"],
};

export default nextConfig;
