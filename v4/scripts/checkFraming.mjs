import * as THREE from 'three'

const BASE = '/Users/julymanuilova/Documents/des/01. Embacy/42AI/prototype/src/components/HeroScene'
const { sceneConfig } = await import(`${BASE}/sceneConfig.js`)
const { placeOnSphere } = await import(`${BASE}/placement.js`)
const { orientTowardCenter } = await import(`${BASE}/orientation.js`)
const { portraits } = await import(`${BASE}/portraits.js`)
const { bendAt } = await import(`${BASE}/bend.js`)

const { camera: cam, sphere, design } = sceneConfig
const camera = new THREE.PerspectiveCamera(cam.fov, design.width / design.height, cam.near, cam.far)
camera.position.fromArray(cam.position)
camera.lookAt(...cam.lookAt)
camera.updateMatrixWorld(true)
camera.updateProjectionMatrix()

const center = new THREE.Vector3().fromArray(sphere.center)
const rows = []

for (const item of portraits) {
  const placed = placeOnSphere(item.rect, sphere)
  const q = orientTowardCenter({
    position: placed.position,
    center,
    cameraPosition: cam.position,
    wrap: item.wrap,
    verticalTurn: sphere.verticalTurn,
    levelToCamera: sphere.levelToCamera,
    rotateZ: (item.rotateZ ?? 0) * sceneConfig.composition.roll,
  })
  const bend = { radius: sphere.radius, curvature: item.curvature ?? 1 }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i <= 12; i++) {
    for (let j = 0; j <= 12; j++) {
      const x = (i / 12 - 0.5) * placed.width
      const y = (j / 12 - 0.5) * placed.height
      const z = bendAt(x, y, bend)
      const p = new THREE.Vector3(x, y, z).applyQuaternion(q).add(placed.position).project(camera)
      const px = (p.x * 0.5 + 0.5) * design.width
      const py = (-p.y * 0.5 + 0.5) * design.height
      minX = Math.min(minX, px); maxX = Math.max(maxX, px)
      minY = Math.min(minY, py); maxY = Math.max(maxY, py)
    }
  }
  rows.push({
    id: item.id,
    left: +minX.toFixed(0), right: +maxX.toFixed(0),
    top: +minY.toFixed(0), bottom: +maxY.toFixed(0),
    w: +(maxX - minX).toFixed(0), h: +(maxY - minY).toFixed(0),
    z: +placed.position.z.toFixed(2),
  })
}

console.table(rows)
console.log('frame 1440x800; copy block starts at y=514, x 286..1154')
