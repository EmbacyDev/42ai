/**
 * The small UI chips from the Figma frame.
 *
 * Every number here is off the macet. `offset` is the chip's position
 * relative to its card's centre in design pixels; `box` is its frame, which
 * is a fixed size there rather than hugging its content; `icon` carries
 * both dimensions, because a single one with `height: auto` gets the risk
 * arrow badly wrong — it is twice as tall as it is wide.
 *
 * `chipLayer.js` turns the offset into a point on the card's curved
 * surface and the box into a real object in the scene.
 */
export const labels = [
  {
    id: 'behavioral-state',
    card: 'image-05',
    offset: { x: -84.1, y: -59.2 },
    box: { width: 87.7, height: 75.7 },
    padding: '6px 8px',
    gap: 12,
    kind: 'state',
    title: ['Behavioral', 'State'],
    tag: 'Stable',
  },
  {
    id: 'context-mapped',
    card: 'image-06',
    offset: { x: 72.8, y: 32.2 },
    box: { width: 97.2, height: 59 },
    padding: '8px 10px',
    gap: 8,
    kind: 'icon',
    icon: { src: '/hero/icon-context.svg', width: 21, height: 21 },
    title: ['Context', 'Mapped'],
  },
  {
    id: 'confidence',
    card: 'image-01',
    offset: { x: -62.5, y: 65.0 },
    box: { width: 103.6, height: 69.1 },
    padding: '8px',
    gap: 6,
    kind: 'metric',
    value: '78',
    unit: '%',
    title: ['Confidence'],
  },
  {
    id: 'risk-tolerance',
    card: 'image-02',
    offset: { x: 69.6, y: 45.1 },
    box: { width: 100.5, height: 52.1 },
    padding: '6px 10px',
    gap: 12,
    kind: 'icon',
    icon: { src: '/hero/icon-risk.svg', width: 9.5, height: 19.1 },
    title: ['Risk', 'Tolerance'],
  },
]
