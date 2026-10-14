import * as THREE from 'three'

const toCenter = new THREE.Vector3()
const euler = new THREE.Euler(0, 0, 0, 'YXZ')
const offset = new THREE.Quaternion()
const offsetEuler = new THREE.Euler()

/**
 * Turns a card toward the crystal horizontally, and levels the whole
 * shell toward the camera vertically.
 *
 * Yaw is the wrap around the crystal. The full turn reaches 88° at the rim,
 * so `wrap` takes a fraction of it — cards near the middle turn a little,
 * cards at the rim turn a lot, and the two sides mirror each other.
 *
 * The shell sits above the camera's look-at, so a world-upright card is
 * seen from below and the field reads as a sphere aimed at the ceiling,
 * top edges yanked up. One shared pitch — the elevation from the camera
 * to the sphere's centre — tips the whole shell back to face us. Every
 * card gets the same amount, so they stay on one surface instead of each
 * aiming at the lens on its own.
 *
 * `verticalTurn` is the old toward-the-crystal pitch, kept as a knob and
 * left at zero: that is what tipped the corners up in the first place.
 *
 * `rotateZ` is applied afterwards in the card's own space, as the small
 * in-plane tilt the macet has.
 */
export function orientTowardCenter({
  position,
  center,
  cameraPosition = [0, 0, 0],
  wrap,
  verticalTurn = 0,
  levelToCamera = 1,
  rotateZ = 0,
}) {
  toCenter.copy(center).sub(position).normalize()

  const yaw = Math.atan2(toCenter.x, toCenter.z) * wrap
  const aim = Math.atan2(
    center.y - cameraPosition[1],
    cameraPosition[2] - center.z
  )
  const crystalPitch =
    -Math.asin(THREE.MathUtils.clamp(toCenter.y, -1, 1)) * wrap * verticalTurn

  euler.set(-aim * levelToCamera + crystalPitch, yaw, 0)
  const quaternion = new THREE.Quaternion().setFromEuler(euler)

  offsetEuler.set(0, 0, rotateZ)
  offset.setFromEuler(offsetEuler)
  quaternion.multiply(offset)

  return quaternion
}