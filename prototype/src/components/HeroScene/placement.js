import * as THREE from 'three'
import { sceneConfig } from './sceneConfig.js'

const { design, camera, composition } = sceneConfig
const cameraZ = camera.position[2]

/**
 * Pushes a design point out from the crystal by the composition spread.
 *
 * Applied to card centres only. A chip's offset from its card is not
 * spread — the card it belongs to does not grow, so the chip has to stay
 * where it sits on it.
 */
/**
 * How far the whole card field must slide, in design pixels, so the
 * outermost left and right edges sit the same distance from the frame.
 *
 * The Figma boxes are not symmetric: the right-hand card crosses x = 1440
 * while the left one still has air. A uniform slide recentres that span.
 * Wider viewports add the same letterbox on both sides, and narrower ones
 * keep the design width, so the two insets stay equal at every size.
 */
let fieldShiftX = 0

export function alignFieldEdges(rects) {
  const [pivotX] = composition.pivot
  let left = Infinity
  let right = -Infinity
  for (const rect of rects) {
    const x = pivotX + (rect.centerX - pivotX) * composition.spreadX
    left = Math.min(left, x - rect.width / 2)
    right = Math.max(right, x + rect.width / 2)
  }
  fieldShiftX = Number.isFinite(left) ? (design.width - right - left) / 2 : 0
  return fieldShiftX
}

export function spreadCenter(centerX, centerY) {
  const [pivotX, pivotY] = composition.pivot
  return {
    x: pivotX + (centerX - pivotX) * composition.spreadX + fieldShiftX,
    y: pivotY + (centerY - pivotY) * composition.spreadY,
  }
}

/**
 * World units per design pixel, measured on the plane through the origin.
 * Everything below works back from the Figma frame through the same camera
 * the scene uses, so a card's projection lands where the macet puts it.
 */
export const unitsPerPixel =
  (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * cameraZ) /
  design.height

/**
 * A design point in the 1440×800 hero, projected the same way the portrait
 * camera frames it. Wider viewports letterbox horizontally; taller ones
 * keep the design width and add space above and below. The crystal and
 * the copy use this so they stay locked to the cards.
 */
export function projectDesignPoint(designX, designY, viewportWidth, viewportHeight) {
  const aspect = viewportWidth / Math.max(viewportHeight, 1)
  const designTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  const halfTan = aspect < camera.designAspect
    ? (designTan * camera.designAspect) / aspect
    : designTan
  const worldX = (designX - design.width / 2) * unitsPerPixel
  const worldY = (design.height / 2 - designY) * unitsPerPixel
  const ndcX = worldX / (halfTan * cameraZ * aspect)
  const ndcY = worldY / (halfTan * cameraZ)
  return {
    x: (ndcX * 0.5 + 0.5) * viewportWidth,
    y: (1 - (ndcY * 0.5 + 0.5)) * viewportHeight,
  }
}

/** Design pixel coordinates to the world point they project from at z = 0. */
export function anchorAtOrigin(centerX, centerY) {
  return {
    x: (centerX - design.width / 2) * unitsPerPixel,
    y: (design.height / 2 - centerY) * unitsPerPixel,
  }
}

/**
 * Places a card on the sphere without moving it on screen.
 *
 * Both constraints have to hold at once: the card sits exactly `radius`
 * from the crystal, and it still projects onto its Figma position. Pushing
 * a card back along the view ray scales its distance from the crystal
 * monotonically, so a bisection on depth finds the one point that satisfies
 * both. `perspective` is the factor the ray has been walked out by, which
 * the card's size has to follow so the footprint on screen stays put.
 *
 * Only the far half of the sphere is searched. A card on the near half
 * would be turned away from the camera once it faces the crystal — the
 * visible inner surface is the far one.
 */
export function placeOnSphere(rect, sphere) {
  const center = sphere.center
  const spread = spreadCenter(rect.centerX, rect.centerY)
  const anchor = anchorAtOrigin(spread.x, spread.y)

  const distanceAt = (z) => {
    const f = 1 - z / cameraZ
    return Math.hypot(
      anchor.x * f - center[0],
      anchor.y * f - center[1],
      z - center[2]
    )
  }

  // A card whose distance already exceeds the radius at the crystal's own
  // plane cannot reach the far half at all — walking it back only pushes it
  // further out. Without this check it silently pins itself to z = 0 and
  // sits off the sphere while everything else is on it.
  if (distanceAt(0) > sphere.radius) {
    console.warn(
      `[HeroScene] ${spread.x.toFixed(0)},${spread.y.toFixed(0)} needs a sphere radius of at least ` +
        `${distanceAt(0).toFixed(2)}; it is pinned to the crystal's plane.`
    )
  }

  let near = -sphere.radius
  let far = 0
  for (let i = 0; i < 48; i++) {
    const mid = (near + far) / 2
    if (distanceAt(mid) > sphere.radius) near = mid
    else far = mid
  }

  const z = (near + far) / 2
  const perspective = 1 - z / cameraZ

  return {
    position: new THREE.Vector3(anchor.x * perspective, anchor.y * perspective, z),
    width: rect.width * unitsPerPixel * perspective,
    height: rect.height * unitsPerPixel * perspective,
    perspective,
  }
}
