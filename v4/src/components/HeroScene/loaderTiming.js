// v4: how long the loading screen is held at minimum.
// First visit: one pass of the logo animation (all three faces, see
// LogoMotionMark.jsx — the third face is in at ~2.85s of its 4.8s loop).
// Later visits: a shorter hold, two stages only — the first face, then
// the switch to the second (fully in at ~1.76s), then the page starts.
const SEEN_KEY = '42ai-logo-intro-seen'

function readSeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export const MIN_LOADER_MS = readSeen() ? 2200 : 3700

export function markLogoIntroSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // Private mode / blocked storage: the hold just repeats next time.
  }
}
