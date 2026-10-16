# 5o — GPU optimizations and native scroll

Previous published snapshot: `0c88a83` (GPU/particles, original scroll).
Native-scroll release: `5o-native-scroll-alpha-20261016`, publication authorized
on 2026-10-16. Prepared on `codex/v5o-native-scroll` for main auto-deployment.

- `/v1`: original V5 rendering.
- `/5o`: optimized rendering plus the local native-scroll timeline.
- `/5o-steps`: optimized rendering with the published stepped-scroll mechanics.

The GPU results below predate the native-scroll follow-up. They compare rendering
algorithms, not the performance of two different scroll timelines.

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
Responsive layout, Canvas2D particle cost, and cold-load shader compilation
remain separate bottlenecks. See the handoff docs for native-scroll validation limits.


## Handoff documentation

- [Performance research](docs/5o/01-performance-research.md) (Russian): methods,
  measured results, evidence limits and remaining bottlenecks.
- [Optimization plan and implementation status](docs/5o/02-optimization-plan.md)
  (Russian): files, verification instructions and work for the next developer.

Particle-scene changes are also gated to `/5o`. Run `/tests/particles.html` on
Vite dev for deterministic image comparisons and the separate ABBA benchmark.


Version isolation: copied to `5o/prototype` before publication; the original
`V5 Final Tuning` source is restored to commit f99732f for colleague compatibility.


## Local native-scroll follow-up

Run `npm run dev -- --host 127.0.0.1 --port 5190 --strictPort` and open `/5o`.
`npm run test:scroll` checks timeline continuity and reversibility.
Hero/cards/world-model/facet/particle playheads follow actual scroll position.
CSS sticky and svh tracks replace gesture locks and scripted recentering.
Buttons retain explicit native smooth navigation. The original visual renderers
and assets remain; animation timing is now distance-based and is intentionally
different from the published timed transitions.

Chrome inspection: nonpassive window wheel/touchmove listeners 4/2 → 0/0.
Two long native wheel gestures: zero cancelled inputs, zero window.scrollTo writes.
These are input-ownership checks, not an FPS or GPU-time benchmark.
Physical iPad Safari testing remains outstanding; subsequent Chrome desktop
and tablet viewport checks are recorded below. Publication was authorized
with this validation limit documented.


## Local scroll refinement

Cards now enter with their viewport and leave with lift/fade; the selected
industry has a synchronized autoplay ring. Fixed handoff surfaces crossfade
without scrolling rectangular edges. The two world-model paragraphs fill
from 35%-opaque black to opaque black line by line, then travel/fade out. The glass-to-particle
transition has more scroll distance. Native poses avoid a second spring
and caption fade, including the fast reverse-scroll oversized flash.

Tablet composition checked in Chrome at 1024×1366, 768×1024 and 1024×768.
Physical iPad Safari/touch/GPU testing remains outstanding. The user authorized publishing these native changes to the target Worker
on 2026-10-16. The release marker identifies the updated version.
Current production preview: `http://127.0.0.1:5191/5o`.
