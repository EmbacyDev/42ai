import { INTRO_GROW_DELAY, INTRO_GROW_DURATION, introEase } from '../components/HeroScene/preloaderSpin.js'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import Studio from './Studio.jsx'
import Glass from './Glass.jsx'
import { crystalScreen } from '../components/HeroScene/crystalScreen.js'
import { heroLightState } from '../components/HeroScene/heroLightState.js'
import { crystalSlosh } from '../components/HeroScene/crystalSlosh.js'
import { TRANSITION_MODE, MASK_SPIN_DESCENT, MASK_SPIN_ZOOM } from '../components/WorldModelSection/worldModelHandoff.js'
import { FACET_STEP_TILT_X, FACET_STEP_TURN_Y, FACET_TURN_END } from './facetBeamState.js'
import HeroLightLayer from './HeroLightLayer.jsx'
import FacetLightLayer from './FacetLightLayer.jsx'
import ActiveBloom from './rendering/ActiveBloom.jsx'
import CrystalFrameDriver, { useCrystalPoseFrame } from './rendering/CrystalFrameDriver.jsx'
import {
  smootherstep,
  easeInOutQuart,
  CRYSTAL_EXTRA_SPIN,
  crystalTravelRangePx,
  crystalHeroBlend,
} from '../components/HeroScene/scrollShrink.js'
import { layoutBlock24 } from '../components/Block24Section/block24Layout.js'
import { projectDesignPoint } from '../components/HeroScene/placement.js'
import { sceneConfig } from '../components/HeroScene/sceneConfig.js'

const CRYSTAL_BASE_SCALE = 0.72
const CRYSTAL_BASE_Y = 0.596
// Matches the preloader mark's roughly 40px footprint. The hand-off now
// happens at the same screen position and apparent size, so it reads as the
// black mark changing material rather than a second, larger object appearing.
const INTRO_START_SCALE = 0.145
// Travel and growth start as soon as the loading sheet opens.
const CAMERA_FOV = 52
const CAMERA_Z = 4.94

function CrystalReadySignal({ onReady }) {
  const onReadyRef = useRef(onReady)
  const frameCountRef = useRef(0)
  const firedRef = useRef(false)
  onReadyRef.current = onReady

  const fire = () => {
    if (firedRef.current) return
    firedRef.current = true
    onReadyRef.current?.()
  }

  // Shader compile can stall on a busy GPU (hero + bulge canvases racing
  // the same context budget). The frame wait is the preferred hand-off;
  // the timeout is the guarantee so the loading sheet never traps the page
  // if a frame never lands.
  useEffect(() => {
    const failsafe = window.setTimeout(fire, 2400)
    return () => window.clearTimeout(failsafe)
  }, [])

  useFrame(() => {
    if (firedRef.current) return
    frameCountRef.current += 1
    if (frameCountRef.current < 8) return
    fire()
  })

  return null
}

function CrystalContextGuard() {
  const { gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    const prevent = (event) => event.preventDefault()
    const restore = () => {
      const width = Math.max(1, canvas.clientWidth)
      const height = Math.max(1, canvas.clientHeight)
      gl.setSize(width, height, false)
    }
    canvas.addEventListener('webglcontextlost', prevent)
    canvas.addEventListener('webglcontextrestored', restore)
    return () => {
      canvas.removeEventListener('webglcontextlost', prevent)
      canvas.removeEventListener('webglcontextrestored', restore)
    }
  }, [gl])

  return null
}

function useCrystalDpr() {
  // A stable cap avoids full-screen framebuffer reallocations at breakpoints.
  return useMemo(() => [1, 1.5], [])
}

// The scale the crystal settles at once it has fully landed on the
// carousel's active card, in the same world units as CRYSTAL_BASE_SCALE.
// A starting guess, not measured against a working preview — this
// session's browser pane wasn't reliable enough to eyeball it against, so
// expect to retune by feel once you can see it move.
// Figma 559:646: a 41.5px gem above block two (0.22 drew it at ~54px).
const CAROUSEL_TARGET_SCALE = 0.14
// The hand-off out of block three keeps the crystal at its small travelling
// size. It only grows to the Figma scale while descending in block four.
const PHYSICS_HANDOFF_SCALE = 0.22
// Block 4 keeps its original opening composition: a large whole crystal,
// centred and cropped by the lower edge. Only after that reading beat does
// it move into the four centred Figma state frames.
const PHYSICS_INTRO_CENTER_X = 0.5
const PHYSICS_TARGET_SCALE = 1.06
// The opening frame under the heading: a bigger gem, set lower and cropped
// by the bottom edge; it shrinks into the state pose as it turns.
const PHYSICS_STATES_SCALE = 1.4
const PHYSICS_TILT_X = 0.12
const PHYSICS_TILT_Z = -0.04

const STATE_ONE_ROTATION = { x: FACET_STEP_TILT_X[0], y: -Math.PI / 2, z: -0.04 }
const STATE_TWO_ROTATION = { x: FACET_STEP_TILT_X[1], y: -Math.PI, z: -0.04 }
const STATE_THREE_ROTATION = { x: FACET_STEP_TILT_X[2], y: -Math.PI * 1.5, z: -0.04 }
const STATE_FOUR_ROTATION = { x: FACET_STEP_TILT_X[3], y: FACET_STEP_TURN_Y[3], z: -0.04 }
const STATE_ONE_SHIFT_X = -0.017
const STATE_TWO_SHIFT_X = 0
const STATE_THREE_SHIFT_X = 0.008
const STATE_FOUR_SHIFT_X = 0.01
const STATE_ONE_CENTER_Y = 0.52
// While the block-four heading is on screen the crystal waits below it
// (this share of the viewport under the centre), then rises to the centre
// as the heading leaves and the first facet separates.
const PHYSICS_INTRO_DROP = 0.24
const STATE_TWO_CENTER_Y = 0.52
const STATE_THREE_CENTER_Y = 0.52
const STATE_FOUR_CENTER_Y = 0.52
const STATE_ONE_SCALE = 1.06
const STATE_TWO_SCALE = 1.06
const STATE_THREE_SCALE = 1.06
const STATE_FOUR_SCALE = 1.06
// The text-free staging frame must preserve the fourth reading pose. The
// detached panes own the first part of the portal move; enlarging the body
// here made the crystal and panes appear to fly at the same time.
const PHYSICS_CLEAN_FRAME_SCALE = STATE_FOUR_SCALE

// One interior palette for the shared crystal across its entire journey.
// Block four established the approved mint/cyan/green balance; keeping the
// colour-bearing core parameters here prevents the hero and transitions
// from silently falling back to the older violet-heavy treatment.
const UNIFIED_CRYSTAL_INTERIOR_LOOK = Object.freeze({
  friendInnerShade: 0.46,
  friendShadeColor: '#9fddea',
  friendCoreSize: 0.14,
  friendVolumeScale: 1.72,
  friendCenterPower: 0.84,
  friendCenterSize: 0.31,
  friendCenterColor: '#f5f7e8',
  friendColorBoost: 0.72,
  // The original v1 crystal colours, led by grass green. The shaders read
  // the palette as a gradient and the noise field sits mostly in its
  // middle, so dominance comes from the centre slots, not slot one: green
  // fills slots three and four, blue and violet/yellow stay at the edges.
  friendColorCount: 5,
  friendFlowColor1: '#756cff',
  friendFlowColor2: '#1d81ed',
  friendFlowColor3: '#29ae57',
  friendFlowColor4: '#29ae57',
  friendFlowColor5: '#f0ff1f',
})

// Only the unified flow colours: shading, centre light and colour boost
// stay local so the gem keeps its depth and white highlights.
const UNIFIED_CRYSTAL_COLOURS = Object.freeze({
  friendColorCount: UNIFIED_CRYSTAL_INTERIOR_LOOK.friendColorCount,
  friendFlowColor1: UNIFIED_CRYSTAL_INTERIOR_LOOK.friendFlowColor1,
  friendFlowColor2: UNIFIED_CRYSTAL_INTERIOR_LOOK.friendFlowColor2,
  friendFlowColor3: UNIFIED_CRYSTAL_INTERIOR_LOOK.friendFlowColor3,
  friendFlowColor4: UNIFIED_CRYSTAL_INTERIOR_LOOK.friendFlowColor4,
  friendFlowColor5: UNIFIED_CRYSTAL_INTERIOR_LOOK.friendFlowColor5,
})

// Figma 450:5855 → 450:6576 scales the same complete crystal composition
// (shell plus the four detached panes) toward the camera until its colour
// becomes the next section's full rounded field. The WebGL zoom stops before
// the geometry reaches the camera; the matched colour field completes the
// remaining apparent magnification without near-plane artefacts.
const PHYSICS_PORTAL_SCALE = 5.6
// v4: how far the docked gem swells during the 2→3 opening (block-two
// dock radius ≈ 24px → about the whole viewport).
const WORLD_OPEN_SCALE = 22
// After the pin releases, the section's own top (and therefore its live
// anchor) scrolls off the viewport; the 2→3 flight has to leave from this
// stable dock instead, or the crystal rides the departing block into the
// top edge and never actually slips behind the incoming frost. The Y is
// the centred cluster under the pinned nav, not a fixed 86px.
const SITE_CRYSTAL_SAMPLES = 10
const SITE_CRYSTAL_RESOLUTION = 512
const PHYSICS_CRYSTAL_SAMPLES = 12
const PHYSICS_CRYSTAL_RESOLUTION = 768
function worldToScreen(worldX, worldY, camera, vw, vh) {
  const halfFovTan = Math.tan((camera.fov * Math.PI) / 360)
  const dist = camera.position.z
  const ndcX = worldX / (halfFovTan * dist * camera.aspect)
  const ndcY = worldY / (halfFovTan * dist)
  return { x: (ndcX * 0.5 + 0.5) * vw, y: (1 - (ndcY * 0.5 + 0.5)) * vh }
}

function screenToWorld(px, py, camera, vw, vh) {
  const halfFovTan = Math.tan((camera.fov * Math.PI) / 360)
  const dist = camera.position.z
  const ndcX = (px / vw) * 2 - 1
  const ndcY = 1 - (py / vh) * 2
  return { x: ndcX * halfFovTan * dist * camera.aspect, y: ndcY * halfFovTan * dist }
}

/**
 * The atmospheric beam belongs to the portrait canvas behind the real
 * crystal. That ordering is correct for its wide haze, but it also hid the
 * first half of the ray behind the opaque crystal and hid the whole end
 * beneath the selected photograph. Keep the beam itself behind the crystal;
 * this narrow foreground pass restores only the light landing on the near
 * part of the selected photo.
 */
function CrystalBeamOverlay({ config, screenAnchorRef, cardHoverRef }) {
  const meshRef = useRef(null)
  const opacityRef = useRef(0)
  const { camera, size } = useThree()
  const origin = useMemo(() => new THREE.Vector2(), [])
  const target = useMemo(() => new THREE.Vector2(), [])
  const direction = useMemo(() => new THREE.Vector2(), [])
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry()
    next.setAttribute('position', new THREE.Float32BufferAttribute([
      0, -0.72, 0,
      0, 0.72, 0,
      1, -0.16, 0,
      1, 0.16, 0,
    ], 3))
    next.setAttribute('uv', new THREE.Float32BufferAttribute([
      0, 0,
      0, 1,
      1, 0,
      1, 1,
    ], 2))
    next.setIndex([0, 2, 1, 2, 3, 1])
    return next
  }, [])
  const uniforms = useMemo(() => ({
    uOpacity: { value: 0 },
    uTime: { value: 0 },
    uColor0: { value: new THREE.Color(config.friendFlowColor1 ?? '#756cff') },
    uColor1: { value: new THREE.Color(config.friendFlowColor2 ?? '#29ae57') },
    uColor2: { value: new THREE.Color(config.friendFlowColor3 ?? '#1d81ed') },
  }), [config])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const anchor = screenAnchorRef.current
    const hover = cardHoverRef?.current
    const heroOnly = crystalHeroBlend(window.scrollY) < 0.08
    const active = Boolean(anchor && hover?.active && heroOnly)
    if (!hover?.active) {
      // HeroScene clears the shared hover ref on the first transition
      // frame. Drop this foreground contact light in that same frame so
      // no glow follows the page into block two.
      opacityRef.current = 0
    } else {
      const follow = 1 - Math.exp(-(active ? 11 : 8) * Math.min(delta, 0.05))
      opacityRef.current += ((active ? 1 : 0) - opacityRef.current) * follow
    }
    uniforms.uOpacity.value = opacityRef.current
    uniforms.uTime.value = clock.elapsedTime
    mesh.visible = opacityRef.current > 0.004
    if (!anchor || (!active && opacityRef.current <= 0.004)) return

    const vw = size.width
    const vh = size.height
    const start = screenToWorld(anchor.x, anchor.y, camera, vw, vh)
    const targetNdcX = hover.contactX ?? hover.x ?? 0
    const targetNdcY = hover.contactY ?? hover.y ?? 0
    const targetPxX = (THREE.MathUtils.clamp(targetNdcX, -1, 1) * 0.5 + 0.5) * vw
    const targetPxY = (1 - (THREE.MathUtils.clamp(targetNdcY, -1, 1) * 0.5 + 0.5)) * vh
    const end = screenToWorld(targetPxX, targetPxY, camera, vw, vh)
    origin.set(start.x, start.y)
    target.set(end.x, end.y)
    direction.copy(target).sub(origin)
    const length = Math.max(0.001, direction.length())

    mesh.position.set(origin.x, origin.y, 0.38)
    mesh.rotation.z = Math.atan2(direction.y, direction.x)
    mesh.scale.set(length, 1, 1)
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      visible={false}
      renderOrder={140}
      frustumCulled={false}
    >
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        blending={THREE.NormalBlending}
        side={THREE.DoubleSide}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform float uOpacity;
          uniform float uTime;
          uniform vec3 uColor0;
          uniform vec3 uColor1;
          uniform vec3 uColor2;

          void main() {
            float along = clamp(vUv.x, 0.0, 1.0);
            float across = vUv.y - 0.5;
            float atBase = 1.0 - smoothstep(0.0, 0.42, along);
            float edge = 1.0 - smoothstep(0.12, 0.42, abs(across));
            float core = exp(-across * across * mix(115.0, 28.0, atBase));
            float inner = exp(-across * across * mix(34.0, 10.0, atBase));
            float halo = exp(-across * across * mix(8.5, 3.2, atBase)) * edge;

            vec3 spectral = mix(uColor0, uColor1, smoothstep(0.12, 0.56, vUv.y));
            spectral = mix(spectral, uColor2, smoothstep(0.58, 0.92, vUv.y));
            float white = clamp(0.72 + inner * 0.26, 0.0, 1.0);
            vec3 color = mix(spectral, vec3(1.0), white);

            // The beam and its source stay in the portrait canvas behind
            // the crystal. This foreground pass exists only where the light
            // lands on the selected photo, so the ray cannot wash over the
            // glass from the camera side.
            float start = smoothstep(0.0, 0.035, along);
            float contactMask = smoothstep(0.76, 0.88, along)
                              * (1.0 - smoothstep(0.96, 1.0, along));
            float shimmer = 0.94 + 0.06 * sin(along * 18.0 - uTime * 2.0);
            float alpha = (inner * 0.065 + core * 0.13) * contactMask
                        * start * edge * shimmer * uOpacity
                        * mix(0.7, 1.0, 1.0 - atBase);
            if (alpha < 0.008) discard;
            gl_FragColor = vec4(color * (1.0 + core * 0.24 * (1.0 - atBase)), min(alpha, 0.55));
          }
        `}
      />
    </mesh>
  )
}

// Critically damped follow: velocity starts at rest, so a new destination
// accelerates in and brakes at the end. A first-order chase (1 - e^(-kt))
// is already at full speed on the first frame.
function springChannel(value, velocity, target, omega, dt) {
  const steps = Math.max(1, Math.ceil((omega * dt) / 0.32))
  const h = dt / steps
  let next = value
  let vel = Number.isFinite(velocity) ? velocity : 0
  const stiffness = omega * omega
  const damping = omega * 2.08
  for (let i = 0; i < steps; i += 1) {
    const accel = (target - next) * stiffness - vel * damping
    vel += accel * h
    next += vel * h
  }
  return [next, vel]
}

/**
 * Drives the one crystal's position/scale every frame. It works entirely
 * in screen pixels, not world units: `heroAnchorPx` is where it sits at
 * rest in the hero (computed by projecting the hero's own resting world
 * position through this same camera, not hard-coded, so it tracks resize
 * correctly), and `carouselAnchorRef.current` is where the carousel's
 * active card wants it (written every carousel frame by
 * GlassCardCarousel.jsx, in viewport pixels — a ref, not React state,
 * since that updates far too often for that and this reads it from
 * inside a useFrame loop). The two are blended in pixel space and the
 * *result* is unprojected back to world space once — simpler than
 * blending in world space, since `heroAnchorPx` and the live carousel
 * target live at different depths/cameras and only pixel space is a
 * space they actually share.
 */
function TravellingCrystal({
  introReady,
  visible,
  sectionAnchorsRef,
  screenAnchorRef,
  pulseProgress,
  spinBlendRef,
  nativeScroll = false,
  refinedVisuals = nativeScroll,
  manualFrames = false,
  poseUpdateRef,
  children,
}) {
  const groupRef = useRef(null)
  // The glass refracts a transmission buffer that is empty (black) until
  // it has been drawn: on mount and whenever the material switches looks
  // (block four's treatment on/off). Hold the gem hidden for those first
  // frames and fade it in, instead of flashing a black crystal.
  const warmRef = useRef({ frames: 0 })
  const physicsSectionRef = useRef(null)
  // Readiness starts the growth; it must not initialise the gem at full size.
  const introProgressRef = useRef(0)
  const introDelayRef = useRef(0)
  const idleAxesRef = useRef(0)
  const visualRef = useRef(null)
  const fourthVisibleRef = useRef(false)
  const crystalReturnRef = useRef(0)
  const { camera, size, gl } = useThree()
  // v4: press and hold the crystal in the hero to turn it by hand. The
  // drag adds an offset on top of the usual spin; after release it keeps a
  // little inertia, and the idle motion carries on from the new angle.
  const dragRef = useRef({ active: false, x: 0, y: 0, offY: 0, offX: 0, vY: 0, vX: 0, t: 0 })
  // Liquid slosh spring: position, velocity.
  const sloshRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 })
  useEffect(() => {
    const drag = dragRef.current
    const onDown = (event) => {
      if (nativeScroll && event.pointerType !== 'mouse') return
      if (event.button !== 0 || !heroLightState.inHero || !crystalScreen.valid) return
      const r = Math.max(60, crystalScreen.r || 0)
      if (Math.hypot(event.clientX - crystalScreen.x, event.clientY - crystalScreen.y) > r) return
      drag.active = true
      drag.x = event.clientX
      drag.y = event.clientY
      drag.t = performance.now()
      drag.vY = 0
      drag.vX = 0
      document.body.style.cursor = 'grabbing'
      event.preventDefault()
    }
    const onMove = (event) => {
      if (!drag.active) return
      const now = performance.now()
      const dt = Math.max(1, now - drag.t) / 1000
      const dY = (event.clientX - drag.x) * 0.006 // v4: half the drag speed
      const dX = (event.clientY - drag.y) * 0.006
      drag.offY += dY
      drag.offX += dX
      drag.vY = dY / dt
      drag.vX = dX / dt
      drag.x = event.clientX
      drag.y = event.clientY
      drag.t = now
    }
    const onUp = () => {
      if (!drag.active) return
      drag.active = false
      document.body.style.cursor = ''
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [nativeScroll])

  useCrystalPoseFrame((_, delta) => {
    if (!groupRef.current) return
    const vw = size.width
    const vh = size.height
    const scrollY = window.scrollY
    const portraitThesis = refinedVisuals && vw <= 1100 && vh > vw
    const landscapeThesis = refinedVisuals && vw > 980 && vw <= 1100 && vh < vw
    const travelRange = crystalTravelRangePx()
    const blend = crystalHeroBlend(scrollY)

    const shrinkRaw = scrollY / Math.max(1, travelRange)
    const shrinkT = smootherstep(Math.min(Math.max(shrinkRaw, 0), 1))
    const baseScale = CRYSTAL_BASE_SCALE + (CAROUSEL_TARGET_SCALE - CRYSTAL_BASE_SCALE) * shrinkT

    const [designX, designY] = sceneConfig.crystal.designCenter
    const heroAnchorPx = projectDesignPoint(designX, designY, vw, vh)
    const anchors = sectionAnchorsRef?.current
    const secondTarget = anchors?.second
    const thirdTarget = anchors?.third
    const fourthTarget = anchors?.fourth
    const dockY = layoutBlock24(vw, vh).crystalCenterY
    const pinProgress = secondTarget?.progress ?? 0
    const toCenter = Math.min(1, Math.max(0, secondTarget?.handoff ?? 0))
    // Read by block three: the burst waits until the gem is really centred.
    crystalScreen.toCenter = toCenter
    let target = secondTarget || heroAnchorPx
    let thirdBlend = 0
    if (secondTarget) {
      // Aim at the authored dock, not the live section rect. While the
      // pin is still releasing, that rect is still travelling up the
      // page — chasing it left the crystal short of its seat unless the
      // reader kept scrolling.
      const fromY = dockY
      target = {
        x: secondTarget.x,
        // v4 band transition: carried up with the cards.
        y: fromY + (vh * 0.5 - fromY) * toCenter - vh * (secondTarget.fade ?? 0),
      }
    }
    if (secondTarget && thirdTarget) {
      const thirdTop = thirdTarget.sectionTop ?? vh
      const blendStart = vh * 0.98
      const blendEnd = vh * 0.32
      const thirdRaw = (blendStart - thirdTop) / Math.max(1, blendStart - blendEnd)
      thirdBlend = smootherstep(Math.min(Math.max(thirdRaw, 0), 1))
    }
    let fourthReveal = 0
    let fourthDescent = 0
    let fourthFocus = 0
    let fourthStateOne = 0
    let fourthStateTwo = 0
    let fourthStateThree = 0
    let fourthStateFour = 0
    let fourthCleanFrame = 0
    let fourthPortal = 0
    if (fourthTarget) {
      fourthReveal = smootherstep(Math.min(Math.max(fourthTarget.reveal ?? 0, 0), 1))
      fourthDescent = smootherstep(Math.min(Math.max(fourthTarget.descent ?? 0, 0), 1))
      fourthFocus = Math.min(Math.max(fourthTarget.focus ?? 0, 0), 1)
      fourthStateOne = Math.min(Math.max(fourthTarget.stateOne ?? 0, 0), 1)
      fourthStateTwo = Math.min(Math.max(fourthTarget.stateTwo ?? 0, 0), 1)
      fourthStateThree = Math.min(Math.max(fourthTarget.stateThree ?? 0, 0), 1)
      fourthStateFour = Math.min(Math.max(fourthTarget.stateFour ?? 0, 0), 1)
      fourthCleanFrame = Math.min(Math.max(fourthTarget.cleanFrame ?? 0, 0), 1)
      fourthPortal = Math.min(Math.max(fourthTarget.portal ?? 0, 0), 1)
    }
    // The wave suspends section four's controller. Prepare its full-size
    // introduction pose while hidden, before revealing the short upward entry.
    if (fourthTarget && document.documentElement.dataset.worldWaveActive === 'true') {
      fourthReveal = 1
      fourthDescent = 1
      fourthFocus = 1
      fourthStateOne = fourthStateTwo = fourthStateThree = fourthStateFour = 0
      fourthCleanFrame = fourthPortal = 0
    }
    // The detached panes cross the camera first. The parent crystal does not
    // begin its own push until their staggered flights are almost complete,
    // so the final beat reads as panes → body instead of one simultaneous
    // scale-up. This is derived from the same reversible playhead.
    const crystalPortal = smootherstep(Math.min(Math.max(
      (fourthPortal - 0.80) / 0.20,
      0,
    ), 1))
    const absorb = Math.min(Math.max(thirdTarget?.absorb ?? 0, 0), 1)
    // During 3→4 the colour must disappear into its white core before the
    // glass object is allowed back on screen. Starting from the old `exit`
    // value revealed the crystal as soon as the copy faded, which broke the
    // illusion of a reverse 2→3 emission.
    const crystalReturn = smootherstep(Math.min(Math.max((absorb - 0.78) / 0.2, 0), 1))
    crystalReturnRef.current = crystalReturn
    // Screen three no longer reforms the gem out of its light. Screen four
    // owns the re-entry and begins directly with its first separating facet.
    const handoffRevealEarly = fourthReveal
    // Only leave the block-two dock once the later sections actually own
    // the mesh. Reading fourthTarget alone parked it at viewport centre
    // the moment block four mounted — still on block two.
    if (fourthTarget && handoffRevealEarly > 0.004) {
      // Match the Figma compositions, which centre the crystal vertically
      // but leave horizontal room for each state's copy: state one opens
      // on the right, state two on the left. The state values are already
      // eased, so the camera-like lateral move accelerates and brakes with
      // the same premium cadence as the turn and detached facet.
      const stateOneShift = vw * STATE_ONE_SHIFT_X
      const stateTwoShift = vw * STATE_TWO_SHIFT_X
      const stateThreeShift = vw * STATE_THREE_SHIFT_X
      const stateFourShift = vw * STATE_FOUR_SHIFT_X
      let stateX = 0
      stateX += (stateOneShift - stateX) * fourthStateOne
      stateX += (stateTwoShift - stateX) * fourthStateTwo
      stateX += (stateThreeShift - stateX) * fourthStateThree
      stateX += (stateFourShift - stateX) * fourthStateFour
      let poseY = vh * 0.5 + (fourthTarget.y - vh * 0.5) * fourthDescent * (1 - fourthFocus)
      poseY += (vh * STATE_ONE_CENTER_Y - poseY) * fourthStateOne * fourthFocus
      poseY += (vh * STATE_TWO_CENTER_Y - poseY) * fourthStateTwo * fourthFocus
      poseY += (vh * STATE_THREE_CENTER_Y - poseY) * fourthStateThree * fourthFocus
      poseY += (vh * STATE_FOUR_CENTER_Y - poseY) * fourthStateFour * fourthFocus
      // Breathing room under the block-four heading.
      poseY += vh * (vw > 980 ? 0.30 : PHYSICS_INTRO_DROP) * (1 - fourthStateOne) * fourthFocus
      const introX = vw * PHYSICS_INTRO_CENTER_X
      const focusedX = fourthTarget.x + stateX
      target = {
        x: introX + (focusedX - introX) * fourthFocus * fourthStateOne,
        y: poseY,
      }
      if (portraitThesis) target.y += (vh * .43 - target.y) * fourthStateOne * fourthFocus
      if (landscapeThesis) target.x += (vw * .45 - target.x) * fourthStateOne * fourthFocus
      // The clean frame holds the exact fourth-state pose while its labels
      // leave. Only the following beat moves the virtual camera into the
      // crystal, keeping the zoom centred on the rounded block-five panel.
      if (fourthCleanFrame > 0) {
        target.x += (vw * 0.5 - target.x) * crystalPortal
        target.y += (vh * 0.5 - target.y) * crystalPortal
      }
      // Until the block-four pane pins, the crystal scrolls with it.
      // The wave already presents the pinned intro. Its final scroll alignment
      // must not remove a leftover section offset from the crystal's position.
      if (document.documentElement.dataset.worldWaveActive !== 'true') {
        target.y += Math.max(0, fourthTarget.sectionTop ?? 0)
      }
    }
    // The colour has to be seen leaving the gem. Hold the mesh at full
    // size while the field is still a halo around it, then fade it in
    // place once that halo has clearly spilled past the silhouette.
    const expansion = thirdTarget?.expansion ?? 0
    // v4: 2→3 borrows the 4→5 portal. While the colour opens, the gem
    // (already centred) swells until its own inner light fills the screen
    // (WORLD_OPEN_SCALE), and only near the end does it dissolve, leaving
    // block three's field that has opened underneath it. Played backwards
    // on the way up, so the light gathers back into the gem.
    const spill = smootherstep(Math.min(Math.max((expansion - 0.55) / 0.4, 0), 1))
    const returned = crystalReturn
    const dissolve = fourthReveal > 0 ? 0 : spill * (1 - returned)
    // Shared with Glass.jsx (liquid blur) and HeroLightLayer (the light
    // behind the gem), which both swell with the block-three opening.
    crystalScreen.worldExpansion = fourthReveal > 0 || TRANSITION_MODE !== 'light' ? 0 : expansion * (1 - returned)
    const handoffReveal = handoffRevealEarly
    let fullScale = baseScale
    if (fourthTarget && handoffReveal > 0) {
      fullScale = PHYSICS_HANDOFF_SCALE
        + (PHYSICS_TARGET_SCALE - PHYSICS_HANDOFF_SCALE) * fourthDescent
      const compactScale = portraitThesis ? Math.min(1, vw / vh * .95) : landscapeThesis ? .9 : vw < 900 ? .63 : 1
      const focusedScale = PHYSICS_STATES_SCALE * compactScale
      fullScale += (focusedScale - fullScale) * fourthFocus
      if (vw > 980) fullScale *= 1 + 0.25 * (1 - fourthStateOne) * fourthFocus
      fullScale *= 1 - (1 - 1 / 1.2) * (1 - fourthStateOne) * fourthFocus
      fullScale += (STATE_ONE_SCALE * compactScale - fullScale) * fourthStateOne * fourthFocus
      fullScale += (STATE_TWO_SCALE * compactScale - fullScale) * fourthStateTwo * fourthFocus
      fullScale += (STATE_THREE_SCALE * compactScale - fullScale) * fourthStateThree * fourthFocus
      fullScale += (STATE_FOUR_SCALE * compactScale - fullScale) * fourthStateFour * fourthFocus
      fullScale += (PHYSICS_CLEAN_FRAME_SCALE * compactScale - fullScale) * fourthCleanFrame
      fullScale += (PHYSICS_PORTAL_SCALE * compactScale - fullScale) * crystalPortal
    }
    // v5 mask: the gem is pushed toward the camera (up to +35%) just before
    // block three bursts out of it.
    fullScale *= 1 + 0.2 * (crystalScreen.preZoom ?? 0)
    {
      const opening = fourthReveal > 0 || TRANSITION_MODE !== 'light' ? 0 : expansion * (1 - returned)
      // Fills the screen by ~45% of the open, ahead of the field.
      const swell = smootherstep(Math.min(Math.max(opening / 0.45, 0), 1))
      fullScale *= 1 + (WORLD_OPEN_SCALE - 1) * swell
    }
    const introWasActive = introProgressRef.current < 1
    if (!introReady) {
      introDelayRef.current = 0
      introProgressRef.current = 0
    } else if (introProgressRef.current < 1) {
      introDelayRef.current += Math.min(delta, 0.05)
      if (introDelayRef.current >= INTRO_GROW_DELAY) {
        introProgressRef.current = Math.min(
          1,
          (introDelayRef.current - INTRO_GROW_DELAY) / INTRO_GROW_DURATION,
        )
      }
    }
    // The shared long-tail ease is applied directly to scale/position: a chase
    // would start at full speed and kill the acceleration out of the
    // preloader pose. Scroll motion uses the critically damped spring below.
    const intro = introEase(introProgressRef.current)
    const introActive = introProgressRef.current < 1
    const destinationX = heroAnchorPx.x + (target.x - heroAnchorPx.x) * blend
    const destinationY = heroAnchorPx.y + (target.y - heroAnchorPx.y) * blend
    // The real coloured mesh begins exactly where the black preloader mark
    // was. Once the white loading sheet crossfades away, it holds at that
    // small size for one beat, then moves and grows into its authored hero
    // position. No substitute CSS shape is enlarged during this hand-off.
    const targetX = vw * 0.5 + (destinationX - vw * 0.5) * intro
    const targetY = vh * 0.5 + (destinationY - vh * 0.5) * intro
    const targetScale = INTRO_START_SCALE + (fullScale - INTRO_START_SCALE) * intro
    const targetSpin = CRYSTAL_EXTRA_SPIN * blend
    let targetTiltX = PHYSICS_TILT_X * handoffReveal
    let targetTiltZ = PHYSICS_TILT_Z * handoffReveal
    let targetTurnY = 0
    // Each step turns (and tilts) the gem in its first part only; the pane
    // leaves afterwards (Glass.jsx), from the face already in place.
    const turnOf = (value) => smootherstep(Math.min(1, value / FACET_TURN_END))
    const turnOne = turnOf(fourthStateOne)
    const turnTwo = turnOf(fourthStateTwo)
    const turnThree = turnOf(fourthStateThree)
    const turnFour = turnOf(fourthStateFour)
    if (fourthTarget && handoffReveal > 0) {
      targetTiltX += (STATE_ONE_ROTATION.x - targetTiltX) * turnOne
      targetTiltZ += (STATE_ONE_ROTATION.z - targetTiltZ) * turnOne
      targetTiltX += (STATE_TWO_ROTATION.x - targetTiltX) * turnTwo
      targetTiltZ += (STATE_TWO_ROTATION.z - targetTiltZ) * turnTwo
      targetTiltX += (STATE_THREE_ROTATION.x - targetTiltX) * turnThree
      targetTiltZ += (STATE_THREE_ROTATION.z - targetTiltZ) * turnThree
      targetTiltX += (STATE_FOUR_ROTATION.x - targetTiltX) * turnFour
      targetTiltZ += (STATE_FOUR_ROTATION.z - targetTiltZ) * turnFour
    }
    const fourthJustAppeared = handoffReveal > 0.004 && !fourthVisibleRef.current
    if (handoffReveal > .004) {
      // Each step turns the gem in its first half; the facet only leaves
      // in the second half (Glass.jsx), from the face already turned out.
      targetTurnY = -Math.PI / 2 * (turnOne + turnTwo + turnThree + turnFour)
    }
    fourthVisibleRef.current = handoffReveal > 0.004

    // Scroll sets the destination. The mesh follows it with a short
    // critically damped spring: a wheel tick accelerates out of rest and
    // brakes into the new pose. Intro writes the eased pose directly so
    // grow in/out stays a true rest-to-rest curve.
    let visual = visualRef.current
    if (!visual || fourthJustAppeared || introWasActive) {
      visual = {
        x: targetX,
        y: targetY,
        scale: targetScale,
        spin: targetSpin,
        turnY: targetTurnY,
        tiltX: targetTiltX,
        tiltZ: targetTiltZ,
        vx: 0,
        vy: 0,
        vScale: 0,
        vSpin: 0,
        vTurnY: 0,
        vTiltX: 0,
        vTiltZ: 0,
      }
      visualRef.current = visual
    } else if (nativeScroll) {
      // The native timeline already eases the pose. A second spring lets the
      // oversized hidden portal pose flash on a fast reverse scroll.
      visual.x = targetX
      visual.y = targetY
      visual.scale = targetScale
      visual.spin = targetSpin
      visual.turnY = targetTurnY
      visual.tiltX = targetTiltX
      visual.tiltZ = targetTiltZ
      visual.vx = visual.vy = visual.vScale = visual.vSpin = 0
      visual.vTurnY = visual.vTiltX = visual.vTiltZ = 0
    } else if (toCenter > 0.002 && toCenter < 0.998 && !fourthJustAppeared && handoffReveal <= 0.004) {
      // The handoff tween already eases this destination. Follow it
      // directly so extra scroll ticks cannot re-scrub the flight.
      visual.x = targetX
      visual.y = targetY
      visual.vx = 0
      visual.vy = 0
      visual.scale += (targetScale - visual.scale) * 0.2
      visual.spin += (targetSpin - visual.spin) * 0.2
      visual.turnY += (targetTurnY - visual.turnY) * 0.2
      visual.tiltX += (targetTiltX - visual.tiltX) * 0.2
      visual.tiltZ += (targetTiltZ - visual.tiltZ) * 0.2
    } else {
      if (!Number.isFinite(visual.turnY)) visual.turnY = 0
      const dt = Math.min(delta, 1 / 30)
      const dissolving = dissolve > 0.01
      const fourthFlight = handoffReveal > 0.004 && (
        Math.abs(targetY - visual.y) > 0.5
        || Math.abs(targetX - visual.x) > 0.5
        || Math.abs(targetScale - visual.scale) > 0.002
        || Math.abs(targetTurnY - visual.turnY) > 0.002
        || Math.abs(targetTiltX - visual.tiltX) > 0.002
        || Math.abs(targetTiltZ - visual.tiltZ) > 0.002
      )
      const omega = fourthFlight
        ? 11
        : dissolving
          ? 18
          : blend > 0.01 && blend < 0.995
            ? 17
            : 12 + toCenter * 3 + thirdBlend * 2
      ;[visual.x, visual.vx] = springChannel(visual.x, visual.vx, targetX, omega, dt)
      ;[visual.y, visual.vy] = springChannel(visual.y, visual.vy, targetY, omega, dt)
      ;[visual.scale, visual.vScale] = springChannel(visual.scale, visual.vScale, targetScale, omega, dt)
      ;[visual.spin, visual.vSpin] = springChannel(visual.spin, visual.vSpin, targetSpin, omega, dt)
      ;[visual.turnY, visual.vTurnY] = springChannel(visual.turnY, visual.vTurnY, targetTurnY, omega, dt)
      ;[visual.tiltX, visual.vTiltX] = springChannel(visual.tiltX, visual.vTiltX, targetTiltX, omega, dt)
      ;[visual.tiltZ, visual.vTiltZ] = springChannel(visual.tiltZ, visual.vTiltZ, targetTiltZ, omega, dt)
      // v5: returning to block two by scroll, the gem is already on its
      // seat — no flight back from the centre.
      if (crystalScreen.snapToTarget) {
        crystalScreen.snapToTarget = false
        visual.x = targetX
        visual.y = targetY
        visual.scale = targetScale
        visual.vx = 0
        visual.vy = 0
        visual.vScale = 0
      }
      // v4 band transition: while block two is carried up (or back down)
      // the gem is pinned to its cards, not chased by the spring.
      const carry = secondTarget?.fade ?? 0
      if (carry > 0.0005 && thirdBlend < 0.5) {
        visual.x = targetX
        visual.y = targetY
        visual.vx = 0
        visual.vy = 0
      }
      if (handoffReveal > 0.004 && (fourthTarget?.sectionTop ?? 0) > 0) {
        visual.y = targetY
        visual.vy = 0
      }
      if (dissolve > 0.5 && handoffReveal <= 0.004) {
        visual.scale = targetScale
        visual.vScale = 0
      }
    }

    // The explicit entry offset owns the rise; do not add a spring tail that
    // settles by a few pixels when the wave hands over to the intro.
    if (document.documentElement.dataset.worldWaveActive === 'true' && fourthTarget) {
      visual.x = targetX
      visual.y = targetY
      visual.scale = targetScale
      visual.turnY = targetTurnY
      visual.tiltX = targetTiltX
      visual.tiltZ = targetTiltZ
      visual.vx = visual.vy = visual.vScale = 0
      visual.vTurnY = visual.vTiltX = visual.vTiltZ = 0
    }
    screenAnchorRef.current = { x: visual.x, y: visual.y, scale: visual.scale }
    // Shared with the hero scene, which lights around the gem (heroLight.js).
    // 0.98 world units is the gem's radius at scale 1.
    const pxPerWorld = vh / (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z)
    crystalScreen.x = visual.x
    crystalScreen.y = visual.y
    crystalScreen.r = visual.scale * 0.98 * pxPerWorld
    crystalScreen.valid = true
    crystalScreen.introElapsed = introReady ? introDelayRef.current : 0
    crystalScreen.introSettled = introReady && !introActive
    crystalScreen.afterFrame?.()

    const world = screenToWorld(visual.x, visual.y, camera, vw, vh)
    groupRef.current.position.set(world.x, world.y, 0)
    groupRef.current.scale.setScalar(visual.scale)
    groupRef.current.visible = handoffReveal > 0.004 || dissolve < 0.97
    // Compose the existing 2→3 screen-plane roll with the reverse 2→1
    // vertical turn on the same parent, using the intro's shorter clock.
    const fourthIsVisible = handoffReveal > 0.004
    const grow = introProgressRef.current
    const heroMotion = fourthIsVisible ? 1 : smootherstep(Math.min(1, Math.max(0, (grow - 0.08) / 0.5)))
    // One continuously integrated angular velocity lives in Glass. The
    // intro blends all the way to the idle velocity, never to a stop.
    // Replay the 2→1 parent turn: blend falls from one to zero, so Y
    // travels from +3π to zero. The child keeps its regular idle rotation.
    const introReturnY = CRYSTAL_EXTRA_SPIN * (1 - intro)
    if (!spinBlendRef.current) spinBlendRef.current = { value: 1 }
    spinBlendRef.current.value = heroMotion
    spinBlendRef.current.introBlend = 1
    const dt = Math.min(delta, 0.05)
    idleAxesRef.current = grow < 1 ? heroMotion : Math.min(1, idleAxesRef.current + dt / 0.6)
    const idleAxes = smootherstep(idleAxesRef.current)
    spinBlendRef.current.idleAxes = grow < 1 ? heroMotion : idleAxes
    // The crystal keeps its own spin. A selected card only moves the
    // light's exit point (crystalLight.js); it does not turn the gem.
    const drag = dragRef.current
    if (!drag.active) {
      // Inertia after release, then the tilt eases back so the gem never
      // stays upside down; the turn around Y is kept.
      const decay = Math.exp(-4 * dt)
      drag.offY += drag.vY * dt
      drag.offX += drag.vX * dt
      drag.vY *= decay
      drag.vX *= decay
      drag.offX *= Math.exp(-1.5 * dt)
    } else if (performance.now() - drag.t > 60) {
      // Held still: the hand has stopped, so the liquid should settle too.
      drag.vY *= Math.exp(-12 * dt)
      drag.vX *= Math.exp(-12 * dt)
    }
    if (fourthIsVisible) {
      drag.active = false
      drag.vY = 0
      drag.vX = 0
    }
    const waveActive = document.documentElement.dataset.worldWaveActive === 'true'
    const waveProgress = Number(document.documentElement.dataset.worldWaveProgress || 0)
    // Undo the wave's power1.inOut easing to express this offset in milliseconds.
    // Previous entry: 720–1200ms. New entry: 570–1100ms (150ms earlier, 50ms longer).
    const waveTime = (waveProgress < .5
      ? Math.sqrt(waveProgress / 2) : 1 - Math.sqrt((1 - waveProgress) / 2)) * 1200
    const arrivalT = Math.max(0, Math.min(1, (waveTime - 570) / 530))
    const waveArrival = waveActive ? smootherstep(arrivalT) : 1
    const dragY = fourthIsVisible ? 0 : drag.offY
    groupRef.current.rotation.y = fourthIsVisible
      ? visual.turnY + (1 - waveArrival) * Math.PI / 4
      // A card switch turns the gem one full turn the other way.
      : (visual.spin - pulseProgress * Math.PI * 2) * heroMotion + introReturnY + dragY
    groupRef.current.rotation.x = fourthIsVisible
      ? visual.tiltX
      : (visual.tiltX + Math.sin(pulseProgress * Math.PI) * 0.16 + drag.offX) * (grow < 1 ? heroMotion : idleAxes)
    // v5 mask: the gem turns anticlockwise as it drops to the centre and
    // keeps turning while it is pushed toward the camera.
    // Not in block four: that roll stayed on the gem there (270°) and threw
    // every facet's opening off the side its pane leaves from. Block four
    // is entered under the wave, so dropping it is never seen.
    const maskSpin = TRANSITION_MODE === 'mask' && !fourthIsVisible
      ? Math.PI * 2 * (MASK_SPIN_DESCENT * toCenter + MASK_SPIN_ZOOM * (crystalScreen.preZoom ?? 0))
      : 0
    groupRef.current.rotation.z = visual.tiltZ + maskSpin
    // Shared with the hero's crystal light so its rays turn with the gem.
    // Let the rays follow only a quarter of the fast arrival turn.
    crystalScreen.spin = groupRef.current.rotation.y
    // v4: the liquid lags behind the hand and swings back like water in a
    // bottle. Drag velocity throws it; a soft, under-damped spring brings
    // it back, so it wobbles a few times before it settles.
    const slosh = sloshRef.current
    const pushX = THREE.MathUtils.clamp(-drag.vY * 0.06, -0.6, 0.6)
    const pushY = THREE.MathUtils.clamp(drag.vX * 0.06, -0.6, 0.6)
    const k = 22
    const damp = 3.2
    slosh.vx += (pushX - slosh.x) * k * dt - slosh.vx * damp * dt
    slosh.vy += (pushY - slosh.y) * k * dt - slosh.vy * damp * dt
    slosh.x += slosh.vx * dt
    slosh.y += slosh.vy * dt
    crystalSlosh.x = fourthIsVisible ? 0 : slosh.x
    crystalSlosh.y = fourthIsVisible ? 0 : slosh.y
    const agitation = Math.min(1, Math.hypot(drag.vX, drag.vY) * 0.08 + Math.hypot(slosh.vx, slosh.vy) * 0.25)
    crystalSlosh.energy += (agitation - crystalSlosh.energy) * (1 - Math.exp(-(agitation > crystalSlosh.energy ? 10 : 1.4) * dt))
    if (fourthIsVisible) crystalSlosh.energy = 0

    // The outer shell is the stacking context. Keeping it above the world
    // pane lets the field grow behind the gem, so the colour reads as
    // spilling out of the crystal instead of covering it.
    // R3F inserts two wrappers around the canvas inside our fixed page
    // layer. Opacity/z-index must be applied to that outer fixed layer;
    // styling the inner wrapper cannot escape its parent's z30 stacking
    // context and lets block four's gradient cover the crystal completely.
    const shell = gl.domElement?.parentElement?.parentElement?.parentElement
    if (shell) {
      const gathering = absorb > 0.05 && !fourthIsVisible
      const emerging = !fourthIsVisible && expansion < 0.88 && (toCenter > 0.12 || expansion > 0.001)
      // In block four the sticky layer owns the hero-style gradient at z31;
      // keep the WebGL glass between that background and the copy/portal.
      shell.style.zIndex = fourthIsVisible
        ? '33'
        : emerging || gathering
          ? '34'
          : '30'
      // The destination panel is the camera aperture for the entire final
      // move, even before its colour field becomes visible. Clipping the
      // fixed WebGL layer here also contains post-processing bloom, so neither
      // a pane nor the enlarged body can leak beyond the later rectangle.
      // Block five is full screen: no card aperture to clip to.
      shell.style.clipPath = 'none'
      shell.style.webkitClipPath = 'none'
      // The mesh stays viewport-locked through block four. Once that
      // section scrolls away, fade the canvas so blocks 5+ stay readable.
      // The same opacity also fades the gem once its colour has spilled out.
      if (!physicsSectionRef.current?.isConnected) {
        physicsSectionRef.current = document.querySelector('.physics-behavior-section')
      }
      const physics = physicsSectionRef.current
      let pageFade = visible ? 1 : 0
      if (physics) {
        const bottom = physics.getBoundingClientRect().bottom
        const fadeEnd = vh * 0.12
        const span = Math.max(1, vh - fadeEnd)
        const t = Math.min(1, Math.max(0, (bottom - fadeEnd) / span))
        pageFade = visible ? t * t * (3 - 2 * t) : 0
      }
      const gemFade = fourthIsVisible ? 1 : 1 - dissolve
      // Keep the glass present while the coloured hero light swells behind
      // it. It disappears only once the camera is already crossing the
      // bright core, avoiding the old premature dissolve into a flat field.
      // The glass fades while its light swells, before the card forms.
      const portalFade = 1 - smootherstep(Math.min(Math.max((crystalPortal - 0.22) / 0.4, 0), 1))
      const handedToBlockFive = physics?.dataset.released === 'true'
      // 4→5: gone while the liquid covers it (portal .3–.68); its own
      // zoom into the camera used to flash its colour once the liquid left.
      const underLiquid = 1 - smootherstep(Math.min(Math.max((fourthPortal - 0.42) / 0.12, 0), 1))
      // v5 mask: the gem vanishes the instant block three bursts out of it.
      const warmState = warmRef.current
      warmState.frames += 1
      const warm = Math.min(1, Math.max(0, (warmState.frames - 4) / 12))
      // Match the title's arrival; preserve the resting pose and use the
      // actual 3D Y axis for the turn, never a screen-space roll.
      shell.style.translate = waveArrival < 1 ? `0 ${(1 - waveArrival) * 80}px` : ''
      shell.style.rotate = ''
      shell.style.opacity = (waveArrival * warm * underLiquid * pageFade * gemFade * portalFade * (1 - (crystalScreen.maskHide ?? 0)) * (handedToBlockFive ? 0 : 1)).toFixed(3)
    }
  }, manualFrames, poseUpdateRef)

  return (
    <group ref={groupRef} position={[0, CRYSTAL_BASE_Y, 0]} scale={CRYSTAL_BASE_SCALE}>
      {children}
    </group>
  )
}

function useCrystalPulse(pulseKey) {
  const [pulse, setPulse] = useState({ progress: 0, intensity: 0 })
  const didMountRef = useRef(false)

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return undefined
    }

    const duration = 980
    const startedAt = window.performance.now()
    let raf = 0

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const attack = Math.min(1, progress / 0.16)
      const releaseRaw = Math.max(0, Math.min(1, (progress - 0.16) / 0.84))
      const release = releaseRaw * releaseRaw * (3 - 2 * releaseRaw)
      const intensity = (1 - Math.pow(1 - attack, 3)) * (1 - release)
      setPulse({ progress, intensity })
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [pulseKey])

  return pulse
}

function useCrystalRotation(sectionAnchorsRef) {
  const [motionState, setMotionState] = useState(() => ({
    shouldRotate: window.scrollY < crystalTravelRangePx(),
    fourthActive: false,
  }))

  useEffect(() => {
    const update = () => {
      const fourth = sectionAnchorsRef?.current?.fourth
      const third = sectionAnchorsRef?.current?.third
      const handoffHasStarted = Boolean(
        (third && third.exit > 0.004)
        || (fourth && fourth.reveal > 0.004),
      )
      const next = {
        // Lock the mesh as soon as it is exposed beneath block three's
        // dissolving field, not only after block four has fully arrived.
        shouldRotate: window.scrollY < crystalTravelRangePx() && !handoffHasStarted,
        fourthActive: handoffHasStarted,
      }
      setMotionState((current) => (
        current.shouldRotate === next.shouldRotate
        && current.fourthActive === next.fourthActive
          ? current
          : next
      ))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return motionState
}

// Hover shimmer: no mesh in this canvas has pointer handlers (the
// wrapping div stays pointerEvents:none so the page's own buttons/links/
// carousel drag underneath still work), so hovering is detected the cheap
// way instead — a window-level pointermove compared against the
// crystal's live on-screen anchor (`screenAnchorRef`, written every frame
// by TravellingCrystal above — it moves now, unlike when this lived only
// in the hero). `hoverT` eases smoothly toward 1 on entry and 0 on exit
// rather than snapping, so the shimmer visibly rises and settles instead
// of popping.
function useCrystalHover(screenAnchorRef) {
  const [hoverT, setHoverT] = useState(0)
  const hoveringRef = useRef(false)
  const hoverTRef = useRef(0)

  useEffect(() => {
    function handleMove(event) {
      const anchor = screenAnchorRef.current
      if (!anchor) return
      // A fixed radius rather than one scaled to the crystal's current
      // size — it shrinks a lot over the course of the page, and a
      // hover target that shrinks with it would get uncomfortably small
      // once it's settled on the carousel.
      const radius = 90
      const dx = event.clientX - anchor.x
      const dy = event.clientY - anchor.y
      hoveringRef.current = Math.hypot(dx, dy) < radius
    }
    window.addEventListener('pointermove', handleMove)

    let raf
    const tick = () => {
      const target = hoveringRef.current ? 1 : 0
      hoverTRef.current += (target - hoverTRef.current) * 0.08
      if (Math.abs(hoverTRef.current - target) < 0.002) hoverTRef.current = target
      setHoverT((prev) => (Math.abs(prev - hoverTRef.current) > 0.001 ? hoverTRef.current : prev))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      cancelAnimationFrame(raf)
    }
  }, [screenAnchorRef])

  return hoverT
}

export default function PageCrystal({
  config,
  introReady = true,
  visible = introReady,
  sectionAnchorsRef,
  pulseKey = 0,
  cardHoverRef,
  onReady = () => {},
  nativeScroll = false,
  refinedVisuals = nativeScroll,
  optimizedRendering = false,
}) {
  const shellRef = useRef(null)
  const poseUpdateRef = useRef(null)
  const screenAnchorRef = useRef(null)
  const spinBlendRef = useRef({ value: introReady ? 1 : 0 })
  const { progress: pulseProgress, intensity: pulseIntensity } = useCrystalPulse(pulseKey)
  const { shouldRotate, fourthActive } = useCrystalRotation(sectionAnchorsRef)
  // Keep one render resolution for the whole journey. Reallocating the
  // full-screen WebGL buffer at the exact moment block four takes over was
  // the source of the intermittent black frame.
  const crystalDpr = useCrystalDpr()

  // Hovering ramps the same "iridescence" knob the editor already has
  // (figureChromaticAberration) well past its tuned value, softens the
  // surface (lower roughness reads as glassier/shinier), speeds up the
  // facet turn so the colour actually visibly shifts instead of just
  // sitting there brighter, and lifts bloom for a flare on the highlights
  // — together this is the crystal "переливается и приламливается"
  // (shimmers and refracts) rather than a flat on/off glow toggle.
  const shimmerConfig = useMemo(() => {
    const baseChroma = config.figureChromaticAberration ?? 0.8
    const baseRoughness = config.figureRoughness ?? 0.19
    const baseBlur = config.figureAnisotropicBlur ?? 0.28
    const baseBloom = config.bloom ?? 0
    const baseEnv = config.envIntensity ?? 0
    const baseCenterPower = config.friendCenterPower ?? 1.69
    const baseColorBoost = config.friendColorBoost ?? 1
    const baseLightMotion = config.friendLightMotion ?? 0.13
    const lerp = (from, to) => from + (to - from) * pulseIntensity
    const nextConfig = {
      ...config,
      // Growth and idle share the same Y/X rotation; TravellingCrystal
      // smoothly boosts its speed while the crystal grows.
      autoRotate: !fourthActive && (config.autoRotate !== false),
      rotateSpeed: shouldRotate ? (config.rotateSpeed ?? 0.5) : 0,
      // A stable transmission target avoids a shader/render-target rebuild
      // during the hand-off, which could briefly paint the gem black.
      samples: Math.max(config.samples ?? 10, SITE_CRYSTAL_SAMPLES),
      resolution: Math.max(config.resolution ?? 512, SITE_CRYSTAL_RESOLUTION),
      figureChromaticAberration: lerp(baseChroma, baseChroma + 1.15),
      figureRoughness: lerp(baseRoughness, Math.max(0.04, baseRoughness * 0.48)),
      figureAnisotropicBlur: lerp(baseBlur, 0.72),
      envIntensity: lerp(baseEnv, baseEnv + 0.7),
      friendCenterPower: lerp(baseCenterPower, baseCenterPower + 0.72),
      friendColorBoost: lerp(baseColorBoost, baseColorBoost + 0.55),
      friendLightMotion: lerp(baseLightMotion, baseLightMotion + 0.34),
      bloom: baseBloom + pulseIntensity * 0.28,
      bloomThreshold: config.bloomThreshold ?? 0.94,
    }
    // The hero and block two keep the local interior shape but take the
    // unified (GitHub) colours; block four takes the whole unified look.
    if (!fourthActive) return { ...nextConfig, ...UNIFIED_CRYSTAL_COLOURS }

    // Block four keeps its paler, back-lit surface treatment, while its
    // interior colour palette now remains identical to the hero crystal.
    return {
      ...nextConfig,
      ...UNIFIED_CRYSTAL_INTERIOR_LOOK,
      friendTransparency: 0.96,
      friendMatte: 0.3,
      friendFrost: 0.18,
      friendGlassBlur: 0.26,
      friendEdgeClarity: 0.82,
      friendLightDiffusion: 0.23,
    }
  }, [config, shouldRotate, fourthActive, pulseIntensity])

  const canvasStyle = useMemo(
    () => ({
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      // The canvas is allowed to render and warm its shaders while hidden,
      // but cannot leak through the preloader before the shared hand-off.
      // Opacity changes in the same React commit that hides the black mark.
      opacity: visible ? 1 : 0,
      // Kept on one compositor layer for its whole lifetime. The loading
      // sheet moves behind it at hand-off instead of moving this expensive
      // full-screen WebGL canvas between z-layers, which could flash on
      // slower GPUs.
      zIndex: 30,
    }),
    [visible],
  )

  return (
    <div ref={shellRef} style={canvasStyle} data-crystal-layer={optimizedRendering ? '5o' : 'v1'}>
      <Canvas
        frameloop={optimizedRendering ? 'never' : 'always'}
        dpr={crystalDpr}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        // Lets R3F throttle the effective render resolution down (and
        // back up) on its own when a frame is taking too long, rather
        // than the idle spin visibly stuttering at a fixed cost whenever
        // something else on the page (the carousel, in particular) is
        // momentarily busy too.
        performance={{ min: 0.4 }}
        // Must stay transparent (alpha:true) — this canvas covers the
        // WHOLE page, not just where the crystal draws, and everything
        // else (portraits, cards) lives underneath it in their own
        // canvases/DOM. Making it opaque would paint a solid rectangle
        // over the entire page.
        //
        // premultipliedAlpha:false avoids a white outline at the
        // crystal's silhouette: with the renderer's default
        // premultipliedAlpha:true, an antialiased edge pixel only
        // partially covered by the (non-premultiplied-authored) glass
        // shader's output blends toward white at that edge, however
        // transparent the canvas is elsewhere.
        gl={{
          antialias: true,
          alpha: true,
          premultipliedAlpha: false,
          powerPreference: 'high-performance',
        }}
        camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV, near: 0.1, far: 40 }}
      >
        <CrystalFrameDriver
          enabled={optimizedRendering}
          introReady={introReady}
          shellRef={shellRef}
          poseUpdateRef={poseUpdateRef}
        />
        <CrystalContextGuard />
        <Suspense fallback={null}>
          <Studio intensity={shimmerConfig.envIntensity ?? 0} neutral />
          <CrystalReadySignal onReady={onReady} />
          <TravellingCrystal
            introReady={introReady}
            visible={visible}
            sectionAnchorsRef={sectionAnchorsRef}
            screenAnchorRef={screenAnchorRef}
            pulseProgress={pulseProgress}
            spinBlendRef={spinBlendRef}
            nativeScroll={nativeScroll}
            refinedVisuals={refinedVisuals}
            manualFrames={optimizedRendering}
            poseUpdateRef={poseUpdateRef}
          >
            <Glass
              config={shimmerConfig}
              rotationLocked={fourthActive}
              rotationLockRef={sectionAnchorsRef}
              spinBlendRef={spinBlendRef}
            />
          </TravellingCrystal>
        </Suspense>
        <EffectComposer enableNormalPass={false}>
          {optimizedRendering ? <ActiveBloom
            intensity={shimmerConfig.bloom ?? 0}
            luminanceThreshold={shimmerConfig.bloomThreshold ?? 0.94}
            luminanceSmoothing={0.3}
          /> : <Bloom
            mipmapBlur
            intensity={shimmerConfig.bloom ?? 0}
            luminanceThreshold={shimmerConfig.bloomThreshold ?? 0.94}
            luminanceSmoothing={0.3}
          />}
        </EffectComposer>
      </Canvas>
      <HeroLightLayer config={shimmerConfig} />
      <FacetLightLayer config={shimmerConfig} />
    </div>
  )
}
