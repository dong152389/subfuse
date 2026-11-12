import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  transpilePackages: ["@subfuse/core", "@subfuse/server-core", "@subfuse/ui", "@subfuse/config"],
  webpack(config) {
    config.resolve.alias["@"] = path.resolve(process.cwd(), "src");
    config.resolve.alias["@local"] = path.resolve(process.cwd(), "src");
    config.resolve.modules = [
      path.resolve(process.cwd(), "node_modules"),
      ...(config.resolve.modules || []),
    ];
    return config;
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    const staticAssetCacheHeaders = [
      { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
    ];
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/((?!_next/static|_next/image|icon\\.png|logo\\.png|icons/|favicon\\.ico|api/releases/latest).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/icon.png",
        headers: staticAssetCacheHeaders,
      },
      {
        source: "/logo.png",
        headers: staticAssetCacheHeaders,
      },
      {
        source: "/icons/:path*",
        headers: staticAssetCacheHeaders,
      },
    ];
  },
};

export default nextConfig;
