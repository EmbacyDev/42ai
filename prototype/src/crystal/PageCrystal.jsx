import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import Studio from './Studio.jsx'
import Glass from './Glass.jsx'
import {
  smootherstep,
  easeInOutQuart,
  CRYSTAL_EXTRA_SPIN,
  crystalTravelRangePx,
  crystalHeroBlend,
} from '../components/HeroScene/scrollShrink.js'
import { preloaderSpinAngle, PRELOADER_SPIN_OMEGA } from '../components/HeroScene/preloaderSpin.js'
import { layoutBlock24 } from '../components/Block24Section/block24Layout.js'
import { projectDesignPoint } from '../components/HeroScene/placement.js'
import { sceneConfig } from '../components/HeroScene/sceneConfig.js'

const CRYSTAL_BASE_SCALE = 0.72
const CRYSTAL_BASE_Y = 0.596
// Matches the preloader mark's roughly 40px footprint. The hand-off now
// happens at the same screen position and apparent size, so it reads as the
// black mark changing material rather than a second, larger object appearing.
const INTRO_START_SCALE = 0.145
// Hold the coloured version for a beat while the white loading sheet opens,
// then let it travel and grow into its authored hero pose.
const INTRO_GROW_DELAY = 0.32
const INTRO_GROW_DURATION = 1.5
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

function useCrystalDpr(highQuality = false) {
  const [dpr, setDpr] = useState(() => {
    if (typeof window === 'undefined') return highQuality ? [1.25, 1.75] : [1.15, 1.5]
    const compact = window.innerWidth < 900 || window.innerHeight < 700
    if (highQuality) return compact ? [1.25, 1.75] : [1.5, 2]
    return compact ? [1.25, 1.5] : [1.5, 2]
  })

  useEffect(() => {
    const update = () => {
      const compact = window.innerWidth < 900 || window.innerHeight < 700
      const next = highQuality
        ? (compact ? [1.25, 1.75] : [1.5, 2])
        : (compact ? [1.25, 1.5] : [1.5, 2])
      setDpr((current) => (current[0] === next[0] && current[1] === next[1] ? current : next))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [highQuality])

  return dpr
}

// The scale the crystal settles at once it has fully landed on the
// carousel's active card, in the same world units as CRYSTAL_BASE_SCALE.
// A starting guess, not measured against a working preview — this
// session's browser pane wasn't reliable enough to eyeball it against, so
// expect to retune by feel once you can see it move.
const CAROUSEL_TARGET_SCALE = 0.22
// The hand-off out of block three keeps the crystal at its small travelling
// size. It only grows to the Figma scale while descending in block four.
const PHYSICS_HANDOFF_SCALE = CAROUSEL_TARGET_SCALE
// Block 4 keeps its original opening composition: a large whole crystal,
// centred and cropped by the lower edge. Only after that reading beat does
// it move into the four centred Figma state frames.
const PHYSICS_INTRO_CENTER_X = 0.5
const PHYSICS_TARGET_SCALE = 1.95
const PHYSICS_STATES_SCALE = 1.14
const PHYSICS_TILT_X = -0.14
const PHYSICS_TILT_Z = -0.34
// State one follows the new 299:28666 composition: the crystal presents a
// broad upper-right facet to camera while the extracted pane clears the
// silhouette above and to the right.
const STATE_ONE_ROTATION = { x: 0.08, y: -0.34, z: -0.03 }
const STATE_TWO_ROTATION = { x: 0.2, y: 0.1, z: -0.05 }
const STATE_THREE_ROTATION = { x: 0.18, y: 0.34, z: 0.06 }
const STATE_FOUR_ROTATION = { x: 0.08, y: -0.34, z: -0.03 }
const STATE_ONE_SHIFT_X = 0.014
const STATE_TWO_SHIFT_X = 0
const STATE_THREE_SHIFT_X = 0.008
const STATE_FOUR_SHIFT_X = 0.01
const STATE_ONE_CENTER_Y = 0.495
const STATE_TWO_CENTER_Y = 0.466
const STATE_THREE_CENTER_Y = 0.432
const STATE_FOUR_CENTER_Y = 0.456
const STATE_ONE_SCALE = 1.14
const STATE_TWO_SCALE = 1.06
const STATE_THREE_SCALE = 1.02
const STATE_FOUR_SCALE = 1.06
// Figma 450:5855 → 450:6576 scales the same complete crystal composition
// (shell plus the four detached panes) by roughly 5.78× until its colour
// becomes the next section's full rounded field.
const PHYSICS_PORTAL_SCALE = STATE_FOUR_SCALE * 5.78
// After the pin releases, the section's own top (and therefore its live
// anchor) scrolls off the viewport; the 2→3 flight has to leave from this
// stable dock instead, or the crystal rides the departing block into the
// top edge and never actually slips behind the incoming frost. The Y is
// the centred cluster under the pinned nav, not a fixed 86px.
const SITE_CRYSTAL_SAMPLES = 10
const SITE_CRYSTAL_RESOLUTION = 512
const PHYSICS_CRYSTAL_SAMPLES = 14
const PHYSICS_CRYSTAL_RESOLUTION = 1024
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
  sectionAnchorsRef,
  screenAnchorRef,
  pulseProgress,
  spinBlendRef,
  children,
}) {
  const groupRef = useRef(null)
  const physicsSectionRef = useRef(null)
  const introProgressRef = useRef(introReady ? 1 : 0)
  const introDelayRef = useRef(0)
  const visualRef = useRef(null)
  const fourthVisibleRef = useRef(false)
  const zSpinRef = useRef(null)
  const { camera, size, gl } = useThree()

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const vw = size.width
    const vh = size.height
    const scrollY = window.scrollY
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
        y: fromY + (vh * 0.5 - fromY) * toCenter,
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
    const absorb = Math.min(Math.max(thirdTarget?.absorb ?? 0, 0), 1)
    // During 3→4 the colour must disappear into its white core before the
    // glass object is allowed back on screen. Starting from the old `exit`
    // value revealed the crystal as soon as the copy faded, which broke the
    // illusion of a reverse 2→3 emission.
    const crystalReturn = smootherstep(Math.min(Math.max((absorb - 0.78) / 0.2, 0), 1))
    const handoffRevealEarly = Math.max(crystalReturn, fourthReveal)
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
      const introX = vw * PHYSICS_INTRO_CENTER_X
      const focusedX = fourthTarget.x + stateX
      target = {
        x: introX + (focusedX - introX) * fourthFocus,
        y: poseY,
      }
      // The clean frame holds the exact fourth-state pose while its labels
      // leave. Only the following beat moves the virtual camera into the
      // crystal, keeping the zoom centred on the rounded block-five panel.
      if (fourthCleanFrame > 0) {
        target.x += (vw * 0.5 - target.x) * fourthPortal
        target.y += (vh * 0.5 - target.y) * fourthPortal
      }
    }
    // The colour has to be seen leaving the gem. Hold the mesh at full
    // size while the field is still a halo around it, then fade it in
    // place once that halo has clearly spilled past the silhouette.
    const expansion = thirdTarget?.expansion ?? 0
    const spill = smootherstep(Math.min(Math.max((expansion - 0.42) / 0.4, 0), 1))
    const returned = crystalReturn
    const dissolve = fourthReveal > 0 ? 0 : spill * (1 - returned)
    const handoffReveal = handoffRevealEarly
    let fullScale = baseScale
    if (fourthTarget && handoffReveal > 0) {
      fullScale = PHYSICS_HANDOFF_SCALE
        + (PHYSICS_TARGET_SCALE - PHYSICS_HANDOFF_SCALE) * fourthDescent
      const focusedScale = vw < 900 ? PHYSICS_STATES_SCALE * 0.82 : PHYSICS_STATES_SCALE
      fullScale += (focusedScale - fullScale) * fourthFocus
      const compactScale = vw < 900 ? 0.82 : 1
      fullScale += (STATE_ONE_SCALE * compactScale - fullScale) * fourthStateOne * fourthFocus
      fullScale += (STATE_TWO_SCALE * compactScale - fullScale) * fourthStateTwo * fourthFocus
      fullScale += (STATE_THREE_SCALE * compactScale - fullScale) * fourthStateThree * fourthFocus
      fullScale += (STATE_FOUR_SCALE * compactScale - fullScale) * fourthStateFour * fourthFocus
      fullScale += (PHYSICS_PORTAL_SCALE * compactScale - fullScale) * fourthPortal
    }
    if (!introReady) {
      introDelayRef.current = 0
      introProgressRef.current = 0
    } else if (introProgressRef.current < 1) {
      introDelayRef.current += delta
      if (introDelayRef.current >= INTRO_GROW_DELAY) {
        introProgressRef.current = Math.min(
          1,
          introProgressRef.current + delta / INTRO_GROW_DURATION,
        )
      }
    }
    // Quart ease-in-out is applied directly to scale/position: a chase
    // would start at full speed and kill the acceleration out of the
    // preloader pose. Scroll motion uses the critically damped spring below.
    const intro = easeInOutQuart(introProgressRef.current)
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
    if (fourthTarget && handoffReveal > 0) {
      targetTiltX += (STATE_ONE_ROTATION.x - targetTiltX) * fourthStateOne
      targetTiltZ += (STATE_ONE_ROTATION.z - targetTiltZ) * fourthStateOne
      targetTurnY += STATE_ONE_ROTATION.y * fourthStateOne
      targetTiltX += (STATE_TWO_ROTATION.x - targetTiltX) * fourthStateTwo
      targetTiltZ += (STATE_TWO_ROTATION.z - targetTiltZ) * fourthStateTwo
      targetTurnY += (STATE_TWO_ROTATION.y - targetTurnY) * fourthStateTwo
      targetTiltX += (STATE_THREE_ROTATION.x - targetTiltX) * fourthStateThree
      targetTiltZ += (STATE_THREE_ROTATION.z - targetTiltZ) * fourthStateThree
      targetTurnY += (STATE_THREE_ROTATION.y - targetTurnY) * fourthStateThree
      targetTiltX += (STATE_FOUR_ROTATION.x - targetTiltX) * fourthStateFour
      targetTiltZ += (STATE_FOUR_ROTATION.z - targetTiltZ) * fourthStateFour
      targetTurnY += (STATE_FOUR_ROTATION.y - targetTurnY) * fourthStateFour
    }
    const fourthJustAppeared = handoffReveal > 0.004 && !fourthVisibleRef.current
    fourthVisibleRef.current = handoffReveal > 0.004

    // Scroll sets the destination. The mesh follows it with a short
    // critically damped spring: a wheel tick accelerates out of rest and
    // brakes into the new pose. Intro writes the eased pose directly so
    // grow in/out stays a true rest-to-rest curve.
    let visual = visualRef.current
    if (!visual || fourthJustAppeared || introActive) {
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
      const dt = Math.min(delta, 0.05)
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
        ? 8
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
      if (dissolve > 0.5 && handoffReveal <= 0.004) {
        visual.scale = targetScale
        visual.vScale = 0
      }
    }

    const motionTrace = (window.__crystalTrace ??= [])
    motionTrace.push([performance.now(), visual.y, visual.vy])
    if (motionTrace.length > 300) motionTrace.shift()

    screenAnchorRef.current = { x: visual.x, y: visual.y }

    const world = screenToWorld(visual.x, visual.y, camera, vw, vh)
    groupRef.current.position.set(world.x, world.y, 0)
    groupRef.current.scale.setScalar(visual.scale)
    groupRef.current.visible = handoffReveal > 0.004 || dissolve < 0.97
    // While the gem is still the small mark that replaces the black logo,
    // it keeps that logo's screen-plane spin and nothing else. The usual
    // Y/X tumble eases in only once the grow is underway.
    const fourthIsVisible = handoffReveal > 0.004
    const grow = introProgressRef.current
    const handoff = grow <= 0.08
      ? 0
      : easeInOutQuart(Math.min(1, (grow - 0.08) / 0.5))
    const heroMotion = fourthIsVisible ? 1 : handoff
    const logoWeight = fourthIsVisible ? 0 : 1 - handoff
    if (!spinBlendRef.current) spinBlendRef.current = { value: 0 }
    spinBlendRef.current.value = heroMotion
    const dt = Math.min(delta, 0.05)
    if (fourthIsVisible) {
      zSpinRef.current = 0
    } else if (logoWeight > 0.995) {
      zSpinRef.current = -preloaderSpinAngle()
    } else {
      if (zSpinRef.current == null) zSpinRef.current = -preloaderSpinAngle()
      zSpinRef.current += -PRELOADER_SPIN_OMEGA * logoWeight * dt
    }
    // The crystal keeps its own spin. A selected card only moves the
    // light's exit point (crystalLight.js); it does not turn the gem.
    groupRef.current.rotation.y = fourthIsVisible
      ? visual.turnY
      : (visual.spin + pulseProgress * Math.PI * 2) * heroMotion
    groupRef.current.rotation.x = fourthIsVisible
      ? visual.tiltX
      : (visual.tiltX + Math.sin(pulseProgress * Math.PI) * 0.16) * heroMotion
    groupRef.current.rotation.z = visual.tiltZ + (zSpinRef.current ?? 0)

    // The outer shell is the stacking context. Keeping it above the world
    // pane lets the field grow behind the gem, so the colour reads as
    // spilling out of the crystal instead of covering it.
    const shell = gl.domElement?.parentElement?.parentElement
    if (shell) {
      const gathering = absorb > 0.05 && !fourthIsVisible
      const emerging = !fourthIsVisible && expansion < 0.88 && (toCenter > 0.12 || expansion > 0.001)
      shell.style.zIndex = emerging || gathering ? '34' : '30'
      // The mesh stays viewport-locked through block four. Once that
      // section scrolls away, fade the canvas so blocks 5+ stay readable.
      // The same opacity also fades the gem once its colour has spilled out.
      if (!physicsSectionRef.current?.isConnected) {
        physicsSectionRef.current = document.querySelector('.physics-behavior-section')
      }
      const physics = physicsSectionRef.current
      let pageFade = introReady ? 1 : 0
      if (physics) {
        const bottom = physics.getBoundingClientRect().bottom
        const fadeEnd = vh * 0.12
        const span = Math.max(1, vh - fadeEnd)
        const t = Math.min(1, Math.max(0, (bottom - fadeEnd) / span))
        pageFade = introReady ? t * t * (3 - 2 * t) : 0
      }
      const gemFade = fourthIsVisible ? 1 : 1 - dissolve
      const portalFade = 1 - smootherstep(Math.min(Math.max((fourthPortal - 0.68) / 0.28, 0), 1))
      shell.style.opacity = (pageFade * gemFade * portalFade).toFixed(3)
    }
  })

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

/**
 * The page's one crystal. There used to be two: the hero's own (this
 * component, formerly TunedCrystalOverlay.jsx, confined to the hero
 * section) and a static placeholder sprite drawn inside the carousel
 * (Carousel.js) above the active card — scrolling from one to the other
 * showed both on screen at once. Now there is only this one: it starts
 * centred in the hero, and as the page scrolls it shrinks in place, then
 * travels down and settles onto the carousel's active card, tracking that
 * live target via `carouselAnchorRef` (see TravellingCrystal above).
 *
 * Rendered at the page level (HeroTestPage.jsx), not inside HeroScene —
 * it has to be, now that it moves beyond the hero's own bounds. `position:
 * fixed` over the whole viewport, above both sections, `pointerEvents:
 * none` throughout so it never blocks the CTA, the carousel's drag
 * handling, or anything else underneath it.
 *
 * Camera/position match sceneConfig.crystal / sceneConfig.camera in the
 * hero's own coordinate space (position [0, 0.54, 0], fov 52, distance
 * 4.94) so the crystal starts exactly where the vanilla placeholder it
 * replaces (see mountHeroScene.js's skipCrystal) used to sit.
 */
export default function PageCrystal({
  config,
  introReady = true,
  sectionAnchorsRef,
  pulseKey = 0,
  cardHoverRef,
  onReady = () => {},
}) {
  const screenAnchorRef = useRef(null)
  const spinBlendRef = useRef({ value: introReady ? 1 : 0 })
  const { progress: pulseProgress, intensity: pulseIntensity } = useCrystalPulse(pulseKey)
  const { shouldRotate, fourthActive } = useCrystalRotation(sectionAnchorsRef)
  const crystalDpr = useCrystalDpr(fourthActive)

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
    return {
      ...config,
      // After the preloader hand-off, Glass resumes the original Y/X
      // tumble. Z-spin is faded out by TravellingCrystal via spinBlendRef.
      autoRotate: !fourthActive && (config.autoRotate !== false),
      rotateSpeed: shouldRotate ? (config.rotateSpeed ?? 0.5) : 0,
      // Small travelling states use the authored 10/512 baseline. The
      // block-four hand-off switches to 14/1024 before the mesh grows, so
      // its large glass silhouette keeps clean facets and colour gradients.
      samples: fourthActive
        ? Math.max(config.samples ?? 10, PHYSICS_CRYSTAL_SAMPLES)
        : Math.max(config.samples ?? 10, SITE_CRYSTAL_SAMPLES),
      resolution: fourthActive
        ? Math.max(config.resolution ?? 512, PHYSICS_CRYSTAL_RESOLUTION)
        : Math.max(config.resolution ?? 512, SITE_CRYSTAL_RESOLUTION),
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
  }, [config, shouldRotate, fourthActive, pulseIntensity])

  const canvasStyle = useMemo(
    () => ({
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      // The canvas is allowed to render and warm its shaders while hidden,
      // but cannot leak through the preloader before the shared hand-off.
      // Opacity changes in the same React commit that hides the black mark.
      opacity: introReady ? 1 : 0,
      // Kept on one compositor layer for its whole lifetime. The loading
      // sheet moves behind it at hand-off instead of moving this expensive
      // full-screen WebGL canvas between z-layers, which could flash on
      // slower GPUs.
      zIndex: 30,
    }),
    [introReady],
  )

  return (
    <div style={canvasStyle}>
      <Canvas
        // DPR remains adaptive because this transparent canvas covers the
        // whole viewport. It runs up to 1.5 in the smaller page states and
        // is raised to 1.75 before the large block-four render appears.
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
        <CrystalContextGuard />
        <Suspense fallback={null}>
          <Studio intensity={shimmerConfig.envIntensity ?? 0} neutral />
          <CrystalReadySignal onReady={onReady} />
          <TravellingCrystal
            introReady={introReady}
            sectionAnchorsRef={sectionAnchorsRef}
            screenAnchorRef={screenAnchorRef}
            pulseProgress={pulseProgress}
            spinBlendRef={spinBlendRef}
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
          <Bloom
            mipmapBlur
            intensity={shimmerConfig.bloom ?? 0}
            luminanceThreshold={shimmerConfig.bloomThreshold ?? 0.94}
            luminanceSmoothing={0.3}
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
