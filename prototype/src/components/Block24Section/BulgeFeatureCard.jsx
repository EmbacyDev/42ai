import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { layoutBlock24 } from './block24Layout.js'

const PHOTO_WIDTH = 315
const PHOTO_HEIGHT = 210
const TITLE_FONT_SIZE = 32
const TITLE_LINE_HEIGHT = 1.2
const imageCache = new Map()

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying float vDome;
  varying float vFacetDepth;
  uniform float uBulge;
  uniform float uMotion;
  uniform float uDirection;
  uniform float uLensX;
  uniform float uPhotoCenterY;

  void main() {
    vUv = uv;
    vec3 p = position;
    float sphereX = (uv.x - 0.5) * 2.0;
    float angle = sphereX * 0.94;
    float absAngle = abs(angle);

    // Every state now lives on one continuous spherical shell. Previously
    // each side was folded around its own hinge, so neighbouring labels
    // looked like unrelated bent cards. This is one shared circular arc:
    // the centre is its tangent face and both sides recede toward the same
    // optical centre above the active card (where the crystal sits).
    float maxDepth = 1.0 - cos(0.94);
    float sphereDepth = (1.0 - cos(angle)) / maxDepth;
    float arcCompression = absAngle < 0.0001 ? 1.0 : sin(absAngle) / absAngle;

    // Keep typography legible: the mathematical sphere is deliberately
    // softened to 72%, limiting horizontal compression to about ten per
    // cent at the outer headings. There is no anisotropic stretching.
    p.x *= mix(1.0, arcCompression, 0.72 * uBulge);
    p.z -= sphereDepth * 0.86 * uBulge;
    p.y += sphereDepth * 0.18 * uBulge;

    // A very shallow central relief gives the active photograph the sense
    // of resting on the front of the same sphere without visibly bending
    // faces, copy, or the photo's rectangular edges.
    float photoY = (uv.y - uPhotoCenterY) * 2.75;
    float centreRelief = exp(
      -sphereX * sphereX * 13.0 - photoY * photoY * 3.6
    ) * (0.055 + uMotion * 0.085);
    p.z += centreRelief * uBulge;

    vDome = 1.0 - sphereDepth;
    vFacetDepth = sphereDepth;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying float vDome;
  varying float vFacetDepth;
  uniform sampler2D uTexture;
  uniform sampler2D uPreviousTexture;
  uniform float uLight;
  uniform float uTime;
  uniform float uProgress;
  uniform float uMotion;
  uniform float uDirection;
  uniform float uLensX;
  uniform vec2 uPhotoMin;
  uniform vec2 uPhotoMax;
  uniform vec2 uTextMin;
  uniform vec2 uTextMax;
  uniform float uCrystalUvY;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float boxMask(vec2 uv, vec2 boxMin, vec2 boxMax, float feather) {
    vec2 insideMin = smoothstep(boxMin, boxMin + vec2(feather), uv);
    vec2 insideMax = 1.0 - smoothstep(boxMax - vec2(feather), boxMax, uv);
    return insideMin.x * insideMin.y * insideMax.x * insideMax.y;
  }

  void main() {
    vec2 lensDelta = vUv - vec2(uLensX, 0.5);
    float sideZone = smoothstep(0.15, 0.29, abs(vUv.x - 0.5));
    // A broad refraction field follows the physical arc. The previous
    // narrow Gaussian band resolved as two bright lines descending from
    // the top during a state change, especially against the white field.
    float arcRefraction = smoothstep(0.10, 0.24, abs(lensDelta.x))
      * (1.0 - smoothstep(0.35, 0.52, abs(lensDelta.x)));
    float refraction = sideZone * (
      0.00018 + uMotion * 0.0010 + arcRefraction * uMotion * 0.00125
    );
    vec2 direction = normalize(vec2(lensDelta.x, lensDelta.y * 0.24) + vec2(0.0001));
    vec2 offset = direction * refraction;

    // Block three feels physical because its cards actually travel between
    // slots. Reproduce that movement here in texture space while keeping a
    // single continuous glass mesh: the old composition leaves the centre
    // for the opposite side, and the new composition enters from the side
    // slot instead of scaling up in place.
    float slot = 0.292;
    vec2 currentUv = clamp(
      vUv - vec2(uDirection * (1.0 - uProgress) * slot, 0.0),
      vec2(0.001), vec2(0.999)
    );
    vec2 previousUv = clamp(
      vUv + vec2(uDirection * uProgress * slot, 0.0),
      vec2(0.001), vec2(0.999)
    );

    // Perspective on the shared sphere now supplies all apparent size
    // change. The former second, shrinking rectangular mask created a faint
    // box around the photograph while it travelled between states.
    float currentPhotoMask = boxMask(currentUv, uPhotoMin, uPhotoMax, 0.004);
    float previousPhotoMask = boxMask(previousUv, uPhotoMin, uPhotoMax, 0.004);

    // The centre photograph must stay optically clean. Refraction belongs
    // to the glass around it and to the side labels; applying even a tiny
    // RGB displacement to the photo's antialiased boundary turns that
    // boundary into a dark top/side rule while the card is moving.
    // Protect a small transparent margin around the photo as well. At the
    // antialiased boundary the regular mask is fractional; allowing RGB
    // refraction there splits that one edge into several nested rectangles.
    float currentPhotoProtection = boxMask(
      currentUv,
      uPhotoMin - vec2(0.012),
      uPhotoMax + vec2(0.012),
      0.002
    );
    float previousPhotoProtection = boxMask(
      previousUv,
      uPhotoMin - vec2(0.012),
      uPhotoMax + vec2(0.012),
      0.002
    );
    float photoProtection = max(currentPhotoProtection, previousPhotoProtection);
    vec2 surfaceOffset = offset * (1.0 - photoProtection);
    currentUv += surfaceOffset;
    previousUv -= surfaceOffset * 1.15;

    // Do not fold the photo a second time in UV space. The whole row is
    // already one subdivided spherical mesh, so a picture travelling from
    // a side slot naturally follows that physical curve. The additional
    // UV fold used to pull the antialiased top and side pixels away from
    // the image body, creating the visible rectangular ghost lines.
    currentUv = clamp(currentUv, vec2(0.001), vec2(0.999));
    previousUv = clamp(previousUv, vec2(0.001), vec2(0.999));

    float currentTextMask = boxMask(currentUv, uTextMin, uTextMax, 0.006);
    float previousTextMask = boxMask(previousUv, uTextMin, uTextMax, 0.006);
    float currentTextProtection = boxMask(
      currentUv,
      uTextMin - vec2(0.012),
      uTextMax + vec2(0.012),
      0.002
    );
    float previousTextProtection = boxMask(
      previousUv,
      uTextMin - vec2(0.012),
      uTextMax + vec2(0.012),
      0.002
    );

    vec4 currentBase = texture2D(uTexture, currentUv);
    vec4 previousBase = texture2D(uPreviousTexture, previousUv);
    // The moving texture carries the side headings and active copy only.
    // Remove its photo footprints completely: the single fixed centre photo
    // is composited below, so no second image can appear on either wing.
    currentBase.a *= (1.0 - currentPhotoProtection) * (1.0 - currentTextProtection);
    previousBase.a *= (1.0 - previousPhotoProtection) * (1.0 - previousTextProtection);
    vec2 currentPlusUv = currentUv + surfaceOffset;
    vec2 currentMinusUv = currentUv - surfaceOffset;
    vec2 previousPlusUv = previousUv + surfaceOffset;
    vec2 previousMinusUv = previousUv - surfaceOffset;
    // Refraction stays inside the image at its edges. Sampling transparent
    // canvas pixels for just one colour channel produces a dark hairline,
    // even when the underlying photograph itself is no longer folded.
    currentPlusUv = mix(currentPlusUv, clamp(currentPlusUv, uPhotoMin, uPhotoMax), currentPhotoMask);
    currentMinusUv = mix(currentMinusUv, clamp(currentMinusUv, uPhotoMin, uPhotoMax), currentPhotoMask);
    previousPlusUv = mix(previousPlusUv, clamp(previousPlusUv, uPhotoMin, uPhotoMax), previousPhotoMask);
    previousMinusUv = mix(previousMinusUv, clamp(previousMinusUv, uPhotoMin, uPhotoMax), previousPhotoMask);
    vec3 currentChromatic = vec3(
      texture2D(uTexture, clamp(currentPlusUv, vec2(0.001), vec2(0.999))).r,
      currentBase.g,
      texture2D(uTexture, clamp(currentMinusUv, vec2(0.001), vec2(0.999))).b
    );
    vec3 previousChromatic = vec3(
      texture2D(uPreviousTexture, clamp(previousMinusUv, vec2(0.001), vec2(0.999))).r,
      previousBase.g,
      texture2D(uPreviousTexture, clamp(previousPlusUv, vec2(0.001), vec2(0.999))).b
    );
    // The shared mesh supplies the photograph's spherical deformation.
    // Chromatic glass remains on the surrounding labels, but the whole
    // expanded photo footprint uses one RGB sample so its boundary cannot
    // split into offset rectangular contours during travel.
    vec3 currentRefracted = mix(currentChromatic, currentBase.rgb, currentPhotoProtection);
    vec3 previousRefracted = mix(previousChromatic, previousBase.rgb, previousPhotoProtection);

    float enter = smoothstep(0.025, 0.82, uProgress);
    // The moving sphere reveals the incoming composition a little before
    // the global blend reaches it, so it reads as a lens uncovering a card
    // rather than two screenshots dissolving into each other.
    float lensReveal = exp(-pow((vUv.x - uLensX) * 6.0, 2.0));
    float movingReveal = smoothstep(0.018, 0.22, uProgress);
    enter = clamp(
      enter + lensReveal * uMotion * movingReveal * (1.0 - enter) * 0.42,
      0.0,
      1.0
    );
    float sourceMix = enter;
    vec4 source = mix(
      vec4(previousRefracted, previousBase.a),
      vec4(currentRefracted, currentBase.a),
      sourceMix
    );

    // Exactly one photograph remains in the centre. Its RGB changes in
    // place while its rounded alpha silhouette stays solid, so the state
    // change reads as one spherical surface updating — never two cards.
    float fixedPhotoMask = boxMask(vUv, uPhotoMin, uPhotoMax, 0.004);
    vec2 fixedPhotoCenter = (uPhotoMin + uPhotoMax) * 0.5;
    vec2 fixedPhotoHalf = max((uPhotoMax - uPhotoMin) * 0.5, vec2(0.0001));
    vec2 photoLocal = (vUv - fixedPhotoCenter) / fixedPhotoHalf;
    float photoRadius = length(photoLocal);

    // One centred image deforms as a single spherical skin. The UV pull is
    // strongest between centre and edge, while the exact centre stays put.
    // Keeping the alpha silhouette on the original UV prevents any frame or
    // second card from appearing during the distortion.
    float sphereProfile = max(0.0, 1.0 - photoRadius * photoRadius);
    float cleanCentre = smoothstep(0.18, 0.48, photoRadius);
    float photoBulge = uMotion * 0.075 * sphereProfile * cleanCentre;
    vec2 warpedPhotoUv = fixedPhotoCenter
      + (vUv - fixedPhotoCenter) * (1.0 - photoBulge);
    warpedPhotoUv = clamp(
      warpedPhotoUv,
      uPhotoMin + vec2(0.002),
      uPhotoMax - vec2(0.002)
    );

    // A restrained spectral split lives only near the curved perimeter.
    // It supplies the missing glass refraction without dirtying faces or
    // turning the central image into a fisheye zoom.
    float edgeRefraction = smoothstep(0.48, 0.90, photoRadius)
      * (1.0 - smoothstep(0.94, 1.04, photoRadius))
      * uMotion;
    vec2 radialDirection = normalize(photoLocal + vec2(0.0001));
    vec2 spectralOffset = radialDirection * edgeRefraction * 0.0022;

    float photoEntrance = smoothstep(0.18, 0.72, uProgress);
    float currentPhotoScale = mix(0.84, 1.0, photoEntrance);
    vec2 currentPhotoHalf = fixedPhotoHalf * currentPhotoScale;
    float currentDrawMask = boxMask(
      vUv,
      fixedPhotoCenter - currentPhotoHalf,
      fixedPhotoCenter + currentPhotoHalf,
      0.004
    );
    vec2 currentWarpedPhotoUv = fixedPhotoCenter
      + (warpedPhotoUv - fixedPhotoCenter) / currentPhotoScale;
    currentWarpedPhotoUv = clamp(
      currentWarpedPhotoUv,
      uPhotoMin + vec2(0.002),
      uPhotoMax - vec2(0.002)
    );

    vec4 previousFixedPhoto = texture2D(uPreviousTexture, warpedPhotoUv);
    vec4 currentFixedPhoto = texture2D(uTexture, currentWarpedPhotoUv);
    vec3 previousPhotoRgb = vec3(
      texture2D(uPreviousTexture, clamp(warpedPhotoUv + spectralOffset, uPhotoMin, uPhotoMax)).r,
      previousFixedPhoto.g,
      texture2D(uPreviousTexture, clamp(warpedPhotoUv - spectralOffset, uPhotoMin, uPhotoMax)).b
    );
    vec3 currentPhotoRgb = vec3(
      texture2D(uTexture, clamp(currentWarpedPhotoUv + spectralOffset, uPhotoMin, uPhotoMax)).r,
      currentFixedPhoto.g,
      texture2D(uTexture, clamp(currentWarpedPhotoUv - spectralOffset, uPhotoMin, uPhotoMax)).b
    );
    vec4 previousPhotoAlpha = texture2D(uPreviousTexture, vUv);
    vec4 currentPhotoAlpha = texture2D(uTexture, currentWarpedPhotoUv);
    float previousPhotoVisibility = 1.0 - smoothstep(0.04, 0.27, uProgress);
    float currentPhotoVisibility = smoothstep(0.20, 0.58, uProgress);
    float previousPhotoA = previousPhotoAlpha.a * fixedPhotoMask * previousPhotoVisibility;
    float currentPhotoA = currentPhotoAlpha.a * currentDrawMask * currentPhotoVisibility;
    float fixedPhotoA = currentPhotoA + previousPhotoA * (1.0 - currentPhotoA);
    vec3 fixedPhotoRgb = (
      currentPhotoRgb * currentPhotoA
      + previousPhotoRgb * previousPhotoA * (1.0 - currentPhotoA)
    ) / max(fixedPhotoA, 0.0001);
    vec4 fixedPhoto = vec4(
      fixedPhotoRgb,
      fixedPhotoA
    );
    source = mix(source, fixedPhoto, fixedPhotoMask);

    // Active copy never travels with the sphere. The old copy disappears
    // immediately, the middle of the transition belongs to the photograph
    // alone, and the new category/headline fade in at the fixed centre last.
    float fixedTextMask = boxMask(vUv, uTextMin, uTextMax, 0.004);
    vec4 previousFixedText = texture2D(uPreviousTexture, vUv);
    vec4 currentFixedText = texture2D(uTexture, vUv);
    float previousCopyVisibility = 1.0 - smoothstep(0.015, 0.14, uProgress);
    float currentCopyVisibility = smoothstep(0.90, 0.998, uProgress);
    float previousTextA = previousFixedText.a * previousCopyVisibility;
    float currentTextA = currentFixedText.a * currentCopyVisibility;
    float fixedTextA = currentTextA + previousTextA * (1.0 - currentTextA);
    vec3 fixedTextRgb = (
      currentFixedText.rgb * currentTextA
      + previousFixedText.rgb * previousTextA * (1.0 - currentTextA)
    ) / max(fixedTextA, 0.0001);
    source = mix(source, vec4(fixedTextRgb, fixedTextA), fixedTextMask);
    if (source.a < 0.005) discard;

    // Gentle atmospheric perspective reinforces the shared sphere without
    // sacrificing the readability of its side headings.
    float facetLuma = dot(source.rgb, vec3(0.299, 0.587, 0.114));
    vec3 distantFacet = mix(vec3(facetLuma), source.rgb, 0.58) * 0.9 + vec3(0.07);
    source.rgb = mix(source.rgb, distantFacet, vFacetDepth * 0.30);
    source.a *= mix(1.0, 0.9, vFacetDepth);

    float brokenLight = 0.8 + hash(floor(vUv * 38.0 + uTime * 0.08)) * 0.2;
    float neutralLight = vDome * uLight * 0.025 * brokenLight;
    vec3 color = source.rgb + vec3(1.0) * neutralLight;

    // Match block three's crystal activation: a cool, soft source above the
    // active photo blooms downward during movement. It only changes light;
    // it never adds refraction or chromatic separation to the clean centre.
    float visiblePhoto = clamp(previousPhotoA + currentPhotoA, 0.0, 1.0);
    vec2 crystalDelta = vec2((vUv.x - 0.5) * 1.18, (vUv.y - uCrystalUvY) * 0.76);
    float crystalLight = exp(-dot(crystalDelta, crystalDelta) * 7.2)
      * uLight * visiblePhoto;
    color = mix(color, vec3(0.89, 0.97, 1.0), crystalLight * 0.31);
    color += vec3(0.72, 0.91, 1.0) * crystalLight * 0.16;
    // The photograph keeps its source RGB: there is no coloured or dark
    // glass overlay, only a short neutral pulse from the crystal.
    gl_FragColor = vec4(color, source.a);
  }
`

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.clip()
}

function drawCover(ctx, image, x, y, width, height) {
  const sourceAspect = image.width / image.height
  const targetAspect = width / height
  let sx = 0
  let sy = 0
  let sw = image.width
  let sh = image.height

  if (sourceAspect > targetAspect) {
    sw = image.height * targetAspect
    sx = (image.width - sw) * 0.5
  } else {
    sh = image.width / targetAspect
    sy = (image.height - sh) * 0.5
  }

  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height)
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let line = ''

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  })

  if (line) lines.push(line)
  return lines
}

// Side titles are part of the same texture as the active composition, so
// they inherit the physical facet and cross its hinge during transitions.
function drawSideLabel(ctx, text, centerX, top, angle, opacity = 0.34, fontSize = 24) {
  ctx.save()
  ctx.translate(centerX, top)
  ctx.rotate(angle)
  ctx.globalAlpha = opacity
  ctx.fillStyle = '#777b7d'
  ctx.font = `500 ${fontSize}px "Season Sans", sans-serif`
  ctx.letterSpacing = '-0.24px'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  wrapLines(ctx, text, 220).forEach((line, index) => {
    ctx.fillText(line, 0, index * fontSize * 1.1)
  })
  ctx.restore()
}

function drawUnifiedSurface(
  canvas,
  width,
  height,
  pixelRatio,
  slide,
  previousSlide,
  nextSlide,
  farPreviousSlide,
  farNextSlide,
  image,
) {
  // Setting canvas.width/height always clears and reallocates its bitmap,
  // even to an unchanged value — doing that on every slide change was
  // repeatedly invalidating the GPU-side CanvasTexture storage (Chromium's
  // glCopySubTextureCHROMIUM offset-overflow warning) and left the surface
  // permanently transparent. Only touch the dimensions when they change.
  const nextWidth = Math.max(1, Math.round(width * pixelRatio))
  const nextHeight = Math.max(1, Math.round(height * pixelRatio))
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth
    canvas.height = nextHeight
  }

  const ctx = canvas.getContext('2d')
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  // Keep empty areas genuinely transparent. An opaque white bitmap looked
  // identical at rest, but once its UVs moved the bitmap's own boundary
  // became a detached white frame above the travelling card. The section
  // itself supplies the white page background; the WebGL surface only
  // needs to carry the photo and copy that actually deform.
  ctx.clearRect(0, 0, width, height)

  const layout = layoutBlock24(width, height)
  const imageX = (width - PHOTO_WIDTH) / 2
  const imageY = layout.photoY

  // Text stays undistorted in texture space. Its visible inward turn comes
  // entirely from the shared 3D shell, so all headings obey one perspective
  // instead of receiving unrelated 2D rotations.
  drawSideLabel(ctx, farPreviousSlide.category, width * 0.075, layout.labelY, 0, 0.16, 17)
  drawSideLabel(ctx, farNextSlide.category, width * 0.925, layout.labelY, 0, 0.16, 17)
  drawSideLabel(ctx, previousSlide.category, width * 0.20833 + 10, layout.labelY, 0, 0.38)
  drawSideLabel(ctx, nextSlide.category, width * 0.79167 - 10, layout.labelY, 0, 0.38)

  ctx.save()
  roundedRect(ctx, imageX, imageY, PHOTO_WIDTH, PHOTO_HEIGHT, 8)
  drawCover(ctx, image, imageX, imageY, PHOTO_WIDTH, PHOTO_HEIGHT)
  ctx.restore()

  const copyTop = imageY + PHOTO_HEIGHT + 32
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.save()
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(3, 3, 3, 0.4)'
  ctx.font = '500 13px "Geist Mono", ui-monospace, monospace'
  ctx.letterSpacing = '0.52px'
  // The active card's own subtitle drops the leading "For" — the side
  // labels keep it (they read as "For X" pointing at a neighbour card),
  // but once a card is the one you're looking at, that framing is redundant.
  ctx.fillText(slide.category.replace(/^for\s+/i, '').toUpperCase(), width / 2, copyTop)
  ctx.restore()

  // The active state headline stays neutral and high-contrast. Colour is
  // reserved for the neighbouring category labels and the crystal light.
  ctx.fillStyle = '#121110'
  ctx.letterSpacing = '-0.64px'

  const titleSize = TITLE_FONT_SIZE
  ctx.font = `400 ${titleSize}px "TT Hoves Pro Trial Variable", sans-serif`

  const titleTop = copyTop + 11 * 1.4 + 8.609
  slide.titleLines.forEach((line, index) => {
    ctx.fillText(line, width / 2, titleTop + index * titleSize * TITLE_LINE_HEIGHT)
  })

  const titleBottom = titleTop + slide.titleLines.length * titleSize * TITLE_LINE_HEIGHT
  return {
    photoRect: { x: imageX, y: imageY, width: PHOTO_WIDTH, height: PHOTO_HEIGHT },
    textRect: {
      x: width / 2 - 250,
      y: copyTop - 4,
      width: 500,
      height: titleBottom - copyTop + 8,
    },
    crystalCenterY: layout.crystalCenterY,
  }
}

function UnifiedSurfaceMesh({
  slide,
  previousSlide,
  nextSlide,
  farPreviousSlide,
  farNextSlide,
  outgoingSlide,
  outgoingPreviousSlide,
  outgoingNextSlide,
  outgoingFarPreviousSlide,
  outgoingFarNextSlide,
  pulseKey,
  direction,
  heroReady,
}) {
  const materialRef = useRef(null)
  const lightRef = useRef(0)
  const transitionRef = useRef(1)
  const didMountRef = useRef(false)
  const { size, viewport } = useThree()

  // Capped at 1.5 before, well under a real Retina display's devicePixelRatio
  // (2, often 3) — the card's bulge already magnifies the centre under
  // perspective (see the dome plateau above), so under-resolving the source
  // canvas on top of that made the photo and title visibly soft. 2 covers
  // the common Retina case without the canvas getting excessive on 3x panels.
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)

  // R3F's reported size is still 0x0 for the first render or two (before its
  // own ResizeObserver has measured the container). THREE.CanvasTexture
  // uploads to the GPU the instant it's constructed, so building it from a
  // canvas that's still at that placeholder size — then resizing the same
  // canvas once the real size lands — makes three.js reallocate the GPU
  // texture's storage for an already-uploaded object. That specific reuse
  // path is what breaks (see the git history on this file for the exact
  // symptom). Waiting for a real size before ever constructing the canvas
  // or its texture sidesteps the whole class of bug: nothing is ever
  // uploaded at the wrong size in the first place, so ordinary
  // needsUpdate-driven redraws afterwards are the plain, standard case.
  const [resources, setResources] = useState(null)

  useEffect(() => {
    if (resources || size.width < 2 || size.height < 2) return
    const canvas = document.createElement('canvas')
    const previousCanvas = document.createElement('canvas')
    const w = Math.max(1, Math.round(size.width * pixelRatio))
    const h = Math.max(1, Math.round(size.height * pixelRatio))
    canvas.width = w
    canvas.height = h
    previousCanvas.width = w
    previousCanvas.height = h

    const texture = new THREE.CanvasTexture(canvas)
    const previousTexture = new THREE.CanvasTexture(previousCanvas)
    for (const t of [texture, previousTexture]) {
      // NOT SRGBColorSpace: that tag makes the GPU decode sRGB->linear on
      // sample, which is only correct if something re-encodes back to sRGB
      // before this reaches the screen. Three.js only does that
      // automatically for its own built-in materials — a bespoke
      // ShaderMaterial's fragmentShader is used verbatim, with no injected
      // output encoding, so gl_FragColor here was writing those decoded
      // linear values straight to the framebuffer. That reads as a
      // systematic darkening of everything sampled from this texture (the
      // photo, the gradient title, the labels) — leaving colorSpace at its
      // default makes texture2D() return the canvas's own sRGB bytes
      // unchanged, matching what we actually draw.
      t.minFilter = THREE.LinearFilter
      t.magFilter = THREE.LinearFilter
      t.generateMipmaps = false
    }
    setResources({ canvas, previousCanvas, texture, previousTexture })
  }, [resources, size.width, size.height, pixelRatio])

  const uniforms = useMemo(
    () => ({
      uTexture: { value: resources?.texture ?? null },
      uPreviousTexture: { value: resources?.previousTexture ?? null },
      uBulge: { value: 1 },
      uLight: { value: 0 },
      uTime: { value: 0 },
      uProgress: { value: 1 },
      uMotion: { value: 0 },
      uDirection: { value: 1 },
      uLensX: { value: 0.5 },
      uPhotoMin: { value: new THREE.Vector2(0.3, 0.3) },
      uPhotoMax: { value: new THREE.Vector2(0.7, 0.7) },
      uTextMin: { value: new THREE.Vector2(0.3, 0.1) },
      uTextMax: { value: new THREE.Vector2(0.7, 0.3) },
      uPhotoCenterY: { value: 0.54 },
      uCrystalUvY: { value: 0.84 },
    }),
    [resources],
  )

  useEffect(() => {
    if (!resources) return undefined
    const { canvas, previousCanvas, texture, previousTexture } = resources
    let cancelled = false

    const renderTextures = (loadedImage, loadedOutgoingImage) => {
      if (cancelled) return
      const { photoRect, textRect, crystalCenterY } = drawUnifiedSurface(
        canvas,
        size.width,
        size.height,
        pixelRatio,
        slide,
        previousSlide,
        nextSlide,
        farPreviousSlide,
        farNextSlide,
        loadedImage,
      )
      drawUnifiedSurface(
        previousCanvas,
        size.width,
        size.height,
        pixelRatio,
        outgoingSlide,
        outgoingPreviousSlide,
        outgoingNextSlide,
        outgoingFarPreviousSlide,
        outgoingFarNextSlide,
        loadedOutgoingImage,
      )
      texture.needsUpdate = true
      previousTexture.needsUpdate = true
      const toTextureRect = (rect, minUniform, maxUniform) => {
        minUniform.value.set(
          rect.x / size.width,
          1 - (rect.y + rect.height) / size.height,
        )
        maxUniform.value.set(
          (rect.x + rect.width) / size.width,
          1 - rect.y / size.height,
        )
      }
      toTextureRect(photoRect, uniforms.uPhotoMin, uniforms.uPhotoMax)
      toTextureRect(textRect, uniforms.uTextMin, uniforms.uTextMax)
      uniforms.uPhotoCenterY.value = 1 - (photoRect.y + photoRect.height / 2) / size.height
      uniforms.uCrystalUvY.value = 1 - crystalCenterY / size.height
    }

    const loadImage = (source) => {
      let loadedImage = imageCache.get(source)
      if (!loadedImage) {
        loadedImage = new Image()
        loadedImage.src = source
        imageCache.set(source, loadedImage)
      }
      if (loadedImage.complete && loadedImage.naturalWidth > 0) return Promise.resolve(loadedImage)
      return new Promise((resolve) => {
        loadedImage.addEventListener('load', () => resolve(loadedImage), { once: true })
      })
    }

    Promise.all([
      loadImage(slide.image),
      loadImage(outgoingSlide.image),
      document.fonts?.load?.('500 13px "Geist Mono"') ?? Promise.resolve(),
      document.fonts?.load?.('400 32px "TT Hoves Pro Trial Variable"') ?? Promise.resolve(),
      document.fonts?.load?.('500 24px "Season Sans"') ?? Promise.resolve(),
    ]).then(([loadedImage, loadedOutgoingImage]) => {
      renderTextures(loadedImage, loadedOutgoingImage)
    })

    return () => {
      cancelled = true
    }
  }, [
    resources,
    farNextSlide,
    farPreviousSlide,
    nextSlide,
    outgoingFarNextSlide,
    outgoingFarPreviousSlide,
    outgoingNextSlide,
    outgoingPreviousSlide,
    outgoingSlide,
    pixelRatio,
    previousSlide,
    size.height,
    size.width,
    slide,
  ])

  // The next image is already decoded before it becomes active. This keeps
  // the lens motion continuous instead of letting the animation begin while
  // the browser is still decoding the incoming photograph.
  //
  // Held back until the hero has finished loading (`heroReady`): this
  // section sits below the fold and isn't visible yet at page load, but
  // without the gate these prefetches were firing at the very same moment
  // as the hero's own six portrait fetches — several of them for the exact
  // same files — and queuing behind them on the browser's shared per-host
  // connection limit, which was stalling the hero's own loading screen far
  // longer than the photos it's actually waiting on should take.
  useEffect(() => {
    if (!heroReady) return
    ;[previousSlide.image, nextSlide.image].forEach((source) => {
      if (imageCache.has(source)) return
      const image = new Image()
      image.src = source
      imageCache.set(source, image)
    })
  }, [heroReady, nextSlide.image, previousSlide.image])

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    lightRef.current = 1
    transitionRef.current = 0
  }, [pulseKey])

  useEffect(() => {
    if (!resources) return undefined
    return () => {
      resources.texture.dispose()
      resources.previousTexture.dispose()
    }
  }, [resources])

  useFrame((state, delta) => {
    if (!materialRef.current) return
    // Background tabs can hand R3F one very large delta on the first frame
    // after they become active. Cap it so a transition never skips from its
    // first to its final state in one render.
    const frameDelta = Math.min(delta, 0.05)
    lightRef.current = Math.max(0, lightRef.current - frameDelta * 1.15)
    transitionRef.current = Math.min(1, transitionRef.current + frameDelta / 0.74)
    const rawProgress = transitionRef.current
    const progress = rawProgress < 0.5
      ? 4 * rawProgress * rawProgress * rawProgress
      : 1 - Math.pow(-2 * rawProgress + 2, 3) / 2
    const motion = Math.sin(rawProgress * Math.PI)
    const sign = direction === 'previous' ? -1 : 1
    const incomingX = 0.5 + sign * 0.292 * (1 - progress)
    const catchProgress = Math.min(1, rawProgress / 0.3)
    const catchEase = catchProgress * catchProgress * (3 - 2 * catchProgress)
    const catchX = 0.5 + sign * 0.292 * (1 - (rawProgress < 0.3 ? 0.3 : progress))
    const lensX = rawProgress < 0.3
      ? THREE.MathUtils.lerp(0.5, catchX, catchEase)
      : incomingX
    materialRef.current.uniforms.uLight.value = lightRef.current
    materialRef.current.uniforms.uProgress.value = progress
    materialRef.current.uniforms.uMotion.value = motion
    materialRef.current.uniforms.uDirection.value = sign
    materialRef.current.uniforms.uLensX.value = lensX
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
  })

  if (!resources) return null

  return (
    <mesh>
      {/* Slightly oversized (not exactly viewport-sized): the bulge nudges
          xy outward and the perspective pop can shift where the plane's own
          edge lands by a fraction of a pixel — a small margin keeps that
          edge reliably past the section's own top/bottom instead of ever
          landing just inside it as a hairline seam. */}
      <planeGeometry args={[viewport.width * 1.03, viewport.height * 1.03, 128, 72]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

export default function BulgeFeatureCard({
  slide,
  previousSlide,
  nextSlide,
  farPreviousSlide,
  farNextSlide,
  outgoingSlide,
  outgoingPreviousSlide,
  outgoingNextSlide,
  outgoingFarPreviousSlide,
  outgoingFarNextSlide,
  pulseKey,
  direction,
  heroReady = true,
  visible = true,
}) {
  return (
    <div className="block24-section__bulge-card" aria-hidden="true">
      <Canvas
        dpr={[1, 1.25]}
        frameloop={visible ? 'always' : 'never'}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        performance={{ min: 0.5 }}
        gl={{ antialias: true, alpha: true, premultipliedAlpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 5.55], fov: 35, near: 0.1, far: 20 }}
      >
        <UnifiedSurfaceMesh
          slide={slide}
          previousSlide={previousSlide}
          nextSlide={nextSlide}
          farPreviousSlide={farPreviousSlide}
          farNextSlide={farNextSlide}
          outgoingSlide={outgoingSlide}
          outgoingPreviousSlide={outgoingPreviousSlide}
          outgoingNextSlide={outgoingNextSlide}
          outgoingFarPreviousSlide={outgoingFarPreviousSlide}
          outgoingFarNextSlide={outgoingFarNextSlide}
          pulseKey={pulseKey}
          direction={direction}
          heroReady={heroReady}
        />
      </Canvas>
    </div>
  )
}
