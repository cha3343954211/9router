# Cloudflare Workers Deployment

This project can be deployed to Cloudflare Workers through OpenNext.

## One-time setup

```bash
npm install
npx wrangler login
```

If you want to use a custom Worker name, edit `name` in `wrangler.jsonc`.

## Cloudflare dashboard settings

When importing this repository in Cloudflare, use these settings:

```text
Framework preset: Next.js
Build command: npm run build:cloudflare
Deploy command: npm run deploy:cloudflare
```

The scripts are also safe when Cloudflare invokes OpenNext directly: `npm run build` detects `CF_PAGES=1` and temporarily swaps the Next 16 Node `proxy.js` for the Cloudflare-compatible Edge middleware.

## Build locally

```bash
npm run build:cloudflare
```

The build writes the Worker bundle to `.open-next/worker.js` and static assets to `.open-next/assets`.

## Preview locally

```bash
npm run preview:cloudflare
```

## Deploy

```bash
npm run deploy:cloudflare
```

Cloudflare will use the `wrangler.jsonc` configuration in this repository.

## Optional D1 durable storage

The app automatically uses a D1 binding named `NINEROUTER_DB` when Cloudflare provides it. Without that binding, builds still pass and the Worker falls back to the bundled SQLite-compatible path.

Create the database:

```bash
npx wrangler d1 create 9router
```

Copy the returned `database_id` into the commented `d1_databases` block in `wrangler.jsonc`, then apply the schema:

```bash
npx wrangler d1 execute 9router --remote --file cloudflare/d1-migrations/0001_initial.sql
```

After that, deploy normally:

```bash
npm run deploy:cloudflare
```

## Cloudflare notes

- The Cloudflare build uses OpenNext and `nodejs_compat`.
- During Cloudflare builds, the script temporarily replaces Next 16 `proxy.js` with an Edge-compatible `middleware.js`, then restores the source files after the build.
- Local desktop-only routes that read host files, spawn processes, install tunnels, or manage local certificates are not meaningful in a Worker runtime.
- The Cloudflare bundle skips Bun/native SQLite drivers and uses D1 automatically when the `NINEROUTER_DB` binding exists.
