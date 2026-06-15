const MESSAGE = "Cloudflare D1 binding NINEROUTER_DB is required for persistent storage.";

function isCountQuery(sql) {
  return /^\s*select\s+count\s*\(/i.test(sql || "");
}

function countAlias(sql) {
  const match = String(sql || "").match(/\bas\s+([a-zA-Z_][\w]*)/i);
  return match?.[1] || "c";
}

function writeUnavailable() {
  const error = new Error(MESSAGE);
  error.code = "CLOUDFLARE_D1_REQUIRED";
  throw error;
}

export function createCloudflareUnavailableAdapter() {
  return {
    driver: "cloudflare-no-d1",
    async run() {
      writeUnavailable();
    },
    async get(sql) {
      if (isCountQuery(sql)) return { [countAlias(sql)]: 0 };
      return undefined;
    },
    async all() {
      return [];
    },
    async exec() {},
    async transaction(fn) {
      return await fn();
    },
    close() {},
    raw: null,
  };
}

export async function createBunSqliteAdapter() {
  throw new Error("bun:sqlite is not available in this deployment target");
}

export function createBetterSqliteAdapter() {
  throw new Error("better-sqlite3 is not available in this deployment target");
}

export async function createNodeSqliteAdapter() {
  throw new Error("node:sqlite is not available in this deployment target");
}
