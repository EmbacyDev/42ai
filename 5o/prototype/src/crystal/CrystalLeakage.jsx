import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { crystalHeroBlend, smootherstep } from '../components/HeroScene/scrollShrink.js'

const FLOW_KEYS = [
  'friendFlowColor1',
  'friendFlowColor2',
  'friendFlowColor3',
  'friendFlowColor4',
]

const vertexShader = /* glsl */ `
  varying vec3 vLocalPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;
  varying float vRadius;

  uniform float uTime;
  uniform float uPhase;

  void main() {
    vec3 p = position;
    float slowTime = uTime * 0.42 + uPhase;
    float liquidDisplacement =
      sin(p.y * 5.3 - slowTime * 1.4)
      + sin(p.x * 4.1 + p.z * 3.7 + slowTime)
      + sin(p.z * 6.2 - p.y * 2.6 - slowTime * 0.72);
    float radialWarp =
      sin(p.x * 3.7 + slowTime * 0.8) * 0.028
      + sin(p.y * 4.9 - p.z * 2.2 - slowTime) * 0.02;
    p *= 1.0 + radialWarp;
    p += vec3(
      sin(p.y * 4.2 + slowTime) * 0.02,
      sin(p.z * 5.1 - slowTime * 0.73) * 0.016,
      sin(p.x * 4.6 + slowTime * 0.61) * 0.018
    );
    p += normal * liquidDisplacement * 0.018;

    vec4 worldPosition = modelMatrix * vec4(p, 1.0);
    vLocalPosition = p;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    vec4 viewPosition = viewMatrix * worldPosition;
    vec3 centerView = (viewMatrix * modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vRadius = length((viewPosition.xyz - centerView).xy)
      / max(length(modelMatrix[0].xyz), 0.0001);
    gl_Position = projectionMatrix * viewPosition;
  }
`

const fragmentShader = /* glsl */ `
  varying vec3 vLocalPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;
  varying float vRadius;

  uniform float uTime;
  uniform float uOpacity;
  uniform float uLayerStrength;
  uniform float uPhase;
  uniform vec3 uColor0;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += noise(p) * amplitude;
      p = mat2(1.67, 1.12, -1.12, 1.67) * p + 0.17;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 p = normalize(vLocalPosition);
    float time = uTime * 0.44 + uPhase;

    // Three projections make the flow continuous over the whole shell,
    // including its sides. It therefore reads as volume rather than a card.
    float flowXY = fbm(p.xy * 2.7 + vec2(time * 0.22, -time * 0.17));
    float flowYZ = fbm(p.yz * 2.9 + vec2(-time * 0.15, time * 0.19));
    float flowZX = fbm(p.zx * 3.1 + vec2(time * 0.12, time * 0.21));
    float liquid = (flowXY + flowYZ + flowZX) / 3.0;

    float angle = atan(p.y, p.x);
    float longitude = atan(p.z, p.x);
    float ribbons =
      sin(angle * 3.2 + liquid * 7.2 - time * 1.25)
      + sin(longitude * 4.1 - liquid * 5.4 + time * 0.91);
    ribbons = smoothstep(0.34, 1.56, ribbons);

    // A continuous palette follows the same order as the liquid core:
    // violet -> blue -> green -> acid yellow -> violet. Only neighbouring
    // colours mix, so the transition glows without collapsing into grey.
    float paletteT = fract(
      angle / 6.2831853
      + longitude * 0.075
      + liquid * 0.72
      - time * 0.035
    );
    vec3 color;
    if (paletteT < 0.1667) {
      color = mix(uColor0, uColor2, smoothstep(0.0, 0.1667, paletteT));
    } else if (paletteT < 0.3333) {
      color = mix(uColor2, uColor1, smoothstep(0.1667, 0.3333, paletteT));
    } else if (paletteT < 0.5) {
      color = mix(uColor1, uColor3, smoothstep(0.3333, 0.5, paletteT));
    } else if (paletteT < 0.6667) {
      color = mix(uColor3, uColor1, smoothstep(0.5, 0.6667, paletteT));
    } else if (paletteT < 0.8333) {
      color = mix(uColor1, uColor2, smoothstep(0.6667, 0.8333, paletteT));
    } else {
      color = mix(uColor2, uColor0, smoothstep(0.8333, 1.0, paletteT));
    }
    // Keep the wave luminous, but do not overdrive every channel into white.
    // The saturation pass below makes overlapping translucent shells stay
    // violet/blue/green/yellow instead of averaging into a grey veil.
    color = pow(color, vec3(0.52)) * (1.06 + ribbons * 0.12);
    vec3 coreColor;
    if (paletteT < 0.25) {
      coreColor = uColor0;
    } else if (paletteT < 0.5) {
      coreColor = uColor2;
    } else if (paletteT < 0.75) {
      coreColor = uColor1;
    } else {
      coreColor = uColor3;
    }
    coreColor = pow(coreColor, vec3(0.48)) * 1.22;

    float facing = abs(dot(normalize(vWorldNormal), normalize(vViewDirection)));
    float fresnel = pow(1.0 - facing, 1.15);
    // The mist crosses the facet that faces the camera and dies on the
    // grazing contour, so the shell does not draw a second outline.
    float throughFace = pow(facing, 0.8) * (1.0 - pow(fresnel, 1.6));
    float bleed = smoothstep(0.9, 0.98, vRadius)
      * (1.0 - smoothstep(1.02, 1.14, vRadius));
    float brokenVeil = smoothstep(0.44, 0.8, liquid + ribbons * 0.24);
    float breakA = 0.5 + 0.5 * sin(angle * 2.15 + longitude * 1.3 - time * 0.72 + liquid * 4.6);
    float breakB = 0.5 + 0.5 * sin(angle * 3.7 - longitude * 2.1 + time * 0.48);
    float tornMask = smoothstep(0.54, 0.93, max(breakA, breakB * 0.86));
    float pulse = 0.82 + 0.18 * sin(time * 0.85 + liquid * 6.0);
    float rawAlpha = (
      throughFace * brokenVeil * 0.46
      + ribbons * throughFace * 0.14
    ) * tornMask * bleed * pulse * uOpacity * uLayerStrength;

    // A narrow, saturated core inside the broad soft veil gives the wave
    // optical density: coloured light at its centre, glow at its edges.
    float coreBand = smoothstep(
      0.58,
      0.88,
      liquid + ribbons * 0.32
    ) * tornMask;
    float coreAlpha = (0.42 * throughFace + fresnel * 0.16) * coreBand * bleed * pulse
      * uOpacity * uLayerStrength * 0.42;
    float coreInfluence = clamp(coreBand * throughFace * 1.35, 0.0, 1.0);
    color = mix(color, coreColor, coreInfluence * 0.97);

    float colorMin = min(color.r, min(color.g, color.b));
    float colorMax = max(color.r, max(color.g, color.b));
    vec3 saturatedColor = (color - vec3(colorMin)) / max(colorMax - colorMin, 0.08);
    color = mix(color, saturatedColor * 1.2, 0.64);
    color *= 1.04 + fresnel * 0.13 + coreInfluence * 0.2;

    if (rawAlpha < 0.003) discard;
    float edgeSoftness = smoothstep(0.003, 0.075, rawAlpha);
    float chroma = max(color.r, max(color.g, color.b))
      - min(color.r, min(color.g, color.b));
    float saturationMask = smoothstep(0.045, 0.34, chroma);
    float alpha = min(rawAlpha * 0.2 + coreAlpha * 0.62, 0.24)
      * edgeSoftness
      * (0.08 + saturationMask * 0.92);
    gl_FragColor = vec4(color, alpha);
  }
`

const sprayVertexShader = /* glsl */ `
  attribute float aSeed;
  varying float vSeed;
  varying float vPulse;
  uniform float uTime;

  void main() {
    float time = uTime * 0.34;
    vec3 p = position;
    p.x += sin(time * 1.17 + aSeed * 17.0 + p.y * 2.1) * (0.035 + aSeed * 0.045);
    p.y += cos(time * 0.91 + aSeed * 23.0 + p.x * 1.8) * (0.03 + aSeed * 0.04);
    p.z += sin(time * 0.73 + aSeed * 31.0) * 0.055;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    vSeed = aSeed;
    vPulse = 0.5 + 0.5 * sin(time * 2.2 + aSeed * 37.0);
    gl_PointSize = (14.0 + aSeed * 15.0 + vPulse * 7.0) * (5.0 / max(2.4, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`

const sprayFragmentShader = /* glsl */ `
  varying float vSeed;
  varying float vPulse;
  uniform float uOpacity;
  uniform float uTime;
  uniform vec3 uColor0;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float distanceFromCenter = length(point) * 2.0;
    if (distanceFromCenter > 1.0) discard;

    float paletteT = fract(vSeed * 1.73 + uTime * 0.018);
    vec3 color;
    if (paletteT < 0.25) {
      color = uColor0;
    } else if (paletteT < 0.5) {
      color = uColor2;
    } else if (paletteT < 0.75) {
      color = uColor1;
    } else {
      color = uColor3;
    }
    // Preserve the actual palette instead of lifting all channels toward
    // white: on the pale page that lift made every soft particle read as a
    // grey spot. The dominant channel stays bright enough for bloom while
    // the other channels keep the dot unmistakably coloured.
    color = pow(color, vec3(0.88)) * (1.02 + vPulse * 0.1);

    float edgeFade = 1.0 - smoothstep(0.72, 1.0, distanceFromCenter);
    float halo = exp(-distanceFromCenter * distanceFromCenter * 2.3) * edgeFade;
    float core = exp(-distanceFromCenter * distanceFromCenter * 11.0);
    float alpha = (
      halo * (0.035 + vPulse * 0.035)
      + core * (0.3 + vPulse * 0.18)
    ) * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`

const ribbonVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const ribbonFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor0;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uCenter;
  uniform vec3 uShade;

  mat2 rotate2d(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
  }

  float softLine(float distanceToLine, float width) {
    return exp(-distanceToLine * distanceToLine / max(width * width, 0.00001));
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float radius = length(p);
    float t = uTime * 0.18;

    // Three independent light paths. They are open S-curves rather than
    // ellipses, so the result reads as a flowing caustic, not a ring placed
    // behind the crystal.
    vec2 a = rotate2d(0.48) * p;
    float pathA = 0.24 * sin(a.x * 2.5 - t * 1.28)
      + 0.045 * sin(a.x * 6.1 + t * 0.52) + 0.19;
    float dA = a.y - pathA;
    float spanA = 1.0 - smoothstep(0.66, 1.08, abs(a.x + 0.02));
    spanA *= 0.38 + 0.62 * smoothstep(-0.7, 0.45, a.x);

    vec2 b = rotate2d(-0.73) * p;
    float pathB = 0.22 * sin(b.x * 2.2 + t * 1.05)
      + 0.04 * sin(b.x * 5.5 - t * 0.47) - 0.22;
    float dB = b.y - pathB;
    float spanB = 1.0 - smoothstep(0.64, 1.08, abs(b.x - 0.03));
    spanB *= 0.34 + 0.66 * (1.0 - smoothstep(-0.35, 0.78, b.x));

    vec2 c = rotate2d(1.18) * p;
    float pathC = 0.13 * sin(c.x * 2.8 - t * 0.72)
      + 0.035 * sin(c.x * 7.2 + t * 0.4) + 0.04;
    float dC = c.y - pathC;
    float spanC = (1.0 - smoothstep(0.42, 0.86, abs(c.x + 0.08))) * 0.72;

    // Broad haze, coloured spectral shoulders, and a hairline hot core are
    // evaluated separately. This layered construction matches the optical
    // references far more closely than a single translucent ribbon.
    float hazeA = softLine(abs(dA), 0.27) * spanA;
    float hazeB = softLine(abs(dB), 0.255) * spanB;
    float hazeC = softLine(abs(dC), 0.185) * spanC;

    float aViolet = softLine(abs(dA + 0.058), 0.042) * spanA;
    float aBlue = softLine(abs(dA + 0.019), 0.039) * spanA;
    float aGreen = softLine(abs(dA - 0.025), 0.042) * spanA;
    float aYellow = softLine(abs(dA - 0.061), 0.027) * spanA;

    float bBlue = softLine(abs(dB + 0.054), 0.04) * spanB;
    float bViolet = softLine(abs(dB + 0.015), 0.038) * spanB;
    float bGreen = softLine(abs(dB - 0.023), 0.041) * spanB;
    float bYellow = softLine(abs(dB - 0.059), 0.026) * spanB;

    float cGreen = softLine(abs(dC + 0.04), 0.036) * spanC;
    float cBlue = softLine(abs(dC), 0.033) * spanC;
    float cViolet = softLine(abs(dC - 0.04), 0.031) * spanC;

    float hotA = softLine(abs(dA), 0.009) * spanA;
    float hotB = softLine(abs(dB), 0.008) * spanB;
    float hotC = softLine(abs(dC), 0.007) * spanC;
    float hotCore = max(hotA, max(hotB, hotC));

    // Crystal hues, pulled toward white so the haze stays luminous, plus
    // the gem's own cream core and pale cyan shade.
    vec3 violet = mix(pow(uColor0, vec3(0.72)), vec3(1.0), 0.34);
    vec3 green = mix(pow(uColor1, vec3(0.72)), vec3(1.0), 0.3);
    vec3 blue = mix(pow(uColor2, vec3(0.7)), vec3(1.0), 0.28);
    vec3 yellow = mix(pow(uColor3, vec3(0.8)), vec3(1.0), 0.22);
    vec3 cream = mix(uCenter, vec3(1.0), 0.4);
    vec3 ice = mix(uShade, vec3(1.0), 0.32);

    vec3 spectral = vec3(0.0);
    spectral = max(spectral, violet * max(aViolet, max(bViolet, cViolet)));
    spectral = max(spectral, blue * max(aBlue, max(bBlue, cBlue)));
    spectral = max(spectral, green * max(aGreen, max(bGreen, cGreen)));
    spectral = max(spectral, yellow * max(aYellow, bYellow));

    // Give every broad halo its own neighbouring pair from the crystal.
    // Blue/green, violet/blue and green/yellow remain chromatic even in the
    // very soft outskirts; none of them can fade into a neutral grey wash.
    vec3 hazeAHue = mix(mix(blue, ice, 0.42), green, 0.48 + 0.3 * sin(a.x * 2.1 - t));
    vec3 hazeBHue = mix(mix(violet, cream, 0.38), blue, 0.5 + 0.28 * sin(b.x * 2.4 + t * 0.8));
    vec3 hazeCHue = mix(mix(green, yellow, 0.46 + 0.3 * sin(c.x * 2.7 - t * 0.6)), cream, 0.34);
    float lightVeil = max(hazeA, max(hazeB, hazeC)) * 0.72;
    vec3 lightHue = mix(cream, ice, 0.5 + 0.5 * sin(t * 0.6 + p.y));
    vec3 hazeSignal = max(
      hazeAHue * hazeA,
      max(hazeBHue * hazeB, max(hazeCHue * hazeC, lightHue * lightVeil))
    );
    vec3 color = max(spectral * 1.24, hazeSignal * 0.92);
    float lightStrength = max(max(color.r, color.g), color.b);
    color /= max(lightStrength, 0.24);
    color = mix(color, vec3(1.0), hotCore * 0.35);

    float centerMask = smoothstep(0.14, 0.36, radius);
    float outerMask = 1.0 - smoothstep(0.89, 1.08, radius);
    float breathe = 0.92 + 0.08 * sin(t * 2.4 + p.x * 3.2 - p.y * 2.1);
    float spectralLines = max(
      max(aViolet, max(aBlue, max(aGreen, aYellow))),
      max(max(bViolet, max(bBlue, max(bGreen, bYellow))), max(cViolet, max(cBlue, cGreen)))
    );
    float haze = max(hazeA, max(hazeB, hazeC));
    float alpha = (
      haze * 0.145
      + spectralLines * 0.29
      + hotCore * 0.25
    ) * centerMask * outerMask * uOpacity * breathe;

    if (alpha < 0.002) discard;
    gl_FragColor = vec4(color, min(alpha, 0.48));
    #include <colorspace_fragment>
  }
`

function makeMaterial(config, { side, phase, strength }) {
  const fallback = ['#756cff', '#29ae57', '#1d81ed', '#f0ff1f']
  const colors = FLOW_KEYS.map((key, index) => (
    new THREE.Color(config[key] ?? fallback[index])
  ))

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uLayerStrength: { value: strength },
      uPhase: { value: phase },
      uColor0: { value: colors[0] },
      uColor1: { value: colors[1] },
      uColor2: { value: colors[2] },
      uColor3: { value: colors[3] },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side,
    toneMapped: false,
    blending: THREE.NormalBlending,
  })
}

function makeSprayGeometry() {
  const count = 76
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  let state = 0x42a1
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }

  for (let index = 0; index < count; index += 1) {
    const lobeCenters = [-2.55, -0.42, 1.48]
    const lobe = Math.min(2, Math.floor(random() * lobeCenters.length))
    const angle = lobeCenters[lobe] + (random() - 0.5) * (0.48 + random() * 0.36)
    const radius = 1.025 + Math.pow(random(), 1.55) * 0.3
    const depth = (random() - 0.5) * 0.78
    const directionalBreak = 0.82 + Math.sin(angle * 3.0 + random() * 1.2) * 0.18
    positions[index * 3] = Math.cos(angle) * radius * directionalBreak
    positions[index * 3 + 1] = Math.sin(angle) * radius * 0.86
    positions[index * 3 + 2] = depth
    seeds[index] = random()
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  return geometry
}

function makeSprayMaterial(config) {
  const fallback = ['#756cff', '#29ae57', '#1d81ed', '#f0ff1f']
  const colors = FLOW_KEYS.map((key, index) => (
    new THREE.Color(config[key] ?? fallback[index])
  ))

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor0: { value: colors[0] },
      uColor1: { value: colors[1] },
      uColor2: { value: colors[2] },
      uColor3: { value: colors[3] },
    },
    vertexShader: sprayVertexShader,
    fragmentShader: sprayFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    blending: THREE.NormalBlending,
  })
}

function makeRibbonMaterial(config) {
  const fallback = ['#756cff', '#29ae57', '#1d81ed', '#f0ff1f']
  const colors = FLOW_KEYS.map((key, index) => (
    new THREE.Color(config[key] ?? fallback[index])
  ))

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor0: { value: colors[0] },
      uColor1: { value: colors[1] },
      uColor2: { value: colors[2] },
      uColor3: { value: colors[3] },
      uCenter: { value: new THREE.Color(config.friendCenterColor ?? '#fff4e8') },
      uShade: { value: new THREE.Color(config.friendShadeColor ?? '#a1e9fc') },
    },
    vertexShader: ribbonVertexShader,
    fragmentShader: ribbonFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  })
}

export default function CrystalLeakage({ config, active = true, waves = true }) {
  const backRef = useRef(null)
  const frontRef = useRef(null)
  const contactRef = useRef(null)
  const sprayRef = useRef(null)
  const ribbonRef = useRef(null)
  const opacityRef = useRef(0)
  const activationAtRef = useRef(null)
  const activePreviouslyRef = useRef(false)
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1.0, 5), [])
  const sprayGeometry = useMemo(() => makeSprayGeometry(), [])
  const backMaterial = useMemo(() => makeMaterial(config, {
    side: THREE.BackSide,
    phase: 0,
    strength: 0.96,
  }), [config])
  const frontMaterial = useMemo(() => makeMaterial(config, {
    side: THREE.FrontSide,
    phase: 2.35,
    strength: 0.22,
  }), [config])
  const contactMaterial = useMemo(() => makeMaterial(config, {
    side: THREE.FrontSide,
    phase: 0.72,
    strength: 0.2,
  }), [config])
  const sprayMaterial = useMemo(() => makeSprayMaterial(config), [config])
  const ribbonMaterial = useMemo(() => makeRibbonMaterial(config), [config])

  useEffect(() => () => {
    geometry.dispose()
    sprayGeometry.dispose()
    backMaterial.dispose()
    frontMaterial.dispose()
    contactMaterial.dispose()
    sprayMaterial.dispose()
    ribbonMaterial.dispose()
  }, [
    geometry,
    sprayGeometry,
    backMaterial,
    frontMaterial,
    contactMaterial,
    sprayMaterial,
    ribbonMaterial,
  ])

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime()
    const heroAmount = 1 - smootherstep(
      THREE.MathUtils.clamp(crystalHeroBlend(window.scrollY) * 1.35, 0, 1),
    )
    if (active && !activePreviouslyRef.current) {
      activationAtRef.current = elapsed
    } else if (!active) {
      activationAtRef.current = null
    }
    activePreviouslyRef.current = active

    // `active` rises when the loading sheet releases the finished crystal.
    // The portrait scene starts its first card 1.22s later, so the leakage
    // waits for that same beat instead of surrounding the crystal while it
    // is still alone on screen.
    const activeAge = activationAtRef.current === null
      ? 0
      : elapsed - activationAtRef.current
    const photoRevealGate = smootherstep(
      THREE.MathUtils.clamp((activeAge - 1.18) / 0.42, 0, 1),
    )
    const target = active ? heroAmount * photoRevealGate : 0
    const follow = 1 - Math.exp(-5.5 * Math.min(delta, 0.05))
    opacityRef.current += (target - opacityRef.current) * follow

    backMaterial.uniforms.uTime.value = elapsed
    frontMaterial.uniforms.uTime.value = elapsed
    contactMaterial.uniforms.uTime.value = elapsed
    sprayMaterial.uniforms.uTime.value = elapsed
    ribbonMaterial.uniforms.uTime.value = elapsed
    // The far shells, spray and ribbon read as a separate atmosphere.
    // Continuity now belongs to the facet membrane in Glass.jsx.
    backMaterial.uniforms.uOpacity.value = 0
    frontMaterial.uniforms.uOpacity.value = 0
    contactMaterial.uniforms.uOpacity.value = 0
    sprayMaterial.uniforms.uOpacity.value = 0
    ribbonMaterial.uniforms.uOpacity.value = 0

    // Separate, very slow drift keeps front and back from locking into one
    // still silhouette, while staying calm enough for the hero photography.
    if (backRef.current) {
      backRef.current.rotation.y = elapsed * 0.018
      backRef.current.rotation.x = Math.sin(elapsed * 0.18) * 0.032
      backRef.current.rotation.z = Math.sin(elapsed * 0.13) * 0.025
    }
    if (frontRef.current) {
      frontRef.current.rotation.y = -elapsed * 0.014
      frontRef.current.rotation.x = Math.cos(elapsed * 0.15) * 0.027
      frontRef.current.rotation.z = Math.sin(elapsed * 0.17 + 1.2) * 0.03
    }
    if (contactRef.current) {
      contactRef.current.rotation.y = Math.sin(elapsed * 0.11) * 0.018
      contactRef.current.rotation.x = Math.cos(elapsed * 0.09) * 0.015
    }
    if (sprayRef.current) {
      sprayRef.current.rotation.y = elapsed * 0.026
      sprayRef.current.rotation.z = -elapsed * 0.018
      sprayRef.current.rotation.x = Math.sin(elapsed * 0.11) * 0.09
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {waves && <mesh
          ref={backRef}
          geometry={geometry}
          material={backMaterial}
          scale={[1.045, 1.03, 1.04]}
          renderOrder={1.5}
          frustumCulled={false}
        />}
      <points
        ref={sprayRef}
        geometry={sprayGeometry}
        material={sprayMaterial}
        renderOrder={109}
        frustumCulled={false}
      />
      <Billboard follow position={[0, 0, -0.42]}>
        <mesh
          ref={ribbonRef}
          material={ribbonMaterial}
          renderOrder={2.35}
          frustumCulled={false}
        >
          <planeGeometry args={[3.85, 3.85, 1, 1]} />
        </mesh>
      </Billboard>
      {waves && <>
        <mesh
          ref={frontRef}
          geometry={geometry}
          material={frontMaterial}
          scale={[1.03, 1.045, 1.032]}
          renderOrder={110}
          frustumCulled={false}
        />
        <mesh
          ref={contactRef}
          geometry={geometry}
          material={contactMaterial}
          scale={[1.02, 1.02, 1.02]}
          renderOrder={109.5}
          frustumCulled={false}
        />
      </>}
    </group>
  )
}
