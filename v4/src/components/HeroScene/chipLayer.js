import * as THREE from 'three'
import { bendAt, bendNormal } from './bend.js'
import { sceneConfig } from './sceneConfig.js'
import { unitsPerPixel, anchorAtOrigin, spreadCenter } from './placement.js'

const cameraZ = sceneConfig.camera.position[2]

const cameraPos = new THREE.Vector3()
const cardPos = new THREE.Vector3()
const cardNormal = new THREE.Vector3()
const planePoint = new THREE.Vector3()
const rayDir = new THREE.Vector3()
const hit = new THREE.Vector3()
const local = new THREE.Vector3()
const chipWorld = new THREE.Vector3()
const surfaceNormal = new THREE.Vector3()
const toInverse = new THREE.Matrix4()
const Z_AXIS = new THREE.Vector3(0, 0, 1)

/**
 * Finds the point on a card's curved surface that projects onto the chip's
 * position in the macet.
 *
 * Gluing the chip to the card at the macet offset measured flat does not
 * work — the card is turned up to 40°, so its surface is foreshortened and
 * the chip lands short. Instead the macet position is turned back into a
 * camera ray and intersected with the card's surface, which gives the
 * surface point that lands exactly where the design puts it.
 *
 * The surface is curved, so the intersection is iterated: each pass
 * intersects the tangent plane offset by the bend found in the previous
 * one. Three passes is well past convergence for a curve this shallow.
 */
function solveSurfacePoint(card, rect, offset, camera) {
  card.getWorldPosition(cardPos)
  cardNormal.set(0, 0, 1).applyQuaternion(card.getWorldQuaternion(new THREE.Quaternion()))
  toInverse.copy(card.matrixWorld).invert()

  cameraPos.setFromMatrixPosition(camera.matrixWorld)
  const card2d = spreadCenter(rect.centerX, rect.centerY)
  const target = anchorAtOrigin(card2d.x + offset.x, card2d.y + offset.y)
  rayDir.set(target.x, target.y, 0).sub(cameraPos).normalize()

  let depth = 0
  for (let pass = 0; pass < 3; pass++) {
    planePoint.copy(cardPos).addScaledVector(cardNormal, depth)
    const t = planePoint.sub(cameraPos).dot(cardNormal) / rayDir.dot(cardNormal)
    hit.copy(cameraPos).addScaledVector(rayDir, t)
    local.copy(hit).applyMatrix4(toInverse)
    depth = bendAt(local.x, local.y, card.userData.bend)
  }

  local.z = depth
  return local.clone()
}

/**
 * Renders the chips as real objects in the scene, as DOM.
 *
 * They are children of their cards in the three.js graph, so they inherit
 * everything the card does: its turn toward the crystal, its depth, the
 * ambient drift, the parallax of the whole rig. Each frame their world
 * matrix is written out as a CSS `matrix3d`, which is the same trick
 * three.js' own CSS3DRenderer uses — the browser then applies the identical
 * perspective the WebGL camera does, so a chip is foreshortened exactly
 * like the photo underneath it.
 *
 * DOM rather than a textured plane because the type is 10-11px and has to
 * stay crisp, and the frosted backdrop is one CSS declaration here versus a
 * transmission pass in WebGL.
 *
 * What DOM cannot do is bend. A chip is flat, laid tangent to the card at
 * its own centre and tilted to the surface normal there, so it sits on the
 * curve rather than cutting through it. Over a box this small the residual
 * gap is well under a pixel.
 */
export function createChipLayer({ labels, cardsById, camera, element }) {
  const root = element.querySelector('.hero-labels')
  const stage = element.querySelector('.hero-labels__stage')
  if (!root || !stage) return { update() {}, dispose() {} }

  const bound = []
  // The solve casts a ray from the camera, which has not rendered yet.
  camera.updateMatrixWorld(true)

  for (const label of labels) {
    const card = cardsById.get(label.card)
    const node = element.querySelector(`[data-label-id="${label.id}"]`)
    if (!card || !node) continue

    card.updateMatrixWorld(true)
    const position = solveSurfacePoint(card, card.userData.rect, label.offset, camera)
    position.y += (card.userData.shear ?? 0) * position.x

    const object = new THREE.Object3D()
    object.position.copy(position)

    bendNormal(position.x, position.y, card.userData.bend, surfaceNormal)
    object.quaternion.setFromUnitVectors(Z_AXIS, surfaceNormal)

    // The chip's box is authored in design pixels; this is what one of them
    // is worth in world units at the depth it ended up at.
    chipWorld.copy(position).applyMatrix4(card.matrixWorld)
    object.scale.setScalar(unitsPerPixel * (1 - chipWorld.z / cameraZ))

    // A hair off the surface, or the photo's own curve pokes through. In
    // world units — an object's own scale does not apply to its position.
    object.translateZ(0.004)

    card.add(object)
    bound.push({ node, object })
  }

  return {
    update(width, height) {
      if (!width || !height) return

      camera.updateMatrixWorld()
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert()

      // The CSS perspective that matches the WebGL camera's field of view.
      const fov = camera.projectionMatrix.elements[5] * (height / 2)
      root.style.perspective = `${fov}px`
      // No centering term: the stage's own origin is already pinned to the
      // middle of the section in CSS, where the perspective origin is too.
      stage.style.transform =
        `translateZ(${fov}px)` + cssMatrix(camera.matrixWorldInverse, true)

      for (const { node, object } of bound) {
        // The card opacity covers the entrance and the scroll exit.
        // chipReveal stays at 0 while the photo is still flying out of
        // the crystal, then fades in once it has reached its seat.
        const card = object.parent
        const reveal = card.userData.chipReveal ?? (card.userData.hasRevealed ? 1 : 0)
        // v4: grows from 55% as it fades in, so it does not pop.
        const grow = 0.55 + 0.45 * reveal
        node.style.transform = `translate(-50%,-50%)${cssMatrix(object.matrixWorld, false)} skewY(${node.dataset.skew || 0}deg) scale(${grow})`
        node.style.opacity = String(reveal * card.material.opacity)
      }
    },
    dispose() {
      for (const { object } of bound) object.removeFromParent()
    },
  }
}

/**
 * A three.js matrix as a CSS one. CSS' y axis points down, so a flip has to
 * be folded in at both ends of the chain: the camera matrix flips its
 * second row, turning the result y-down, and each object matrix flips its
 * second column, reading a y-down box out of the DOM. Between them the two
 * flips leave the world untouched — flipping both ends of one matrix
 * instead would put a spurious mirror in the middle.
 */
export function cssMatrix(matrix, isCamera) {
  const e = matrix.elements
  const s = isCamera
    ? [e[0], -e[1], e[2], e[3], e[4], -e[5], e[6], e[7], e[8], -e[9], e[10], e[11], e[12], -e[13], e[14], e[15]]
    : [e[0], e[1], e[2], e[3], -e[4], -e[5], -e[6], -e[7], e[8], e[9], e[10], e[11], e[12], e[13], e[14], e[15]]
  return `matrix3d(${s.map((n) => (Math.abs(n) < 1e-6 ? 0 : n)).join(',')})`
}
