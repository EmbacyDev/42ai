import * as THREE from 'three'
import { easeInOutQuart, fadeProgress, shrinkFactor } from './scrollShrink.js'
import { sceneConfig } from './sceneConfig.js'
import { projectDesignPoint } from './placement.js'

const flyPosition = new THREE.Vector3()
const launchOffset = new THREE.Vector3()
const crystalOrigin = new THREE.Vector3()
const ndcPoint = new THREE.Vector3()
const CRYSTAL_ORIGIN = new THREE.Vector3(...sceneConfig.crystal.position)
// Same clock as PageCrystal's intro: a short hold at the preloader size,
// then 1.5s of growth up to the settled hero scale. Shards are built at
// radius 1, so the group scale is the circumradius. 0.7 of that is inside
// the faces, not out at a vertex.
const INTRO_GROW_DELAY = 0.32
const INTRO_GROW_DURATION = 1.5
const INTRO_START_SCALE = 0.145
const INTRO_FULL_SCALE = 0.72
const CRYSTAL_INRADIUS_RATIO = 0.7

// Ease in and out. An exponential chase is already at full speed on the
// first frame, so growing and shrinking both felt like a snap.
function springHover(mesh, target, delta) {
  const omega = 7.5
  const dt = Math.min(Math.max(delta, 0.001), 0.05)
  const steps = 3
  const h = dt / steps
  const stiffness = omega * omega
  const damping = omega * 2
  let value = mesh.userData.hover ?? 0
  let velocity = mesh.userData.hoverVel ?? 0
  for (let i = 0; i < steps; i += 1) {
    const accel = (target - value) * stiffness - velocity * damping
    velocity += accel * h
    value += velocity * h
  }
  mesh.userData.hover = THREE.MathUtils.clamp(value, 0, 1)
  mesh.userData.hoverVel = velocity
}

/**
 * Cinematic rest-to-rest flight. Cubic smoothstep gives zero velocity at
 * both ends; the small symmetric momentum term moves the card decisively
 * through the middle without introducing a kink or a visible overshoot.
 * The result accelerates for a short beat and spends the longer readable
 * part of the move braking into its authored seat.
 */
function easeFlight(t) {
  const x = Math.min(1, Math.max(0, t))
  const smooth = x * x * (3 - 2 * x)
  const momentum = 0.8 * x * x * (1 - x) * (1 - x)
  return smooth + momentum
}

function crystalInradiusAt(elapsed) {
  const growT = THREE.MathUtils.clamp(
    (elapsed - INTRO_GROW_DELAY) / INTRO_GROW_DURATION,
    0,
    1,
  )
  const scale = INTRO_START_SCALE + (INTRO_FULL_SCALE - INTRO_START_SCALE) * easeInOutQuart(growT)
  return scale * CRYSTAL_INRADIUS_RATIO
}

function launchPoint(rest, target, radius, origin) {
  launchOffset.copy(rest).sub(origin)
  const len = launchOffset.length()
  if (len < 1e-4) return target.copy(origin)
  return target.copy(origin).addScaledVector(launchOffset, radius / len)
}

/**
 * Where the visible crystal is right now. It grows while travelling from
 * the middle of the screen to its hero seat, so a card has to be born at
 * that moving point — the settled seat is still empty early on.
 */
function placeCrystalOrigin(elapsed, camera, vw, vh) {
  if (!camera || !vw || !vh) {
    crystalOrigin.copy(CRYSTAL_ORIGIN)
    return crystalOrigin
  }
  const growT = THREE.MathUtils.clamp(
    (elapsed - INTRO_GROW_DELAY) / INTRO_GROW_DURATION,
    0,
    1,
  )
  const intro = easeInOutQuart(growT)
  const anchor = projectDesignPoint(
    sceneConfig.crystal.designCenter[0],
    sceneConfig.crystal.designCenter[1],
    vw,
    vh,
  )
  const px = vw * 0.5 + (anchor.x - vw * 0.5) * intro
  const py = vh * 0.5 + (anchor.y - vh * 0.5) * intro
  const ndcX = (px / vw) * 2 - 1
  const ndcY = 1 - (py / vh) * 2
  ndcPoint.set(ndcX, ndcY, 0.5).unproject(camera)
  const dz = ndcPoint.z - camera.position.z
  const travel = Math.abs(dz) < 1e-6 ? 0 : (0 - camera.position.z) / dz
  crystalOrigin.set(
    camera.position.x + (ndcPoint.x - camera.position.x) * travel,
    camera.position.y + (ndcPoint.y - camera.position.y) * travel,
    0,
  )
  return crystalOrigin
}
const rollQuat = new THREE.Quaternion()
const rollAxis = new THREE.Vector3(0, 0, 1)

function applyCardRoll(mesh) {
  const roll = mesh.userData.cardRoll
  if (!roll) return
  rollQuat.setFromAxisAngle(rollAxis, roll)
  mesh.quaternion.multiply(rollQuat)
}

/**
 * The loading-screen entrance for one card. Returns linear 0→1 through the
 * authored duration plus the opacity already written onto the material.
 */
function updateReveal(mesh, time) {
  const reveal = mesh.userData.reveal
  if (!reveal) {
    return {
      active: false,
      linearProgress: mesh.userData.hasRevealed ? 1 : 0,
      opacity: mesh.userData.hasRevealed ? 1 : 0,
    }
  }

  const raw = (time - reveal.start) / reveal.duration
  if (raw < 0) {
    mesh.material.opacity = 0
    return {
      active: true,
      waiting: true,
      linearProgress: 0,
      opacity: 0,
    }
  }
  const t = Math.min(raw, 1)
  const opacity = THREE.MathUtils.clamp(t / 0.06, 0, 1)
  mesh.material.opacity = opacity
  // Stays `transparent` even once settled (skipping the small perf win
  // of turning it back off) — the hero-to-carousel transition below
  // needs to fade this same material back out later in the card's life.
  if (t >= 1) mesh.userData.reveal = null
  return {
    active: t < 1,
    linearProgress: t,
    opacity,
  }
}

/**
 * Where a settled card goes when the hero hands off to block 2.
 * Same point it was born at: just inside the face nearest its seat,
 * scaled to the crystal's size at this moment in the shrink.
 */
function returnPoint(rest, origin, crystalScale, target) {
  const inside = INTRO_FULL_SCALE * CRYSTAL_INRADIUS_RATIO * crystalScale
  return launchPoint(rest, target, inside * 0.34, origin)
}

function returnScale(mesh, crystalScale) {
  const inside = INTRO_FULL_SCALE * CRYSTAL_INRADIUS_RATIO * crystalScale
  const launchRadius = inside * 0.34
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere()
  const reach = Math.max(mesh.geometry.boundingSphere?.radius ?? 1, 1e-4)
  const fitted = (inside * 0.78 - launchRadius) / reach
  return THREE.MathUtils.clamp(fitted, 0.035, 0.12)
}

/**
 * Tiny independent drift. Positions stay anchored to the config and the
 * orientation stays anchored to the sphere — nothing travels around the
 * crystal, the cards just breathe in place.
 *
 * `transition`, when given, is the hero-to-carousel handoff
 * (heroTransition.js). While the crystal is still in its hero seat the
 * cards fly back into it — the entrance in reverse — and only disappear
 * once they are inside. `fadeProgress` finishes that flight before the
 * crystal starts down toward block 2. Scrolling back up runs the same
 * path outward again.
 */
export function updateAmbient(meshes, time, delta, transition) {
  const flyRaw = transition ? transition.progress : 0
  const fly = fadeProgress(Math.min(Math.max(flyRaw, 0), 1))
  const crystalScale = shrinkFactor(Math.min(Math.max(flyRaw, 0), 1))
  const returning = fly > 0.001
  const introElapsed = transition?.introElapsed
  const origin = placeCrystalOrigin(
    introElapsed ?? INTRO_GROW_DELAY + INTRO_GROW_DURATION,
    transition?.camera,
    transition?.viewport?.width,
    transition?.viewport?.height,
  )

  for (const mesh of meshes) {
    const base = mesh.userData.base
    const entrance = updateReveal(mesh, time)
    const hoverTarget = entrance.active ? 0 : (mesh.userData.hoverTarget ?? 0)
    springHover(mesh, hoverTarget, delta)
    const hover = mesh.userData.hover
    // The light can select a photograph, but it never makes the remaining
    // images transparent. Ease out any dimming left from an earlier frame.
    const dimTarget = 0
    const dimBlend = 1 - Math.exp(-7 * delta)
    mesh.userData.hoverDim += (dimTarget - mesh.userData.hoverDim) * dimBlend
    const hoverDim = mesh.userData.hoverDim

    // Born inside the crystal, on the side nearest this card's seat, then
    // carried out to that seat. The six starts are different points, so
    // the cards leave through different faces instead of one shared centre.
    // The page crystal is a separate canvas painted over this scene; for
    // the whole flight the card is also drawn on the front layer, so it
    // is seen coming out of the gem rather than from behind it.
    if (entrance.waiting) {
      mesh.position.copy(origin)
      mesh.quaternion.copy(base.quaternion)
      applyCardRoll(mesh)
      mesh.scale.setScalar(0.001)
      mesh.userData.entranceInFront = true
    } else if (entrance.active) {
      // Moving from the first frame, with a short brake into the seat.
      // The launch is captured on this card's own first frame, so it fits
      // inside the gem at the size it has then.
      const flight = easeFlight(entrance.linearProgress)
      if (!mesh.userData.launch) {
        const inside = crystalInradiusAt(introElapsed ?? INTRO_GROW_DELAY + INTRO_GROW_DURATION)
        const launchRadius = inside * 0.34
        mesh.userData.launch = launchPoint(base.position, new THREE.Vector3(), launchRadius, origin)
        if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere()
        const reach = Math.max(mesh.geometry.boundingSphere?.radius ?? 1, 1e-4)
        const fitted = (inside * 0.78 - launchRadius) / reach
        mesh.userData.launchScale = THREE.MathUtils.clamp(fitted, 0.035, 0.12)
      }
      flyPosition.copy(mesh.userData.launch).lerp(base.position, flight)
      mesh.position.copy(flyPosition)
      mesh.userData.entranceInFront = true

      // Orient from the rest seat even at flight≈0, where the current
      // position still sits on the crystal and has no stable sphere normal.
      mesh.quaternion.copy(base.quaternion)
      applyCardRoll(mesh)
      const startScale = mesh.userData.launchScale ?? 0.08
      mesh.scale.setScalar(startScale + flight * (1 - startScale))
    } else if (returning) {
      // Back through the face they left from, shrinking into the gem.
      // `fly` is already rest-to-rest (quart), so the cards lift off and
      // brake into the crystal instead of leaping on the first tick.
      const flight = fly
      const sink = returnPoint(base.position, origin, crystalScale, flyPosition)
      mesh.position.copy(base.position).lerp(sink, flight)
      mesh.quaternion.copy(base.quaternion)
      applyCardRoll(mesh)
      const sinkScale = returnScale(mesh, crystalScale)
      mesh.scale.setScalar(THREE.MathUtils.lerp(1, sinkScale, flight))
      mesh.userData.entranceInFront = flight < 0.98
    } else {
      mesh.userData.entranceInFront = false
      // A slow drift, each card on its own clock, so they hover in place.
      const phase = base.phase ?? 0
      mesh.position.copy(base.position)
      mesh.position.x += Math.sin(time * 0.23 + phase) * 0.028
      mesh.position.y += Math.cos(time * 0.19 + phase * 1.3) * 0.04
      mesh.position.z += Math.sin(time * 0.16 + phase * 0.7) * 0.016
      mesh.quaternion.copy(base.quaternion)
      applyCardRoll(mesh)
      mesh.scale.setScalar(1)
    }

    // K95-style local response: the selected card floats slightly toward
    // the viewer and turns into the pointer with a damped, reversible
    // motion. The small limits preserve the half-sphere instead of making
    // one card detach from it like a conventional hover tile.
    if (!returning && hover > 0.001) {
      mesh.scale.multiplyScalar(1 + hover * 0.055)
      // A small step toward the viewer. The scale change stays slight;
      // the spring above eases both the growth and the return.
      mesh.position.z += hover * 0.06
    }

    mesh.renderOrder = hover > 0.01 ? 18 : 0
    mesh.material.roughness = 0.82 - hover * 0.24
    mesh.material.envMapIntensity = 0.16 + hover * 0.28 - hoverDim * 0.07
    const baseColor = mesh.userData.baseMaterialColor
    if (baseColor) {
      const shade = 1 - hoverDim * 0.08
      const lit = 1 + hover * 0.42
      mesh.material.color.setRGB(
        baseColor.r * shade * lit,
        baseColor.g * shade * lit,
        baseColor.b * shade * lit,
      )
    }

    mesh.material.transparent = true
    // The selected card stays solid. The others step back a little so the
    // one the beam is on reads as the subject.
    const presence = entrance.active ? 1 : (1 - hoverDim * 0.28)
    const restOpacity = mesh.userData.restOpacity ?? 1
    // Stay solid through the flight home. Vanish only as the card
    // crosses into the crystal, so the motion reads as a return.
    const sinkFade = 1 - THREE.MathUtils.smoothstep(fly, 0.78, 1)
    mesh.material.opacity = entrance.opacity * sinkFade * presence * restOpacity
    // Chips stay parented to the card, so they would otherwise fly out of
    // the crystal with the photograph. Hold them invisible until the photo
    // has nearly reached its seat, then fade them in. On the way back they
    // leave first, before the photograph itself moves.
    const chipHome = 1 - THREE.MathUtils.smoothstep(fly, 0, 0.28)
    mesh.userData.chipReveal = entrance.active
      ? THREE.MathUtils.smoothstep(entrance.linearProgress, 0.78, 1)
      : (mesh.userData.hasRevealed ? chipHome : 0)
    if (mesh.userData.shadowMaterial) {
      // A card does not cast its external drop shadow while it is still
      // inside the crystal. Bring it in only after the card crosses out.
      const shadowReveal = entrance.active
        ? THREE.MathUtils.smoothstep(entrance.linearProgress, 0.32, 0.58)
        : 1 - THREE.MathUtils.smoothstep(fly, 0, 0.3)
      mesh.userData.shadowMaterial.opacity = entrance.opacity * shadowReveal * sinkFade * presence * restOpacity
    }
    if (mesh.userData.cleanMaterial) {
      mesh.userData.cleanMaterial.opacity = entrance.opacity * hover * 0.28 * sinkFade * presence
    }
  }
}
