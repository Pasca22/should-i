import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Hide the "N" route indicator over the map in development; build and runtime errors still show.
  devIndicators: false,
  // "/" has no page of its own. Redirecting here (before Proxy and rendering) rather than calling redirect()
  // in a page keeps it out of prerendering, which can't produce a shell for a page that only redirects.
  async redirects() {
    return [{ source: "/", destination: "/run", permanent: false }];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
