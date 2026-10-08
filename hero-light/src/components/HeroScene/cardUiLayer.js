import * as THREE from 'three'
import { cssMatrix } from './chipLayer.js'
import { heroUiElement } from './rasterizeHeroCard.js'

function parseMatrix(value) {
  const nums = `${value || ''}`.match(/-?[\d.]+(?:e-?\d+)?/gi)?.map(Number) ?? []
  if (nums.length < 6) return [1, 0, 0, 1, 0, 0]
  return nums.slice(0, 6)
}

/**
 * The frosted chips, as the original SVG rather than a texture.
 *
 * The portrait canvas is deliberately low-density, and a mipmapped texture
 * of small type goes soft on top of that. These nodes share each card's
 * transform, so they stay glued to the photograph, but the browser rasterises
 * the vectors at the screen's real pixel density.
 */
export function createCardUiLayer({ meshes, sources, camera, element }) {
  const root = document.createElement('div')
  root.className = 'hero-card-ui'
  const stage = document.createElement('div')
  stage.className = 'hero-card-ui__stage'
  root.appendChild(stage)
  element.appendChild(root)

  const bound = []
  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i]
    const size = mesh.userData.uiPixelSize
    if (!size) continue
    const node = document.createElement('div')
    node.className = 'hero-card-ui__card'
    node.style.width = `${size.width}px`
    node.style.height = `${size.height}px`
    node.style.opacity = '0'
    const glass = document.createElement('div')
    glass.className = 'hero-card-ui__glass'
    glass.style.opacity = '0'
    stage.appendChild(glass)
    stage.appendChild(node)
    const item = { node, glass, mesh, shown: 0, skew: '' }
    bound.push(item)
    heroUiElement(sources[i])
      .then((svg) => {
        if (!node.isConnected) return
        const box = svg.viewBox?.baseVal
        const rect = svg._chipRect
        if (rect && box?.width && box?.height) {
          const [a, b, c, d, e, f] = parseMatrix(rect.getAttribute('transform'))
          const rw = Number(rect.getAttribute('width')) || 0
          const rh = Number(rect.getAttribute('height')) || 0
          const rx = Number(rect.getAttribute('rx')) || 0
          const kx = size.width / box.width
          const ky = size.height / box.height
          const cx = a * (rw / 2) + c * (rh / 2) + e
          const cy = b * (rw / 2) + d * (rh / 2) + f
          const anchor = mesh.userData.uiAnchor
          const unit = anchor.scale.x
          const glassAnchor = new THREE.Object3D()
          glassAnchor.scale.copy(anchor.scale)
          glassAnchor.position.set(
            anchor.position.x + (cx - box.width / 2) * kx * unit,
            anchor.position.y - (cy - box.height / 2) * ky * unit,
            anchor.position.z,
          )
          mesh.add(glassAnchor)
          glass.style.width = `${rw * kx}px`
          glass.style.height = `${rh * ky}px`
          glass.style.borderRadius = `${rx * ((kx + ky) / 2)}px`
          item.glassAnchor = glassAnchor
          item.skew = `matrix(${a}, ${b * (ky / kx)}, ${c * (kx / ky)}, ${d}, 0, 0)`
        }
        node.appendChild(svg)
      })
      .catch(() => {})
  }

  return {
    update(width, height) {
      if (!width || !height) return
      camera.updateMatrixWorld()
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
      const fov = camera.projectionMatrix.elements[5] * (height / 2)
      root.style.perspective = `${fov}px`
      stage.style.transform = `translateZ(${fov}px)${cssMatrix(camera.matrixWorldInverse, true)}`

      for (const item of bound) {
        const { node, mesh } = item
        const anchor = mesh.userData.uiAnchor
        if (!anchor) continue
        node.style.transform = `translate(-50%,-50%)${cssMatrix(anchor.matrixWorld, false)}`
        if (item.glassAnchor) {
          item.glass.style.transform =
            `translate(-50%,-50%)${cssMatrix(item.glassAnchor.matrixWorld, false)}${item.skew}`
        }
        const target = (mesh.userData.chipReveal ?? 0) * (mesh.material.opacity ?? 0)
        // Ease in after the card lands. Follow the target straight down, so
        // the chip is gone before the photograph moves back into the crystal.
        item.shown = target < item.shown ? target : item.shown + (target - item.shown) * 0.22
        const opacity = String(item.shown)
        node.style.opacity = opacity
        item.glass.style.opacity = opacity
      }
    },
    dispose() {
      root.remove()
    },
  }
}
