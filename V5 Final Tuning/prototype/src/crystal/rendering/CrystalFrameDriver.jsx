import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

// Position/opacity must keep following scroll even while the GPU sleeps.
// Otherwise the frame that would reveal the crystal could never wake it up.
export function useCrystalPoseFrame(callback, manual, poseUpdateRef) {
  const callbackRef = useRef(callback)
  useLayoutEffect(() => { callbackRef.current = callback })

  useLayoutEffect(() => {
    if (!manual) return undefined
    const update = (...args) => callbackRef.current(...args)
    poseUpdateRef.current = update
    return () => { if (poseUpdateRef.current === update) poseUpdateRef.current = null }
  }, [manual, poseUpdateRef])

  useFrame((state, delta) => {
    if (!manual) callbackRef.current(state, delta)
  })
}

export default function CrystalFrameDriver({ enabled, introReady, shellRef, poseUpdateRef }) {
  const get = useThree((state) => state.get)
  const introReadyRef = useRef(introReady)
  useLayoutEffect(() => { introReadyRef.current = introReady }, [introReady])

  useLayoutEffect(() => {
    if (!enabled) return undefined
    let frame = 0
    let previous = performance.now()
    let elapsed = get().clock.elapsedTime

    const tick = (now) => {
      frame = requestAnimationFrame(tick)
      const delta = Math.min(0.05, Math.max(0, (now - previous) / 1000))
      previous = now
      if (document.hidden) return
      elapsed += delta
      const state = get()
      poseUpdateRef.current?.(state, delta)

      // Use the final opacity written by the pose controller, after all
      // fades/masks/hand-offs. No layout read or React update on each frame.
      const opacity = Number(shellRef.current?.style.opacity || 0)
      const warming = !introReadyRef.current || !poseUpdateRef.current
      if (!warming && opacity <= 0) return

      // advance() in R3F's manual loop takes elapsed seconds. Keep delta
      // bounded on wake-up so material animation does not receive the whole
      // hidden interval. Other canvases own the shared global frame effects.
      state.clock.elapsedTime = elapsed - delta
      state.advance(elapsed, false)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [enabled, get, poseUpdateRef, shellRef])

  return null
}
