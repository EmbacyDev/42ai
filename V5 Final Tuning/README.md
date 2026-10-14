# V5 Final Tuning

Independent snapshot of the V5 Fine Tuning prototype, published separately from V5.

- App source: `prototype/`
- Public URL: https://42ai-v5-final-tuning.scal-nv.workers.dev/v1
- Cloudflare Worker: `42ai-v5-final-tuning`
- Search indexing is disabled.

## Development

From `prototype/`, run `npm ci` and `npm run dev` (port 5177).

## Publish

From `prototype/`, run `npm ci`, `npm run build`, then
`npx wrangler deploy`.

This static-assets Worker is separate from the existing V5 Worker deployment.
