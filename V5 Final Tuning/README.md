# V5 Final Tuning

Current tuned website. The former local V5 Fine Tuning folder is now named V5 Final Tuning to match GitHub.

- App source: `prototype/`
- Public URL: https://42ai-v5-final-tuning.scal-nv.workers.dev/v1
- Cloudflare Worker: `42ai-v5-final-tuning`
- Search indexing is disabled.

## Development

From `prototype/`, run `npm ci`, then `npm run dev -- --host 127.0.0.1 --port 5177 --strictPort`.

## Publish

From `prototype/`, run `npm ci`, `npm run build`, then `npx wrangler deploy`.

This Worker is separate from the existing `42ai-v4` deployment.
