import card01 from '../../../assets/hero images/new/01.png'
import card02 from '../../../assets/hero images/new/02.png'
import card03 from '../../../assets/hero images/new/03.png'
import card04 from '../../../assets/hero images/new/04.png'
import card05 from '../../../assets/hero images/new/05.png'
import card06 from '../../../assets/hero images/new/06.png'

/**
 * Desktop portrait field, read from Figma hero 318:35283 (1440×800).
 *
 * The photographs are the exported cards in `assets/hero images/new`.
 * Curve, skew and rounded corners are already in the PNG alpha, so the
 * mesh stays a flat plane facing the camera. Shearing or yawing it again
 * would bend the export a second time.
 *
 * `rect` is the mask group's bounding box — the opaque pixels, not the
 * file's transparent padding. `pad` is that padding, so the plane can be
 * a little larger than `rect` and the visible card still lands on it.
 * `shear` is only for the label chips; it is the rise of the opaque top
 * edge divided by its width (local +y is up).
 */
export const portraits = [
  {
    id: 'image-05',
    src: card02,
    rect: { centerX: 261.83, centerY: 227.17, width: 232.21, height: 185.13 },
    pad: { imgW: 783, imgH: 636, minX: 56, minY: 32, maxX: 753, maxY: 581 },
    shear: 0.094,
    phase: 0.2,
  },
  {
    id: 'image-04',
    src: card03,
    rect: { centerX: 490.08, centerY: 267.06, width: 108.89, height: 89.74 },
    pad: { imgW: 370, imgH: 310, minX: 28, minY: 15, maxX: 354, maxY: 282 },
    shear: 0.084,
    phase: 1.7,
  },
  {
    id: 'image-06',
    src: card01,
    rect: { centerX: 148.69, centerY: 431.72, width: 104.12, height: 90.76 },
    pad: { imgW: 352, imgH: 306, minX: 25, minY: 14, maxX: 337, maxY: 281 },
    shear: 0.168,
    phase: 3.1,
  },
  {
    id: 'image-01',
    src: card04,
    // 40px closer to the crystal than the macet box (1165.23).
    rect: { centerX: 1125.23, centerY: 232.27, width: 171.23, height: 136.51 },
    pad: { imgW: 578, imgH: 469, minX: 41, minY: 23, maxX: 555, maxY: 428 },
    shear: -0.093,
    phase: 2.2,
  },
  {
    id: 'image-02',
    src: card05,
    rect: { centerX: 1336.31, centerY: 170.1, width: 108.89, height: 89.74 },
    pad: { imgW: 370, imgH: 310, minX: 28, minY: 15, maxX: 354, maxY: 282 },
    shear: -0.084,
    phase: 4.4,
  },
  {
    id: 'image-03',
    src: card06,
    rect: { centerX: 1385.53, centerY: 441.79, width: 153.84, height: 134.1 },
    pad: { imgW: 519, imgH: 452, minX: 37, minY: 21, maxX: 499, maxY: 415 },
    shear: -0.17,
    phase: 5.3,
  },
]
