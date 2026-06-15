import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const [, , command, ...rawArgs] = process.argv;
const forceNextBuildOnly = rawArgs.includes("--ninerouter-next-only");
const args = rawArgs.filter((arg) => arg !== "--ninerouter-next-only");

if (!command) {
  console.error("Usage: node scripts/next-build-env.mjs <command> [...args]");
  process.exit(1);
}

const homeDir = resolve(process.cwd(), ".next-build-home");
const appDataDir = join(homeDir, "AppData", "Roaming");
const localAppDataDir = join(homeDir, "AppData", "Local");
const isWindows = process.platform === "win32";

if (isWindows) {
  mkdirSync(appDataDir, { recursive: true });
  mkdirSync(localAppDataDir, { recursive: true });
}

const isCloudflareBuild = process.env.NEXT_DEPLOY_TARGET === "cloudflare" || process.env.CF_PAGES === "1";
const isOpenNextInnerBuild = process.env.NINEROUTER_OPENNEXT_BUILD === "1";
const srcDir = resolve(process.cwd(), "src");
const proxyFile = join(srcDir, "proxy.js");
const disabledProxyFile = join(srcDir, "proxy.js.cloudflare-disabled");
const middlewareFile = join(srcDir, "middleware.js");
const cloudflareMiddlewareFile = join(srcDir, "middleware.cloudflare.js");
let restored = false;
let ownsMiddlewareSwap = false;

function runCommand(cmd, cmdArgs, cmdEnv = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      env: cmdEnv,
      stdio: "inherit",
      shell: isWindows,
    });
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`Command terminated by ${signal}`));
      else resolve(code ?? 0);
    });
    child.on("error", reject);
  });
}

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

if (!isOpenNextInnerBuild && !forceNextBuildOnly) {
    try {
      process.exit(await runCommand("node", ["scripts/cloudflare-env.mjs", "opennextjs-cloudflare", "build"]));
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
}

if (isCloudflareBuild || isOpenNextInnerBuild) {
  for (const dir of [".next"]) {
    const target = resolve(process.cwd(), dir);
    try { if (existsSync(target)) rmSync(target, { recursive: true, force: true }); } catch {}
  }
  ownsMiddlewareSwap = prepareCloudflareMiddleware();
}

const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || "1",
  ...(isWindows
    ? {
        HOME: process.env.HOME || homeDir,
        USERPROFILE: homeDir,
        APPDATA: appDataDir,
        LOCALAPPDATA: localAppDataDir,
      }
    : {}),
};

try {
  const code = await runCommand(command, args, env);
  restoreSourceFiles();
  process.exit(code);
} catch (error) {
  restoreSourceFiles();
  console.error(error.message);
  process.exit(1);
}

process.on("SIGINT", () => {
  restoreSourceFiles();
  process.exit(130);
});

process.on("SIGTERM", () => {
  restoreSourceFiles();
  process.exit(143);
});
