# 42AI

Marketing landing page for 42AI.

## Glass effect

Стеклянный эффект с рефракцией: `src/lib/glass-panel/`. Инструкция — [GLASS-EFFECT.md](src/lib/glass-panel/GLASS-EFFECT.md).

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

Build output is written to `dist/`.

## Deploy (Cloudflare Workers)

**Build command** in Cloudflare dashboard:

```bash
npm install && npm run build
```

**Deploy command** in Cloudflare dashboard:

```bash
npm run deploy
```

Do not use `npx wrangler versions upload` for the production branch. That command only uploads a preview version and does not publish the site to `workers.dev`.

If the dashboard shows `No URLs enabled`, open **Domains** and enable **workers.dev** for `42ai.welcome-d80.workers.dev`.

Local deploy:

```bash
npm install
npm run deploy
```
