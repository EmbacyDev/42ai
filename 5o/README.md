# 5o — isolated performance version

Application: `prototype/`. Based on V5 Final Tuning with local GPU/particle optimizations.
The original `V5 Final Tuning/` directory is restored to the GitHub main baseline.

Target Worker: **42ai-build**, expected URL https://42ai-build.welcome-d80.workers.dev/.
The colleague Worker **42ai-v5-final-tuning** is not a deployment target for this directory.

From `prototype/`: `npm ci`, `npm run test:rendering`, `npm run build`.
Deploy only after confirming access to the Cloudflare account owning the `welcome-d80`
subdomain, using `npm run deploy`. Do not create a same-name
Worker in an unrelated account.

If Workers Builds is configured, its root must point to `5o/prototype` for this Worker.
There is no GitHub Actions deployment workflow in the repository at publication prep.
Dashboard build triggers have to be verified separately.

`/` opens `/5o`; `/v1` is retained inside this isolated app for comparison.
The release marker is `/5o-release.json`.

Research and implementation handoff: `prototype/docs/5o/`.
The current release includes GPU/particle optimizations and native scroll.
Publication of the native-scroll follow-up was authorized on 2026-10-16.

## Verified build configuration before release

Account: Welcome@embacy.io (d801b6ed087c47c37fd510799fb96169).
Worker 42ai-build watches EmbacyDev/42ai main. Its old root was `/`, build command
`npm run build`, deploy `npx wrangler deploy`; the last several main builds failed
and the active site still showed a deployment from 10 days earlier.
The release changes only this Worker root to `5o/prototype`.
The colleague Worker belongs to a different account/subdomain and its source
directory is byte-for-byte unchanged from origin/main f99732f in this release.


## Published and local states

The GPU/particle release was deployed successfully from main `0c88a83` on
2026-10-16. Build ID: `b47bcc83-73ce-41bb-b431-4816d653f308`.
The root `5o/prototype` is saved in Workers Builds. Non-production branch builds
were disabled in this Worker's configuration.

The native-scroll release was prepared on `codex/v5o-native-scroll`:
`http://127.0.0.1:5190/5o`; same rendering with old scroll: `/5o-steps`.
The user authorized publishing this follow-up to main and the same Worker.
Unread world-model text uses the same black ink at 35% opacity, filling to opaque
black with scroll. Release marker: `5o-native-scroll-alpha-20261016`.
The configured main auto-build is the publication path; check its result after push.
