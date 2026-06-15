const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build"
  || process.env.NEXT_PHASE === "phase-export"
  || process.env.NEXT_PHASE === "phase-static";
const isCloudflareRuntime = process.env.NEXT_DEPLOY_TARGET === "cloudflare" || process.env.CF_PAGES === "1";

// Server-only singleton: guard via global so HMR / re-imports don't double-init.
// Cloudflare Workers must not import the local desktop bootstrap graph.
if (typeof window === "undefined" && !isBuildPhase && !isCloudflareRuntime && !global.__appBootstrapped) {
  global.__appBootstrapped = true;
  import("./initializeApp.js")
    .then(({ default: initializeApp }) => initializeApp())
    .catch((e) => console.error("[Bootstrap] init failed:", e.message));
}
