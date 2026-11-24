import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: root,
  turbopack: { root },
  // Promptbestanden worden op de server gelezen; zorg dat ze in de serverbundel meegaan.
  outputFileTracingIncludes: { "/**": ["./prompts/**"] },
};

export default nextConfig;
