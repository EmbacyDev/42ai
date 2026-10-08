import card01 from '../../../assets/hero images/01.svg'
import card02 from '../../../assets/hero images/02.svg'
import card03 from '../../../assets/hero images/03.svg'
import card04 from '../../../assets/hero images/04.svg'
import card05 from '../../../assets/hero images/05.svg'
import card06 from '../../../assets/hero images/06.svg'

/**
 * Desktop portrait field, read from Figma hero 318:35283 (1440×800).
 *
 * The cards are the SVGs in `assets/hero images`. Each file is a masked
 * photograph plus the UI chip that belongs on it. `rect` is still the
 * photograph's place in the macet — the mesh is not sheared again, because
 * the skew is already in the export.
 *
 * `sheet` is the SVG viewBox. `mask` is the photograph's axis-aligned
 * bounds inside that sheet, and it is what lands on `rect`. `crop` is the
 * photo group's drop-shadow filter, so the shadow still hangs off the card
 * without pulling the UI's empty margin into the flight size.
 * `shear` is only for the (currently unused) label chips.
 */
export const portraits = [
  {
    id: 'image-05',
    src: card02,
    rect: { centerX: 261.83, centerY: 227.17, width: 232.21, height: 185.13 },
    sheet: { w: 283, h: 212 },
    mask: { x: 40, y: 10, w: 233, h: 184 },
    crop: { x: 21.7985, y: 0, w: 260.969, h: 211.736 },
    shear: 0.094,
    phase: 0.2,
  },
  {
    id: 'image-04',
    src: card03,
    rect: { centerX: 475.45, centerY: 271.87, width: 108.89, height: 89.74 },
    sheet: { w: 172, h: 138 },
    mask: { x: 9, y: 5, w: 110, h: 90 },
    crop: { x: 0, y: 0, w: 123.099, h: 103.009 },
    shear: 0.084,
    phase: 1.7,
  },
  {
    id: 'image-06',
    src: card01,
    rect: { centerX: 148.69, centerY: 431.72, width: 104.12, height: 90.76 },
    sheet: { w: 198, h: 117 },
    mask: { x: 8, y: 4, w: 105, h: 90 },
    crop: { x: 0, y: 0, w: 117.015, h: 101.866 },
    shear: 0.168,
    phase: 3.1,
  },
  {
    id: 'image-01',
    src: card04,
    // Card positions from Figma 450:4406 (local layout).
    rect: { centerX: 994, centerY: 232.27, width: 171.23, height: 136.51 },
    sheet: { w: 242, h: 177 },
    mask: { x: 13, y: 7, w: 173, h: 136 },
    crop: { x: 0, y: 0, w: 192.438, h: 156.134 },
    shear: -0.093,
    phase: 2.2,
  },
  {
    id: 'image-02',
    src: card05,
    rect: { centerX: 1227.41, centerY: 170.1, width: 108.89, height: 89.74 },
    sheet: { w: 171, h: 147 },
    mask: { x: 9, y: 5, w: 110, h: 90 },
    crop: { x: 0, y: 0, w: 123.099, h: 103.009 },
    shear: -0.084,
    phase: 4.4,
  },
  {
    id: 'image-03',
    src: card06,
    rect: { centerX: 1231.69, centerY: 441.79, width: 153.84, height: 134.1 },
    sheet: { w: 226, h: 157 },
    mask: { x: 64, y: 7, w: 155, h: 132 },
    crop: { x: 52.232, y: 0, w: 172.892, h: 150.51 },
    shear: -0.17,
    phase: 5.3,
  },
]

/** Tablet Figma positions, expressed in the existing camera's design space. */
const tabletCenters = {
  'image-05': [77.83, 474.57],
  'image-04': [153.45, 219.87],
  'image-06': [-197.94, 431.72],
  'image-01': [599.91, 182.53],
  'image-02': [880.78, 170.10],
  'image-03': [671.69, 490.05],
}
export const tabletPortraits = portraits.map((portrait) => {
  const [x, y] = tabletCenters[portrait.id]
  const ratio = portrait.id === 'image-01' ? .8116 : 1
  return { ...portrait, rect: { ...portrait.rect,
    centerX: 720 + x - 384, centerY: 400 + y - 480,
    width: portrait.rect.width * ratio, height: portrait.rect.height * ratio,
  } }
})
