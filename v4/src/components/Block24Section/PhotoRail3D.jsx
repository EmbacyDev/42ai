import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { block24CardGeometry, layoutBlock24 } from './block24Layout.js'

const CARD_WIDTH = 227
const CARD_HEIGHT = 270.24
const CARD_TOP = 282.88
// Give the optical hinge room to breathe: the active card remains locked to
// the viewport centre while only the inactive rail shifts farther right.
// v4: the active card's right edge is 720.5 + 310/2 = 875.5; the first
// rail card now sits one rail gap (259 - 227 = 32) after it, so both gaps
// match. It was 920.5 (a 45px gap next to a 32px one).
const FIRST_CARD_LEFT = 907.5
const SLOT_STEP = 259
// Active card is the Figma 336×400 frame. The flight still eases onto
// these bounds; only the landing size changed.
// The active card's size and the rail's centre line come from
// block24CardGeometry (desktop Figma 559:594, tablet 336×400).
const HERO_CENTER_X = 720.5
const SIDE_CENTER_X = FIRST_CARD_LEFT + CARD_WIDTH / 2
// Keep the primary optical hinge just beside the active card. Centering it in
// the whole gap pushed the bulge too far right and produced an S-shaped panel.
const CAMERA_FOV = 35
export const BLOCK24_CARD_TRANSITION_DURATION = 1.4
export const BLOCK24_CARD_PHASES = Object.freeze({
  exitEnd: 0.16,
  transitionStart: 0.16,
  transitionEnd: 0.62,
  // The gradient starts dissolving into the photo while it is still
  // sliding over the old one, so the hand-off reads as one move.
  photoStart: 0.3,
  photoEnd: 0.82,
})

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function smootherstep(value) {
  const t = clamp01(value)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

// Cards further down the rail start later, then catch the same rest pose.
// The leader eases through the whole gesture; each follower is pulled after it.
function laggedProgress(rawProgress, index) {
  const delay = index * 0.055
  return smootherstep((rawProgress - delay) / (1 - delay))
}

const FOLLOW_STIFFNESS = [300, 230, 175, 130, 100]

const vertexShader = /* glsl */ `
  uniform float uScale;
  uniform float uScreenCenterX;
  uniform float uLensCenterX;
  uniform float uLensWidth;
  uniform float uRightLensCenterX;
  uniform float uRightLensWidth;
  uniform float uRightEntryMotion;
  uniform float uEdgeStart;
  uniform float uEdgeEnd;
  uniform float uHeightStretchPx;
  uniform float uEdgeCenterShiftPx;
  uniform float uMotion;
  uniform float uActivation;
  uniform float uDirection;
  varying vec2 vUv;
  varying float vEdgeWarp;

  void main() {
    vUv = uv;
    vec3 p = position;

    // The card always faces the viewer. A narrow lens in the gap before the
    // active card pulls nearby vertices into a continuous wave; there is no
    // perspective rotation.
    float safeScale = max(uScale, 0.0001);
    float screenX = uScreenCenterX + p.x * safeScale;
    float edgeDistance = (screenX - uLensCenterX) / max(uLensWidth, 1.0);
    float primaryBand = exp(-edgeDistance * edgeDistance * 2.35);
    float innerBand = exp(-(edgeDistance + 0.78) * (edgeDistance + 0.78) * 3.8);
    float transitionBand = clamp(primaryBand - innerBand * 0.16, 0.0, 1.0);

    // A second independent optical centre lives just beyond the right edge.
    // Unlike the inner hinge, it exists only while a new card is entering
    // the viewport, then resolves back to a perfectly flat resting card.
    float rightDistance = (screenX - uRightLensCenterX) / max(uRightLensWidth, 1.0);
    float rightPrimaryBand = exp(-rightDistance * rightDistance * 2.35);
    float rightInnerBand = exp(-(rightDistance + 0.78) * (rightDistance + 0.78) * 3.8);
    float rightBand = clamp(rightPrimaryBand - rightInnerBand * 0.16, 0.0, 1.0)
      * uRightEntryMotion;
    // The inner portal exists only during a committed card transition. It
    // grows from zero, peaks halfway through the flight, then disappears as
    // the new hero settles.
    float animatedTransitionBand = transitionBand * uMotion;
    float edgeBand = max(animatedTransitionBand, rightBand);

    // The activation distortion follows the card itself instead of relying
    // only on the fixed screen lens. It enters through the inactive card's
    // left edge, crosses the surface, then exits through the new hero's
    // right edge. This keeps the effect visible throughout the move without
    // introducing a second DOM/image layer.
    float leftCardEdge = exp(-uv.x * uv.x * 34.0);
    float rightUv = 1.0 - uv.x;
    float rightCardEdge = exp(-rightUv * rightUv * 34.0);
    float edgeTransfer = smoothstep(0.28, 0.72, uActivation);
    float cardEdgeWarp = mix(leftCardEdge, rightCardEdge, edgeTransfer)
      * uMotion;
    // Keep the portal as a local edge distortion. A stronger pull widened
    // the whole inactive card until it looked like a large opaque curtain.
    float transitionPullPx = animatedTransitionBand * uLensWidth * 0.10
      * (0.72 + uMotion * 0.55);
    float rightPullPx = rightBand * uRightLensWidth * 0.30
      * (0.72 + uRightEntryMotion * 0.55);
    // The two lenses bend in opposite directions. The inner transition pulls
    // the card toward the hero, while the viewport edge pushes the entering
    // card back outside, making it feel as if it is arriving from depth.
    float pullPx = transitionPullPx - rightPullPx;
    float cardEdgePullPx = mix(-1.0, 1.0, edgeTransfer)
      * cardEdgeWarp * uLensWidth * 0.17;

    // At the lens, the near edge of an inactive card reaches the exact top
    // and bottom of the active card. Across the card this extra height falls
    // away continuously, producing a tapered optical bridge rather than two
    // rectangles colliding.
    float verticalPosition = p.y / 135.12;
    float verticalProfile = verticalPosition * abs(verticalPosition);
    float targetHeightPx = verticalPosition * animatedTransitionBand * uHeightStretchPx;
    float targetCenterPx = animatedTransitionBand * uEdgeCenterShiftPx;
    // Motion adds a restrained viscous S-curve without changing the resting
    // alignment of the two card edges.
    float verticalBulgePx = verticalProfile * animatedTransitionBand
      * uLensWidth * uMotion * 0.06;
    // At the outer edge, reverse the bulge: top and bottom contract toward
    // the centre before opening to the card's normal height inside the page.
    verticalBulgePx -= verticalProfile * rightBand * uRightLensWidth
      * (0.09 + uRightEntryMotion * 0.08);

    p.x += (cardEdgePullPx - pullPx) / safeScale;
    // Near the right screen edge the resting card bows into an arc and
    // drifts upward as it dissolves into the frosted margin.
    float edgeT = smoothstep(uEdgeStart, uEdgeEnd, screenX);
    float edgeCurve = edgeT * edgeT;
    // Trapezoid: the top edge rises and the bottom edge drops toward the
    // screen edge, both bowing slightly outward.
    float arcLiftPx = 0.0;
    float arcSquashPx = verticalPosition * edgeCurve * 135.12 * 0.3 * safeScale
      * (1.0 + 0.25 * (1.0 - verticalPosition * verticalPosition));
    p.y += (targetHeightPx + targetCenterPx + verticalBulgePx + arcLiftPx + arcSquashPx) / safeScale;
    vEdgeWarp = clamp(
      max(edgeBand, cardEdgeWarp * 0.94) + max(
        primaryBand * uMotion,
        rightPrimaryBand * uRightEntryMotion
      ) * max(uMotion, uRightEntryMotion) * 0.18,
      0.0,
      1.0
    );

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform sampler2D uGradientTexture;
  uniform float uGradientMix;
  uniform float uGradientSeed;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uMotion;
  uniform float uActivation;
  uniform float uDirection;
  uniform float uViewportWidth;
  uniform float uCssViewportWidth;
  uniform float uLensCenterX;
  uniform float uLensWidth;
  uniform float uRightLensCenterX;
  uniform float uRightLensWidth;
  uniform float uEdgeStart;
  uniform float uEdgeEnd;
  uniform float uRightEntryMotion;
  uniform float uActiveRightX;
  uniform float uLayoutScale;
  uniform float uHeroPass;
  uniform sampler2D uLabel;
  varying vec2 vUv;
  varying float vEdgeWarp;

  // Soft lens blur: a mip-biased centre tap plus two rings. An amount of 0 is a
  // single crisp sample, so resting cards cost nothing extra.
  vec3 blurTexture(sampler2D tex, vec2 uv, float amount) {
    if (amount < 0.002) return texture2D(tex, uv).rgb;
    float radius = amount * 0.05;
    float bias = amount * 3.5;
    vec3 sum = texture2D(tex, uv, bias).rgb * 2.0;
    float weight = 2.0;
    for (int i = 0; i < 8; i++) {
      float angle = float(i) * 0.78539816;
      vec2 dir = vec2(cos(angle), sin(angle) * 0.84);
      sum += texture2D(tex, clamp(uv + dir * radius * 0.5, vec2(0.003), vec2(0.997)), bias).rgb;
      sum += texture2D(tex, clamp(uv + dir * radius, vec2(0.003), vec2(0.997)), bias).rgb * 0.7;
      weight += 1.7;
    }
    return sum / weight;
  }

  vec4 sampleCard(vec2 uv) {
    vec2 safeUv = clamp(uv, vec2(0.003), vec2(0.997));
    // The gradient melts into blur while the photograph underneath comes
    // into focus out of the same blur, so the two never swap hard.
    float photoReveal = 1.0 - uGradientMix;
    float gradientBlur = smoothstep(0.0, 0.7, photoReveal);
    float photoBlur = 1.0 - smoothstep(0.3, 1.0, photoReveal);
    float crossfade = smoothstep(0.18, 0.82, photoReveal);
    vec3 gradientColor = crossfade < 0.999
      ? blurTexture(uGradientTexture, safeUv, gradientBlur)
      : vec3(0.0);
    vec3 photoColor = crossfade > 0.001
      ? blurTexture(uTexture, safeUv, photoBlur)
      : vec3(0.0);
    return vec4(mix(gradientColor, photoColor, crossfade), 1.0);
  }

  float roundedBox(vec2 uv, float radius, float feather) {
    vec2 q = abs(uv - 0.5) - vec2(0.5 - radius);
    float distanceToEdge = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
    return 1.0 - smoothstep(-feather, feather, distanceToEdge);
  }

  void main() {
    float screenX = gl_FragCoord.x / max(uViewportWidth, 1.0);
    float cssScreenX = screenX * uCssViewportWidth;
    float lensCoordinate = (cssScreenX - uLensCenterX) / max(uLensWidth, 1.0);
    float lensBand = exp(-lensCoordinate * lensCoordinate * 1.85);
    float rightLensCoordinate = (cssScreenX - uRightLensCenterX)
      / max(uRightLensWidth, 1.0);
    float rightLensBand = exp(-rightLensCoordinate * rightLensCoordinate * 1.85)
      * uRightEntryMotion;
    float animatedLensBand = lensBand * uMotion;
    float edge = max(max(animatedLensBand, rightLensBand), vEdgeWarp * 0.92);
    float edgeSquared = edge * edge;
    float opticalMotion = max(uMotion, uRightEntryMotion);

    float leftCardEdge = exp(-vUv.x * vUv.x * 30.0);
    float rightCardUv = 1.0 - vUv.x;
    float rightCardEdge = exp(-rightCardUv * rightCardUv * 30.0);
    float edgeTransfer = smoothstep(0.26, 0.74, uActivation);
    float activatingEdge = mix(leftCardEdge, rightCardEdge, edgeTransfer)
      * uMotion;

    // Compress the sampled UVs while the geometry itself keeps its width.
    // This creates the long optical stretch visible in the reference rather
    // than simply skewing the rectangular card.
    vec2 uv = vUv;
    float magnification = 1.0 - edgeSquared * (0.115 + opticalMotion * 0.085);
    uv.x = 0.5 + (uv.x - 0.5) * magnification;

    // The image is mirrored on the inactive side of the lens and unfolds as
    // it crosses into the active-card side. Halfway through that change,
    // details collapse into long soft streaks.
    float pixelRatio = uViewportWidth / max(uCssViewportWidth, 1.0);
    float cssScreenY = gl_FragCoord.y / max(pixelRatio, 0.0001);
    float filterZone = smoothstep(-0.72, 0.42, lensCoordinate) * uMotion;
    float mirrorMix = smoothstep(-0.74, 0.72, lensCoordinate) * uMotion;
    float foldFocus = sin(mirrorMix * 3.14159265);
    uv.x = mix(uv.x, 1.0 - uv.x, mirrorMix);

    // The outer lens keeps the already-mirrored inactive rail orientation,
    // but introduces a second compression/blur peak at the viewport edge.
    float rightFilterZone = smoothstep(-0.82, 0.38, rightLensCoordinate)
      * uRightEntryMotion;
    float rightFoldFocus = rightLensBand;

    // The blur is horizontal. A slow, soft variation along Y creates the
    // hazy horizontal streaks seen in the footage without slicing the image
    // into visible rows.
    float streakBand = 0.76 + 0.24 * (0.5 + 0.5 * sin(cssScreenY * 0.115 + 0.7));
    float transitionGlass = filterZone
      * (0.28 + uMotion * 0.36 + foldFocus * 0.36);
    float rightGlass = rightFilterZone
      * (0.22 + uRightEntryMotion * 0.24 + rightFoldFocus * 0.46);
    float edgeT = smoothstep(uEdgeStart, uEdgeEnd, cssScreenX);
    float glassStrength = clamp(
      transitionGlass
        + rightGlass
        + edgeT * 0.85
        + uHeroPass * animatedLensBand * uMotion * 0.30,
      0.0,
      1.0
    );
    foldFocus = max(foldFocus, rightFoldFocus);
    uv = clamp(uv, vec2(0.003), vec2(0.997));

    float trail = edgeSquared * (0.0032 + opticalMotion * 0.0105)
      + activatingEdge * (0.008 + foldFocus * 0.012);
    float signedTrail = trail * mix(1.0, uDirection, step(0.001, abs(uDirection)));
    vec2 redUv = clamp(uv + vec2(signedTrail, 0.0), vec2(0.003), vec2(0.997));
    vec2 blueUv = clamp(uv - vec2(signedTrail * 0.82, 0.0), vec2(0.003), vec2(0.997));
    vec2 nearSmearUv = clamp(uv - vec2(signedTrail * 1.8, 0.0), vec2(0.003), vec2(0.997));
    vec2 farSmearUv = clamp(uv - vec2(signedTrail * 3.7, 0.0), vec2(0.003), vec2(0.997));
    float glassBlur = glassStrength * streakBand * (
      0.006 + foldFocus * 0.021 + opticalMotion * 0.008
    );
    // The smear belongs to the single activating surface: it begins on the
    // gradient's left edge and sweeps to that same card's right edge as the
    // card reaches the hero. No clone of the old active photograph is used.
    glassBlur += filterZone * (0.0025 + foldFocus * 0.0075)
      + uHeroPass * animatedLensBand * (0.003 + foldFocus * 0.009)
      + activatingEdge * streakBand * (0.009 + uMotion * 0.012);
    vec2 glassUvA = clamp(uv + vec2(glassBlur * 0.45, 0.0), vec2(0.003), vec2(0.997));
    vec2 glassUvB = clamp(uv - vec2(glassBlur * 0.45, 0.0), vec2(0.003), vec2(0.997));
    vec2 glassUvC = clamp(uv + vec2(glassBlur * 1.25, 0.0), vec2(0.003), vec2(0.997));
    vec2 glassUvD = clamp(uv - vec2(glassBlur * 1.25, 0.0), vec2(0.003), vec2(0.997));
    vec2 glassUvE = clamp(uv + vec2(glassBlur * 2.35, 0.0), vec2(0.003), vec2(0.997));
    vec2 glassUvF = clamp(uv - vec2(glassBlur * 2.35, 0.0), vec2(0.003), vec2(0.997));

    vec4 base = sampleCard(uv);
    vec3 split = vec3(
      sampleCard(redUv).r,
      base.g,
      sampleCard(blueUv).b
    );
    vec3 nearSmear = sampleCard(nearSmearUv).rgb;
    vec3 farSmear = sampleCard(farSmearUv).rgb;
    vec3 refracted = split * 0.62 + nearSmear * 0.25 + farSmear * 0.13;
    vec3 color = mix(base.rgb, refracted, edgeSquared * (0.38 + opticalMotion * 0.46));

    vec3 glassBlurred = (
      base.rgb * 0.9
      + sampleCard(glassUvA).rgb
      + sampleCard(glassUvB).rgb
      + sampleCard(glassUvC).rgb * 0.72
      + sampleCard(glassUvD).rgb * 0.72
      + sampleCard(glassUvE).rgb * 0.38
      + sampleCard(glassUvF).rgb * 0.38
    ) / 5.1;
    color = mix(
      color,
      glassBlurred,
      clamp(
        glassStrength * (0.35 + foldFocus * 0.42)
          + activatingEdge * 0.72,
        0.0,
        0.94
      )
    );

    // A broad, low-contrast sheen keeps the fold optical rather than glitchy.
    float glassSheen = foldFocus * max(filterZone, rightFilterZone)
      * (0.035 + opticalMotion * 0.025);
    color = mix(color, min(color * 1.035 + vec3(0.014), vec3(1.0)), glassSheen);

    // Industry name sits on the inactive gradient. It leaves with that
    // gradient as the card becomes the hero photograph.
    vec4 labelSample = texture2D(uLabel, vUv);
    // The name leaves in the first half of the dissolve, before the photo
    // starts to resolve, so it never ghosts over the picture.
    color = mix(color, labelSample.rgb, labelSample.a * smoothstep(0.55, 1.0, uGradientMix));

    float rounded = roundedBox(
      vUv,
      0.026,
      0.0022
    );
    // Reserve a clean breathing gap beside the active DOM card. As the rail
    // card crosses the portal its left side fades behind this mask and the
    // centred hero takes over, so the two surfaces never visibly overlap.
    float animatedGapStart = mix(8.0, -8.0, uMotion) * uLayoutScale;
    float animatedGapFeather = mix(18.0, 10.0, uMotion) * uLayoutScale;
    float entryMask = smoothstep(
      uActiveRightX + animatedGapStart,
      uActiveRightX + animatedGapStart + animatedGapFeather,
      cssScreenX
    );
    entryMask = mix(entryMask, 1.0, uHeroPass);
    // Dissolve toward the edge instead of a hard clip under the frost.
    float edgeFade = 1.0 - smoothstep(0.25, 1.0, edgeT) * 0.92;
    color = mix(color, min(color * 1.06 + vec3(0.06), vec3(1.0)), edgeT * 0.5);
    // While the incoming card slides over the old photo its rim is soft,
    // like the frosted right edge, so it melts in rather than cutting.
    float travelSoft = uHeroPass * uMotion;
    float softRim = roundedBox(vUv, 0.06, 0.004 + 0.07 * travelSoft);
    float alpha = base.a * mix(rounded, softRim, travelSoft) * uOpacity * entryMask * edgeFade;
    // Drop the extremely faint fringe produced by the rounded alpha feather.
    // On a white background that fringe read as a grey one-pixel outline.
    if (alpha < 0.035) discard;
    gl_FragColor = vec4(color, alpha);
  }
`

function wrapLabelLines(ctx, text, maxWidth) {
  const words = text.trim().split(/\s+/)
  const lines = []
  let line = ''
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  })
  if (line) lines.push(line)
  return lines
}

function createInactiveLabelTexture(text, color) {
  const ratio = 6
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(CARD_WIDTH * ratio)
  canvas.height = Math.round(CARD_HEIGHT * ratio)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const fontSize = 18 * ratio
  ctx.font = `400 ${fontSize}px "TT Hoves Web", sans-serif` // v4: 500 read too heavy on the cards
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${-0.36 * ratio}px`
  const lines = wrapLabelLines(ctx, text, 153 * ratio)
  const lineHeight = fontSize * 1.15
  const originY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, index) => {
    ctx.fillText(line, canvas.width / 2, originY + index * lineHeight)
  })
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  // Drawn at 4× and shown at ~1×: mipmaps keep the downscaled glyphs
  // smooth instead of shimmering into pixels.
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

function PhotoPlane({ offset, texture, gradientTexture, gradientSeed, labelTexture, register }) {
  const uniforms = useMemo(() => ({
    uTexture: { value: texture },
    uGradientTexture: { value: gradientTexture },
    uGradientMix: { value: 1 },
    uGradientSeed: { value: gradientSeed },
    uTime: { value: 0 },
    uScale: { value: 1 },
    uScreenCenterX: { value: 0 },
    uCssViewportWidth: { value: 1 },
    uOpacity: { value: 0 },
    uMotion: { value: 0 },
    uActivation: { value: 0 },
    uDirection: { value: 1 },
    uViewportWidth: { value: 1 },
    uLensCenterX: { value: 0 },
    uLensWidth: { value: 1 },
    uRightLensCenterX: { value: 0 },
    uRightLensWidth: { value: 1 },
    uRightEntryMotion: { value: 0 },
    uEdgeStart: { value: 1e6 },
    uEdgeEnd: { value: 1e6 + 1 },
    uHeightStretchPx: { value: 0 },
    uEdgeCenterShiftPx: { value: 0 },
    uActiveRightX: { value: 0 },
    uLayoutScale: { value: 1 },
    uHeroPass: { value: 0 },
    uLabel: { value: labelTexture },
  }), [])

  const meshRef = useRef(null)
  // R3F copies the `uniforms` prop into the material, so mutating this
  // object after mount never reached the shader: every slot kept the slide
  // it was created with and the activating card developed the wrong photo
  // before the DOM hero snapped to the right one. Write the live material.
  useLayoutEffect(() => {
    const live = meshRef.current?.material?.uniforms ?? uniforms
    live.uTexture.value = texture
    live.uGradientTexture.value = gradientTexture
    live.uGradientSeed.value = gradientSeed
    live.uLabel.value = labelTexture
  }, [texture, gradientTexture, gradientSeed, labelTexture, uniforms])

  return (
    <mesh
      ref={(node) => {
        meshRef.current = node
        register(offset, node)
      }}
      frustumCulled={false}
      renderOrder={20 - offset}
    >
      <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT, 40, 20]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function PhotoRailScene({ slides, activeIndex, flight, reduceMotion }) {
  const sources = useMemo(() => slides.map((slide) => slide.image), [slides])
  const textures = useTexture(sources)
  const gradientTextures = useTexture(slides.map((slide) => slide.gradient))
  const [labelRevision, setLabelRevision] = useState(0)
  const labelTextures = useMemo(
    () => slides.map((slide) => createInactiveLabelTexture(
      slide.tab,
      slide.labelColor || '#ffffff',
    )),
    [slides, labelRevision],
  )

  useEffect(() => {
    let alive = true
    const ready = document.fonts?.load?.('400 72px "TT Hoves Web"')
      ?? Promise.resolve()
    ready.then(() => {
      if (alive) setLabelRevision((value) => value + 1)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => () => {
    labelTextures.forEach((texture) => texture.dispose())
  }, [labelTextures])
  const cardRefs = useRef(new Map())
  const progressRef = useRef(1)
  const timeRef = useRef(0)
  const shiftRef = useRef([0, 0, 0, 0, 0])
  const velocityRef = useRef([0, 0, 0, 0, 0])
  const wasFlyingRef = useRef(false)
  const directionRef = useRef(1)
  const settleAgeRef = useRef(2)
  const { camera, gl, size } = useThree()
  const drawingBufferSize = useMemo(() => new THREE.Vector2(), [])

  const register = useCallback((offset, node) => {
    if (node) cardRefs.current.set(offset, node)
    else cardRefs.current.delete(offset)
  }, [])

  useLayoutEffect(() => {
    const moving = Boolean(flight) && !reduceMotion
    progressRef.current = moving ? 0 : 1
    if (!moving) return
    const direction = flight.direction === 'previous' ? -1 : 1
    shiftRef.current = [direction, direction, direction, direction, direction]
    velocityRef.current = [0, 0, 0, 0, 0]
  }, [flight?.id, reduceMotion])

  useLayoutEffect(() => {
    const distance = size.height / (2 * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)))
    camera.position.set(0, 0, distance)
    camera.fov = CAMERA_FOV
    camera.aspect = size.width / Math.max(size.height, 1)
    camera.near = 0.1
    camera.far = distance * 3
    camera.updateProjectionMatrix()
  }, [camera, size.height, size.width])

  useFrame((_, delta) => {
    timeRef.current += Math.min(delta, 0.05)
    if (flight && progressRef.current < 1) {
      // The DOM wipe and this WebGL surface must share real elapsed time.
      // Integrating a capped frame delta made WebGL lag behind whenever a
      // frame was dropped, splitting one hand-off into two visible effects.
      progressRef.current = Math.min(
        1,
        Math.max(0, (
          window.performance.now() - flight.id
        ) / (BLOCK24_CARD_TRANSITION_DURATION * 1000)),
      )
    } else if (!flight) {
      progressRef.current = 1
    }

    const rawProgress = progressRef.current
    const elapsed = timeRef.current
    // A strict three-beat hand-off: the old hero exits first, then the
    // gradient card travels through the optical hinge, and only after the
    // hinge has resolved does the new photograph begin to appear.
    const transitionProgress = clamp01((
      rawProgress - BLOCK24_CARD_PHASES.transitionStart
    ) / (
      BLOCK24_CARD_PHASES.transitionEnd
      - BLOCK24_CARD_PHASES.transitionStart
    ))
    const motion = flight
      && rawProgress >= BLOCK24_CARD_PHASES.transitionStart
      && rawProgress < BLOCK24_CARD_PHASES.transitionEnd
      ? Math.sin(Math.PI * transitionProgress) ** 1.12
      : 0
    const direction = flight
      ? (flight.direction === 'previous' ? -1 : 1)
      : directionRef.current
    if (flight) {
      directionRef.current = direction
      wasFlyingRef.current = true
      settleAgeRef.current = 0
    } else if (wasFlyingRef.current) {
      wasFlyingRef.current = false
      // The eased pose has arrived, but the row keeps a little of its
      // velocity. Farther cards carry more, so the pull finishes in the pause.
      for (let index = 0; index < 5; index += 1) {
        velocityRef.current[index] = 0
      }
    }

    const step = Math.min(delta, 0.033)
    if (!flight) settleAgeRef.current += step
    const settleAge = settleAgeRef.current
    const flying = Boolean(flight) && rawProgress < 1
    for (let index = 0; index < 5; index += 1) {
      const stiffness = FOLLOW_STIFFNESS[index]
      const damping = Math.sqrt(stiffness) * 1.5
      const coast = reduceMotion
        ? 0
        : 0
      const drift = 0
      const target = flying
        ? direction * (1 - laggedProgress(transitionProgress, index))
        : drift + coast
      let velocity = velocityRef.current[index]
      let shift = shiftRef.current[index]
      velocity += (target - shift) * stiffness * step
      velocity *= Math.exp(-damping * step)
      shift += velocity * step
      velocityRef.current[index] = velocity
      shiftRef.current[index] = shift
    }

    const layout = layoutBlock24(size.width, size.height)
    const scale = layout.scale
    // Every card shares the hero's vertical centre. Inactive cards can still
    // breathe horizontally, but no card is allowed to sit a few pixels above
    // or below its neighbours.
    const geo = block24CardGeometry(size.width)
    const HERO_WIDTH = geo.width
    const HERO_HEIGHT = geo.height
    const HERO_LEFT = HERO_CENTER_X - HERO_WIDTH / 2
    const HERO_CENTER_Y = geo.top + HERO_HEIGHT / 2
    const LENS_CENTER_X = HERO_LEFT + HERO_WIDTH + 6
    const sideCenterY = geo.sideCenterY
    const lensCenterX = layout.originX + LENS_CENTER_X * scale
    const lensWidth = 118 * scale
    const rightLensCenterX = size.width + 18 * scale
    const rightLensWidth = 148 * scale
    const activeRightX = layout.originX + (HERO_LEFT + HERO_WIDTH) * scale
    const bufferWidth = gl.getDrawingBufferSize(drawingBufferSize).x

    cardRefs.current.forEach((mesh, offset) => {
      const travel = shiftRef.current[offset]
      const slot = offset + travel
      // Whichever tab was selected, offset zero is the new active surface.
      // Previously the shader hand-off ran only while moving forward; a
      // previous-tab selection therefore produced a blank interval followed
      // by a sudden DOM-photo appearance.
      const isActivating = Boolean(flight && offset === 0)
      // The rail keeps its springy follower motion, but the card performing
      // the actual hero wipe needs deterministic timing. Driving that card
      // from raw transition progress prevents it from arriving after the DOM
      // photo swap and leaving a visible empty interval between the two.
      // A cubic smoothstep leaves the rest pose clean but starts moving
      // noticeably sooner than the previous quintic curve, removing the
      // dead pause at the beginning of each state change.
      const activationT = transitionProgress
      const activationProgress = isActivating
        ? activationT * activationT * (3 - 2 * activationT)
        : 0
      const activation = activationProgress
      const heightActivation = isActivating
        ? THREE.MathUtils.smoothstep(activationProgress, 0.08, 0.64)
        : 0
      // The travelling card remains the one real inactive gradient surface
      // all the way to the hand-off. Its width never changes; it only grows
      // vertically, crosses the fixed hero and dissolves to expose the next
      // photo underneath. This removes the old double-gradient illusion.
      const photoProgress = clamp01((
        rawProgress - BLOCK24_CARD_PHASES.photoStart
      ) / (
        BLOCK24_CARD_PHASES.photoEnd - BLOCK24_CARD_PHASES.photoStart
      ))
      // Develop the photograph inside the same moving surface. A refracted
      // front replaces the gradient locally instead of crossfading two full
      // cards through uniform opacity.
      const gradientMix = isActivating
        ? 1 - smootherstep(photoProgress)
        : offset === 0 ? 0 : 1
      const regularCenterX = SIDE_CENTER_X + (slot - 1) * SLOT_STEP
      const designCenterX = isActivating
        ? THREE.MathUtils.lerp(SIDE_CENTER_X, HERO_CENTER_X, activation)
        : regularCenterX
      // Interpolate directly onto the one fixed hero centre. The previous
      // cinematic lift made alternating cards appear to land a few pixels
      // above or below one another even though the DOM hero itself was fixed.
      const designCenterY = THREE.MathUtils.lerp(
        sideCenterY,
        HERO_CENTER_Y,
        activation,
      )
      const floatingAmount = isActivating
        ? 1 - THREE.MathUtils.smoothstep(activationProgress, 0.06, 0.70)
        : offset === 0 ? 0 : 1
      const floatPhase = elapsed * 0.34 + (activeIndex + offset) * 1.73
      const floatX = 0
      // Only two inactive cards remain visible at rest. The next one starts
      // beyond the viewport and enters through the right lens during a
      // transition instead of permanently protruding from the screen edge.
      const rightEntry = flight && direction > 0 && offset === 2
        ? THREE.MathUtils.clamp(slot - 2, 0, 1)
        : 0
      // The outer lens is an entrance animation, not a permanent shape.
      // Its bell curve begins while the new card is still outside, peaks as
      // it crosses the viewport edge, and is fully gone before it settles.
      // Restore the original full-strength screen-edge lens during entry.
      // Spatial lens falloff decides where the bend appears; this envelope
      // only releases it smoothly before the new card reaches its rest pose.
      const rightEntryMotion = flight
        && direction > 0
        && offset === 2
        ? 1 - THREE.MathUtils.smoothstep(rawProgress, 0.74, 0.98)
        : 0
      const transitionJoin = isActivating ? motion * 16 * scale : 0
      const screenCenterX = layout.originX + designCenterX * scale
        + floatX + rightEntry * 82 * scale - transitionJoin
      const screenCenterY = layout.originY + designCenterY * scale
      // Keep the completed WebGL photograph fully opaque through the end of
      // the flight. The identical DOM image is already underneath it, and
      // the stacking-order switch removes this surface without a one-frame
      // alpha dip or white flash.
      const nearVisibility = isActivating
        ? 1
        : offset === 0
          ? 0
          : THREE.MathUtils.smoothstep(slot, 0.34, 0.78)
      const farVisibility = 1 - THREE.MathUtils.smoothstep(slot, 2.54, 3.02)
      const opacity = nearVisibility * farVisibility
      const idleScale = 1
      // Reach the hero's exact default bounds while the gradient is still
      // deforming. The photograph is developed only afterwards, so the
      // final WebGL-to-DOM hand-off is pixel-for-pixel and cannot jump in
      // size. The ratio is uniform because both cards share one aspect ratio.
      const heroScaleRatioX = HERO_WIDTH / CARD_WIDTH
      const heroScaleRatioY = HERO_HEIGHT / CARD_HEIGHT
      const sizeActivation = isActivating
        ? smootherstep((activationProgress - 0.16) / 0.68)
        : 0
      const activationScaleX = THREE.MathUtils.lerp(
        1,
        heroScaleRatioX,
        sizeActivation,
      )
      const activationScaleY = THREE.MathUtils.lerp(
        1,
        heroScaleRatioY,
        sizeActivation,
      )
      const cardScale = scale * idleScale * activationScaleX
      // Preserve the compact inactive-card silhouette. The full-height seam
      // is handled by a narrow DOM glass band, so the moving surface never
      // grows into a large panel over the hero.
      const cardScaleY = scale * idleScale * activationScaleY
      const targetHalfHeightPx = HERO_HEIGHT * scale / 2
      const currentHalfHeightPx = CARD_HEIGHT * cardScaleY / 2
      const heightStretchPx = Math.max(0, targetHalfHeightPx - currentHalfHeightPx)
      const edgeCenterShiftPx = screenCenterY
        - (layout.originY + HERO_CENTER_Y * scale)

      mesh.position.set(
        screenCenterX - size.width / 2,
        size.height / 2 - screenCenterY,
        0,
      )
      mesh.scale.set(cardScale, cardScaleY, cardScale)
      mesh.visible = opacity > 0.002

      const material = mesh.material
      material.uniforms.uScale.value = cardScale
      material.uniforms.uScreenCenterX.value = screenCenterX
      material.uniforms.uCssViewportWidth.value = size.width
      material.uniforms.uLensCenterX.value = lensCenterX
      material.uniforms.uLensWidth.value = lensWidth
      material.uniforms.uRightLensCenterX.value = rightLensCenterX
      material.uniforms.uRightLensWidth.value = rightLensWidth
      material.uniforms.uRightEntryMotion.value = rightEntryMotion
      // Desktop only: the rail fades into the right margin (Figma 559:658).
      const edgeOn = size.width > 980
      material.uniforms.uEdgeStart.value = edgeOn ? layout.originX + 1190 * scale : 1e6
      material.uniforms.uEdgeEnd.value = edgeOn ? Math.min(size.width, layout.originX + 1450 * scale) + 40 * scale : 1e6 + 1
      material.uniforms.uHeightStretchPx.value = heightStretchPx
      material.uniforms.uEdgeCenterShiftPx.value = edgeCenterShiftPx
      material.uniforms.uActiveRightX.value = activeRightX
      material.uniforms.uLayoutScale.value = scale
      material.uniforms.uHeroPass.value = isActivating
        ? THREE.MathUtils.smoothstep(activationProgress, 0.06, 0.24)
        : 0
      material.uniforms.uOpacity.value = opacity
      material.uniforms.uGradientMix.value = gradientMix
      material.uniforms.uTime.value = elapsed
      material.uniforms.uMotion.value = motion
      material.uniforms.uActivation.value = isActivating ? activationProgress : 0
      material.uniforms.uDirection.value = direction
      material.uniforms.uViewportWidth.value = bufferWidth
    })
  })

  return [0, 1, 2, 3, 4].map((offset) => {
    const slideIndex = (activeIndex + offset + slides.length) % slides.length
    return (
      <PhotoPlane
        key={offset}
        offset={offset}
        texture={textures[slideIndex]}
        gradientTexture={gradientTextures[slideIndex]}
        labelTexture={labelTextures[slideIndex]}
        gradientSeed={(slideIndex + 1) * 1.371}
        register={register}
      />
    )
  })
}

export default function PhotoRail3D({
  slides,
  activeIndex,
  flight,
  ready,
  visible,
}) {
  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!ready) return null

  return (
    <div className="block24-section__photo-rail" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        frameloop={visible ? 'always' : 'demand'}
        camera={{ position: [0, 0, 1000], fov: CAMERA_FOV, near: 0.1, far: 4000 }}
        gl={{
          alpha: true,
          antialias: true,
          premultipliedAlpha: false,
          powerPreference: 'high-performance',
        }}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <Suspense fallback={null}>
          <PhotoRailScene
            slides={slides}
            activeIndex={activeIndex}
            flight={flight}
            reduceMotion={reduceMotion}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
