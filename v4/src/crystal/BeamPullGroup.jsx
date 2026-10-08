import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { crystalScreen } from '../components/HeroScene/crystalScreen.js'

const worldA = new THREE.Vector3()
const worldB = new THREE.Vector3()
const localA = new THREE.Vector3()
const localB = new THREE.Vector3()

/**
 * Leans the crystal's inner colour toward the hovered card: the liquid
 * drifts (and stretches a little) in the direction of the beam, in screen
 * space, while the shell keeps tumbling.
 */
export default function BeamPullGroup({ children, reach = 0.16 }) {
  const ref = useRef(null)
  const pull = useRef({ x: 0, y: 0 })

  useFrame((_, delta) => {
    const group = ref.current
    const parent = group?.parent
    if (!group || !parent) return
    // v4: the liquid no longer leans toward the hovered card / cursor. It
    // only reacts to the hand-turned crystal (crystalSlosh in Glass.jsx).
    const hover = null
    let tx = 0
    let ty = 0
    if (hover && crystalScreen.valid) {
      const dx = hover.x - crystalScreen.x
      const dy = -(hover.y - crystalScreen.y)
      const len = Math.hypot(dx, dy) || 1
      tx = dx / len
      ty = dy / len
    }
    const k = 1 - Math.exp(-4 * Math.min(delta, 0.05))
    pull.current.x += (tx - pull.current.x) * k
    pull.current.y += (ty - pull.current.y) * k
    // World-space offset turned into the rotating parent's local space.
    parent.getWorldPosition(worldA)
    worldB.set(worldA.x + pull.current.x * reach, worldA.y + pull.current.y * reach, worldA.z)
    localA.copy(worldA)
    parent.worldToLocal(localA)
    localB.copy(worldB)
    parent.worldToLocal(localB)
    group.position.copy(localB).sub(localA)
    const amount = Math.hypot(pull.current.x, pull.current.y)
    group.scale.setScalar(1 + amount * 0.06)
  })

  return <group ref={ref}>{children}</group>
}
