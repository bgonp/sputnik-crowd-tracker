import type { NextConfig } from "next";

const isPreview = process.env.VERCEL_ENV === "preview";

const nextConfig: NextConfig = {
  // Only Preview deployments read the committed fixture (TURSO_URL=file:preview.db).
  // Preview: force it into the serverless trace so the file: DB has a file to open.
  // Otherwise: exclude it — db.ts's process.cwd()-rooted fs calls make @vercel/nft
  // auto-bundle the ~2 MB fixture into every function, so an explicit exclude is
  // what actually keeps it out of Production bundles.
  ...(isPreview
    ? { outputFileTracingIncludes: { "/*": ["./preview.db"] } }
    : { outputFileTracingExcludes: { "/*": ["./preview.db"] } }),
};

export default nextConfig;
