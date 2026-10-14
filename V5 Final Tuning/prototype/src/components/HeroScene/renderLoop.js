import * as THREE from 'three'

export function startRenderLoop({ renderer, scene, camera, element, update }) {
  let frame = 0
  let running = true
  const timer = new THREE.Timer()

  const tick = () => {
    if (!running) return
    frame = requestAnimationFrame(tick)
    timer.update()
    const delta = Math.min(timer.getDelta(), 0.05)
    update(timer.getElapsed(), delta)
    renderer.render(scene, camera)
  }

  const visibility = new IntersectionObserver(([entry]) => {
    const visible = entry.isIntersecting
    if (visible && !running) {
      running = true
      timer.update()
      tick()
    } else if (!visible && running) {
      running = false
      cancelAnimationFrame(frame)
    }
  })

  if (element) visibility.observe(element)
  tick()

  return () => {
    running = false
    cancelAnimationFrame(frame)
    visibility.disconnect()
  }
}
