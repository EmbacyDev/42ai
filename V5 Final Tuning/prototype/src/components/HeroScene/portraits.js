const card01 = '/images/hero-749/01.png'
const card02 = '/images/hero-749/02.png'
const card03 = '/images/hero-749/03.png'
const card04 = '/images/hero-749/04.png'
const card05 = '/images/hero-749/05.png'
const card06 = '/images/hero-749/06.png'

/**
 * Figma Hero 749:1427. Each photo export includes its authored inner shadows.
 * `rect` is the photo mask's design-space bounds; `sheet` includes shadow padding.
 * The original vector mask restores transparency when the texture is loaded.
 */
export const portraits = [
  {
    id: 'image-05',
    src: card02,
    rect: { centerX: 250.26596, centerY: 233.34561, width: 211.59442, height: 168.69122 },
    sheet: { w: 237.796875, h: 192.9375 },
    mask: { x: 17.25000, y: 8.80664, w: 211.59442, h: 168.69122 },
    crop: { x: 0, y: 0, w: 237.796875, h: 192.9375 },
    shear: 0.094,
    phase: 0.2,
  },
  {
    id: 'image-04',
    src: card03,
    rect: { centerX: 460.44724, centerY: 271.87079, width: 108.89448, height: 89.74158 },
    sheet: { w: 126.484375, h: 106.40625 },
    mask: { x: 12.79688, y: 6.33203, w: 108.89448, h: 89.74158 },
    crop: { x: 0, y: 0, w: 126.484375, h: 106.40625 },
    shear: 0.084,
    phase: 1.7,
  },
  {
    id: 'image-06',
    src: card01,
    rect: { centerX: 148.68560, centerY: 431.71479, width: 104.12119, height: 90.75769 },
    sheet: { w: 121.71875, h: 106.57422 },
    mask: { x: 12.79688, y: 5.90821, w: 104.12119, h: 90.75769 },
    crop: { x: 0, y: 0, w: 121.71875, h: 106.57422 },
    shear: 0.168,
    phase: 3.1,
  },
  {
    id: 'image-01',
    src: card04,
    rect: { centerX: 993.99249, centerY: 232.27075, width: 171.23378, height: 136.51416 },
    sheet: { w: 188.828125, h: 152.53125 },
    mask: { x: 4.79747, y: 6.00781, w: 171.23378, h: 136.51416 },
    crop: { x: 0, y: 0, w: 188.828125, h: 152.53125 },
    shear: -0.093,
    phase: 2.2,
  },
  {
    id: 'image-02',
    src: card05,
    rect: { centerX: 1227.39651, centerY: 170.09931, width: 108.89448, height: 89.74158 },
    sheet: { w: 126.484375, h: 106.40625 },
    mask: { x: 4.79302, y: 6.33204, w: 108.89448, h: 89.74158 },
    crop: { x: 0, y: 0, w: 126.484375, h: 106.40625 },
    shear: -0.084,
    phase: 4.4,
  },
  {
    id: 'image-03',
    src: card06,
    rect: { centerX: 1231.68848, centerY: 441.79453, width: 153.84178, height: 134.09688 },
    sheet: { w: 171.4375, h: 149.06055 },
    mask: { x: 4.79884, y: 5.48242, w: 153.84178, h: 134.09688 },
    crop: { x: 0, y: 0, w: 171.4375, h: 149.06055 },
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
