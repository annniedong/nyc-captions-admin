import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Runs Tailwind over CSS files. Without this rule the stylesheet is empty.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
