export const WORLD_MODEL_ABSORBED_EVENT = '42ai-world-model-absorbed'
export const WORLD_MODEL_RETURN_EVENT = '42ai-world-model-return'
// 4→3: block four has played its arrival backwards (facet back in the gem,
// heading shown again); block three now plays the wave backwards.
export const WORLD_MODEL_BACK_EVENT = '42ai-world-model-back'

// The 2↔3 transition:
//  'mask'  (v5) the crystal settles in the centre, then block three's field,
//          cut to the crystal's hexagon, bursts out of it to fill the screen
//  'band'  (v4) the field wells up from the bottom edge in a dome
//  'light' the earlier crystal-light opening
export const TRANSITION_MODE = 'mask'
export const BAND_TRANSITION = TRANSITION_MODE === 'band'
export const MASK_TRANSITION = TRANSITION_MODE === 'mask'
// Mask burst: how long the hexagon takes to grow from the gem to the
// whole screen (and to shrink back on the way up).
// (the reference: the gradient "o" of "You" floods the frame in ~0.3s,
// accelerating, its picture zooming with it).
export const MASK_BURST = 0.2
// Step 1: cards fade, the gem drops to the centre (spinning anticlockwise).
export const MASK_DESCENT = 0.7
export const MASK_CONTENT_EXIT = 0.3
// Step 2: still spinning, the gem grows a little toward the camera.
export const MASK_PRE_ZOOM = 0.22
// Turns (anticlockwise) over the descent and over the pre-zoom.
export const MASK_SPIN_DESCENT = 0.75
export const MASK_SPIN_ZOOM = 0.5
// Band timing (seconds): a peek at the bottom edge, then the stretch.
export const BAND_PEEK = 0.45
export const BAND_STRETCH = 0.9
export const BAND_IN = BAND_PEEK + BAND_STRETCH
// How far the band peeks before it stretches (share of the viewport).
export const BAND_PEEK_SHARE = 0.14
// Block two is not animated: it is carried up the screen by the rising
// band, exactly like a scroll (cards, copy and crystal together).

// Live band size (0..1), written by WorldModelSection while the band plays,
// read by block two to ride exactly on the dome's crest.
export const bandState = { value: 0 }
// Height of the dome's crest in viewport heights per unit of band
// (bandRenderer.js: ry = (2.3·band + 0.01)·0.7, solid to 0.86 of it).
export const BAND_CREST_PER_UNIT = 2.3 * 0.7 * 0.86

// v5: true while the mask is being drawn back into the centred gem (3→2);
// block two must keep the gem in the centre until then.
export const maskState = { collapsing: false }
