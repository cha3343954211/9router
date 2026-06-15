import { getCloudflareContext } from "@opennextjs/cloudflare";

function getD1Binding() {
  try {
    const { env } = getCloudflareContext();
    return env?.NINEROUTER_DB || env?.DB || null;
  } catch {
    return null;
  }
}

function normalizeParams(params = []) {
  if (!Array.isArray(params)) return [params];
  return params;
}

export async function createD1Adapter() {
  const db = getD1Binding();
  if (!db) return null;

  async function run(sql, params = []) {
    const result = await db.prepare(sql).bind(...normalizeParams(params)).run();
    return {
      changes: Number(result?.meta?.changes ?? 0),
      lastInsertRowid: result?.meta?.last_row_id ?? result?.meta?.lastRowId ?? null,
      raw: result,
    };
  }

  async function get(sql, params = []) {
    return await db.prepare(sql).bind(...normalizeParams(params)).first();
  }

  async function all(sql, params = []) {
    const result = await db.prepare(sql).bind(...normalizeParams(params)).all();
    return result?.results || [];
  }

  async function exec(sql) {
    if (typeof db.exec === "function") return await db.exec(sql);
    const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
    for (const statement of statements) await run(statement);
  }

  async function transaction(fn) {
    // D1 statements are already atomic individually. The repo layer keeps a
    // transaction-shaped API so callers do not need Cloudflare-specific code.
    return await fn();
  }

  return {
    driver: "cloudflare-d1",
    run,
    get,
    all,
    exec,
    transaction,
    close() {},
    raw: db,
  };
}
