import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship the committed preview fixture (used when TURSO_URL=file:preview.db on
  // Vercel preview deployments) into the serverless trace; without this the
  // file: DB has no file to open at runtime. Harmless when previews use Turso.
  outputFileTracingIncludes: {
    "/*": ["./preview.db"],
  },
};

export default nextConfig;
