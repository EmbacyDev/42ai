
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
