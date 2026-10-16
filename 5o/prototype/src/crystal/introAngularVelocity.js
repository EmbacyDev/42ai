import { PRELOADER_SPIN_OMEGA, INTRO_SLOWDOWN } from '../components/HeroScene/preloaderSpin.js'

// Reverse both arrival and idle while preserving the speed envelope.
export function introAngularVelocity(speed, blend) {
  const t = Math.max(0, Math.min(1, blend))
  const idleMagnitude = Math.abs(speed) * Math.hypot(.35, 1, .12)
  if (!idleMagnitude) return { x: 0, y: 0, z: 0 }
  const idleSpeed = speed
  const x = idleSpeed * .35 / idleMagnitude * t
  const y = idleSpeed / idleMagnitude * t
  const z = -Math.sign(speed) * (1 - t) + idleSpeed * .12 / idleMagnitude * t
  const magnitude = (PRELOADER_SPIN_OMEGA / INTRO_SLOWDOWN) * (1 - t) + idleMagnitude * t
  const scale = magnitude / Math.hypot(x, y, z)
  return { x: x * scale, y: y * scale, z: z * scale }
}
