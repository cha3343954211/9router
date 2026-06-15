import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const [, , command, ...args] = process.argv;

if (!command) {
  console.error("Usage: node scripts/cloudflare-env.mjs <command> [...args]");
  process.exit(1);
}

const homeDir = resolve(process.cwd(), ".cloudflare-home");
const appDataDir = join(homeDir, "AppData", "Roaming");
const localAppDataDir = join(homeDir, "AppData", "Local");
const isWindows = process.platform === "win32";

if (isWindows) {
  mkdirSync(appDataDir, { recursive: true });
  mkdirSync(localAppDataDir, { recursive: true });
}

for (const dir of [".next", ".open-next"]) {
  const target = resolve(process.cwd(), dir);
  try { if (existsSync(target)) rmSync(target, { recursive: true, force: true }); } catch {}
}

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

ownsMiddlewareSwap = prepareCloudflareMiddleware();

const env = {
  ...process.env,
  NINEROUTER_OPENNEXT_BUILD: "1",
  NEXT_DEPLOY_TARGET: "cloudflare",
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || "1",
  ...(isWindows
    ? {
        HOME: homeDir,
        USERPROFILE: homeDir,
        APPDATA: appDataDir,
        LOCALAPPDATA: localAppDataDir,
      }
    : {}),
};

let child;
try {
  child = spawn(command, args, {
    env,
    stdio: "inherit",
    shell: isWindows,
  });
} catch (error) {
  restoreSourceFiles();
  console.error(error.message);
  process.exit(1);
}

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
