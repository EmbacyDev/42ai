export const SLOW_LOAD_DELAY_MS = 1000
export const LOADER_CYCLE_MS = 5000

// Readiness is monotonic: after reveal, late timers cannot bring the loader back.
export function createIntroGate(onChange, schedule = setTimeout, cancel = clearTimeout) {
  let ready = false
  let released = false
  let shown = false
  let cycleDone = false
  let disposed = false
  let cycleTimer
  const release = () => {
    if (disposed || released || !ready || (shown && !cycleDone)) return
    released = true
    cancel(delayTimer)
    onChange({ shown, released: true })
  }
  const delayTimer = schedule(() => {
    if (disposed || released) return
    shown = true
    onChange({ shown: true, released: false })
    cycleTimer = schedule(() => {
      cycleDone = true
      release()
    }, LOADER_CYCLE_MS)
  }, SLOW_LOAD_DELAY_MS)
  return {
    setReady() { ready = true; release() },
    dispose() {
      disposed = true
      cancel(delayTimer)
      cancel(cycleTimer)
    },
  }
}
