import * as THREE from 'three'
import { alignFieldEdges, placeOnSphere } from './placement.js'

const loader = new THREE.TextureLoader()

function createSoftShadowTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.5,
  )
  gradient.addColorStop(0, 'rgba(28, 26, 24, 0.16)')
  gradient.addColorStop(0.4, 'rgba(28, 26, 24, 0.05)')
  gradient.addColorStop(1, 'rgba(28, 26, 24, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const softShadowTexture = createSoftShadowTexture()

/**
 * A flat plane whose opaque pixels land on the Figma mask box.
 *
 * The export is larger than the card: a transparent margin around the
 * skewed, rounded photograph. The plane grows by that margin, then shifts
 * so the opaque centre — not the file centre — sits on the mask centre.
 */
function buildBakedPlane(placed, pad) {
  const opaqueW = pad.maxX - pad.minX + 1
  const opaqueH = pad.maxY - pad.minY + 1
  const planeW = placed.width * (pad.imgW / opaqueW)
  const planeH = placed.height * (pad.imgH / opaqueH)
  const geometry = new THREE.PlaneGeometry(planeW, planeH)
  const dx = ((pad.minX + pad.maxX) / 2 - pad.imgW / 2) / pad.imgW * planeW
  const dy = -(((pad.minY + pad.maxY) / 2 - pad.imgH / 2) / pad.imgH) * planeH
  geometry.translate(-dx, -dy, 0)
  return geometry
}

function prepareTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 8
  // The whole file, padding included. Cropping to the plane would shift
  // the opaque card off the mask box the plane was sized for.
  texture.repeat.set(1, 1)
  texture.offset.set(0, 0)
  texture.needsUpdate = true
}

function createPlane(item, placed, nearness) {
  const { position } = placed
  const shear = item.shear ?? 0
  // The export already contains the curve and the skew. Facing the camera
  // keeps that silhouette; a yaw would turn it into a second trapezoid.
  const quaternion = new THREE.Quaternion()

  const frame = { width: placed.width, height: placed.height }
  const geometry = buildBakedPlane(placed, item.pad)

  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.copy(position)
  mesh.quaternion.copy(quaternion)

  // A light-independent copy of the photograph, normally invisible. On
  // hover it crossfades over the lit surface so the selected image becomes
  // crisp and true-colour instead of merely receiving even more light.
  const cleanMaterial = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const cleanSurface = new THREE.Mesh(geometry, cleanMaterial)
  cleanSurface.renderOrder = 24
  mesh.add(cleanSurface)

  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: softShadowTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(frame.width * 1.45, frame.height * 1.55),
    shadowMaterial,
  )
  shadow.position.set(0, -0.045, -0.06)
  shadow.renderOrder = -1
  mesh.add(shadow)

  mesh.userData.base = {
    position: position.clone(),
    quaternion: quaternion.clone(),
    phase: item.phase ?? 0,
  }
  mesh.userData.cardRoll = 0
  mesh.userData.shear = shear
  mesh.userData.restOpacity = item.opacity ?? 1
  mesh.userData.cardId = item.id
  mesh.userData.shadowMaterial = shadowMaterial
  mesh.userData.cleanMaterial = cleanMaterial
  mesh.userData.baseMaterialColor = material.color.clone()
  // Loading-screen entrance: null until `reveal()` (see
  // createPortraitPlanes below) stamps a start time on it. updateAmbient
  // reads this every frame to fade the material in and settle the card
  // up from a slight drop, then clears it once the animation finishes.
  mesh.userData.reveal = null
  mesh.userData.hasRevealed = false
  mesh.userData.entranceIndex = 0
  mesh.userData.hover = 0
  mesh.userData.hoverVel = 0
  mesh.userData.hoverTarget = 0
  mesh.userData.hoverDim = 0
  mesh.userData.hoverPointer = { x: 0, y: 0 }
  mesh.userData.planeAspect = item.pad.imgW / item.pad.imgH
  mesh.userData.size = frame
  mesh.renderOrder = 2 + nearness
  // Chips follow the exported skew. The photograph itself is flat, so the
  // bend they used to ride is zero.
  mesh.userData.rect = item.rect
  mesh.userData.bend = { radius: 1, curvature: 0 }

  return { object: mesh, material, geometry }
}

export function createPortraitPlanes(items, sphere, onProgress = () => {}) {
  const object = new THREE.Group()
  const meshes = []
  const textures = []

  alignFieldEdges(items.map((item) => item.rect))
  const placed = items.map((item) => placeOnSphere(item.rect, sphere))
  const depths = placed.map((p) => p.position.z)
  const minZ = Math.min(...depths)
  const maxZ = Math.max(...depths)
  const span = Math.max(maxZ - minZ, 1e-3)

  const built = items.map((item, i) =>
    createPlane(
      item,
      placed[i],
      (placed[i].position.z - minZ) / span,
    )
  )
  let disposed = false
  let revealStarted = false

  for (const plane of built) {
    object.add(plane.object)
    meshes.push(plane.object)
  }
  meshes.forEach((mesh, index) => {
    mesh.userData.entranceIndex = index
  })

  // Loading progress is "how many of the six photos have settled", not
  // bytes — a fetch that fails still counts (the plane falls back to a
  // flat colour and moves on), so a dropped image can't stall the loading
  // screen forever.
  let settledCount = 0
  const reportSettled = () => {
    settledCount += 1
    onProgress(settledCount / items.length)
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const plane = built[i]
    loader.load(
      item.src,
      (texture) => {
        if (disposed) {
          texture.dispose()
          return
        }
        prepareTexture(texture)
        plane.material.map = texture
        plane.material.needsUpdate = true
        plane.object.userData.cleanMaterial.map = texture
        plane.object.userData.cleanMaterial.needsUpdate = true
        textures.push(texture)
        reportSettled()
      },
      undefined,
      () => {
        plane.material.color.set('#dedbd6')
        reportSettled()
      }
    )
  }

  return {
    object,
    meshes,
    byId: new Map(items.map((item, i) => [item.id, built[i].object])),
    // Same flight length for every card, and an equal pause before the next
    // one starts, so they sit down one after another with a constant gap.
    // Top to bottom, alternating sides.
    reveal(time, stagger = 0.11, duration = 0.5) {
      // The entrance belongs to the first page load only. In particular,
      // returning to the hero from the following section must never stamp
      // a fresh timeline onto cards that have already settled.
      if (revealStarted) return 0
      revealStarted = true
      const left = []
      const right = []
      for (const mesh of meshes) {
        if (mesh.userData.base.position.x < 0) left.push(mesh)
        else right.push(mesh)
      }
      const byHeight = (a, b) => b.userData.base.position.y - a.userData.base.position.y
      left.sort(byHeight)
      right.sort(byHeight)
      const order = []
      const rows = Math.max(left.length, right.length)
      for (let row = 0; row < rows; row++) {
        if (left[row]) order.push(left[row])
        if (right[row]) order.push(right[row])
      }
      order.forEach((mesh, index) => {
        mesh.userData.entranceIndex = index
        mesh.userData.hasRevealed = true
        mesh.userData.reveal = { start: time + index * stagger, duration }
      })
      return duration + Math.max(0, order.length - 1) * stagger
    },
    finishReveal() {
      revealStarted = true
      for (const mesh of meshes) {
        mesh.userData.hasRevealed = true
        mesh.userData.reveal = null
        mesh.userData.entranceInFront = false
        mesh.material.opacity = mesh.userData.restOpacity ?? 1
      }
    },
    dispose() {
      disposed = true
      for (const texture of textures) texture.dispose()
      for (const plane of built) {
        const shadow = plane.object.children.find(
          (child) => child.material === plane.object.userData.shadowMaterial,
        )
        if (shadow?.isMesh) {
          shadow.material.dispose()
          shadow.geometry.dispose()
        }
        plane.object.userData.cleanMaterial?.dispose()
        plane.geometry.dispose()
        plane.material.dispose()
      }
    },
  }
}
