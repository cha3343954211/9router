import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "./jsonCol.js";

export function makeKv(scope) {
  return {
    async get(key, fallback = null) {
      const db = await getAdapter();
      const row = await db.get(`SELECT value FROM kv WHERE scope = ? AND key = ?`, [scope, key]);
      return row ? parseJson(row.value, fallback) : fallback;
    },
    async getAll() {
      const db = await getAdapter();
      const rows = await db.all(`SELECT key, value FROM kv WHERE scope = ?`, [scope]);
      const out = {};
      for (const r of rows) out[r.key] = parseJson(r.value);
      return out;
    },
    async set(key, value) {
      const db = await getAdapter();
      await db.run(`INSERT OR REPLACE INTO kv(scope, key, value) VALUES(?, ?, ?)`, [scope, key, stringifyJson(value)]);
    },
    async setMany(obj) {
      const db = await getAdapter();
      await db.transaction(async () => {
        for (const [k, v] of Object.entries(obj)) {
          await db.run(`INSERT OR REPLACE INTO kv(scope, key, value) VALUES(?, ?, ?)`, [scope, k, stringifyJson(v)]);
        }
      });
    },
    async remove(key) {
      const db = await getAdapter();
      await db.run(`DELETE FROM kv WHERE scope = ? AND key = ?`, [scope, key]);
    },
    async clear() {
      const db = await getAdapter();
      await db.run(`DELETE FROM kv WHERE scope = ?`, [scope]);
    },
  };
}
