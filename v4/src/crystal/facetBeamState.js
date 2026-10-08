// Block four: screen position of each detached facet, in CSS px. Written by
// the facets in Glass.jsx, read by FacetLightLayer.jsx, which draws the
// hero's hover beam from the crystal to the most recent facet.
export const facetBeamState = { facets: {} }

// Block four's facet steps, shared by PageCrystal (the gem's pose) and Glass
// (which face each pane leaves from). Each step first turns the gem a
// quarter turn (and tilts it), then the pane leaves.
// Pitch per step: steps alternate top / bottom — step two tips the gem's
// lower half toward the viewer so its pane comes out of the bottom; the
// panes always leave on the right.
export const FACET_STEP_TILT_X = [0.12, -0.34, 0.12, 0.12]
// Share of each step spent turning, and where the pane starts to leave.
export const FACET_TURN_END = 0.45
export const FACET_DETACH_START = 0.55
