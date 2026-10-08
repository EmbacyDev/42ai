import { useEffect, useRef } from 'react'
import { buildShards } from '../../crystal/shards.js'

const TAU = Math.PI * 2
const clamp01 = (value) => Math.min(1, Math.max(0, value))
const smooth = (value) => {
  const t = clamp01(value)
  return t * t * t * (t * (t * 6 - 15) + 10)
}
const mix = (a, b, t) => a + (b - a) * t

function random(seed = 42) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const GALAXY_TILT = 1.08
const GALAXY_FACE_TILT = 0.22
const SHAPE_CYCLE = 2300
const CRYSTAL_EXTRA_HOLD = 1500

const LINK_LABELS = [
  '2025-04-18', 'OPENNESS', 'LOSS AVERSION', 'NEW ROLE',
  'TRUST +12%', 'MARKET SHOCK', '2026-01-09', 'CURIOSITY',
  'RISK TOLERANCE', 'SOCIAL SIGNAL', 'CONTEXT SHIFT', 'THE EVENT',
]

function createField(count = 1560) {
  const rng = random(4206)
  const points = []
  const crystalFaces = buildShards(1.65)
  for (let index = 0; index < count; index += 1) {
    const longitude = index * 2.399963229728653
    const latitude = Math.acos(1 - (2 * (index + 0.5)) / count)
    const sphereRadius = 1.62 + (rng() - 0.5) * 0.13
    const sx = Math.sin(latitude) * Math.cos(longitude) * sphereRadius
    const sy = Math.cos(latitude) * sphereRadius
    const sz = Math.sin(latitude) * Math.sin(longitude) * sphereRadius

    const face = crystalFaces[index % crystalFaces.length]
    const vertices = face.geometry.attributes.position.array
    const u = Math.sqrt(rng())
    const v = rng()
    const weights = [1 - u, u * (1 - v), u * v]
    const [cx, cy, cz] = [0, 1, 2].map(axis => face.position[axis] + weights.reduce((sum, weight, vertex) => sum + vertices[vertex * 3 + axis] * weight, 0))

    const arm = index % 4
    const galaxyRadius = 0.08 + Math.pow(rng(), 0.72) * 2.35
    const galaxyAngle = arm * TAU / 4 + galaxyRadius * 4.5 + (rng() - 0.5) * 0.12
    const gx = Math.cos(galaxyAngle) * galaxyRadius
    const flatY = Math.sin(galaxyAngle) * galaxyRadius * 0.76
    const flatZ = (rng() - 0.5) * (0.1 + galaxyRadius * 0.08)
    // Seen almost face-on, so the spiral reads as a galaxy at once.
    const gy = flatY * Math.cos(GALAXY_FACE_TILT) - flatZ * Math.sin(GALAXY_FACE_TILT)
    const gz = flatY * Math.sin(GALAXY_FACE_TILT) + flatZ * Math.cos(GALAXY_FACE_TILT)

    const cluster = index % 7
    const clusterAngle = cluster * TAU / 7 + 0.34
    const clusterRadius = cluster === 0 ? 0 : 2.3 + (cluster % 3) * 0.76
    const localRadius = 0.04 + Math.pow(rng(), 0.7) * (cluster === 0 ? 1.06 : 0.72)
    const localArm = Math.floor(index / 7) % 4
    const localA = localArm * TAU / 4 + localRadius * 4.5 + (rng() - 0.5) * 0.26
    void clusterAngle
    void clusterRadius
    // One central galaxy (tilted like the step-three one); the rest of the
    // universe arrives through the tunnel.
    const coreR = 0.06 + Math.pow(rng(), 0.7) * 1.9
    const coreA = localArm * TAU / 4 + coreR * 4.2 + (rng() - 0.5) * 0.3
    const kx = Math.cos(coreA) * coreR
    const kFlat = Math.sin(coreA) * coreR * 0.8
    const kDepth = (rng() - 0.5) * 0.12
    const ky = kFlat * Math.cos(GALAXY_TILT) - kDepth * Math.sin(GALAXY_TILT)
    const kz = kFlat * Math.sin(GALAXY_TILT) + kDepth * Math.cos(GALAXY_TILT)

    points.push({
      sphere: [sx, sy, sz],
      crystal: [cx, cy, cz],
      galaxy: [gx, gy, gz],
      scatter: [(rng() * 2 - 1) * 5.5, (rng() * 2 - 1) * 3.3, (rng() * 2 - 1) * 5],
      clusters: [kx, ky, kz],
      size: 0.62 + rng() * 1.1,
      reveal: rng() * 0.88,
    })
  }
  crystalFaces.forEach(face => face.geometry.dispose())
  return points
}

// eslint-disable-next-line no-unused-vars
function buildLinks(points) {
  const rng = random(4219)
  const links = []
  for (let index = 0; index < 2400; index += 1) {
    const from = Math.floor(rng() * points.length)
    let to = Math.floor(rng() * points.length)
    if (from === to) to = (to + 1) % points.length
    links.push({
      from, to,
      phase: rng() * TAU,
      speed: 0.72 + rng() * 1.5,
      label: LINK_LABELS[index % LINK_LABELS.length],
    })
  }
  return links
}

function buildPaths(points, count = 110) {
  const rng = random(4251)
  return Array.from({ length: count }, (_, pathIndex) => {
    const path = [Math.floor(rng() * points.length)]
    const length = 6 + (pathIndex % 4)
    while (path.length < length) {
      const current = points[path[path.length - 1]].scatter
      let closest = 0
      let closestDistance = Infinity
      for (let sample = 0; sample < 42; sample += 1) {
        const candidate = Math.floor(rng() * points.length)
        if (path.includes(candidate)) continue
        const next = points[candidate].scatter
        const distance = (current[0] - next[0]) ** 2 + (current[1] - next[1]) ** 2 + (current[2] - next[2]) ** 2
        if (distance < closestDistance) {
          closest = candidate
          closestDistance = distance
        }
      }
      path.push(closest)
    }
    return { points: path, phase: rng() * TAU, speed: .65 + rng() * 1.1 }
  })
}

const FIELD = createField()
const PATHS = buildPaths(FIELD)

// Step four: galaxies further down the tunnel. Each is a tilted spiral that
// starts small in the distance and grows past the camera, spread around
// the screen rather than queued in one place.
const TUNNEL = (() => {
  const rng = random(4307)
  const galaxies = []
  const count = 20
  for (let index = 0; index < count; index += 1) {
    let bx = 0
    let by = 0
    while (Math.hypot(bx, by * 1.4) < 0.42) {
      bx = rng() * 2 - 1
      by = rng() * 2 - 1
    }
    const tilt = 0.75 + rng() * 0.7
    const spin = rng() * TAU
    const points = []
    for (let p = 0; p < 560; p += 1) {
      const r = 0.05 + Math.pow(rng(), 0.7)
      const a = (p % 3) * TAU / 3 + r * 4.2 + (rng() - 0.5) * 0.35 + spin
      const fx = Math.cos(a) * r
      const fy = Math.sin(a) * r
      const fz = (rng() - 0.5) * 0.08
      points.push([fx, fy * Math.cos(tilt) - fz * Math.sin(tilt), rng()])
    }
    galaxies.push({ bx, by, offset: index / count + rng() * 0.04, size: 0.7 + rng() * 0.6, points })
  }
  return galaxies
})()

// Deterministic per-slot pick, so a highlight lands on a new point each time.
const pick = (slot, cycle, count) => Math.floor(Math.abs(Math.sin(slot * 91.7 + cycle * 47.3) * 43758.5) % count)

function currentPosition(point, phase) {
  const sphereToCrystal = smooth((phase - 0.3) / 0.14)
  const crystalToGalaxy = smooth((phase - 0.46) / 0.15)
  const galaxyToScatter = smooth((phase - 0.64) / 0.12)
  const scatterToClusters = smooth((phase - 0.79) / 0.17)
  let x = mix(point.sphere[0], point.crystal[0], sphereToCrystal)
  let y = mix(point.sphere[1], point.crystal[1], sphereToCrystal)
  let z = mix(point.sphere[2], point.crystal[2], sphereToCrystal)
  x = mix(x, point.galaxy[0], crystalToGalaxy)
  y = mix(y, point.galaxy[1], crystalToGalaxy)
  z = mix(z, point.galaxy[2], crystalToGalaxy)
  x = mix(x, point.scatter[0], galaxyToScatter)
  y = mix(y, point.scatter[1], galaxyToScatter)
  z = mix(z, point.scatter[2], galaxyToScatter)
  x = mix(x, point.clusters[0], scatterToClusters)
  y = mix(y, point.clusters[1], scatterToClusters)
  z = mix(z, point.clusters[2], scatterToClusters)
  return [x, y, z]
}

export default function BehaviorNetworkTransition({ motionRef }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d', { alpha: true })
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let dpr = 1
    let frame = 0
    let loopStart = null
    let chainStart = null

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 1.7)
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
    }

    const render = (time) => {
      // v4: stops while off screen (see the observer below).
      frame = onScreen ? window.requestAnimationFrame(render) : 0
      if (!onScreen) return
      const stage = motionRef.current?.stage ?? 0
      const phase = stage / 4
      const reveal = smooth(stage)
      const flight = smooth(stage - 3)
      if (stage >= 2.99 && loopStart === null) loopStart = time
      if (stage < 2.5) loopStart = null
      // Shape loop: crystal → sphere → galaxy. The crystal holds 1.5s longer
      // than the others before it rebuilds.
      const elapsed = reduced ? 0 : Math.max(0, time - (loopStart ?? time))
      const durations = [SHAPE_CYCLE + CRYSTAL_EXTRA_HOLD, SHAPE_CYCLE, SHAPE_CYCLE]
      const round = durations[0] + durations[1] + durations[2]
      let shapeIndex = 0
      let shapeLocal = elapsed % round
      while (shapeLocal >= durations[shapeIndex]) {
        shapeLocal -= durations[shapeIndex]
        shapeIndex += 1
      }
      const shapeHold = durations[shapeIndex] - SHAPE_CYCLE
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      if (phase <= 0.002) return

      const unit = Math.min(width * 0.14, height * 0.18)
      // Push through the loose field, then ease the virtual camera back just
      // enough to reveal that the traversed mass is one of several clusters.
      const clusterReveal = smooth((flight - .5) / .5)
      // Step four flies straight into the step-three galaxy and through it:
      // no central galaxy remains, only the ones streaming past at the sides.
      const cameraPush = flight * 5.4
      const mainFade = 1 - smooth((flight - .3) / .55)
      const rotation = time * 0.000035 + phase * 0.58
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      const assemblyShown = smooth(stage - 2)
      const projected = FIELD.map((point, index) => {
        const shapes = ['crystal', 'sphere', 'galaxy']
        const from = shapes[shapeIndex]
        const to = shapes[(shapeIndex + 1) % 3]
        // Same 0.9s rebuild; each figure now holds 0.5s longer.
        const morph = smooth((shapeLocal - shapeHold - 216) / 900)
        const assembly = smooth(stage - 2)
        // While the galaxy is shown the field stops turning edge-on: the
        // spin around the vertical axis eases back to a frontal view.
        const galaxyWeight = from === 'galaxy' ? 1 - morph : to === 'galaxy' ? morph : 0
        const wrapped = Math.atan2(sin, cos)
        const turn = wrapped * (1 - galaxyWeight * assemblyShown)
        const tc = Math.cos(turn)
        const ts = Math.sin(turn)
        const xyz = point.scatter.map((value, axis) => {
          const shape = mix(point[from][axis], point[to][axis], morph)
          return mix(mix(value * .66, shape, assembly), point.clusters[axis], clusterReveal)
        })
        const [rawX, rawY, rawZ] = xyz
        const x = rawX * tc + rawZ * ts
        const z = -rawX * ts + rawZ * tc - cameraPush
        const perspective = 5.8 / Math.max(1.6, 5.8 + z)
        return {
          x: width * 0.5 + x * unit * perspective,
          y: height * 0.38 + rawY * unit * perspective,
          z,
          perspective,
          point,
          index,
        }
      })

      const linkStage = smooth(stage - 1) * (1 - smooth(stage - 2))
      context.lineWidth = Math.max(0.55, width / 1900)
      context.font = `${Math.max(7, width / 170)}px 'Geist Mono', monospace`
      context.textBaseline = 'middle'

      // Step one: faint labels everywhere, and a few bright, slightly larger
      // ones in the foreground that light up a point, hold, and move on.
      const labelStage = smooth(stage) * (1 - smooth(stage - 1))
      const highlighted = new Map()
      if (labelStage > .01) {
        for (let index = 31; index < projected.length; index += 89) {
          const item = projected[index]
          if (!pointVisible(item.point, reveal)) continue
          context.fillStyle = `rgba(232, 242, 250, ${(labelStage * .32).toFixed(3)})`
          context.fillText(LINK_LABELS[index % LINK_LABELS.length], item.x + 7, item.y - 7)
        }
        const bigFont = `${Math.max(11, width / 96)}px 'Geist Mono', monospace`
        for (let slot = 0; slot < 4; slot += 1) {
          const span = 2600
          const local = (reduced ? 0 : time) + slot * span / 4
          const cycle = Math.floor(local / span)
          const t = (local % span) / span
          const life = smooth(t / .22) * (1 - smooth((t - .72) / .26))
          const index = pick(slot, cycle, projected.length)
          const item = projected[index]
          if (item.x < 60 || item.x > width - 180 || item.y < 50 || item.y > height - 60) continue
          highlighted.set(index, life * labelStage)
          context.font = bigFont
          context.fillStyle = `rgba(255, 255, 255, ${(life * labelStage).toFixed(3)})`
          context.fillText(LINK_LABELS[(index + slot) % LINK_LABELS.length], item.x + 12, item.y - 12)
        }
        context.font = `${Math.max(7, width / 170)}px 'Geist Mono', monospace`
      }

      // Step two: relations are drawn one chain at a time, point to point,
      // each chain flaring its cluster white, then settling into the
      // background while the next one builds somewhere else.
      if (stage >= 1.02 && chainStart === null) chainStart = time
      if (stage < .9) chainStart = null
      if (linkStage > .01) {
        const elapsed = reduced ? 4000 : time - (chainStart ?? time)
        const gap = 900
        const segment = 260
        const life = 7600
        const first = Math.max(0, Math.floor((elapsed - life) / gap))
        const last = Math.floor(elapsed / gap)
        for (let chain = first; chain <= last; chain += 1) {
          const path = PATHS[chain % PATHS.length]
          const local = elapsed - chain * gap
          if (local < 0) continue
          const foreground = chain % 3 !== 2
          const fade = 1 - smooth((local - life + 1400) / 1400)
          const settle = 1 - .55 * smooth((local - path.points.length * segment - 900) / 1200)
          const opacity = linkStage * fade * (foreground ? 1 : .35)
          if (opacity < .02) continue
          const drawn = local / segment
          context.strokeStyle = `rgba(236, 246, 255, ${(.62 * opacity * settle).toFixed(3)})`
          context.lineWidth = Math.max(.8, width / 1400)
          context.beginPath()
          for (let step = 0; step < path.points.length - 1; step += 1) {
            const grow = clamp01(drawn - step)
            if (grow <= 0) break
            const a = projected[path.points[step]]
            const b = projected[path.points[step + 1]]
            if (step === 0) context.moveTo(a.x, a.y)
            context.lineTo(mix(a.x, b.x, grow), mix(a.y, b.y, grow))
          }
          context.stroke()
          path.points.forEach((pointIndex, step) => {
            const lit = smooth(drawn - step) * fade * (foreground ? 1 : .45)
            const flare = lit * (1 - .5 * smooth((local - path.points.length * segment - 600) / 1400))
            highlighted.set(pointIndex, Math.max(highlighted.get(pointIndex) ?? 0, flare * linkStage))
          })
          if (foreground && local > path.points.length * segment) {
            const tail = projected[path.points[path.points.length - 1]]
            context.fillStyle = `rgba(255, 255, 255, ${(opacity * settle * .9).toFixed(3)})`
            context.fillText(LINK_LABELS[chain % LINK_LABELS.length], tail.x + 9, tail.y - 9)
          }
        }
      }

      projected.sort((a, b) => b.z - a.z)
      for (const item of projected) {
        if (mainFade < .01) break
        if (!pointVisible(item.point, reveal)) continue
        if (item.z < -5.2) continue
        const edgeFade = mainFade * clamp01(Math.min(item.x, width - item.x, item.y, height - item.y) / 42)
        if (edgeFade <= 0) continue
        const radius = Math.max(0.9, item.point.size * item.perspective * (1.02 + flight * 0.42))
        // A share of the field is bright white; the rest keeps a soft range,
        // and highlighted points flare larger and pure white.
        const lit = highlighted.get(item.index) ?? 0
        const solid = item.index % 6 === 0
        const base = solid ? 1 : 0.42 + item.point.size * 0.32
        context.globalAlpha = Math.min(1, edgeFade * (base + lit))
        context.fillStyle = solid || lit > .2 ? '#ffffff' : item.index % 7 === 0 ? '#d6fff5' : item.index % 5 === 0 ? '#efe0ff' : '#e9f3ff'
        const triangleRotation = time * .00016 + item.index * 1.73
        const triangleSize = radius * (1.45 + lit * 1.6)
        if (lit > .05) {
          const glow = context.createRadialGradient(item.x, item.y, 0, item.x, item.y, triangleSize * 4)
          glow.addColorStop(0, `rgba(255,255,255,${(.45 * lit).toFixed(3)})`)
          glow.addColorStop(1, 'rgba(255,255,255,0)')
          context.fillStyle = glow
          context.fillRect(item.x - triangleSize * 4, item.y - triangleSize * 4, triangleSize * 8, triangleSize * 8)
          context.fillStyle = '#ffffff'
        }
        context.beginPath()
        for (let vertex = 0; vertex < 3; vertex += 1) {
          const angle = triangleRotation + vertex * TAU / 3 - Math.PI / 2
          const x = item.x + Math.cos(angle) * triangleSize
          const y = item.y + Math.sin(angle) * triangleSize
          if (vertex === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        }
        context.closePath()
        context.fill()
      }
      context.globalAlpha = 1

      // Step four: we keep flying; galaxies emerge small in the distance all
      // over the screen and grow past the camera, like a tunnel of them.
      const tunnel = clusterReveal
      if (tunnel > .01) {
        const travel = reduced ? 0 : time * 0.000055
        for (const galaxy of TUNNEL) {
          const p = (galaxy.offset + travel) % 1
          const depth = mix(16, .9, p)
          const scale = 5.8 / depth
          const alpha = tunnel * smooth(p / .22) * (1 - smooth((p - .84) / .14))
          if (alpha < .01) continue
          // Kept off the centre even in the distance: they pass at the sides.
          const cx = width * .5 + galaxy.bx * width * (.2 + .1 * scale)
          const cy = height * .44 + galaxy.by * height * (.18 + .09 * scale)
          const r = unit * .75 * galaxy.size * scale
          context.fillStyle = '#ffffff'
          for (const [fx, fy, shade] of galaxy.points) {
            const x = cx + fx * r
            const y = cy + fy * r
            if (x < -10 || x > width + 10 || y < -10 || y > height + 10) continue
            const dot = Math.max(1, scale * (.6 + shade * .6))
            context.globalAlpha = Math.min(1, alpha * (.55 + shade * .6))
            context.fillRect(x - dot / 2, y - dot / 2, dot, dot)
          }
        }
        context.globalAlpha = 1
      }
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    let onScreen = false
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (onScreen && !frame) frame = window.requestAnimationFrame(render)
    })
    visibility.observe(canvas)
    return () => {
      visibility.disconnect()
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [motionRef])

  return <canvas ref={canvasRef} className="physics-behavior-section__network-canvas" aria-hidden="true" />
}

function pointVisible(point, reveal) {
  return reveal >= point.reveal
}
