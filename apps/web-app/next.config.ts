import type { NextConfig } from "next";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";

// `next build` emits a static site to `out/` for Cloudflare Pages, where the
// browser calls the API origin directly (NEXT_PUBLIC_API_BASE_URL). Rewrites
// don't exist in a static export, so the `/api` proxy is dev-only.
const nextConfig: NextConfig =
  process.env.NODE_ENV === "production"
    ? { output: "export" }
    : {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${API_ORIGIN}/api/:path*`,
            },
          ];
        },
      };

export default nextConfig;
