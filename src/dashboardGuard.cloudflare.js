import { NextResponse } from "next/server";

const PUBLIC_PREFIXES = ["/v1", "/v1beta", "/api/v1", "/api/v1beta"];
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLoopbackHostname(h) {
  if (!h) return false;
  const name = h.split(":")[0].replace(/^\[|\]$/g, "").toLowerCase();
  return LOOPBACK_HOSTS.has(name);
}

function isPublicLlmApi(pathname) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isLocalRequest(request) {
  if (!isLoopbackHostname(request.headers.get("host"))) return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (!isLoopbackHostname(new URL(origin).hostname)) return false;
    } catch { return false; }
  }
  return true;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Cloudflare Workers cannot run the local SQLite/file-system checks used by
  // the desktop middleware. API routes still enforce their own auth where needed.
  if (isPublicLlmApi(pathname)) return NextResponse.next();

  return NextResponse.next();
}
