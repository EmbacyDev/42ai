// Figma 527:18059. Chips stay attached to the existing animated card rig.
// skewY: the tag's perspective lean in Figma 450:4406 (from its transform).
export const labels = [
  { id: 'reading-people', skewY: -5.08, card: 'image-05', offset: { x: -82.6, y: 84.8 }, box: { width: 148, height: 36 }, title: 'Reading people' },
  { id: 'modeling-risk', skewY: -7.59, card: 'image-06', offset: { x: 84, y: 35 }, box: { width: 108, height: 64 }, title: 'Modeling behavioral risk' },
  { id: 'simulating-responses', skewY: -6.34, card: 'image-04', offset: { x: 55, y: 65 }, box: { width: 108, height: 64 }, title: 'Simulating human responses' },
  { id: 'optimizing-decisions', skewY: 6.34, card: 'image-01', offset: { x: 43.6, y: 62 }, box: { width: 195, height: 36 }, title: 'Optimizing decisions' },
  { id: 'predicting-markets', skewY: 3.81, card: 'image-02', offset: { x: 52, y: 61 }, box: { width: 108, height: 64 }, title: 'Predicting market reactions' },
  { id: 'personalizing-interactions', skewY: 8.84, card: 'image-03', offset: { x: -76, y: 42 }, box: { width: 133, height: 50 }, title: 'Personalizing interactions' },
].map(label => ({
  ...label,
  kind: 'copy',
  // Hug the text with the same 14px either side in every tag: one-line tags
  // size to their line, stacked tags to their longest word.
  fit: label.box.height <= 36 ? 'max-content' : 'min-content',
  padding: '10px 14px',
  gap: 0,
}))
