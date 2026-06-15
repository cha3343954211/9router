import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const isCloudflareBuild = process.env.NEXT_DEPLOY_TARGET === "cloudflare" || process.env.CF_PAGES === "1";
// CLI bundling needs workspace root so tracing includes hoisted node_modules (slim ~50MB).
// Docker / default uses projectRoot so server.js lands at /app/server.js (not nested).
const tracingRoot = process.env.NEXT_TRACING_ROOT_MODE === "workspace"
  ? join(projectRoot, "..")
  : projectRoot;
const proxyClientMaxBodySize = process.env.NINEROUTER_PROXY_CLIENT_MAX_BODY_SIZE || "128mb";

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  ...(isCloudflareBuild ? {} : { output: "standalone" }),
  serverExternalPackages: ["better-sqlite3", "sql.js", "node:sqlite", "bun:sqlite"],
  turbopack: {
    root: tracingRoot
  },
  outputFileTracingRoot: tracingRoot,
  outputFileTracingExcludes: {
    "*": ["./gitbook/**/*"]
  },
  images: {
    unoptimized: true
  },
  env: {},
  experimental: {
    // #1529/#1572: LLM clients can send long context or base64 image payloads through /v1 rewrites.
    proxyClientMaxBodySize,
  },
  webpack: (config, { isServer }) => {
    if (isCloudflareBuild) {
      const unavailableDbAdapter = resolve(projectRoot, "src/lib/db/adapters/unavailableAdapter.js");
      config.resolve.alias = {
        ...config.resolve.alias,
        [resolve(projectRoot, "src/dashboardGuard.js")]: resolve(projectRoot, "src/dashboardGuard.cloudflare.js"),
        [resolve(projectRoot, "src/lib/db/adapters/bunSqliteAdapter.js")]: unavailableDbAdapter,
        [resolve(projectRoot, "src/lib/db/adapters/betterSqliteAdapter.js")]: unavailableDbAdapter,
        [resolve(projectRoot, "src/lib/db/adapters/nodeSqliteAdapter.js")]: unavailableDbAdapter,
      };
    }

    // Ignore fs/path modules in browser bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    // Exclude logs, .next, gitbook subapp from watcher
    config.watchOptions = { ...config.watchOptions, ignored: /[\\/](logs|\.next|gitbook|cli)[\\/]/ };
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/v1/v1/:path*",
        destination: "/api/v1/:path*"
      },
      {
        source: "/v1/v1",
        destination: "/api/v1"
      },
      {
        source: "/codex/:path*",
        destination: "/api/v1/responses"
      },
      {
        source: "/v1/:path*",
        destination: "/api/v1/:path*"
      },
      {
        source: "/v1",
        destination: "/api/v1"
      }
    ];
  }
};

export default nextConfig;
