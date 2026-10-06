// The portrait rig used to yaw and pitch toward the cursor, and a wheel
// gesture tilted that same shell. Both stay inert. apply() pins the rig
// every frame so a leftover pointer target, or a scroll-up nudge, cannot
// turn the card field — including after the hero is shown again.
export function createParallax() {
  return {
    setFromPointer() {},
    reset() {},
    nudgeFromScroll() {},
    apply(object) {
      if (!object) return
      object.rotation.x = 0
      object.rotation.y = 0
    },
  }
}
