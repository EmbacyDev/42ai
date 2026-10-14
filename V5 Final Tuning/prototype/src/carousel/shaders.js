// Square cards from Figma. The C is not a card cut — it is Figma's
// glass-left / glass-right layers (effect type GLASS) over the scene.

export const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// The inactive card is one continuous surface. Only the inner 30% bends
// around a vertical hinge and comes toward the camera; this creates the
// protruding-wall read from the reference without drawing a recognisable
// C/S-shaped mask on top of the image.
export const cardVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying float vFold;
  uniform float uSide;
  uniform float uFold;
  uniform float uMotion;
  uniform float uTime;

  void main() {
    vUv = uv;
    vec3 p = position;
    float side = abs(uSide) < 0.5 ? 1.0 : uSide;
    float innerUv = 0.5 - (vUv.x - 0.5) * side;
    float foldBase = smoothstep(0.78, 1.0, innerUv);
    // A second smooth pass removes the visible hinge/kink and gives the
    // lower contour the long, calm bend from the reference.
    float foldT = foldBase * foldBase * (3.0 - 2.0 * foldBase);

    if (uFold > 0.001 && foldT > 0.0) {
      // Figma keeps the card itself visually thin. This is only a slight
      // 2D silhouette pull; all of the material depth comes from optical
      // refraction below, never from a second face coming toward camera.
      // The reference is subtly asymmetric: the top corner lifts only a
      // little while the bottom corner extends farther and rounds into the
      // vertical edge. Bias the stretch toward the lower half instead of
      // scaling both corners equally.
      float lowerBias = 1.0 - smoothstep(0.0, 0.58, vUv.y);
      float verticalStretch = 1.0 + foldT * uFold * (0.075 + lowerBias * 0.06);
      p.y *= verticalStretch;
      p.x -= side * foldT * uFold * 0.028;

      // Subtle silhouette distortion along the free edge. It becomes a
      // little more alive during manual movement, but stays far below the
      // old recognisable C-shaped refraction.
      float edgeMask = smoothstep(0.62, 1.0, foldT);
      float edgeRipple = (
        sin((p.y + 0.5) * 12.5 + uTime * 0.42) * 0.006
        + sin((p.y + 0.5) * 25.0 - uTime * 0.27) * 0.0025
      ) * edgeMask * uFold * uMotion * 0.55;
      p.x -= side * edgeRipple;
    }

    vFold = foldT * uFold;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

export const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying float vFold;

  uniform sampler2D uMap;
  uniform sampler2D uGradient;
  uniform vec2 uMapScale;
  uniform vec2 uMapOffset;

  uniform float uSide;
  uniform float uBlur;
  uniform float uFocus;
  uniform float uHasPhoto;
  uniform float uOpacity;
  uniform float uCornerRadius;
  uniform float uRim;
  uniform float uActivation;
  uniform float uTime;
  uniform float uDebug;

  uniform float uGlass;
  uniform float uRefract;
  uniform float uGlassDepth;
  uniform float uDispersion;
  uniform float uSplay;
  uniform float uMotion;
  uniform float uCrystalGlass;
  uniform float uTonalGradient;
  uniform vec3 uGradientColor;
  uniform float uYellowLight;

  float roundedRectSDF(vec2 p, vec2 halfSize, float r) {
    vec2 d = abs(p) - halfSize + vec2(r);
    return length(max(d, 0.0)) - r + min(max(d.x, d.y), 0.0);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  vec2 coverUv(vec2 uv) {
    return (uv - 0.5) * uMapScale + 0.5 + uMapOffset;
  }

  vec3 sampleTex(sampler2D tex, vec2 uv, float radius) {
    vec2 cuv = coverUv(uv);
    if (radius <= 0.0001) return texture2D(tex, cuv).rgb;
    vec3 sum = vec3(0.0);
    float total = 0.0;
    const int N = 8;
    for (int i = 0; i < N; i++) {
      float a = (float(i) / float(N)) * 6.28318;
      vec2 offset = vec2(cos(a), sin(a)) * radius;
      sum += texture2D(tex, coverUv(uv + offset)).rgb;
      total += 1.0;
    }
    sum += texture2D(tex, cuv).rgb * 2.5;
    total += 2.5;
    return sum / total;
  }

  vec3 sampleSource(vec2 uv, float radius, float photoAmt) {
    vec3 grad = sampleTex(uGradient, uv, radius);
    vec3 photo = sampleTex(uMap, uv, radius * 0.25);
    return mix(grad, photo, photoAmt);
  }

  // Every gradient card receives one colour from the Friend Lab crystal.
  // Its depth comes only from lighter/darker versions of that hue and a
  // travelling light field. The fields stay stretched and noise-warped,
  // so the result never resolves into a recognisable circular blob.
  float crystalField(vec2 uv, vec2 center, vec2 stretch, float softness) {
    vec2 d = (uv - center) * stretch;
    return exp(-dot(d, d) * softness);
  }

  vec3 tonalCrystalGradient(vec2 uv) {
    float t = uTime * 0.055;
    vec2 slowWarp = vec2(
      noise(uv * 2.35 + vec2(t, -t * 0.61)),
      noise(uv * 2.75 + vec2(7.4 - t * 0.47, 2.1 + t))
    ) - 0.5;
    vec2 q = uv + slowWarp * 0.115;

    vec2 cLight = vec2(0.26 + sin(t * 0.83) * 0.07, 0.25 + cos(t * 0.72) * 0.085);
    vec2 cMid = vec2(0.72 + sin(t * 0.69) * 0.08, 0.62 + cos(t * 0.77) * 0.09);
    vec2 cShade = vec2(0.30 + cos(t * 0.58) * 0.09, 0.78 + sin(t * 0.91) * 0.065);

    float lightField = crystalField(q, cLight, vec2(1.34, 0.67), 5.0);
    float midField = crystalField(q, cMid, vec2(0.80, 1.28), 4.8);
    float shadeField = crystalField(q, cShade, vec2(1.25, 0.73), 5.5);
    float ribbon = 0.5 + 0.5 * sin(
      q.x * 3.4 + q.y * 2.1 + noise(q * 3.0) * 2.2 - t * 0.55
    );

    vec3 darkTone = uGradientColor * 0.25;
    vec3 deepTone = uGradientColor * 0.54;
    vec3 lightTone = mix(uGradientColor, vec3(1.0), 0.69);
    vec3 glowTone = mix(uGradientColor, vec3(1.0), 0.86);

    vec3 color = mix(deepTone, uGradientColor, 0.36 + midField * 0.48);
    color = mix(color, lightTone, clamp(lightField * 0.82 + ribbon * 0.12, 0.0, 0.9));
    color = mix(color, darkTone, shadeField * 0.48);
    color = mix(color, glowTone, lightField * ribbon * 0.22);
    return min(vec3(1.0), color * 1.06);
  }

  void main() {
    vec2 p = vUv - 0.5;
    float sideAmt = 1.0 - uFocus;

    float dist = roundedRectSDF(p, vec2(0.5), uCornerRadius);
    float mask = 1.0 - smoothstep(-0.001, mix(0.0024, 0.0045, sideAmt), dist);
    if (mask <= 0.001) discard;

    float blurRadius = uBlur * sideAmt * mix(0.0015, 0.012, sideAmt);

    // Card-local glass: this follows the card itself, unlike the large
    // screen-space Figma panes. As a card approaches the side position,
    // the same live uGlass/vFold progress that bends its geometry also
    // refracts its artwork. Returning to the active position unwinds both
    // effects continuously back to the untouched image.
    float side = abs(uSide) < 0.5 ? 1.0 : uSide;
    float glassField = smoothstep(0.035, 0.58, vFold) * uGlass;
    float y = vUv.y * 2.0 - 1.0;
    float movingRipple = (noise(vec2(vUv.y * 8.0, uTime * 0.22)) - 0.5)
      * (0.003 + uMotion * 0.008);
    float refractAmount = glassField * uRefract * uGlassDepth
      * (0.014 + uMotion * 0.01);
    vec2 refractDirection = normalize(vec2(-side, y * (0.20 + uSplay * 0.18)));
    vec2 glassUv = clamp(
      vUv + refractDirection * refractAmount + vec2(movingRipple * glassField, 0.0),
      vec2(0.002),
      vec2(0.998)
    );

    // On the dedicated crystal-gradient card the whole surface is a lens,
    // not a coloured coating. Two low-frequency offsets make the material
    // optically alive while keeping its silhouette thin.
    vec2 crystalWarp = vec2(
      noise(vUv * 3.1 + vec2(uTime * 0.045, 1.7)) - 0.5,
      noise(vUv * 2.7 + vec2(5.2, -uTime * 0.038)) - 0.5
    );
    glassUv = clamp(
      glassUv + crystalWarp * (0.030 + uMotion * 0.010) * uCrystalGlass,
      vec2(0.002),
      vec2(0.998)
    );
    vec3 base = sampleSource(glassUv, blurRadius, uHasPhoto);
    base = mix(base, tonalCrystalGradient(glassUv), uTonalGradient);

    // A small RGB split only at the deepest part of the fold reads as
    // thick glass rather than a generic wavy image filter.
    float dispersion = glassField * uDispersion * (0.0012 + uMotion * 0.0012);
    vec2 spectralOffset = refractDirection * dispersion;
    vec3 redSource = mix(
      texture2D(uGradient, coverUv(clamp(glassUv + spectralOffset, vec2(0.002), vec2(0.998)))).rgb,
      texture2D(uMap, coverUv(clamp(glassUv + spectralOffset, vec2(0.002), vec2(0.998)))).rgb,
      uHasPhoto
    );
    vec3 blueSource = mix(
      texture2D(uGradient, coverUv(clamp(glassUv - spectralOffset, vec2(0.002), vec2(0.998)))).rgb,
      texture2D(uMap, coverUv(clamp(glassUv - spectralOffset, vec2(0.002), vec2(0.998)))).rgb,
      uHasPhoto
    );
    redSource = mix(redSource, tonalCrystalGradient(glassUv + spectralOffset), uTonalGradient);
    blueSource = mix(blueSource, tonalCrystalGradient(glassUv - spectralOffset), uTonalGradient);
    base.r = mix(base.r, redSource.r, glassField);
    base.b = mix(base.b, blueSource.b, glassField);

    if (uDebug > 0.5) {
      vec2 gridUv = vUv * vec2(28.0, 36.0);
      vec2 gv = abs(fract(gridUv) - 0.5);
      float grid = smoothstep(0.46, 0.42, min(gv.x, gv.y));
      gl_FragColor = vec4(mix(vec3(0.12), vec3(0.35, 0.92, 1.0), grid), mask);
      return;
    }

    if (uHasPhoto > 0.5) {
      float scrim = smoothstep(0.38, 0.0, vUv.y) * mix(0.0, 1.0, uFocus);
      base = mix(base, vec3(0.0), scrim * 0.72);
    }

    // A slow, broken ribbon of warm light for the exact blue Figma card.
    // It changes illumination rather than drawing a yellow object, and its
    // long diagonal profile deliberately avoids any circular silhouette.
    float yellowPhase = uTime * 0.10;
    float yellowAxis = vUv.y + vUv.x * 0.43;
    float yellowCenter = 0.72 + sin(yellowPhase) * 0.12;
    float yellowRibbon = exp(-pow((yellowAxis - yellowCenter) / 0.145, 2.0));
    float yellowBreakup = 0.58 + 0.42 * noise(
      vec2(vUv.x * 3.2 - yellowPhase * 0.7, vUv.y * 4.4 + yellowPhase)
    );
    // Keep a visible blue/cyan perimeter on all four sides. The light is
    // suspended inside the material and has already faded out well before
    // it reaches either a rounded corner or the deforming inner edge.
    float yellowInset = smoothstep(0.07, 0.23, vUv.x)
      * smoothstep(0.93, 0.77, vUv.x)
      * smoothstep(0.08, 0.25, vUv.y)
      * smoothstep(0.92, 0.74, vUv.y);
    float yellowGlow = yellowRibbon * yellowBreakup * yellowInset * uYellowLight;
    base = mix(base, vec3(0.95, 1.0, 0.42), yellowGlow * 0.095);
    base += vec3(0.075, 0.082, 0.014) * yellowGlow;

    // No coloured/white glass fill: the Figma layer is transparent and
    // changes the pixels through refraction rather than painting a wash
    // over the inactive cards.
    float foldedFace = smoothstep(0.04, 0.30, vFold);
    base *= 1.0 - foldedFace * sideAmt * 0.012;

    // While the carousel moves, the crystal above the active card becomes
    // a real light source: a concentrated cool highlight at the top centre
    // blooms down across the central card and fades with the motion.
    vec2 crystalDelta = vec2((vUv.x - 0.5) * 1.15, (vUv.y - 1.08) * 0.72);
    float crystalLight = exp(-dot(crystalDelta, crystalDelta) * 7.5)
      * uActivation * smoothstep(0.42, 0.96, uFocus);
    base = mix(base, vec3(0.89, 0.97, 1.0), crystalLight * 0.24);
    base += vec3(0.72, 0.91, 1.0) * crystalLight * 0.13;

    // A parallel, softly diffused highlight. The old version used the
    // direction from the card centre; all rays therefore converged into a
    // visible angular spike. This band has no origin or vanishing point.
    float sheenAxis = vUv.y - vUv.x * 0.22;
    float sheenCenter = 0.54 + sin(uTime * 0.075) * 0.055;
    float sheen = exp(-pow((sheenAxis - sheenCenter) / 0.29, 2.0));
    float sheenTexture = 0.72 + 0.28 * noise(vUv * 2.25 + vec2(uTime * 0.025, 3.1));
    base += vec3(0.96, 0.98, 1.0) * sheen * sheenTexture * (0.010 + 0.022 * uFocus);

    // Diffuse glass illumination with no intersecting caustic lines. The
    // former pair of diagonal bands met near the centre and produced a
    // sharp triangular spike, especially on the green card.
    float crystalHaze = noise(
      vUv * 1.75 + vec2(uTime * 0.018, -uTime * 0.014)
    );
    float crystalHaze2 = noise(
      vUv * 2.35 + vec2(4.2 - uTime * 0.011, 1.7 + uTime * 0.016)
    );
    float diffuseGlassLight = (crystalHaze * 0.62 + crystalHaze2 * 0.38);
    base += vec3(0.78, 0.91, 1.0)
      * (diffuseGlassLight - 0.35) * 0.038 * uCrystalGlass;

    float lip = exp(-max(-dist, 0.0) * 36.0);
    float traveling = 0.5 + 0.5 * sin(uTime * 0.55 + vUv.x * 2.2 + vUv.y * 1.4);
    base += vec3(1.0) * lip * traveling * 0.014 * uFocus;

    float rim = smoothstep(0.018, 0.0, -dist);
    base += vec3(1.0) * rim * uRim * mix(0.16, 0.42, uFocus);
    base += vec3(0.93, 0.99, 1.0) * rim * 0.12 * uCrystalGlass;
    base += vec3(0.90, 0.98, 1.0) * rim * uActivation * 0.08;

    gl_FragColor = vec4(base, mask * uOpacity);
  }
`

export const glassOverlayFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform sampler2D uGradient;
  uniform vec2 uMapScale;
  uniform vec2 uMapOffset;
  uniform vec2 uOverlayScale;
  uniform float uSide;
  uniform float uGlass;
  uniform float uRefract;
  uniform float uGlassDepth;
  uniform float uDispersion;
  uniform float uSplay;
  uniform float uMotion;
  uniform float uFocus;
  uniform float uHasPhoto;
  uniform float uOpacity;

  vec2 coverUv(vec2 uv) {
    return (uv - 0.5) * uMapScale + 0.5 + uMapOffset;
  }

  vec3 sourceAt(vec2 uv, float photoAmt) {
    vec2 cuv = coverUv(clamp(uv, vec2(0.002), vec2(0.998)));
    return mix(texture2D(uGradient, cuv).rgb, texture2D(uMap, cuv).rgb, photoAmt);
  }

  void main() {
    vec2 cardUv = (vUv - 0.5) * uOverlayScale + 0.5;
    float inner = 0.5 - (cardUv.x - 0.5) * uSide;
    float y = cardUv.y * 2.0 - 1.0;
    float splay = clamp(uSplay, 0.0, 1.0);

    // The reference does not put a translucent wash over the whole side
    // card. Its image only turns liquid along the edge that touches the
    // active card. Keep this band narrow, with a slightly deeper bite in
    // the vertical middle so its outer contour reads as a soft lens rather
    // than as a straight blurred strip.
    float middleBulge = exp(-pow(y / 0.72, 2.0));
    float start = mix(0.78, 0.62, splay) - middleBulge * 0.055;
    float reach = 1.035 + middleBulge * (0.025 + uMotion * 0.025);
    float field = smoothstep(start, start + 0.12, inner)
      * (1.0 - smoothstep(reach - 0.055, reach, inner))
      * (1.0 - smoothstep(1.00, 1.15, abs(y)))
      * uGlass;
    if (field <= 0.001) discard;

    // The refraction now comes from the bent card geometry above, not from
    // shifting the image independently. This pass is only the faint glass
    // highlight sitting on that physical bend.
    float contact = smoothstep(start + 0.035, 0.98, inner);
    float edge = smoothstep(0.84, 1.015, inner);
    vec3 glassTint = mix(vec3(0.91, 0.965, 1.0), vec3(1.0), edge);
    float glassAlpha = field * uOpacity
      * (0.035 + contact * 0.075 + uMotion * 0.035);
    gl_FragColor = vec4(glassTint, glassAlpha);
  }
`

export const screenGlassFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uScene;
  uniform vec2 uResolution;
  uniform float uSide;
  uniform float uRefract;
  uniform float uDepthPx;
  uniform float uDispersionPx;
  uniform float uSplay;
  uniform float uMotion;
  uniform float uLightAngle;
  uniform float uCornerRadius;

  float roundedRectSDF(vec2 p, vec2 halfSize, float r) {
    vec2 d = abs(p) - halfSize + vec2(r);
    return length(max(d, 0.0)) - r + min(max(d.x, d.y), 0.0);
  }

  void main() {
    vec2 p = vUv - 0.5;
    float dist = roundedRectSDF(p, vec2(0.5), uCornerRadius);
    if (dist > 0.002) discard;

    // Figma GLASS on glass-left / glass-right. The card geometry now owns
    // the shape, so this pass must not draw a second C/S-shaped contour.
    // It contributes only refraction along the physical hinge. There is
    // deliberately no tint, white fill or additive edge light: those were
    // the source of the milky/overexposed inactive cards.
    float inner = 0.5 - (vUv.x - 0.5) * uSide;
    float y = vUv.y * 2.0 - 1.0;
    float endFade = 1.0 - smoothstep(0.76, 0.94, abs(y));
    // A broad low-amplitude pull begins well before the edge; a narrower
    // Gaussian crest forms the actual lens. This is the Instagram-like
    // transition: the image starts flowing first and only then resolves
    // into a readable refracted rim, rather than switching blur on at once.
    float broadPull = smoothstep(0.72, 0.985, inner);
    float lensCrest = exp(-pow((inner - 0.925) / 0.065, 2.0));
    float lowerSoftness = 1.0 - smoothstep(0.0, 0.68, vUv.y);
    float activation = smoothstep(0.0, 1.0, uMotion);
    float field = clamp(broadPull * 0.16 + lensCrest * 0.84, 0.0, 1.0)
      * endFade;
    float fall = pow(field, 1.08) * activation;

    float strengthPx = uDepthPx * uRefract
      * (fall * 0.085 + lensCrest * endFade * activation * 0.035);
    // The small vertical component follows the stretched upper/lower
    // corners, giving the edge the glassy pull seen in the reference
    // without deforming the text layer above the canvas.
    vec2 offsetPx = vec2(
      -uSide * strengthPx,
      (y * 0.20 - lowerSoftness * 0.10) * strengthPx
    );
    vec2 screenUv = gl_FragCoord.xy / uResolution;
    vec2 refractedUv = clamp(screenUv + offsetPx / uResolution, 0.001, 0.999);
    vec2 spectral = normalize(offsetPx + vec2(-uSide * 0.01, 0.001)) * uDispersionPx * strengthPx * 0.035 / uResolution;
    vec3 refracted;
    refracted.r = texture2D(uScene, clamp(refractedUv + spectral, 0.001, 0.999)).r;
    refracted.g = texture2D(uScene, refractedUv).g;
    refracted.b = texture2D(uScene, clamp(refractedUv - spectral, 0.001, 0.999)).b;

    // The sampled scene is the material — no coloured or white overlay.
    // Linear alpha at the beginning keeps the appearance/disappearance of
    // the lens soft while still making the settled edge clearly visible.
    gl_FragColor = vec4(refracted, clamp(fall * 0.82, 0.0, 0.62));
  }
`
