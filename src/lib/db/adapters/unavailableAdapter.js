export async function createBunSqliteAdapter() {
  throw new Error("bun:sqlite is not available in this deployment target");
}

export function createBetterSqliteAdapter() {
  throw new Error("better-sqlite3 is not available in this deployment target");
}

export async function createNodeSqliteAdapter() {
  throw new Error("node:sqlite is not available in this deployment target");
}
