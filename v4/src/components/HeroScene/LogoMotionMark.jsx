import { useEffect, useRef } from 'react'

/**
 * Preloader mark: the crystal half of the 42AI logo animation from Figma
 * (622:3215 "Logo_motion"), without the letters. The face swaps between
 * three poses and the eyes blink/look around on a 6s loop. Figma draws it
 * white on near-black; the whole mark is inverted so it reads black on the
 * white loading sheet, like the header logo.
 *
 * Geometry is Figma's own, in the 541.738 x 203.705 logo frame, cropped to
 * the hexagon. Keyframes are sampled by hand (no animation library here).
 */

const W = 541.738
const H = 203.705
const CROP_W = 185
// v4: 80% of Figma's 6s loop.
const DURATION = 4800
const SRC = '/images/preloader/'

const EIO = [0.42, 0, 0.58, 1]
const SOFT = [0.6, 0, 0.4, 1]
const BLINK = [0.38, 0, 0.62, 1]
const L = 'linear'
const E = 'easeInOut'

// Track helpers: [values, times, ease (one per segment, or a single one)].
const faceOut = { opacity: [[1, 1, 0, 0, 1, 1], [0, 0.2533, 0.2933, 0.9, 0.9533, 1], [L, E, L, E, L]] }
const faceIn = (o, s) => ({
  opacity: [[0, 0, 1, 1, 0, 0], o, [L, E, L, E, L]],
  scaleX: [[0.01, 0.01, 1, 1, 0.01, 0.01], s, [L, SOFT, L, SOFT, L]],
  scaleY: [[0.01, 0.01, 1, 1, 0.01, 0.01], s, [L, SOFT, L, SOFT, L]],
})

const S1 = [0, 0.18, 0.2933, 0.9, 0.9933, 1]
const EYE1_T = [0, 0.08, 0.0917, 0.1067, 0.1267, 0.15, 0.16, 0.18, 0.2933, 0.9, 0.9933, 1]
const EYE1_E = [E, E, E, E, E, E, SOFT, SOFT, L, SOFT, L]
const EYE1_SY = [[1, 1, 0.06, 0.06, 1, 1, 0.01, 0.01, 1, 1], [0, 0.0917, 0.1067, 0.1267, 0.15, 0.18, 0.2933, 0.9, 0.9933, 1], [L, E, L, E, L, SOFT, L, SOFT, L]]

const EYE2_O = [[0, 0, 1, 1, 0, 0, 1, 1, 0, 0], [0, 0.2533, 0.2933, 0.3899, 0.39, 0.4632, 0.4633, 0.5533, 0.5933, 1], [L, E, L, L, L, L, L, E, L]]
const EYE2_S = [0, 0.2533, 0.3667, 0.4833, 0.5933, 1]
const EYE2_SY = [[0.01, 0.01, 1, 1, 0.008, 0.008, 1, 0.01, 0.01], [0, 0.2533, 0.3667, 0.37, 0.39, 0.4633, 0.4833, 0.5933, 1], [L, SOFT, L, BLINK, L, BLINK, SOFT, L]]
const EYE2_T = [0, 0.2533, 0.3667, 0.37, 0.39, 0.41, 0.4433, 0.4633, 0.4833, 0.5933, 1]
const EYE2_E = [L, SOFT, BLINK, BLINK, BLINK, BLINK, BLINK, BLINK, SOFT, L]

const EYE3_O = [[0, 0, 1, 1, 0, 0, 1, 1, 0, 0], [0, 0.5533, 0.5933, 0.6999, 0.7, 0.8324, 0.8325, 0.9, 0.9533, 1], [L, E, L, L, L, L, L, E, L]]
const EYE3_S = [0, 0.5533, 0.6667, 0.8533, 0.9533, 1]
const EYE3_SY = [[0.01, 0.01, 1, 1, 0.008, 0.008, 1, 0.01, 0.01], [0, 0.5533, 0.6667, 0.68, 0.7, 0.8325, 0.8533, 0.9533, 1], [L, SOFT, L, BLINK, L, BLINK, SOFT, L]]
const EYE3_T = [0, 0.5533, 0.6667, 0.68, 0.7, 0.72, 0.8117, 0.8325, 0.8533, 0.9533, 1]

const pct = (top, right, bottom, left) => ({ top: `${top}%`, right: `${right}%`, bottom: `${bottom}%`, left: `${left}%` })

const PARTS = [
  {
    src: 'face1', box: pct(28.27, 78.06, 19.43, 2.76),
    inner: { w: 'hypot(94.0083cqw, -5.67968cqh)', h: 'hypot(5.99171cqw, 94.3203cqh)', t: 'rotate(-3.55deg)' },
    tracks: {
      ...faceOut,
      scaleX: [[1, 1, 0.01, 0.01, 1, 1], S1, [L, SOFT, L, SOFT, L]],
      scaleY: [[1, 1, 0.01, 0.01, 1, 1], S1, [L, SOFT, L, SOFT, L]],
      x: [[0, 0, 48.438, 48.438, 0, 0], S1, [L, SOFT, L, SOFT, L]],
      y: [[0, 0, 49.833, 49.833, 0, 0], S1, [L, SOFT, L, SOFT, L]],
    },
  },
  {
    src: 'eyeA1', box: pct(34.98, 83.74, 50.23, 11.32), pad: pct(15.07, 6.72, 3.32, 7.57),
    inner: { w: 'hypot(-88.1688cqw, 7.44785cqh)', h: 'hypot(-11.8312cqw, -92.5521cqh)', t: 'rotate(174.56deg) skewX(1.03deg)' },
    tracks: {
      ...faceOut,
      scaleX: [[1, 1, 0.01, 0.01, 1, 1], S1, [L, SOFT, L, SOFT, L]],
      scaleY: EYE1_SY,
      x: [[0, 1.6, 1.485, 0.974, -0.131, -1.016, -1.1, 0, 11.714, 11.714, 0, 0], EYE1_T, EYE1_E],
      y: [[0, -0.55, -0.48, 13.023, 13.699, 1.049, 1.1, 0, 13.892, 13.892, 0, 0], EYE1_T, EYE1_E],
    },
  },
  {
    src: 'eyeB1', box: pct(34.72, 88.86, 52.51, 6.65), pad: pct(15.75, 6.55, 3.67, 10.06),
    inner: { w: 'hypot(-88.8475cqw, 7.92118cqh)', h: 'hypot(-11.1525cqw, -92.0788cqh)', t: 'rotate(174.56deg) skewX(1.03deg)' },
    tracks: {
      ...faceOut,
      scaleX: [[1, 1, 0.01, 0.01, 1, 1], S1, [L, SOFT, L, SOFT, L]],
      scaleY: EYE1_SY,
      x: [[0, 1.1, 0.985, 0.474, -0.631, -1.516, -1.6, 0, 10.755, 10.755, 0, 0], EYE1_T, EYE1_E],
      y: [[0, -0.55, -0.48, 11.161, 11.837, 1.049, 1.1, 0, 11.932, 11.932, 0, 0], EYE1_T, EYE1_E],
    },
  },
  {
    src: 'face2', box: pct(26.44, 77.35, 17.6, 2.04),
    inner: { w: 'hypot(-86.7037cqw, -12.6551cqh)', h: 'hypot(13.2963cqw, -87.3449cqh)', t: 'rotate(-171.52deg)' },
    tracks: {
      ...faceIn([0, 0.2533, 0.2933, 0.5533, 0.5933, 1], EYE2_S),
      x: [[48.438, 48.438, 0, 0, 48.438, 48.438], EYE2_S, [L, SOFT, L, SOFT, L]],
      y: [[49.833, 49.833, 0, 0, 49.833, 49.833], EYE2_S, [L, SOFT, L, SOFT, L]],
    },
  },
  {
    src: 'eyeA2', box: pct(59.78, 84.35, 26.04, 11.19),
    inner: { w: 'hypot(97.9629cqw, 2.89962cqh)', h: 'hypot(-2.03711cqw, 97.1004cqh)', t: 'rotate(2.03deg) skewX(1.03deg)' },
    tracks: {
      opacity: EYE2_O,
      scaleX: [[0.01, 0.01, 1, 1, 0.01, 0.01], EYE2_S, [L, SOFT, L, SOFT, L]],
      scaleY: EYE2_SY,
      x: [[11.714, 11.714, 0, 0.131, 1.573, 0.974, -0.99, -0.916, 0, 11.714, 11.714], EYE2_T, EYE2_E],
      y: [[13.892, 13.892, 0, 0.09, 15.004, 14.638, 13.438, 13.462, 0, 13.892, 13.892], EYE2_T, EYE2_E],
    },
  },
  {
    src: 'eyeB2', box: pct(57.99, 89.56, 29.8, 6.35),
    inner: { w: 'hypot(98.0919cqw, 3.09356cqh)', h: 'hypot(-1.90809cqw, 96.9064cqh)', t: 'rotate(2.03deg) skewX(1.03deg)' },
    tracks: {
      opacity: EYE2_O,
      scaleX: [[0.01, 0.01, 1, 1, 0.01, 0.01], EYE2_S, [L, SOFT, L, SOFT, L]],
      scaleY: EYE2_SY,
      x: [[10.755, 10.755, 0, 0.09, 1.073, 0.474, -1.49, -1.333, 0, 10.755, 10.755], EYE2_T, EYE2_E],
      y: [[11.932, 11.932, 0, 0.09, 13.039, 12.673, 11.473, 11.498, 0, 11.932, 11.932], EYE2_T, EYE2_E],
    },
  },
  {
    src: 'face3', box: pct(20.81, 68, 23.19, 11.53),
    tracks: {
      ...faceIn([0, 0.5533, 0.5933, 0.9, 0.9533, 1], EYE3_S),
      x: [[54.889, 54.889, 0, 0, 54.889, 54.889], EYE3_S, [L, SOFT, L, SOFT, L]],
      y: [[56.47, 56.47, 0, 0, 56.47, 56.47], EYE3_S, [L, SOFT, L, SOFT, L]],
    },
  },
  {
    src: 'eyeA3', box: pct(28.79, 76.98, 56.42, 18.09),
    inner: { w: 'hypot(-88.1688cqw, 7.44785cqh)', h: 'hypot(-11.8312cqw, -92.5521cqh)', t: 'rotate(174.56deg) skewX(1.03deg)' },
    tracks: {
      opacity: EYE3_O,
      scaleX: [[0.01, 0.01, 1, 1, 0.01, 0.01], EYE3_S, [L, SOFT, L, SOFT, L]],
      scaleY: EYE3_SY,
      x: [[11.714, 11.714, 0, -1.6, -1.466, -1.044, 1.024, 0.3, 0, 11.714, 11.714], EYE3_T, EYE2_E],
      y: [[13.892, 13.892, 0, 0.55, 14.388, 14.131, 12.896, 13.62, 0, 13.892, 13.892], EYE3_T, EYE2_E],
    },
  },
  {
    src: 'eyeB3', box: pct(30.5, 72.12, 56.73, 23.39),
    inner: { w: 'hypot(-88.8475cqw, 7.92118cqh)', h: 'hypot(-11.1525cqw, -92.0788cqh)', t: 'rotate(174.56deg) skewX(1.03deg)' },
    tracks: {
      opacity: EYE3_O,
      scaleX: [[0.01, 0.01, 1, 1, 0.01, 0.01], EYE3_S, [L, SOFT, L, SOFT, L]],
      scaleY: EYE3_SY,
      x: [[10.755, 10.755, 0, -1.1, -0.966, -0.544, 1.49, 0.437, 0, 10.755, 10.755], EYE3_T, EYE2_E],
      y: [[11.932, 11.932, 0, 0.55, 12.424, 12.166, 10.931, 11.656, 0, 11.932, 11.932], EYE3_T, EYE2_E],
    },
  },
  {
    src: 'closed', px: { left: 94.25, top: 63.5, width: 59.47, height: 14.575 },
    tracks: {
      opacity: [[0, 0, 1, 1, 0, 0], [0, 0.6999, 0.7, 0.8324, 0.8325, 1], L],
      scaleY: [[0.008, 0.008, 1, 1, 0.008, 0.008], [0, 0.7, 0.72, 0.8117, 0.8325, 1], [L, BLINK, L, BLINK, L]],
      y: [[4.501, 4.501, 0, 0, 4.501, 4.501], [0, 0.7, 0.72, 0.8117, 0.8325, 1], [L, BLINK, L, BLINK, L]],
    },
  },
  {
    src: 'arcs', px: { left: 31.39, top: 129.44, width: 55.393, height: 13.89 }, inner: { t: 'rotate(180deg)' },
    tracks: {
      opacity: [[0, 0, 1, 1, 0, 0], [0, 0.3899, 0.39, 0.4632, 0.4633, 1], L],
      scaleY: [[0.008, 0.008, 1, 1, 0.008, 0.008], [0, 0.39, 0.41, 0.4433, 0.4633, 1], [L, BLINK, L, BLINK, L]],
      y: [[4.161, 4.161, 0, 0, 4.161, 4.161], [0, 0.39, 0.41, 0.4433, 0.4633, 1], [L, BLINK, L, BLINK, L]],
    },
  },
]

function bezier([x1, y1, x2, y2], t) {
  // Solve x(s) = t, return y(s).
  let s = t
  for (let i = 0; i < 8; i += 1) {
    const x = 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s ** 2 * x2 + s ** 3 - t
    const dx = 3 * (1 - s) ** 2 * x1 + 6 * (1 - s) * s * (x2 - x1) + 3 * s ** 2 * (1 - x2)
    if (Math.abs(dx) < 1e-6) break
    s = Math.min(1, Math.max(0, s - x / dx))
  }
  return 3 * (1 - s) ** 2 * s * y1 + 3 * (1 - s) * s ** 2 * y2 + s ** 3
}

function sample([values, times, ease], t) {
  if (t <= times[0]) return values[0]
  for (let i = 0; i < times.length - 1; i += 1) {
    if (t <= times[i + 1]) {
      const span = times[i + 1] - times[i]
      const local = span > 0 ? (t - times[i]) / span : 1
      const curve = Array.isArray(ease) && typeof ease[0] !== 'number' ? ease[i] : ease
      const k = curve === L || curve == null ? local : bezier(curve === E ? EIO : curve, local)
      return values[i] + (values[i + 1] - values[i]) * k
    }
  }
  return values[values.length - 1]
}

function frameAt(part, t) {
  const v = (key, fallback) => (part.tracks[key] ? sample(part.tracks[key], t) : fallback)
  return {
    opacity: v('opacity', 1),
    transform: `translate(${v('x', 0)}px, ${v('y', 0)}px) scale(${v('scaleX', 1)}, ${v('scaleY', 1)})`,
  }
}

// v4 header: the logo rests on the third face with its triangle eyes
// open (fully in at 0.6667, before they glance at 0.68), and every 15s
// plays one whole loop from there back to the same pose. On hover it
// loops until the pointer leaves, then finishes the loop and rests.
const REST_T = 0.67
const HEADER_PERIOD = 15000

/**
 * The 42AI logo animation.
 * - Loading screen: the whole 4.8s loop, crystal half only.
 * - `periodic` (header): rests on REST_T and plays one loop every 30s.
 * `crop` keeps only the hexagon; `invert` turns Figma's white mark black.
 */
export default function LogoMotionMark({ size = 56, periodic = false, crop = true, invert = true }) {
  const partRefs = useRef([])
  const rootRef = useRef(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // v4: baked into Web Animations keyframes instead of a rAF loop. Only
    // transform and opacity change, so the browser runs it on the
    // compositor: it keeps moving while the main thread is busy loading
    // the hero (the rAF version froze on exactly those frames).
    const STEPS = 240
    const animations = []
    PARTS.forEach((part, index) => {
      const node = partRefs.current[index]
      if (!node) return
      if (reduced || typeof node.animate !== 'function') {
        const f = frameAt(part, 0)
        node.style.opacity = String(f.opacity)
        node.style.transform = f.transform
        return
      }
      const frames = []
      for (let k = 0; k <= STEPS; k += 1) frames.push({ ...frameAt(part, k / STEPS), offset: k / STEPS })
      animations.push(node.animate(frames, { duration: DURATION, iterations: Infinity, easing: 'linear' }))
    })
    if (!periodic || !animations.length) return () => animations.forEach((a) => a.cancel())

    // Header: held on the rest pose; the browser plays the loop itself
    // (compositor-driven) once per period, then it is parked again.
    const rest = () => animations.forEach((a) => {
      a.pause()
      a.currentTime = REST_T * DURATION
    })
    rest()
    let stopTimer = 0
    let playing = false
    let hovering = false
    let every = 0
    // One loop from the rest pose back to it. While the pointer stays on
    // the logo the loops keep coming; leaving lets the current one finish.
    const endLoop = () => {
      if (hovering) {
        stopTimer = window.setTimeout(endLoop, DURATION)
        return
      }
      rest()
      playing = false
    }
    const playOnce = () => {
      if (playing) return
      playing = true
      animations.forEach((a) => a.play())
      stopTimer = window.setTimeout(endLoop, DURATION)
    }
    const restartClock = () => {
      window.clearInterval(every)
      every = window.setInterval(playOnce, HEADER_PERIOD)
    }
    restartClock()
    // Hovering the logo plays it at once; the 15s clock counts from there.
    const host = rootRef.current?.closest('a') ?? rootRef.current
    const onEnter = () => {
      hovering = true
      if (playing) return
      playOnce()
      restartClock()
    }
    const onLeave = () => {
      hovering = false
      restartClock()
    }
    host?.addEventListener('pointerenter', onEnter)
    host?.addEventListener('pointerleave', onLeave)
    return () => {
      host?.removeEventListener('pointerenter', onEnter)
      host?.removeEventListener('pointerleave', onLeave)
      window.clearInterval(every)
      window.clearTimeout(stopTimer)
      animations.forEach((a) => a.cancel())
    }
  }, [periodic])

  const scale = size / H
  return (
    <div
      ref={rootRef}
      className="logo-motion-mark"
      aria-hidden="true"
      style={{ width: (crop ? CROP_W : W) * scale, height: size, overflow: 'hidden', filter: invert ? 'invert(1)' : 'none' }}
    >
      <div style={{ position: 'relative', width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        <img src={`${SRC}union.svg`} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        {PARTS.map((part, index) => {
          const boxStyle = part.px
            ? { position: 'absolute', left: part.px.left, top: part.px.top, width: part.px.width, height: part.px.height }
            : { position: 'absolute', ...part.box }
          const img = <img src={`${SRC}${part.src}.svg`} alt="" style={{ display: 'block', width: '100%', height: '100%' }} />
          return (
            <div
              key={part.src}
              ref={(node) => { partRefs.current[index] = node }}
              style={{ ...boxStyle, ...frameAt(part, periodic ? REST_T : 0), display: 'flex', alignItems: 'center', justifyContent: 'center', containerType: 'size', transformOrigin: '50% 50%', willChange: 'transform, opacity' }}
            >
              <div
                style={{
                  flex: 'none',
                  position: 'relative',
                  width: part.inner?.w ?? '100%',
                  height: part.inner?.h ?? '100%',
                  transform: part.inner?.t,
                }}
              >
                {part.pad ? <div style={{ position: 'absolute', ...part.pad }}>{img}</div> : img}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
