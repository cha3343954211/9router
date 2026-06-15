import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const [, , command, ...args] = process.argv;

if (!command) {
  console.error("Usage: node scripts/next-build-env.mjs <command> [...args]");
  process.exit(1);
}

const homeDir = resolve(process.cwd(), ".next-build-home");
const appDataDir = join(homeDir, "AppData", "Roaming");
const localAppDataDir = join(homeDir, "AppData", "Local");

mkdirSync(appDataDir, { recursive: true });
mkdirSync(localAppDataDir, { recursive: true });

const isCloudflareBuild = process.env.NEXT_DEPLOY_TARGET === "cloudflare" || process.env.CF_PAGES === "1";
const srcDir = resolve(process.cwd(), "src");
const proxyFile = join(srcDir, "proxy.js");
const disabledProxyFile = join(srcDir, "proxy.js.cloudflare-disabled");
const middlewareFile = join(srcDir, "middleware.js");
const cloudflareMiddlewareFile = join(srcDir, "middleware.cloudflare.js");
let restored = false;
let ownsMiddlewareSwap = false;

function prepareCloudflareMiddleware() {
  const alreadyPrepared = existsSync(middlewareFile) && existsSync(disabledProxyFile) && !existsSync(proxyFile);
  if (alreadyPrepared) return false;
  if (existsSync(middlewareFile)) {
    throw new Error("Cloudflare build cannot create src/middleware.js because it already exists.");
  }
  if (existsSync(disabledProxyFile)) {
    renameSync(disabledProxyFile, proxyFile);
  }
  if (existsSync(proxyFile)) renameSync(proxyFile, disabledProxyFile);
  copyFileSync(cloudflareMiddlewareFile, middlewareFile);
  return true;
}

function restoreSourceFiles() {
  if (restored) return;
  restored = true;
  if (!ownsMiddlewareSwap) return;
  try { if (existsSync(middlewareFile)) rmSync(middlewareFile); } catch {}
  try { if (existsSync(disabledProxyFile)) renameSync(disabledProxyFile, proxyFile); } catch {}
}

if (isCloudflareBuild) {
  for (const dir of [".next"]) {
    const target = resolve(process.cwd(), dir);
    try { if (existsSync(target)) rmSync(target, { recursive: true, force: true }); } catch {}
  }
  ownsMiddlewareSwap = prepareCloudflareMiddleware();
}

const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || "1",
  HOME: process.env.HOME || homeDir,
  USERPROFILE: homeDir,
  APPDATA: appDataDir,
  LOCALAPPDATA: localAppDataDir,
};

const child = spawn(command, args, {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  restoreSourceFiles();
  if (signal) {
    console.error(`Command terminated by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  restoreSourceFiles();
  console.error(error.message);
  process.exit(1);
});

process.on("SIGINT", () => {
  restoreSourceFiles();
  process.exit(130);
});

process.on("SIGTERM", () => {
  restoreSourceFiles();
  process.exit(143);
});
