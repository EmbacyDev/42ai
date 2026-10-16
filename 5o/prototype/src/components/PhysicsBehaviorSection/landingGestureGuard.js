// Absorb only the tail of the gesture that opened screen six. A quiet gap,
// reverse input, or the hard deadline always releases native scrolling.
export function createLandingGestureGuard(quietMs = 100, maxMs = 700) {
  let quietUntil = 0
  let deadline = 0
  return {
    arm(now) {
      quietUntil = now + quietMs
      deadline = now + maxMs
    },
    consume(now, direction) {
      if (direction <= 0 || now >= quietUntil || now >= deadline) {
        quietUntil = deadline = 0
        return false
      }
      quietUntil = now + quietMs
      return true
    },
  }
}
