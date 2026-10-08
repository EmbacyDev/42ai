import * as THREE from 'three'

/**
 * Placeholder faceted crystal.
 *
 * The visual-lab crystal (MeshTransmissionMaterial, shard explode, color
 * core) stays in that app. This module is the swap point: replace
 * `createCrystal` later without touching the portrait field.
 */
export function createCrystal({ position, radius }) {
  const geometry = new THREE.IcosahedronGeometry(radius, 0)
  geometry.scale(1, 1.08, 0.92)
  geometry.computeVertexNormals()

  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f4fbfb'),
    metalness: 0,
    roughness: 0.14,
    transmission: 0.9,
    thickness: 1.15,
    ior: 1.55,
    attenuationColor: new THREE.Color('#7ec4c2'),
    attenuationDistance: 1.45,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.35,
    specularIntensity: 1,
    flatShading: true,
  })

  const shell = new THREE.Mesh(geometry, material)
  shell.position.set(position[0], position[1], position[2])

  return {
    object: shell,
    update(time) {
      shell.rotation.y = time * 0.12
      shell.rotation.x = Math.sin(time * 0.18) * 0.05
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
