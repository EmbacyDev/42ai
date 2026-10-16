import { useEffect, useRef } from 'react'
import {cameraCentre} from './networkCamera.js'
import { buildShards } from '../../crystal/shards.js'
import { projectField } from './rendering/projectField.js'
import { projectTunnelPoint } from './rendering/projectTunnelPoint.js'

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

    // A cube's surface, the third figure of step two.
    const cubeHalf = 1.25
    const cubeAxis = index % 3
    const cube = [(rng() * 2 - 1) * cubeHalf, (rng() * 2 - 1) * cubeHalf, (rng() * 2 - 1) * cubeHalf]
    cube[cubeAxis] = (Math.floor(index / 3) % 2 ? 1 : -1) * cubeHalf
    points.push({
      cube,
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

function buildPaths(points, count = 110, minimum=6, maximum=15) {
  const rng = random(4251)
  return Array.from({ length: count }, (_, pathIndex) => {
    const path = [Math.floor(rng() * points.length)]
    const length = minimum + Math.floor(rng()*(maximum-minimum+1))
    while (path.length < length) {
      const current = points[path[path.length - 1]].sphere
      const angle=pathIndex*1.71+path.length*1.35
      const target=[Math.cos(angle)*.9,Math.sin(angle)*.9,(rng()-.5)*1.5]
      let closest = 0
      let closestDistance = Infinity
      for (let sample = 0; sample < 42; sample += 1) {
        const candidate = Math.floor(rng() * points.length)
        if (path.includes(candidate)) continue
        const next = points[candidate].sphere
        const separation=Math.hypot(...next.map((v,i)=>v-current[i]))
        const distance = next.reduce((sum,v,i)=>sum+(v-target[i])**2,0)+(separation<.45?12:0)+Math.max(0,separation-1.5)**2*8
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

const FIELD = createField(20000)
function makeChainTimeline(minimum,maximum){
  let period=0
  const entries=buildPaths(FIELD.slice(0,1560),110,minimum,maximum).map(path=>{
    const drawDuration=(path.points.length-1)*420
    const duration=650+drawDuration+180+975
    const entry={path,start:period,drawDuration,duration}
    period+=duration
    return entry
  })
  return {entries,period}
}

// Step four: galaxies further down the tunnel. Each is a tilted spiral that
// starts small in the distance and grows past the camera, spread around
// the screen rather than queued in one place.
const TUNNEL = (() => {
  const rng = random(4307)
  const galaxies = []
  const count = 100
  // Chaotic placement: random over the screen, only kept a little apart
  // from the ones already placed so they do not pile up.
  const placed = []
  for (let index = 0; index < count; index += 1) {
    let bx = 0
    let by = 0
    // The first two go near the middle, so the centre is never empty.
    const reach = index < 2 ? 0.35 : 1
    for (let attempt = 0; attempt < 30; attempt += 1) {
      bx = (rng() * 2 - 1) * reach
      by = (rng() * 2 - 1) * reach
      if (placed.every(([px, py]) => Math.hypot(px - bx, py - by) > 0.42)) break
    }
    placed.push([bx, by])
    // Half are loose, scattered clouds (bigger); the rest are a sphere,
    // the crystal or a cube — all 3D, turning slowly as they fly in.
    const kind = index % 2 === 0 ? 'chaos' : ['sphere', 'crystal', 'cube'][(index >> 1) % 3]
    const jitter = () => (rng() - 0.5) * 0.04
    const points = []
    const total = 1500
    if (kind === 'chaos') {
      // Spread wide and thin: a scattered cluster, not a figure.
      const lumps = Array.from({ length: 4 + Math.floor(rng() * 5) }, () => ({
        x: (rng() - 0.5) * 2.0, y: (rng() - 0.5) * 1.5, z: (rng() - 0.5) * 1.4,
        sx: 0.18 + rng() * 0.4, sy: 0.14 + rng() * 0.36, sz: 0.14 + rng() * 0.36,
      }))
      for (let p = 0; p < total; p += 1) {
        const lump = lumps[p % lumps.length]
        const g = () => Math.sqrt(-2 * Math.log(Math.max(1e-6, rng()))) * Math.cos(rng() * TAU)
        points.push([lump.x + g() * lump.sx, lump.y + g() * lump.sy, lump.z + g() * lump.sz, rng()])
      }
    } else if (kind === 'sphere') {
      for (let p = 0; p < total; p += 1) {
        const z = rng() * 2 - 1
        const a = rng() * TAU
        const r = Math.sqrt(1 - z * z)
        points.push([Math.cos(a) * r * 0.62 + jitter(), z * 0.62 + jitter(), Math.sin(a) * r * 0.62 + jitter(), rng()])
      }
    } else if (kind === 'crystal') {
      // The gem's faces (same shard geometry as step two's crystal).
      const faces = buildShards(0.62)
      for (let p = 0; p < total; p += 1) {
        const face = faces[p % faces.length]
        const v = face.geometry.attributes.position.array
        const u = Math.sqrt(rng())
        const w = rng()
        const k = [1 - u, u * (1 - w), u * w]
        const at = (axis) => face.position[axis] + k[0] * v[axis] + k[1] * v[3 + axis] + k[2] * v[6 + axis]
        points.push([at(0), at(1), at(2), rng()])
      }
      faces.forEach((face) => face.geometry.dispose())
    } else {
      const h = 0.5
      for (let p = 0; p < total; p += 1) {
        const c = [(rng() * 2 - 1) * h, (rng() * 2 - 1) * h, (rng() * 2 - 1) * h]
        c[p % 3] = (Math.floor(p / 3) % 2 ? 1 : -1) * h
        points.push([c[0], c[1], c[2], rng()])
      }
    }
    galaxies.push({ kind,
      id: index,
      bx, by, offset: index / count + rng() * 0.06, size: (kind === 'chaos' ? 1.15 : 0.7) + rng() * 0.6,
      points, spin: rng() * TAU, tilt: (rng() - 0.5) * 0.9, spinSpeed: 0.00012 + rng() * 0.00016,
    })
  }
  // Reuse geometry pools while giving every instance its own trajectory.
  // 2,600 instances leave at least 400 of each selectable solid type.
  return Array.from({length:2600},(_,index)=>index<galaxies.length?galaxies[index]:{
    ...galaxies[index%galaxies.length],id:index,
    spin:rng()*TAU,tilt:(rng()-.5)*.9,
    size:.7+rng()*.6,spinSpeed:.00012+rng()*.00016,
  })
})()

// Stable tunnel particles in world space: perspective supplies outward motion.
const TUNNEL_DUST = (() => {
  const rng = random(19841)
  return Array.from({ length: 8000 }, () => {
    const angle = rng() * TAU
    const radius = .15 + rng() * 9
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius,
      z: rng() * 36, size: .3 + rng() * .8, hue: rng() }
  })
})()

// Broad translucent perspective streams; the existing background remains visible.
const TUNNEL_STREAMS = (() => {
  const rng = random(61206)
  return Array.from({ length: 28 }, (_, i) => ({
    angle: i / 28 * TAU + (rng() - .5) * .14,
    width: .035 + rng() * .09,
    phase: rng() * TAU,
    speed: .18 + rng() * .22,
    tone: i % 4 === 0 ? '225,233,242' : i % 4 === 1 ? '86,204,191' : i % 4 === 2 ? '147,146,213' : '104,173,232',
  }))
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

export default function BehaviorNetworkTransition({ motionRef, settingsRef, optimizedRendering = false }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const renderer = createNetworkRenderer(canvasRef.current, motionRef, settingsRef, optimizedRendering)
    return renderer?.dispose
  }, [motionRef, settingsRef, optimizedRendering])

  return <canvas ref={canvasRef} className="physics-behavior-section__network-canvas" aria-hidden="true" />
}

function pointVisible(point, reveal) {
  return reveal >= point.reveal
}

// Manual mode drives the real renderer with a deterministic clock in browser tests.
export function createNetworkRenderer(canvas, motionRef, settingsRef, optimized = false, { automatic = true } = {}) {
    if (!canvas) return undefined
    const frontContext = canvas.getContext('2d', { alpha: true })
    let context = frontContext
    const depthCanvas = document.createElement('canvas')
    const softCanvas = document.createElement('canvas')
    const depthContext = depthCanvas.getContext('2d')
    const blurLayers = Array.from({length:4},(_,i)=>{
      const buffer=i===3?depthCanvas:document.createElement('canvas')
      return {canvas:buffer,context:i===3?depthContext:buffer.getContext('2d'),strength:(i+1)/4}
    })
    const softContext = softCanvas.getContext('2d')
    const projectionPool = []
    const tunnelProjection = [0, 0, 0]
    let depthScale = .5
    let copyBounds=null,copyBoundsKey=''
    const highlightedWords=new Map()
    const recentWords=[]
    const overlapsCopy=(text,x,y)=>{
      if(!copyBounds)return false
      const metrics=context.measureText(text)
      const ascent=metrics.actualBoundingBoxAscent||10
      const descent=metrics.actualBoundingBoxDescent||5
      return x+metrics.width>copyBounds.left && x<copyBounds.right &&
        y+descent>copyBounds.top && y-ascent<copyBounds.bottom
    }
    const neuronSprite=document.createElement('canvas')
    neuronSprite.width=neuronSprite.height=64
    const neuronBrush=neuronSprite.getContext('2d')
    const neuronGlow=neuronBrush.createRadialGradient(32,32,0,32,32,32)
    neuronGlow.addColorStop(0,'rgba(255,255,255,1)')
    neuronGlow.addColorStop(.12,'rgba(220,250,255,.9)')
    neuronGlow.addColorStop(.35,'rgba(170,231,255,.35)')
    neuronGlow.addColorStop(1,'rgba(130,210,255,0)')
    neuronBrush.fillStyle=neuronGlow;neuronBrush.fillRect(0,0,64,64)
    const trailSprites = new Map()
    const trailSprite = (color) => {
      if(trailSprites.has(color))return trailSprites.get(color)
      const sprite=document.createElement('canvas');sprite.width=128;sprite.height=32
      const brush=sprite.getContext('2d')
      const along=brush.createLinearGradient(0,0,128,0)
      along.addColorStop(0,`rgba(${color},0)`)
      along.addColorStop(.45,`rgba(${color},.2)`)
      along.addColorStop(.88,`rgba(${color},.8)`)
      along.addColorStop(1,`rgba(${color},0)`)
      brush.fillStyle=along;brush.fillRect(0,0,128,32)
      brush.globalCompositeOperation='destination-in'
      const across=brush.createLinearGradient(0,0,0,32)
      across.addColorStop(0,'rgba(255,255,255,0)')
      across.addColorStop(.3,'rgba(255,255,255,.22)')
      across.addColorStop(.5,'rgba(255,255,255,1)')
      across.addColorStop(.7,'rgba(255,255,255,.22)')
      across.addColorStop(1,'rgba(255,255,255,0)')
      brush.fillStyle=across;brush.fillRect(0,0,128,32)
      trailSprites.set(color,sprite)
      // Only the three currently selected colours need cached textures.
      if(trailSprites.size>6)trailSprites.delete(trailSprites.keys().next().value)
      return sprite
    }
    const useDepth = (depth, config) => {
      const distance = Math.abs(depth-config.volumeBlurDepth)
      const outside = Math.max(0,distance-(config.volumeBlurWidth ?? 14)/2)
      const softness = smooth(outside/6)
      const layer = config.volumeBlur && config.volumeBlurAmount > 0 && depth >= 0 && softness > .03
        ? blurLayers[Math.min(3,Math.floor(softness*4))] : null
      if (layer && !layer.used) {
        if (optimized) {
          // An unused depth bucket has no contribution; prepare it on first use.
          if (layer.canvas.width !== depthCanvas.width || layer.canvas.height !== depthCanvas.height) {
            layer.canvas.width = depthCanvas.width; layer.canvas.height = depthCanvas.height
          }
          layer.context.globalAlpha = 1
          layer.context.setTransform(depthScale, 0, 0, depthScale, 0, 0)
          layer.context.clearRect(0, 0, width, height)
        }
        layer.used = true
      }
      context=layer?layer.context:frontContext
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let dpr = 1
    let frame = 0
    let chainStart = null
    let chainTimeline=null,chainRangeKey='',chainClock=0
    let wasInSecond = false
    let crystalAngle = 0
    let previousStage = null
    let reformAngle = 0
    let reformBaseAngle = 0
    let lineOpacity = 0
    let tunnelTravel = 0
    let previousFrame = null
    let sceneTime = 0
    let labelOpacity = 0
    let labelTime = 0
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 }
    const onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect()
      if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) return
      pointer.targetX = clamp01((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.targetY = clamp01((event.clientY - rect.top) / rect.height) * 2 - 1
      motionRef.current.pointer={x:pointer.targetX,y:pointer.targetY}
    }
    const onPointerLeave = () => { pointer.targetX = 0; pointer.targetY = 0; motionRef.current.pointer={x:0,y:0} }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onPointerLeave)
    // Cache the expensive wide, blurred light field once, then move it as a texture.
    const streams = document.createElement('canvas')
    streams.width = streams.height = 768
    const beam = streams.getContext('2d')
    let streamSignature = ''
    const updateStreams = (config) => {
    const signature = JSON.stringify([config.rayCount,config.rayBlur,config.rayWidth,config.rayColor1,config.rayColor2,config.rayColor3,config.rayColor4])
    if (signature === streamSignature) return
    streamSignature = signature
    beam.setTransform(1,0,0,1,0,0)
    beam.clearRect(0,0,768,768)
    beam.translate(384, 384)
    beam.filter = `blur(${config.rayBlur}px)`
    for (const [index, stream] of TUNNEL_STREAMS.entries()) {
      if(index >= config.rayCount) break
      const hex = config['rayColor'+(index%4+1)]
      const tone = [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')
      beam.save()
      beam.rotate(stream.angle + index * (TAU / Math.max(1, config.rayCount) - TAU / 28))
      const gradient = beam.createLinearGradient(12, 0, 560, 0)
      gradient.addColorStop(0, `rgba(${tone},0)`)
      gradient.addColorStop(.15, `rgba(${tone},.08)`)
      gradient.addColorStop(.55, `rgba(${tone},.7)`)
      gradient.addColorStop(1, `rgba(${tone},0)`)
      beam.fillStyle = gradient
      const spread = stream.width * 560 * config.rayWidth
      beam.beginPath()
      beam.moveTo(12, 0)
      beam.bezierCurveTo(140, -spread * .25, 360, -spread, 560, -spread)
      beam.lineTo(560, spread)
      beam.bezierCurveTo(360, spread, 140, spread * .25, 12, 0)
      beam.fill()
      beam.restore()
    }

    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 1.7)
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      depthScale = Math.min(.5, 640 / Math.max(width,height))
      depthCanvas.width = softCanvas.width = Math.max(1,Math.round(width * depthScale))
      depthCanvas.height = softCanvas.height = Math.max(1,Math.round(height * depthScale))
    }

    let lastPaint = -Infinity
    const render = (time) => {
      const frameTime=time
      // v4: stops while off screen (see the observer below).
      frame = automatic && onScreen ? window.requestAnimationFrame(render) : 0
      if (!onScreen) return
      if (document.hidden || motionRef.current.visible === false) { previousFrame = time; return }
      if (time - lastPaint < 1000 / 30 - 1) return
      lastPaint = time
      const dt = previousFrame === null ? 0 : Math.min(.05, (time - previousFrame) / 1000)
      previousFrame = time
      const config = settingsRef.current
      if(motionRef.current.visible===false)return
      sceneTime += dt * 1000 * (config.paused ? 0 : config.speed)
      time = sceneTime
      updateStreams(config)
      const hex = config.particleColor
      const customColor = [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')
      const stage = motionRef.current?.stage ?? 0
      if (stage <= 3) tunnelTravel = 0
      else if (!reduced && !document.hidden && !config.paused) tunnelTravel += dt * config.speed * config.shapeSpeed * (1.1 + 1.1 * smooth(stage - 3))
      const phase = stage / 4
      // Points come in early, so the field is never an empty background.
      const reveal = smooth(stage * 1.8)
      const flight = smooth((stage - 2.5) / 1.5)
      const ink = Math.round(255 * flight)
      const particleColor = customColor
      const follow = reduced ? 0 : 1 - Math.exp(-dt * config.cursorSmoothness)
      pointer.x += (pointer.targetX - pointer.x) * follow
      pointer.y += (pointer.targetY - pointer.y) * follow
      context = frontContext
      // Begin each frame with a clean compositor state before painting the wash.
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      context.filter = 'none'
      for(const layer of blurLayers){
        layer.used=false
        if(optimized || !config.volumeBlur)continue
        if(layer.canvas.width!==depthCanvas.width || layer.canvas.height!==depthCanvas.height){
          layer.canvas.width=depthCanvas.width;layer.canvas.height=depthCanvas.height
        }
        layer.used=false
        layer.context.globalAlpha=1
        layer.context.setTransform(depthScale,0,0,depthScale,0,0)
        layer.context.clearRect(0,0,width,height)
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      if (phase <= 0.002) return

      const unit = Math.min(width * 0.14, height * 0.18) * config.shapeScale
      // Push through the loose field, then ease the virtual camera back just
      // enough to reveal that the traversed mass is one of several clusters.
      const clusterReveal = smooth((stage - 2.5) / .72)
      // Step four flies straight into the step-three galaxy and through it:
      // no central galaxy remains, only the ones streaming past at the sides.
      const cameraPush = flight * 10.4
      const mainFade = 1 // Perspective near-plane clipping completes the fly-through.
      // Step two: the camera's perspective swings and the field swirls
      // while it gathers into the crystal.
      // Integrate travel instead of deriving the angle from the current stage:
      // changing direction must never reverse the established leftward spin.
      const gatherProgress = smooth((stage - 1) / 1.5)
      if (!config.paused && !reduced) {
        crystalAngle += dt * .11 * config.rotationSpeed * (1 - flight)
        if (previousStage !== null) {
          const previousGather = smooth((previousStage - 1) / 1.5)
          const previousFlight = smooth((previousStage - 2.5) / 1.5)
          crystalAngle += Math.abs(gatherProgress - previousGather) * Math.PI * .45
            + Math.abs(flight - previousFlight) * Math.PI
        }
      }
      previousStage = stage
      const rotation = crystalAngle
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      const assemblyShown = smooth((stage - 1.3) / 1.2)
      const drift = reduced ? 0 : tunnelTravel
      const camera=cameraCentre(motionRef,config,frameTime)
      const vanishingX = width * camera.x
      const vanishingY = height * camera.y
      const grey = [1,3,5].map(i=>parseInt(config.greyColor.slice(i,i+2),16)).join(',')
      context.fillStyle = `rgba(${grey},${config.greyMix})`
      context.fillRect(0, 0, width, height)
      if (clusterReveal > .001) {
        const reach = Math.hypot(width, height) * 1.15
        context.save()
        context.translate(vanishingX, vanishingY)
        context.transform(1,camera.orbitY*.08,camera.orbitX*.1,1,0,0)
        context.rotate(Math.sin(drift * .045) * .055 + (config.cursor ? pointer.x : 0) * .035)
        context.globalAlpha = config.rays ? clusterReveal * config.rayOpacity : 0
        const breathing = 1 + Math.sin(drift * .15) * .035
        context.scale(breathing, 1 / breathing)
        context.drawImage(streams, -reach, -reach, reach * 2, reach * 2)
        context.restore()
        context.globalAlpha = 1
        // Keep the shared light background visible through the tunnel.
        const focal = Math.min(width, height) * config.focalLength
        const dustPalette=[config.dustColor1,config.dustColor2,config.dustColor3].map(hex=>
          [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(','))
        for (const [starIndex, star] of TUNNEL_DUST.entries()) {
          if(!config.dust || starIndex >= config.dustCount) break
          const z = .35 + ((star.z - tunnelTravel * 3 * config.dustSpeed) % 36 + 36) % 36
          const far = z + (.015 + flight * .035) * config.trailLength
          const x = vanishingX + (star.x-camera.orbitX*1.5)*focal/z
          const y = vanishingY + (star.y-camera.orbitY*1.2)*focal/z
          const tailX = vanishingX + (star.x-camera.orbitX*1.5)*focal/far
          const tailY = vanishingY + (star.y-camera.orbitY*1.2)*focal/far
          const distanceOpacity = config.dustFarOpacity + (1-config.dustFarOpacity) * (1-smooth((z-10)/26))
          const alpha = config.dustOpacity * clusterReveal * distanceOpacity * (1-smooth((z-26)/10)) * smooth(z/.8)
          useDepth(config.volumeBlurDust ? z : -1,config)
          context.globalAlpha=1
          // Seeded random colour per particle remains stable throughout its flight.
          const dustColor=dustPalette[Math.min(2,Math.floor(star.hue*3))]
          context.strokeStyle = `rgba(${dustColor},${alpha * .65})`
          context.lineWidth = config.dustSize * star.size * Math.min(1.7, 3/z)
          if(config.trailMotionBlur && config.trailMotionBlurAmount>0 && config.trailLength>0){
            const dx=x-tailX,dy=y-tailY,length=Math.hypot(dx,dy)
            const amount=config.trailMotionBlurAmount
            const extension=amount*Math.min(2,3/z)
            const breadth=Math.max(2,context.lineWidth*2+amount*.55*Math.min(1.5,4/z))
            context.save();context.translate(tailX,tailY);context.rotate(Math.atan2(dy,dx))
            context.globalAlpha=alpha
            context.drawImage(trailSprite(dustColor),-extension,-breadth*.5,length+extension+amount*.15,breadth)
            context.restore()
          }else{
            context.beginPath(); context.moveTo(tailX, tailY); context.lineTo(x, y); context.stroke()
          }
          context.fillStyle = `rgba(${dustColor},${alpha * .85})`
          const radius = config.dustSize * Math.min(2.2, .35 + star.size * 2.5 / z)
          context.beginPath(); context.arc(x, y, radius, 0, TAU); context.fill()
        }
      }
      context = frontContext
        const minimum=Math.round(Math.min(config.chainMin,config.chainMax))
        const maximum=Math.round(Math.max(config.chainMin,config.chainMax))
        const rangeKey=`${minimum}:${maximum}`
        if(rangeKey!==chainRangeKey){chainRangeKey=rangeKey;chainTimeline=makeChainTimeline(minimum,maximum);chainClock=0}
        const inSecond = stage >= 2.49 && stage <= 2.51
        if (inSecond && !wasInSecond) { chainClock = 650; reformBaseAngle = reformAngle - Math.PI }
        wasInSecond = inSecond
        if(!config.paused && inSecond)chainClock+=dt*1000*config.speed*config.linkSpeed*config.lineSpeed
      const clock=(reduced?4000:chainClock)%chainTimeline.period
      const currentChain=chainTimeline.entries.find(entry=>clock>=entry.start&&clock<entry.start+entry.duration)
      const reformAge=currentChain?clock-currentChain.start:650
      const reformOrdinal = Math.floor(chainClock / chainTimeline.period) * chainTimeline.entries.length
        + Math.max(0, chainTimeline.entries.indexOf(currentChain))
      const reformProgress = smooth(reformAge / 650)
      if (inSecond && !reduced) reformAngle = reformBaseAngle + (reformOrdinal + reformProgress) * Math.PI
        const assembly = assemblyShown
        const turn = rotation + reformAngle
        const tc = Math.cos(turn)
        const ts = Math.sin(turn)
      let projectionCount = Math.max(1560, stage > 2.5 ? config.mainFieldCount : config.fieldCount)
      if (optimized && stage <= 2.5 && config.fieldBlend === 0 && config.fieldStartCount !== undefined) {
        // Later points have exactly zero coverage; labels use the start count
        // and relation paths reference only the first 1560 indices.
        projectionCount = Math.min(projectionCount, Math.max(1560, config.fieldStartCount))
      }
      const projected = flight >= .999 ? [] : optimized ? projectField(FIELD,
        projectionCount, projectionPool, {
          fill: stage > 2.5 ? config.mainFieldFill : stage > 1.01 ? config.fieldFill : 0,
          assembly, tilt: -reformAngle * .65 + assemblyShown * (.55 + (reduced ? 0 : Math.sin(time * .00018) * .16 * (1 - flight))),
          tc, ts, cameraPush, width, height, unit, flight, cameraY: camera.y,
        }) : FIELD.slice(0,Math.max(1560,stage>2.5?config.mainFieldCount:config.fieldCount)).map((point, index) => {
        const sample=Math.sin((index+1)*127.1+311.7)*43758.5453
        const radial=Math.cbrt(sample-Math.floor(sample))
        const fill=stage>2.5?config.mainFieldFill:stage>1.01?config.fieldFill:0
        const fillScale=mix(1,radial,fill)
        const xyz = point.scatter.map((value, axis) => {
          const shape = point.crystal[axis] * fillScale
          return mix(value * .66, shape, assembly)
        })
        const [rawX, rawY, rawZ] = xyz
        const tilt = -reformAngle * .65 + assemblyShown * (.55 + (reduced ? 0 : Math.sin(time * .00018) * .16 * (1 - flight)))
        const tiltedY = rawY * Math.cos(tilt) - rawZ * Math.sin(tilt)
        const tiltedZ = rawY * Math.sin(tilt) + rawZ * Math.cos(tilt)
        const x = rawX * tc + tiltedZ * ts
        const z = -rawX * ts + tiltedZ * tc - cameraPush
        const perspective = 5.8 / Math.max(.12, 5.8 + z)
        return {
          x: width * 0.5 + x * unit * perspective * (1 + flight * .65),
          y: height * mix(0.38,camera.y,flight) + tiltedY * unit * perspective * (1 + flight * .4),
          z,
          perspective,
          point,
          index,
        }
      })

      // The relation lines keep drawing while the crystal forms.
      lineOpacity = Math.max(0, Math.min(1, lineOpacity + (motionRef.current.linesActive === false ? -1 : 1) * dt / .15))
      const linkStage = smooth((stage - 2.4)/.1) * (1 - smooth(stage - 3)) * smooth(lineOpacity)
      context.lineWidth = Math.max(0.55, width / 1900)
      context.font = `${Math.max(4.5, width / 190 - 2)}px 'Geist Mono', monospace`
      context.textBaseline = 'middle'

      // Step one: faint labels everywhere, and a few bright, slightly larger
      // ones in the foreground that light up a point, hold, and move on.
      // Fade before geometry starts moving; re-enter only at the settled
      // first-step pose. Keep the word clock paused while labels are hidden.
      const labelsActive = motionRef.current.labelsActive ?? (Math.abs(stage - 1) < .001)
      labelOpacity = Math.max(0, Math.min(1, labelOpacity + (labelsActive ? 1 : -1) * dt / .15))
      if (labelsActive && labelOpacity === 1 && !config.paused) labelTime += dt * 1000 * config.speed
      const labelStage = smooth(stage) * (1 - smooth(stage - 1)) * smooth(labelOpacity)
      const highlighted = new Map()
      const neuronLabels=[]
      if (config.labels && labelStage > .01) {
        const labelCount = Math.min(projected.length, config.fieldStartCount ?? projected.length)
        const boundsKey=[width,height,config.text,config.textValue,config.textSize,config.textWidth,config.textBottom,config.textWeight].join('|')
        if(copyBoundsKey!==boundsKey){
          copyBoundsKey=boundsKey
          const copy=canvas.parentElement.querySelector('.scene-copy[data-active="true"]')
          if(copy){
            const rect=copy.getBoundingClientRect(),origin=canvas.getBoundingClientRect()
            copyBounds={left:rect.left-origin.left-24,right:rect.right-origin.left+24,
              top:rect.top-origin.top-24,bottom:rect.bottom-origin.top+24}
          }else copyBounds=null
        }
        for (let index = 31; index < labelCount; index += 89) {
          const item = projected[index]
          if(!item)continue
          if (!pointVisible(item.point, reveal)) continue
          context.fillStyle = `rgba(${particleColor}, ${(labelStage * .32).toFixed(3)})`
          const text=LINK_LABELS[index % LINK_LABELS.length]
          if(!overlapsCopy(text,item.x+7,item.y-7))context.fillText(text,item.x+7,item.y-7)
        }
        const bigFont = `${Math.max(8, width / 108 - 2)}px 'Geist Mono', monospace`
        for (let slot = 0; slot < 4; slot += 1) {
          const span = 2600
          const local = (reduced ? 0 : labelTime) + slot * span / 4
          const cycle = Math.floor(local / span)
          const t = (local % span) / span
          const life = smooth(t / .22) * (1 - smooth((t - .72) / .26))
          const index = pick(slot, cycle, labelCount)
          const item = projected[index]
          if(!item)continue
          if (item.x < 60 || item.x > width - 180 || item.y < 50 || item.y > height - 60) continue
          context.font = bigFont
          const event=cycle*4-slot
          let text=highlightedWords.get(event)
          if(!text){
            if(life<.01)continue
            // Choose only after the label is actually eligible to appear.
            const candidates=LINK_LABELS.filter(word=>!recentWords.includes(word)&&!overlapsCopy(word,item.x+12,item.y-12))
            if(!candidates.length)continue
            text=candidates[Math.floor(random(event*971+4271)()*candidates.length)]
            highlightedWords.set(event,text)
            recentWords.push(text)
            if(recentWords.length>4)recentWords.shift()
            if(highlightedWords.size>64)highlightedWords.delete(highlightedWords.keys().next().value)
          }
          if(overlapsCopy(text,item.x+12,item.y-12))continue
          highlighted.set(index, life * labelStage)
          context.fillStyle = `rgba(${particleColor}, ${(life * labelStage).toFixed(3)})`
          context.fillText(text, item.x + 12, item.y - 12)
        }
        context.font = `${Math.max(4.5, width / 190 - 2)}px 'Geist Mono', monospace`
      }

      // Step two: relations are drawn one chain at a time, point to point,
      // each chain flaring its cluster white, then settling into the
      // background while the next one builds somewhere else.
      if (stage >= 1.02 && chainStart === null) chainStart = time
      if (stage < .9) chainStart = null
      if (linkStage > .01 && projected.length) {
        for (const [chain,entry] of chainTimeline.entries.entries()) {
          const {path,drawDuration,duration}=entry
          const local=(clock-entry.start+chainTimeline.period)%chainTimeline.period-650
          if(local<0||local>=duration-650)continue
          const fade = 1 - smooth((local-drawDuration-180)/975)
          const opacity = config.linkOpacity * config.lineBrightness * linkStage * fade * smooth(local/225)
          if(opacity<.02)continue
          // Ease the complete journey, without stopping at every neuron.
          const drawn = smooth(clamp01(local/drawDuration))*(path.points.length-1)
          const wave=position=>{
            const age=drawn-position
            return smooth((age+.12)*4)*(1-smooth((age-2.5)*config.lineFadeSpeed/2.5))
          }
          // Connections stay on the sharp canvas, outside all depth-blur buffers.
          context=frontContext
          context.save()
          context.filter='none'
          context.globalAlpha=1
          context.lineJoin='round';context.lineCap='round'
          const coreWidth=config.lineThickness*Math.max(.65,width/1700)
          for(let step=0;step<path.points.length-1;step++){
            const grow=clamp01(drawn-step)
            if(grow<=0)break
            const a=projected[path.points[step]],b=projected[path.points[step+1]]
            if(!a||!b)continue
            const px=mix(a.x,b.x,grow),py=mix(a.y,b.y,grow)
            if(Math.hypot(px-a.x,py-a.y)<.1)continue
            const tail=wave(step),head=wave(step+grow)
            if(Math.max(tail,head)<.005)continue
            const gradient=context.createLinearGradient(a.x,a.y,px,py)
            for(let stop=0;stop<=4;stop++){
              const t=stop/4
              gradient.addColorStop(t,`rgba(192,226,242,${Math.min(.75,opacity*.7*wave(step+grow*t))})`)
            }
            context.strokeStyle=gradient
            // Thin translucent filament with softly diffused edges.
            for(const [blur,multiplier,alpha] of [[3,2.4,.18],[1.3,1.35,.4],[.5,1,.75]]){
              context.filter=blur?`blur(${blur*config.lineBlur}px)`:'none'
              context.lineWidth=coreWidth*multiplier
              context.globalAlpha=alpha
              context.beginPath();context.moveTo(a.x,a.y);context.lineTo(px,py);context.stroke()
            }
          }
          context.filter='none';context.globalAlpha=1
          const headIndex=Math.min(path.points.length-2,Math.floor(drawn))
          const headFrom=projected[path.points[headIndex]],headTo=projected[path.points[headIndex+1]]
          if(headFrom&&headTo){
          const fraction=clamp01(drawn-headIndex)
          const pulseX=mix(headFrom.x,headTo.x,fraction),pulseY=mix(headFrom.y,headTo.y,fraction)
          const glowSize=11
          context.globalAlpha=Math.min(.55,opacity*.55)
          context.drawImage(neuronSprite,pulseX-glowSize,pulseY-glowSize,glowSize*2,glowSize*2)
          }
          context.restore()
          path.points.forEach((pointIndex,step)=>{
            const flare=wave(step)*fade*linkStage*smooth(local/225)*config.lineBrightness
            highlighted.set(pointIndex,Math.max(highlighted.get(pointIndex)??0,flare))
            if(flare>.02){
              const point=projected[pointIndex]
              if(!point)return
              neuronLabels.push({x:point.x,y:point.y,alpha:Math.min(1,flare),text:LINK_LABELS[(chain*5+step)%LINK_LABELS.length]})
            }
          })

        }
      }

      projected.sort((a, b) => b.z - a.z)
      for (const item of projected) {
        if ((!config.particles && stage <= 2.5) || mainFade < .01) break
        if(item.index >= config.fieldCount) continue
        if (!pointVisible(item.point, reveal)) continue
        if (item.z <= -5.68) continue
        // The copy area (centre, lower part) stays mostly clear so the text
        // reads on every step.
        const inCopyX = clamp01(1 - Math.abs(item.x - width * .5) / (width * .34))
        const inCopyY = smooth((item.y - height * .62) / (height * .1)) * (1 - smooth((item.y - height * .93) / (height * .05)))
        const copyClear = 1 - .82 * smooth(inCopyX * 3) * inCopyY
        const coverage = stage <= 2.5 && config.fieldStartCount !== undefined
          ? mix(item.index < config.fieldStartCount ? 1 : 0, item.index < config.fieldEndCount ? 1 : 0, config.fieldBlend) : 1
        // Fade before crossing the camera, rather than leaving opaque dots
        // on the near plane. Engage early in the fly-through.
        const passingCamera = smooth(flight / .18)
        const nearFade = mix(1, Math.pow(smooth((5.8 + item.z - .5) / 3.3), 1.5), passingCamera)
        const edgeFade = coverage * nearFade * copyClear * mainFade * clamp01(Math.min(item.x, width - item.x, item.y, height - item.y) / 42)
        if (edgeFade <= 0) continue
        useDepth(5.8 + item.z,config)
        const sizeSpread = stage <= 1.01 ? config.particleSizeSpread : 1
        const dotPerspective = mix(item.perspective, Math.min(item.perspective, 2.8), passingCamera)
        const radius = config.particleSize * mix(1, Math.max(0.9, item.point.size * dotPerspective * 1.02),sizeSpread)
        // A share of the field is bright white; the rest keeps a soft range,
        // and highlighted points flare larger and pure white.
        const lit = highlighted.get(item.index) ?? 0
        if(stage<=1.01 && lit>.1) useDepth(-1,config)
        const solid = item.index % 6 === 0
        // Stable opacity per point: translucent background neurons and denser ones.
        const base = linkStage>.01
          ? mix(1,.15 + .85*Math.pow(item.point.reveal/.88,1.4),config.particleOpacitySpread)
          : solid ? 1 : 0.65 + item.point.size * 0.32
        context.globalAlpha = config.particleOpacity * Math.min(1, edgeFade * (base + lit))
        context.fillStyle = `rgb(${particleColor})`
        const triangleRotation = time * .00016 + item.index * 1.73
        // Step one's crystals are 1.2× smaller; from step two on the
        // usual size returns.
        const stepOneShrink = mix(1 / 1.2, 1, smooth(stage - 1))
        const triangleSize = radius * (1.45 + lit * 1.6 * sizeSpread) * stepOneShrink
        if(linkStage>.01){
          const halo=radius*(6+lit*8)
          context.globalAlpha=Math.min(1,config.particleOpacity*edgeFade*linkStage*(.18*base+lit*.82))
          context.drawImage(neuronSprite,item.x-halo,item.y-halo,halo*2,halo*2)
          context.globalAlpha=config.particleOpacity*Math.min(1,edgeFade*(base+lit))
          context.fillStyle=lit>.05?`rgba(235,252,255,${Math.min(1,.55+lit)})`:`rgb(${particleColor})`
        }
        if (lit > .05 && linkStage<.01) {
          // A wide, soft halo rather than a visible disc.
          const halo = triangleSize * 8
          const glow = context.createRadialGradient(item.x, item.y, 0, item.x, item.y, halo)
          glow.addColorStop(0, `rgba(${particleColor},${(.3 * lit).toFixed(3)})`)
          glow.addColorStop(.35, `rgba(${particleColor},${(.1 * lit).toFixed(3)})`)
          glow.addColorStop(1, `rgba(${particleColor},0)`)
          context.fillStyle = glow
          context.fillRect(item.x - halo, item.y - halo, halo * 2, halo * 2)
          context.fillStyle = `rgb(${particleColor})`
        }
        context.beginPath()
        // Our hexagonal crystal as the particle, not a triangle.
        for (let vertex = 0; vertex < 6; vertex += 1) {
          const angle = triangleRotation + vertex * TAU / 6 - Math.PI / 2
          const x = item.x + Math.cos(angle) * triangleSize
          const y = item.y + Math.sin(angle) * triangleSize
          if (vertex === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        }
        context.closePath()
        context.fill()
      }
      context = frontContext
      context.globalAlpha = 1

      // Labels follow only active neurons and are drawn above the particle field.
      if(neuronLabels.length){
        context=frontContext
        context.save()
        context.filter='none'
        context.font=`${Math.max(8,width/108-2)}px 'Geist Mono', monospace`
        context.textBaseline='middle'
        const copy=canvas.parentElement.querySelector('.scene-copy[data-active="true"]')
        const origin=canvas.getBoundingClientRect()
        const rect=copy?.getBoundingClientRect()
        const occupied=[]
        for(const label of neuronLabels){
          const x=label.x+12,y=label.y-12,w=context.measureText(label.text).width
          if(x<8||x+w>width-8||y<16||y>height-16)continue
          if(rect&&x+w>rect.left-origin.left-20&&x<rect.right-origin.left+20&&y+10>rect.top-origin.top-20&&y-10<rect.bottom-origin.top+20)continue
          if(occupied.some(box=>x<box.x+box.w+8&&x+w+8>box.x&&Math.abs(y-box.y)<20))continue
          occupied.push({x,y,w})
          context.globalAlpha=label.alpha
          context.fillStyle=`rgb(${particleColor})`
          context.fillText(label.text,x,y)
        }
        context.restore()
      }

      // Step four: we keep flying; galaxies emerge small in the distance all
      // over the screen and grow past the camera, like a tunnel of them.
      const tunnel = clusterReveal
      if (tunnel > .01) {
        const tunnelUnit=Math.min(width*.14,height*.18)*config.tunnelShapeScale
        const travel = tunnelTravel / 45
        const visibleGalaxies = TUNNEL.filter(g=>
          g.kind==='sphere'?config.spheres:g.kind==='cube'?config.cubes:g.kind==='crystal'?config.crystals:config.clouds).slice(0,config.shapeCount)
        const perShape = Math.max(1,Math.floor(config.fieldCount / Math.max(1,visibleGalaxies.length)))
        for (const [galaxyIndex, galaxy] of visibleGalaxies.entries()) {
          if(!config.shapes) break
          // Uneven arrival times; reseed only while a figure wraps invisibly.
          const phaseSeed=random((galaxy.id+1)*7127)()
          const progress=phaseSeed+travel
          const cycle=Math.floor(progress)
          const p=progress-cycle
          const laneRandom=random((galaxy.id+1)*9187+cycle*61027)
          // Travel from the distant tunnel through the camera plane. Size is
          // entirely perspective-driven; there is no scale-in or early fade-out.
          const depth = mix(42, -3, p)
          const scale = 5.8 / Math.max(.2,depth)
          // Fade distant particles independently of blur, keeping the middle crisp.
          const distanceOpacity = config.figureFarOpacity + (1-config.figureFarOpacity) * (1-smooth((depth-8)/24))
          const alpha = tunnel * distanceOpacity * (.28 + .72 * smooth(p / .06))
          if (alpha < .01) continue
          // Bias changes probabilities, never imposes an empty central ring.
          // Keep a central lane available even with a small number of figures.
          const throughCentre=config.shapeCenterShare>0 &&
            (galaxyIndex===0 || laneRandom()<config.shapeCenterShare)
          const laneAngle=laneRandom()*TAU
          const radiusSample=Math.sqrt(laneRandom())
          const nearWall=!throughCentre && laneRandom()<config.shapeEdgeBias
          const laneRadius=throughCentre ? Math.sqrt(laneRandom())*.09
            : nearWall ? .6+radiusSample*.4 : radiusSample
          const laneX=Math.cos(laneAngle)*laneRadius
          const laneY=Math.sin(laneAngle)*laneRadius
          const sideOffset=throughCentre ? 0 : config.shapeSideSpawn*laneRandom()
          // Lateral positions live in world space, so every lane converges
          // into the same distant tunnel instead of spawning on the screen.
          const worldX=laneX*(4*config.shapeSpreadX+4*sideOffset)-camera.orbitX*2
          const worldY=laneY*(3*config.shapeSpreadY+3*sideOffset)-camera.orbitY*1.6
          const cx = vanishingX + worldX*tunnelUnit*scale
          const cy = vanishingY + worldY*tunnelUnit*scale
          const figureSize = config.figureSize * mix(1, galaxy.size, config.figureSizeSpread * 2)
          if(depth + figureSize*1.5 < .2)continue
          // Clusters passing over the copy (centre, lower part) dim there,
          // so the text stays readable.
          const overCopyX = clamp01(1 - Math.abs(cx - width * .5) / (width * .34))
          const overCopyY = smooth((cy - height * .55) / (height * .12))
          const copyDim = 1 - .7 * smooth(overCopyX * 3) * overCopyY
          const clusterAlpha = alpha * copyDim
          // Each cluster turns slowly in 3D (its own axis and speed) and is
          // drawn in perspective, so it reads as a volume.
          const yaw = galaxy.spin + (reduced ? 0 : time * galaxy.spinSpeed)
          const cy0 = Math.cos(yaw)
          const sy0 = Math.sin(yaw)
          const ct = Math.cos(galaxy.tilt)
          const stt = Math.sin(galaxy.tilt)
          const project = (point) => {
            const fill = galaxy.kind==='chaos'?0:config.shapeFill
            const radial = Math.cbrt(Math.max(.0001,point[3]))
            const factor = mix(1,radial,fill)
            const [px,py,pz] = point.map((v,i)=>i<3?v*factor:v)
            const x1 = px * cy0 + pz * sy0
            const z1 = -px * sy0 + pz * cy0
            const y2 = py * ct - z1 * stt
            const z2 = py * stt + z1 * ct
            const pointDepth = depth + z2 * .75 * figureSize
            if (pointDepth < .2) return [-10000, -10000, 0]
            const perspective=5.8/pointDepth
            return [vanishingX + (worldX + x1*.75*figureSize)*tunnelUnit*perspective,
              vanishingY + (worldY + y2*.75*figureSize)*tunnelUnit*perspective,
              Math.max(.2,depth)/pointDepth]
          }
          useDepth(depth,config)
          context.fillStyle = `rgb(${particleColor})`
          const sampleCount = perShape
          for (let sampleIndex=0;sampleIndex<sampleCount;sampleIndex++) {
            const sourceIndex = Math.floor(sampleIndex * galaxy.points.length / sampleCount)
            const source = galaxy.points[sourceIndex]
            // Extra samples fill the volume without allocating a large pool for every figure.
            const point = sampleCount <= galaxy.points.length ? source : source.map((v,axis)=>axis<3?v + Math.sin((sampleIndex+1)*127.1+(axis+1)*311.7)*.012:v)
            const [x, y, depthScale] = optimized
              ? projectTunnelPoint(point, galaxy.kind === 'chaos' ? 0 : config.shapeFill,
                cy0, sy0, ct, stt, depth, figureSize, vanishingX, vanishingY,
                worldX, worldY, tunnelUnit, tunnelProjection)
              : project(point)
            if (x < -10 || x > width + 10 || y < -10 || y > height + 10) continue
            const shade = point[3]
            const dot = config.particleSize * Math.max(.8, scale * (.45 + shade * .5) * depthScale)
            context.globalAlpha = config.particleOpacity * Math.min(1, clusterAlpha * (.45 + shade * .55) * Math.min(1.2, depthScale))
            if (dot < 2.4) {
              context.fillRect(x - dot / 2, y - dot / 2, dot, dot)
            } else {
              // Near the camera: the same hexagonal crystal particle.
              context.beginPath()
              for (let vertex = 0; vertex < 6; vertex += 1) {
                const angle = vertex * TAU / 6 - Math.PI / 2
                const hx = x + Math.cos(angle) * dot
                const hy = y + Math.sin(angle) * dot
                if (vertex === 0) context.moveTo(hx, hy)
                else context.lineTo(hx, hy)
              }
              context.closePath()
              context.fill()
            }
          }
        }
        // Relations run between the figures: each one links to its two
        // nearest neighbours on screen, faint while they are far away.
        context.globalAlpha = 1
        context.lineWidth = Math.max(.6, width / 1700)
        context.globalAlpha = 1
      }
      context = frontContext
      if(config.volumeBlur && config.volumeBlurAmount > 0) {
        // Blur one small depth buffer, never individual particles or the text.
        for(const layer of blurLayers){
          if(!layer.used)continue
          softContext.clearRect(0,0,softCanvas.width,softCanvas.height)
          softContext.filter = `blur(${config.volumeBlurAmount * layer.strength * depthScale}px)`
          softContext.drawImage(layer.canvas,0,0)
          softContext.filter = 'none'
          context.globalAlpha=1
          context.drawImage(softCanvas,0,0,width,height)
        }
      }
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    let onScreen = !automatic
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (onScreen && !frame) frame = window.requestAnimationFrame(render)
    })
    if (automatic) visibility.observe(canvas)
    const dispose = () => {
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      visibility.disconnect()
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
    return { render, resize, dispose }
}
