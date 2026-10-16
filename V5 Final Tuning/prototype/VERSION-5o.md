# 5o — crystal GPU rendering

Local branch: `codex/v5o-gpu`. No deployment or push is needed to compare versions.

- `/v1`: original V5 rendering.
- `/5o`: identical page/assets, with crystal and particle-scene rendering optimizations.

5o keeps the crystal's position/opacity controller running so scrolling back,
anchor navigation and animated hand-offs can wake the crystal. Three.js frame
callbacks, transmission captures and the composer run only while the final
crystal opacity is positive, plus the initial shader/readiness warm-up. The
existing renderer, buffers, resolution and material settings are retained.

At zero Bloom intensity, only the luminance/blur update is skipped. The same
composer, final composite, color handling and antialiasing remain. A positive
CTA pulse uses the original Bloom update and reuses its allocated buffers.

Run from this directory:

```sh
npm ci
npm run test:rendering
npm run build
npm run preview -- --host 127.0.0.1 --port 5185 --strictPort
```

Open `http://127.0.0.1:5185/v1` and `http://127.0.0.1:5185/5o` sequentially
in the same browser/viewport. Check initial load, the hero/card hand-off,
all four facet states, particle chapter, reverse scrolling, anchor navigation
and the CTA pulse. Compare WebGL calls rather than only the shared Chrome
process GPU percentage. Hidden crystal GPU calls should settle at zero;
zero-intensity Bloom luminance/downsampling/upsampling calls should be zero.

## Measured locally in Chrome, 2026-10-16

Production build; versions opened sequentially in the same viewport. Counters
wrap drawArrays/drawElements on the crystal's own WebGL2 context. They do not
measure the particles, companion light canvases or the whole GPU process.

| Scenario | Original /v1 | /5o |
| --- | ---: | ---: |
| Visible fourth facet, Bloom intensity 0 | 39 draws/frame | 23 draws/frame |
| Hidden crystal behind first particle chapter, 5 seconds | 2511 draws (93 frames) | 0 draws |
| Bloom preparation at intensity 0 | 16 draws/frame | 0 draws/frame |

Visible sample: original 5304 calls / 136 frames in 5 seconds; 5o 3496 calls /
152 frames in 5 seconds. Frame rates are illustrative, not a controlled GPU-time
benchmark: other animated layers and machine load are still present. The 41%
reduction concerns crystal draw calls in this facet, not total site GPU load.

Reverse scrolling from particles resumed the crystal in its fourth facet.
Hero, facet states and particle transition were inspected visually; no application
console errors were captured on the clean optimized page.

Real GPU regression fixture: run Vite with `npm run dev`, then open
`/tests/rendering.html`. The original and optimized Bloom pipelines produced
identical half-float output (zero differing channels) at intensities
`0 → 0.05 → 0.28 → 0.1 → 0`. At zero, fixture calls fell from 18 to 2; at positive
intensity both remained 18. This verifies Bloom output on the fixture, not pixel
identity of every frame of the animated website.

`npm run test:rendering`, `npm run build`, and `git diff --check` passed.
Responsive layout, scroll capture, particle rendering, and cold-load shader
compilation are outside this version's changes and may still cause stutters.


## Handoff documentation

- [Performance research](docs/5o/01-performance-research.md) (Russian): methods,
  measured results, evidence limits and remaining bottlenecks.
- [Optimization plan and implementation status](docs/5o/02-optimization-plan.md)
  (Russian): files, verification instructions and work for the next developer.

Particle-scene changes are also gated to `/5o`. Run `/tests/particles.html` on
Vite dev for deterministic image comparisons and the separate ABBA benchmark.
