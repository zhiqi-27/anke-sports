import type { NextConfig } from "next";

const staticExport = process.env.ANKE_SPORTS_STATIC_EXPORT === "true";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(staticExport
    ? { output: "export" as const, distDir: ".next-cloudflare" }
    : {}),
  ...(!staticExport
    ? {
        async rewrites() {
          const backend =
            process.env.ANKE_SPORTS_BACKEND_URL || "http://127.0.0.1:8787";
          return [
            { source: "/api/:path*", destination: `${backend}/api/:path*` },
          ];
        },
      }
    : {}),
};
export default nextConfig;
