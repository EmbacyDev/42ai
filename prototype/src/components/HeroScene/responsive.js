import * as THREE from 'three'
import { sceneConfig } from './sceneConfig.js'

/**
 * Keeps the desktop composition's horizontal span stable.
 * Narrower viewports reveal a little more vertical space instead of
 * scaling the portrait positions. Wider viewports keep the same field
 * and show more margin.
 */
export function frameCamera(camera, width, height) {
  const { fov, designAspect } = sceneConfig.camera
  const aspect = width / Math.max(height, 1)
  const designTan = Math.tan(THREE.MathUtils.degToRad(fov / 2))

  let nextFov = fov
  if (aspect < designAspect) {
    const horizontalTan = designTan * designAspect
    nextFov = THREE.MathUtils.radToDeg(Math.atan(horizontalTan / aspect) * 2)
  }

  camera.aspect = aspect
  camera.fov = nextFov
  camera.updateProjectionMatrix()
}

export function resizeRenderer(renderer, camera, width, height) {
  const dpr = Math.min(window.devicePixelRatio || 1, sceneConfig.dprCap)
  renderer.setPixelRatio(dpr)
  renderer.setSize(Math.max(width, 1), Math.max(height, 1), false)
  frameCamera(camera, width, height)
}

export function bindResize(element, onResize) {
  // clientWidth/clientHeight, not getBoundingClientRect: the latter reports
  // the transformed box, so a page that scales or animates this section with
  // a CSS transform would silently change the render resolution.
  const measure = () => {
    onResize(element.clientWidth, element.clientHeight)
  }

  measure()
  const observer = new ResizeObserver(measure)
  observer.observe(element)
  return () => observer.disconnect()
}
