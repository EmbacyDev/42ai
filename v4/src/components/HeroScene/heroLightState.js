// Hero scene → crystal canvas: what the crystal light needs each frame, in
// CSS pixels. Written by mountHeroScene.js, read by PageCrystal.jsx.
export const heroLightState = { hover: null, masks: [], inHero: false }
if (typeof window !== "undefined") window.__heroLightState = heroLightState
