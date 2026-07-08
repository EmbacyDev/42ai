import { useEffect, useRef } from 'react'
import styles from './CrystalFieldShader.module.css'

export type ShaderSettings = {
  density: number
  sphereRadius: number
  clusterStrength: number
  scatter: number
  pointSize: number
  warp: number
  blockCount: number
  blockLength: number
  blockThickness: number
  blockSpread: number
  rotation: number
  tilt: number
  speed: number
  exposure: number
  colorShift: number
  videoOpacity: number
  videoScale: number
  videoContrast: number
  videoDodge: number
  videoDepth: number
  maskContrast: number
  maskPosterize: number
  maskThreshold: number
  maskSoftness: number
  maskGamma: number
  maskBrightness: number
  maskInvert: number
  blockPointDensity: number
  blockSpeed: number
  rayDensity: number
  rayIntensity: number
  rayBlur: number
  rayLength: number
  facetFeather: number
  facetStrength: number
  facetScale: number
  facetDrift: number
  refractionStrength: number
  refractionChroma: number
  refractionGlow: number
  backdropAnchorY: number
}

type ControlConfig = {
  key: keyof ShaderSettings
  label: string
  min: number
  max: number
  step: number
}

export const DEFAULT_CRYSTAL_SHADER_SETTINGS: ShaderSettings = {
  density: 47,
  sphereRadius: 0.28,
  clusterStrength: 0.45,
  scatter: 0.28,
  pointSize: 2.4,
  warp: 0.18,
  blockCount: 64,
  blockLength: 1.35,
  blockThickness: 0.12,
  blockSpread: 0.55,
  rotation: -32,
  tilt: -44,
  speed: 0.03,
  exposure: 0.92,
  colorShift: 0,
  videoOpacity: 1,
  videoScale: 0.3,
  videoContrast: 1.22,
  videoDodge: 0,
  videoDepth: 0.8,
  maskContrast: 1.38,
  maskPosterize: 9,
  maskThreshold: 0.4,
  maskSoftness: 0.3,
  maskGamma: 2.5,
  maskBrightness: 2.4,
  maskInvert: 0,
  blockPointDensity: 10,
  blockSpeed: 0.01,
  rayDensity: 0.24,
  rayIntensity: 0.28,
  rayBlur: 0.42,
  rayLength: 1.05,
  facetFeather: 0.12,
  facetStrength: 0.24,
  facetScale: 4.5,
  facetDrift: 1.11,
  refractionStrength: 0.12,
  refractionChroma: 0,
  refractionGlow: 0,
  backdropAnchorY: 0.5,
}

export const CRYSTAL_SHADER_CONTROL_GROUPS: ControlConfig[] = [
  { key: 'density', label: 'Sphere point density', min: 28, max: 128, step: 1 },
  { key: 'sphereRadius', label: 'Sphere radius', min: 0.22, max: 0.72, step: 0.01 },
  { key: 'clusterStrength', label: 'Cluster pull', min: 0, max: 1.4, step: 0.01 },
  { key: 'scatter', label: 'Point scatter', min: 0, max: 0.42, step: 0.01 },
  { key: 'pointSize', label: 'Point size', min: 0.8, max: 5.8, step: 0.1 },
  { key: 'warp', label: 'Sphere warp', min: 0, max: 0.62, step: 0.01 },
  { key: 'blockCount', label: 'Block count', min: 16, max: 96, step: 1 },
  { key: 'blockLength', label: 'Block length', min: 0.4, max: 2.4, step: 0.01 },
  { key: 'blockThickness', label: 'Block thickness', min: 0.02, max: 0.18, step: 0.005 },
  { key: 'blockSpread', label: 'Block spread', min: 0.1, max: 1.2, step: 0.01 },
  { key: 'blockPointDensity', label: 'Block edge points', min: 3, max: 16, step: 1 },
  { key: 'blockSpeed', label: 'Block motion speed', min: 0, max: 0.3, step: 0.005 },
  { key: 'rayDensity', label: 'Ray block share', min: 0.05, max: 0.55, step: 0.01 },
  { key: 'rayIntensity', label: 'Ray intensity', min: 0, max: 1.6, step: 0.01 },
  { key: 'rayBlur', label: 'Ray motion blur', min: 0.05, max: 1, step: 0.01 },
  { key: 'rayLength', label: 'Ray length', min: 0.4, max: 2.2, step: 0.01 },
  { key: 'rotation', label: 'Scene rotation', min: -80, max: 80, step: 1 },
  { key: 'tilt', label: 'Scene tilt', min: -44, max: 44, step: 1 },
  { key: 'speed', label: 'Motion speed', min: 0, max: 1.8, step: 0.01 },
  { key: 'exposure', label: 'Exposure', min: 0.22, max: 1.8, step: 0.01 },
  { key: 'colorShift', label: 'Cool / gold mix', min: 0, max: 1, step: 0.01 },
  { key: 'videoOpacity', label: 'Video opacity', min: 0, max: 1.4, step: 0.01 },
  { key: 'videoScale', label: 'Video scale', min: 0.5, max: 2.2, step: 0.01 },
  { key: 'videoContrast', label: 'Video contrast', min: 0.2, max: 2.6, step: 0.01 },
  { key: 'videoDodge', label: 'Screen / dodge', min: 0, max: 1, step: 0.01 },
  { key: 'videoDepth', label: 'Crystal depth', min: -0.8, max: 0.8, step: 0.01 },
  { key: 'maskContrast', label: 'Mask contrast', min: 0.4, max: 4, step: 0.01 },
  { key: 'maskPosterize', label: 'Mask posterize', min: 2, max: 16, step: 1 },
  { key: 'maskThreshold', label: 'Mask threshold', min: 0, max: 1, step: 0.01 },
  { key: 'maskSoftness', label: 'Mask softness', min: 0.001, max: 0.3, step: 0.005 },
  { key: 'maskGamma', label: 'Mask gamma', min: 0.3, max: 2.5, step: 0.01 },
  { key: 'maskBrightness', label: 'Mask brightness', min: 0.2, max: 2.4, step: 0.01 },
  { key: 'maskInvert', label: 'Mask invert', min: 0, max: 1, step: 1 },
  { key: 'facetFeather', label: 'Facet edge feather', min: 0.004, max: 0.12, step: 0.001 },
  { key: 'facetStrength', label: 'Facet edge bend', min: 0, max: 1.4, step: 0.01 },
  { key: 'facetScale', label: 'Facet size range', min: 2.8, max: 9, step: 0.1 },
  { key: 'facetDrift', label: 'Facet drift', min: 0, max: 1.2, step: 0.01 },
  { key: 'refractionStrength', label: 'Refraction bend', min: 0, max: 0.12, step: 0.001 },
  { key: 'refractionChroma', label: 'Refraction prism', min: 0, max: 1.5, step: 0.01 },
  { key: 'refractionGlow', label: 'Crystal edge glow', min: 0, max: 1.4, step: 0.01 },
]

export const SHADER_LAB_BACKDROP = '/assets/images/shader-lab-backdrop.png'

export const SHADER_LAB_BACKDROP_CONTROLS: ControlConfig[] = [
  { key: 'backdropAnchorY', label: 'Backdrop vertical position', min: 0, max: 1, step: 0.01 },
]

export const DEFAULT_SHADER_LAB_SETTINGS: ShaderSettings = {
  ...DEFAULT_CRYSTAL_SHADER_SETTINGS,
  sphereRadius: 0.22,
  backdropAnchorY: 0.44,
}

const VIDEO_SOURCE = '/assets/videos/shader-overlay.mp4'
const BLOCK_EDGES = 12
const RAY_POINTS_PER_BLOCK = 20
const DEFAULT_CAMERA_DISTANCE = 4.35
const DEFAULT_CLEAR_COLOR: [number, number, number] = [0.004, 0.006, 0.006]
const REFERENCE_SPHERE_RADIUS = DEFAULT_CRYSTAL_SHADER_SETTINGS.sphereRadius

function parseBackgroundColor(color: string): [number, number, number] {
  if (color.startsWith('#') && color.length >= 7) {
    const hex = color.slice(1)
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    ]
  }

  return DEFAULT_CLEAR_COLOR
}

const POST_VERTEX_SHADER = `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}
`

const MASK_PASS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uVideoTexture;
uniform vec2 uResolution;
uniform vec2 uVideoResolution;
uniform float uVideoScale;
uniform float uSphereRadius;
uniform float uReferenceSphereRadius;
uniform float uMaskContrast;
uniform float uMaskPosterize;
uniform float uMaskThreshold;
uniform float uMaskSoftness;
uniform float uMaskGamma;
uniform float uMaskBrightness;
uniform float uMaskInvert;

in vec2 vUv;
out vec4 fragColor;

vec2 coverUv(vec2 uv, vec2 resolution, vec2 videoResolution, float scale, float sphereRadius, float referenceSphereRadius) {
  vec2 safeVideo = max(videoResolution, vec2(1.0));
  float canvasAspect = resolution.x / max(1.0, resolution.y);
  float videoAspect = safeVideo.x / safeVideo.y;
  vec2 planeSize = canvasAspect > videoAspect
    ? vec2(videoAspect / canvasAspect, 1.0)
    : vec2(1.0, canvasAspect / videoAspect);
  float unifiedScale = scale * (sphereRadius / max(0.001, referenceSphereRadius));
  vec2 centered = uv - 0.5;
  return centered / max(vec2(0.001), planeSize * max(0.01, unifiedScale)) + 0.5;
}

void main() {
  vec2 videoUv = coverUv(vUv, uResolution, uVideoResolution, uVideoScale, uSphereRadius, uReferenceSphereRadius);
  float boundsMask = step(0.0, videoUv.x) * step(videoUv.x, 1.0) * step(0.0, videoUv.y) * step(videoUv.y, 1.0);
  vec3 color = texture(uVideoTexture, clamp(videoUv, vec2(0.0), vec2(1.0))).rgb;

  color *= uMaskBrightness;
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / max(0.05, uMaskGamma)));
  color = clamp((color - 0.5) * uMaskContrast + 0.5, 0.0, 1.0);

  float levels = max(2.0, uMaskPosterize);
  color = floor(color * levels + 0.0001) / max(1.0, levels - 1.0);

  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  lum = mix(lum, 1.0 - lum, uMaskInvert);

  float softness = max(0.001, uMaskSoftness);
  float mask = smoothstep(uMaskThreshold - softness, uMaskThreshold + softness, lum) * boundsMask;

  fragColor = vec4(vec3(mask), 1.0);
}
`

const SPHERE_VERTEX_SHADER = `#version 300 es
precision highp float;

uniform mat4 uViewProj;
uniform float uTime;
uniform float uPointCount;
uniform float uSphereRadius;
uniform float uClusterStrength;
uniform float uScatter;
uniform float uPointSize;
uniform float uExposure;
uniform float uColorShift;
uniform float uWarp;
uniform float uDepthMode;
uniform float uVideoDepth;

out vec3 vColor;
out float vAlpha;
out float vCluster;
out float vDepthGate;

const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;
const float GOLDEN = 2.399963229728653;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float clusterMask(float angle, float layer, float time) {
  float a = angle + 0.12 * sin(time * 0.19);
  float c1 = pow(max(0.0, 0.5 + 0.5 * sin(a * 5.0 + 0.5 * layer)), 7.0);
  float c2 = pow(max(0.0, 0.5 + 0.5 * sin(a * 9.0 - 1.8 + time * 0.23)), 9.0);
  float c3 = pow(max(0.0, 0.5 + 0.5 * sin(a * 13.0 + 2.1)), 12.0);
  return clamp(c1 * 0.56 + c2 * 0.36 + c3 * 0.28, 0.0, 1.0);
}

void main() {
  float id = float(gl_VertexID);
  float seed = id * 1.317;
  float t = (id + 0.5) / max(1.0, uPointCount);
  float y = 1.0 - 2.0 * t;
  float radiusAtY = sqrt(max(0.0, 1.0 - y * y));
  float phi = id * GOLDEN + hash(seed + 2.0) * uScatter * 0.4;
  float angle = atan(sin(phi), cos(phi));
  float cluster = clusterMask(angle, y * 3.0, uTime);

  float jitter = (hash(seed + 5.0) - 0.5) * uScatter * 0.12;
  float radius = uSphereRadius + cluster * uClusterStrength * 0.09 + jitter;
  float warpPulse = sin(phi * 3.0 + uTime * 0.75) * uWarp * 0.08;
  radius += warpPulse;

  vec3 pos = vec3(
    cos(phi) * radiusAtY * radius,
    y * radius * 0.92 + warpPulse * 0.5,
    sin(phi) * radiusAtY * radius
  );
  vDepthGate = uDepthMode < 0.0 ? step(pos.z, uVideoDepth) : step(uVideoDepth, pos.z);

  gl_Position = uViewProj * vec4(pos, 1.0);

  float shimmer = 0.68 + 0.32 * hash(seed + floor(uTime * 18.0));
  vAlpha = clamp((0.22 + cluster * 0.95) * shimmer * uExposure, 0.0, 1.35);
  vCluster = cluster;

  vec3 cool = vec3(0.48, 0.82, 1.0);
  vec3 violet = vec3(0.38, 0.34, 1.0);
  vec3 gold = vec3(1.0, 0.84, 0.36);
  vec3 white = vec3(0.9, 1.0, 0.96);
  vec3 coldMix = mix(violet, cool, t);
  vec3 warmMix = mix(white, gold, cluster);
  vColor = mix(coldMix, warmMix, uColorShift * (0.38 + cluster * 0.8));

  gl_PointSize = uPointSize * (0.62 + cluster * 1.75) * (1.0 + 0.12 * abs(y));
}
`

const SPHERE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 vColor;
in float vAlpha;
in float vCluster;
in float vDepthGate;
out vec4 fragColor;

void main() {
  if (vDepthGate < 0.5) {
    discard;
  }

  vec2 uv = gl_PointCoord.xy - 0.5;
  float d = length(uv);
  float core = smoothstep(0.5, 0.05, d);
  float halo = smoothstep(0.5, 0.18, d) * 0.42;
  float alpha = (core + halo * vCluster) * vAlpha;
  fragColor = vec4(vColor * (0.76 + vCluster * 1.25), alpha);
}
`

const BLOCK_WIREFRAME_VERTEX_SHADER = `#version 300 es
precision highp float;

uniform mat4 uViewProj;
uniform float uTime;
uniform float uBlockCount;
uniform float uSphereRadius;
uniform float uBlockLength;
uniform float uBlockThickness;
uniform float uBlockSpread;
uniform float uBlockPointDensity;
uniform float uPointSize;
uniform float uExposure;
  uniform float uColorShift;
  uniform float uDepthMode;
  uniform float uVideoDepth;
  uniform float uBlockEdgeFade;

  out vec3 vColor;
  out float vAlpha;
  out float vCluster;
  out float vDepthGate;

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  vec3 hash33(float n) {
  return normalize(vec3(
    hash(n) * 2.0 - 1.0,
    hash(n + 1.7) * 2.0 - 1.0,
    hash(n + 3.1) * 2.0 - 1.0
  ) + vec3(0.0001));
}

mat3 basisFromDir(vec3 dir) {
  vec3 up = abs(dir.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 side = normalize(cross(up, dir));
  vec3 up2 = cross(dir, side);
  return mat3(side, up2, dir);
}

void main() {
  float pointsPerEdge = max(3.0, uBlockPointDensity);
  float pointsPerBlock = float(${BLOCK_EDGES}) * pointsPerEdge;
  float pointId = mod(float(gl_VertexID), pointsPerBlock);
  float blockId = floor(float(gl_VertexID) / pointsPerBlock);
  float seed = blockId * 2.173 + 11.0;

  vec3 dir = hash33(seed + sin(uTime * 0.08 + seed) * 0.15);
  dir = normalize(mix(dir, normalize(dir + vec3(0.0, hash(seed + 4.0) - 0.5, 0.0) * 0.4), uBlockSpread));

  float lengthScale = uBlockLength * (0.55 + hash(seed + 6.0) * 0.9);
  float width = uBlockThickness * (0.7 + hash(seed + 8.0) * 1.4);
  float height = uBlockThickness * (0.5 + hash(seed + 9.0) * 1.1);
  vec3 origin = dir * (uSphereRadius * (0.88 + hash(seed + 2.0) * 0.12));
  mat3 basis = basisFromDir(dir);

  vec3 halfSize = vec3(width, height, lengthScale * 0.5);
  vec3 corners[8];
  corners[0] = vec3(-halfSize.x, -halfSize.y, 0.0);
  corners[1] = vec3(halfSize.x, -halfSize.y, 0.0);
  corners[2] = vec3(halfSize.x, halfSize.y, 0.0);
  corners[3] = vec3(-halfSize.x, halfSize.y, 0.0);
  corners[4] = vec3(-halfSize.x, -halfSize.y, halfSize.z * 2.0);
  corners[5] = vec3(halfSize.x, -halfSize.y, halfSize.z * 2.0);
  corners[6] = vec3(halfSize.x, halfSize.y, halfSize.z * 2.0);
  corners[7] = vec3(-halfSize.x, halfSize.y, halfSize.z * 2.0);

  int edges[24] = int[24](
    0, 1, 1, 2, 2, 3, 3, 0,
    4, 5, 5, 6, 6, 7, 7, 4,
    0, 4, 1, 5, 2, 6, 3, 7
  );

  float edgeIndex = floor(pointId / pointsPerEdge);
  float edgeT = mod(pointId, pointsPerEdge) / max(1.0, pointsPerEdge - 1.0);
  int cornerA = edges[int(edgeIndex) * 2];
  int cornerB = edges[int(edgeIndex) * 2 + 1];
  vec3 local = mix(corners[cornerA], corners[cornerB], edgeT);
  vec3 pos = origin + basis * local;
  vDepthGate = uDepthMode < 0.0 ? step(pos.z, uVideoDepth) : step(uVideoDepth, pos.z);

  gl_Position = uViewProj * vec4(pos, 1.0);

  vec2 ndc = gl_Position.xy / max(abs(gl_Position.w), 0.0001);
  float edge = max(abs(ndc.x), abs(ndc.y));
  float edgeFade = mix(1.0, 1.0 - smoothstep(0.48, 0.96, edge), uBlockEdgeFade);

  float cluster = 0.42 + hash(seed + pointId * 0.37) * 0.58;
  float shimmer = 0.68 + 0.32 * hash(seed + floor(uTime * 18.0 + pointId));
  vAlpha = clamp((0.18 + cluster * 0.82) * shimmer * uExposure * edgeFade, 0.0, 1.2);
  vCluster = cluster;

  vec3 cool = vec3(0.42, 0.72, 1.0);
  vec3 prism = vec3(0.95, 0.55, 1.0);
  vec3 gold = vec3(1.0, 0.78, 0.34);
  vColor = mix(mix(cool, prism, cluster), gold, uColorShift * 0.42);

  gl_PointSize = uPointSize * (0.55 + cluster * 1.15);
}
`

const BLOCK_RAY_VERTEX_SHADER = `#version 300 es
precision highp float;

uniform mat4 uViewProj;
uniform float uTime;
uniform float uSphereRadius;
uniform float uBlockLength;
uniform float uBlockThickness;
uniform float uBlockSpread;
uniform float uRayDensity;
uniform float uRayLength;
uniform float uRayIntensity;
uniform float uPointSize;
uniform float uColorShift;
uniform float uDepthMode;
uniform float uVideoDepth;

out vec3 vColor;
out float vAlpha;
out vec2 vScreenDir;
out float vDepthGate;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

vec3 hash33(float n) {
  return normalize(vec3(
    hash(n) * 2.0 - 1.0,
    hash(n + 1.7) * 2.0 - 1.0,
    hash(n + 3.1) * 2.0 - 1.0
  ) + vec3(0.0001));
}

mat3 basisFromDir(vec3 dir) {
  vec3 up = abs(dir.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 side = normalize(cross(up, dir));
  vec3 up2 = cross(dir, side);
  return mat3(side, up2, dir);
}

void main() {
  float pointsPerBlock = float(${RAY_POINTS_PER_BLOCK});
  float pointId = mod(float(gl_VertexID), pointsPerBlock);
  float blockId = floor(float(gl_VertexID) / pointsPerBlock);
  float seed = blockId * 2.173 + 11.0;
  float rayPick = hash(seed + 99.0);

  vec3 dir = hash33(seed + sin(uTime * 0.08 + seed) * 0.15);
  dir = normalize(mix(dir, normalize(dir + vec3(0.0, hash(seed + 4.0) - 0.5, 0.0) * 0.4), uBlockSpread));

  float lengthScale = uBlockLength * (0.55 + hash(seed + 6.0) * 0.9) * uRayLength;
  vec3 origin = dir * (uSphereRadius * (0.88 + hash(seed + 2.0) * 0.12));
  mat3 basis = basisFromDir(dir);

  float rayT = pointId / max(1.0, pointsPerBlock - 1.0);
  float pulse = 0.82 + 0.18 * sin(uTime * 1.4 + seed * 3.7);
  vec3 local = vec3(0.0, 0.0, lengthScale * rayT * pulse);
  vec3 pos = origin + basis * local;
  vec3 posAhead = origin + basis * vec3(0.0, 0.0, lengthScale * 0.06 + 0.02);

  vec4 clipPos = uViewProj * vec4(pos, 1.0);
  vec4 clipAhead = uViewProj * vec4(posAhead, 1.0);
  vec2 ndc = clipPos.xy / max(0.0001, clipPos.w);
  vec2 ndcAhead = clipAhead.xy / max(0.0001, clipAhead.w);
  vScreenDir = normalize(ndcAhead - ndc + vec2(0.00001));

  vDepthGate = uDepthMode < 0.0 ? step(pos.z, uVideoDepth) : step(uVideoDepth, pos.z);
  gl_Position = clipPos;

  float head = 1.0 - abs(rayT - 0.5) * 1.35;
  float rayActive = step(rayPick, uRayDensity);
  vAlpha = rayActive * uRayIntensity * (0.35 + head * 0.85) * (0.7 + hash(seed + pointId) * 0.3);

  vec3 cool = vec3(0.55, 0.82, 1.0);
  vec3 gold = vec3(1.0, 0.82, 0.42);
  vColor = mix(cool, gold, uColorShift * 0.55 + rayT * 0.2);

  gl_PointSize = uPointSize * (1.4 + rayT * 2.8) * rayActive;
}
`

const RAY_STREAK_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float uRayBlur;

in vec3 vColor;
in float vAlpha;
in vec2 vScreenDir;
in float vDepthGate;
out vec4 fragColor;

void main() {
  if (vDepthGate < 0.5 || vAlpha < 0.001) {
    discard;
  }

  vec2 dir = normalize(vScreenDir + vec2(0.00001));
  vec2 side = vec2(-dir.y, dir.x);
  vec3 accum = vec3(0.0);
  float weightSum = 0.0;

  for (int i = 0; i < 10; i += 1) {
    float t = (float(i) / 9.0 - 0.5) * uRayBlur;
    vec2 offset = gl_PointCoord - 0.5 + dir * t;
    float along = dot(offset, dir);
    float across = dot(offset, side);
    float core = exp(-across * across * 110.0);
    float streak = core * smoothstep(0.55, 0.0, abs(along));
    float weight = core * streak;
    accum += vColor * weight;
    weightSum += weight;
  }

  float alpha = vAlpha * clamp(weightSum * 0.55, 0.0, 0.65);
  if (alpha < 0.01) {
    discard;
  }

  vec3 color = accum / max(0.001, weightSum);
  fragColor = vec4(min(color, vec3(0.85)), alpha);
}
`

const POST_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uSceneTexture;
uniform sampler2D uVideoTexture;
uniform sampler2D uMaskTexture;
uniform sampler2D uBackgroundTexture;
uniform vec2 uResolution;
uniform vec2 uVideoResolution;
uniform vec2 uBackgroundResolution;
uniform float uTime;
uniform float uVideoOpacity;
uniform float uVideoScale;
uniform float uSphereRadius;
uniform float uReferenceSphereRadius;
uniform float uHasBackground;
uniform float uBackgroundAnchorY;
uniform float uVideoContrast;
uniform float uVideoDodge;
uniform float uFacetFeather;
uniform float uFacetStrength;
uniform float uFacetScale;
uniform float uFacetDrift;
uniform float uRefractionStrength;
uniform float uRefractionChroma;
uniform float uRefractionGlow;

in vec2 vUv;
out vec4 fragColor;

vec3 screenBlend(vec3 base, vec3 blend) {
  return 1.0 - (1.0 - base) * (1.0 - blend);
}

vec3 colorDodge(vec3 base, vec3 blend) {
  return clamp(base / max(vec3(0.045), 1.0 - blend), 0.0, 1.0);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  return vec2(hash12(p), hash12(p + 19.19));
}

vec4 movingFacetField(vec2 p, vec2 center, float mask) {
  vec2 local = p - center;
  float squash = mix(0.88, 1.28, smoothstep(0.36, 0.94, p.x));
  vec2 q = vec2(local.x * 1.12 + local.y * 0.26, local.y * squash - local.x * 0.16);
  q.x += uTime * uFacetDrift;
  q *= uFacetScale;

  vec2 base = floor(q);
  vec2 f = fract(q);
  float nearest = 100.0;
  float secondNearest = 100.0;
  vec2 nearestCell = vec2(0.0);
  vec2 nearestDelta = vec2(0.0);

  for (int y = -1; y <= 1; y += 1) {
    for (int x = -1; x <= 1; x += 1) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 cell = base + neighbor;
      vec2 jitter = hash22(cell) * 0.68 + 0.16;
      jitter.x += (hash12(cell + 4.7) - 0.5) * 0.42;
      vec2 delta = neighbor + jitter - f;
      float distance = dot(delta, delta);

      if (distance < nearest) {
        secondNearest = nearest;
        nearest = distance;
        nearestCell = cell;
        nearestDelta = delta;
      } else if (distance < secondNearest) {
        secondNearest = distance;
      }
    }
  }

  float edgeDistance = (sqrt(secondNearest) - sqrt(nearest)) / max(0.001, uFacetScale);
  float facetEdge = 1.0 - smoothstep(0.0, max(0.002, uFacetFeather), edgeDistance);
  float id = hash12(nearestCell);
  float angle = id * 6.2831853 + sin(uTime * 0.19 + id * 8.0) * 0.18;
  vec2 randomNormal = vec2(cos(angle), sin(angle));
  vec2 radial = normalize(local + vec2(0.00001));
  vec2 flowNormal = normalize(vec2(-0.78, 0.18) + nearestDelta * 0.4);
  vec2 facetNormal = normalize(randomNormal * 0.46 + radial * 0.22 + flowNormal * 0.36 + vec2(0.00001));
  vec2 edgeBend = facetNormal * facetEdge * uFacetStrength;

  return vec4(edgeBend * mask, facetEdge, 1.0);
}

vec2 coverUv(vec2 uv, vec2 resolution, vec2 videoResolution, float scale, float sphereRadius, float referenceSphereRadius) {
  vec2 safeVideo = max(videoResolution, vec2(1.0));
  float canvasAspect = resolution.x / max(1.0, resolution.y);
  float videoAspect = safeVideo.x / safeVideo.y;
  vec2 planeSize = canvasAspect > videoAspect
    ? vec2(videoAspect / canvasAspect, 1.0)
    : vec2(1.0, canvasAspect / videoAspect);
  float unifiedScale = scale * (sphereRadius / max(0.001, referenceSphereRadius));
  vec2 centered = uv - 0.5;
  return centered / max(vec2(0.001), planeSize * max(0.01, unifiedScale)) + 0.5;
}

vec2 coverBackgroundUv(vec2 uv, vec2 resolution, vec2 imageResolution, float anchorY) {
  vec2 safeImage = max(imageResolution, vec2(1.0));
  float canvasAspect = resolution.x / max(1.0, resolution.y);
  float imageAspect = safeImage.x / safeImage.y;
  vec2 planeSize = canvasAspect > imageAspect
    ? vec2(imageAspect / canvasAspect, 1.0)
    : vec2(1.0, canvasAspect / imageAspect);
  vec2 centered = uv - vec2(0.5, anchorY);
  return centered / max(vec2(0.001), planeSize) + 0.5;
}

void main() {
  vec3 backdrop = vec3(0.0);
  if (uHasBackground > 0.5) {
    vec2 backgroundUv = coverBackgroundUv(vUv, uResolution, uBackgroundResolution, uBackgroundAnchorY);
    backdrop = texture(uBackgroundTexture, clamp(backgroundUv, vec2(0.0), vec2(1.0))).rgb;
  }

  vec2 videoUv = coverUv(vUv, uResolution, uVideoResolution, uVideoScale, uSphereRadius, uReferenceSphereRadius);
  float mask = texture(uMaskTexture, vUv).r;

  vec3 video = texture(uVideoTexture, clamp(videoUv, vec2(0.0), vec2(1.0))).rgb;
  video = clamp((video - 0.5) * uVideoContrast + 0.5, 0.0, 1.0);
  float videoLum = dot(video, vec3(0.2126, 0.7152, 0.0722));

  vec2 maskTexel = 1.0 / max(uResolution, vec2(1.0));
  float mLeft = texture(uMaskTexture, clamp(vUv - vec2(maskTexel.x, 0.0), vec2(0.0), vec2(1.0))).r;
  float mRight = texture(uMaskTexture, clamp(vUv + vec2(maskTexel.x, 0.0), vec2(0.0), vec2(1.0))).r;
  float mDown = texture(uMaskTexture, clamp(vUv - vec2(0.0, maskTexel.y), vec2(0.0), vec2(1.0))).r;
  float mUp = texture(uMaskTexture, clamp(vUv + vec2(0.0, maskTexel.y), vec2(0.0), vec2(1.0))).r;
  vec2 maskGradient = vec2(mRight - mLeft, mUp - mDown);
  float edge = length(maskGradient) * 4.0;

  vec2 fineTexel = 2.0 / max(uVideoResolution, vec2(1.0));
  float fLeft = dot(texture(uVideoTexture, clamp(videoUv - vec2(fineTexel.x, 0.0), vec2(0.0), vec2(1.0))).rgb, vec3(0.2126, 0.7152, 0.0722));
  float fRight = dot(texture(uVideoTexture, clamp(videoUv + vec2(fineTexel.x, 0.0), vec2(0.0), vec2(1.0))).rgb, vec3(0.2126, 0.7152, 0.0722));
  float fDown = dot(texture(uVideoTexture, clamp(videoUv - vec2(0.0, fineTexel.y), vec2(0.0), vec2(1.0))).rgb, vec3(0.2126, 0.7152, 0.0722));
  float fUp = dot(texture(uVideoTexture, clamp(videoUv + vec2(0.0, fineTexel.y), vec2(0.0), vec2(1.0))).rgb, vec3(0.2126, 0.7152, 0.0722));
  vec2 facetNormal = vec2(fRight - fLeft, fUp - fDown) * mask * 0.28;

  vec2 centerLens = (videoUv - 0.5) * mask * 0.16;
  vec4 triangle = movingFacetField(videoUv, vec2(0.5), mask);
  vec2 triangleBend = triangle.xy * (0.24 + triangle.z * 0.76);
  vec2 bend =
    (normalize(maskGradient + vec2(0.00001)) * edge * (0.8 + mask * 0.45) + triangleBend + facetNormal + centerLens) *
    uRefractionStrength;

  float chroma = uRefractionChroma * 0.34;
  vec3 points = texture(uSceneTexture, vUv).rgb;
  vec3 baseScene = backdrop + points;
  vec3 refractedScene;
  refractedScene.r = texture(uSceneTexture, clamp(vUv + bend * (1.0 + chroma), vec2(0.0), vec2(1.0))).r;
  refractedScene.g = texture(uSceneTexture, clamp(vUv + bend, vec2(0.0), vec2(1.0))).g;
  refractedScene.b = texture(uSceneTexture, clamp(vUv + bend * (1.0 - chroma), vec2(0.0), vec2(1.0))).b;

  vec3 edgeGlow = vec3(0.55, 0.78, 1.0) * edge * mask * uRefractionGlow;

  vec3 screened = screenBlend(vec3(0.0), video);
  vec3 dodged = colorDodge(vec3(0.018), video * 0.68);
  vec3 material = mix(screened, dodged, uVideoDodge);
  vec3 crystal = refractedScene * (0.62 + videoLum * 0.18) + material * (0.34 + videoLum * 0.5);
  vec3 color = mix(baseScene, crystal, clamp(mask * uVideoOpacity, 0.0, 1.0)) + edgeGlow;

  fragColor = vec4(color, 1.0);
}
`

const BLIT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uSceneTexture;

in vec2 vUv;
out vec4 fragColor;

void main() {
  fragColor = vec4(texture(uSceneTexture, vUv).rgb, 1.0);
}
`

type SceneTarget = {
  framebuffer: WebGLFramebuffer
  texture: WebGLTexture
  width: number
  height: number
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)

  if (!shader) {
    throw new Error('Could not create shader')
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? 'Unknown shader error'
    gl.deleteShader(shader)
    throw new Error(info)
  }

  return shader
}

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()

  if (!program) {
    throw new Error('Could not create WebGL program')
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? 'Unknown link error'
    gl.deleteProgram(program)
    throw new Error(info)
  }

  return program
}

function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
}

function multiply(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16)

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[0 * 4 + row] * b[column * 4 + 0] +
        a[1 * 4 + row] * b[column * 4 + 1] +
        a[2 * 4 + row] * b[column * 4 + 2] +
        a[3 * 4 + row] * b[column * 4 + 3]
    }
  }

  return out
}

function perspective(fovRadians: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovRadians / 2)
  const rangeInv = 1 / (near - far)

  return new Float32Array([
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (near + far) * rangeInv,
    -1,
    0,
    0,
    near * far * rangeInv * 2,
    0,
  ])
}

function translate(matrix: Float32Array, x: number, y: number, z: number) {
  const transform = identity()
  transform[12] = x
  transform[13] = y
  transform[14] = z
  return multiply(matrix, transform)
}

function rotateX(matrix: Float32Array, radians: number) {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  const transform = new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1])
  return multiply(matrix, transform)
}

function rotateY(matrix: Float32Array, radians: number) {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  const transform = new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1])
  return multiply(matrix, transform)
}

function resizeCanvas(gl: WebGL2RenderingContext) {
  const canvas = gl.canvas as HTMLCanvasElement
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr))
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr))

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  gl.viewport(0, 0, width, height)
  return { width, height }
}

function createSceneTarget(gl: WebGL2RenderingContext): SceneTarget {
  const framebuffer = gl.createFramebuffer()
  const texture = gl.createTexture()

  if (!framebuffer || !texture) {
    throw new Error('Could not create shader render target')
  }

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  return { framebuffer, texture, width: 0, height: 0 }
}

function resizeSceneTarget(gl: WebGL2RenderingContext, target: SceneTarget, width: number, height: number) {
  if (target.width === width && target.height === height) {
    return
  }

  target.width = width
  target.height = height
  gl.bindTexture(gl.TEXTURE_2D, target.texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
}

function createVideoTexture(gl: WebGL2RenderingContext) {
  const texture = gl.createTexture()

  if (!texture) {
    throw new Error('Could not create video texture')
  }

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))

  return texture
}

function setSphereUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  matrix: Float32Array,
  settings: ShaderSettings,
  elapsed: number,
  pointCount: number,
  depthMode: number,
) {
  gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uViewProj'), false, matrix)
  gl.uniform1f(gl.getUniformLocation(program, 'uTime'), elapsed)
  gl.uniform1f(gl.getUniformLocation(program, 'uPointCount'), pointCount)
  gl.uniform1f(gl.getUniformLocation(program, 'uSphereRadius'), settings.sphereRadius)
  gl.uniform1f(gl.getUniformLocation(program, 'uClusterStrength'), settings.clusterStrength)
  gl.uniform1f(gl.getUniformLocation(program, 'uScatter'), settings.scatter)
  gl.uniform1f(gl.getUniformLocation(program, 'uPointSize'), settings.pointSize)
  gl.uniform1f(gl.getUniformLocation(program, 'uExposure'), settings.exposure)
  gl.uniform1f(gl.getUniformLocation(program, 'uColorShift'), settings.colorShift)
  gl.uniform1f(gl.getUniformLocation(program, 'uWarp'), settings.warp)
  gl.uniform1f(gl.getUniformLocation(program, 'uDepthMode'), depthMode)
  gl.uniform1f(gl.getUniformLocation(program, 'uVideoDepth'), settings.videoDepth)
}

function setBlockUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  matrix: Float32Array,
  settings: ShaderSettings,
  elapsed: number,
  depthMode: number,
  blockEdgeFade: number,
) {
  gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uViewProj'), false, matrix)
  gl.uniform1f(gl.getUniformLocation(program, 'uTime'), elapsed)
  gl.uniform1f(gl.getUniformLocation(program, 'uBlockCount'), settings.blockCount)
  gl.uniform1f(gl.getUniformLocation(program, 'uSphereRadius'), settings.sphereRadius)
  gl.uniform1f(gl.getUniformLocation(program, 'uBlockLength'), settings.blockLength)
  gl.uniform1f(gl.getUniformLocation(program, 'uBlockThickness'), settings.blockThickness)
  gl.uniform1f(gl.getUniformLocation(program, 'uBlockSpread'), settings.blockSpread)
  gl.uniform1f(gl.getUniformLocation(program, 'uBlockPointDensity'), settings.blockPointDensity)
  gl.uniform1f(gl.getUniformLocation(program, 'uPointSize'), settings.pointSize)
  gl.uniform1f(gl.getUniformLocation(program, 'uExposure'), settings.exposure)
  gl.uniform1f(gl.getUniformLocation(program, 'uColorShift'), settings.colorShift)
  gl.uniform1f(gl.getUniformLocation(program, 'uDepthMode'), depthMode)
  gl.uniform1f(gl.getUniformLocation(program, 'uVideoDepth'), settings.videoDepth)
  gl.uniform1f(gl.getUniformLocation(program, 'uBlockEdgeFade'), blockEdgeFade)
}

function setRayUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  matrix: Float32Array,
  settings: ShaderSettings,
  elapsed: number,
  depthMode: number,
) {
  gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uViewProj'), false, matrix)
  gl.uniform1f(gl.getUniformLocation(program, 'uTime'), elapsed)
  gl.uniform1f(gl.getUniformLocation(program, 'uSphereRadius'), settings.sphereRadius)
  gl.uniform1f(gl.getUniformLocation(program, 'uBlockLength'), settings.blockLength)
  gl.uniform1f(gl.getUniformLocation(program, 'uBlockThickness'), settings.blockThickness)
  gl.uniform1f(gl.getUniformLocation(program, 'uBlockSpread'), settings.blockSpread)
  gl.uniform1f(gl.getUniformLocation(program, 'uRayDensity'), settings.rayDensity)
  gl.uniform1f(gl.getUniformLocation(program, 'uRayLength'), settings.rayLength)
  gl.uniform1f(gl.getUniformLocation(program, 'uRayIntensity'), settings.rayIntensity)
  gl.uniform1f(gl.getUniformLocation(program, 'uPointSize'), settings.pointSize)
  gl.uniform1f(gl.getUniformLocation(program, 'uColorShift'), settings.colorShift)
  gl.uniform1f(gl.getUniformLocation(program, 'uDepthMode'), depthMode)
  gl.uniform1f(gl.getUniformLocation(program, 'uVideoDepth'), settings.videoDepth)
  gl.uniform1f(gl.getUniformLocation(program, 'uRayBlur'), settings.rayBlur)
}

type CrystalFieldShaderProps = {
  className?: string
  settings?: ShaderSettings
  showMask?: boolean
  onGlError?: (message: string | null) => void
  contentScale?: number
  backgroundColor?: string
  followPointer?: boolean
  blockEdgeFade?: boolean
  backgroundImage?: string
}

export function CrystalFieldShader({
  className,
  settings = DEFAULT_CRYSTAL_SHADER_SETTINGS,
  showMask = false,
  onGlError,
  contentScale = 1,
  backgroundColor = '#020303',
  followPointer = false,
  blockEdgeFade = false,
  backgroundImage,
}: CrystalFieldShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const backgroundImageRef = useRef<HTMLImageElement | null>(null)
  const backgroundReadyRef = useRef(false)
  const settingsRef = useRef(settings)
  const showMaskRef = useRef(showMask)
  const contentScaleRef = useRef(contentScale)
  const backgroundColorRef = useRef(backgroundColor)
  const followPointerRef = useRef(followPointer)
  const blockEdgeFadeRef = useRef(blockEdgeFade ? 1 : 0)
  const pointerTargetRef = useRef({ x: 0, y: 0 })
  const pointerCurrentRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    showMaskRef.current = showMask
  }, [showMask])

  useEffect(() => {
    contentScaleRef.current = contentScale
  }, [contentScale])

  useEffect(() => {
    backgroundColorRef.current = backgroundColor
  }, [backgroundColor])

  useEffect(() => {
    followPointerRef.current = followPointer
    if (!followPointer) {
      pointerTargetRef.current = { x: 0, y: 0 }
      pointerCurrentRef.current = { x: 0, y: 0 }
    }
  }, [followPointer])

  useEffect(() => {
    blockEdgeFadeRef.current = blockEdgeFade ? 1 : 0
  }, [blockEdgeFade])

  useEffect(() => {
    backgroundReadyRef.current = false
    backgroundImageRef.current = null

    if (!backgroundImage) {
      return
    }

    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      backgroundReadyRef.current = true
    }
    image.onerror = () => {
      backgroundReadyRef.current = false
    }
    image.src = backgroundImage
    backgroundImageRef.current = image

    return () => {
      backgroundReadyRef.current = false
      backgroundImageRef.current = null
    }
  }, [backgroundImage])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas || !followPointer) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        return
      }

      pointerTargetRef.current = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
      }
    }

    const handlePointerLeave = () => {
      pointerTargetRef.current = { x: 0, y: 0 }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerleave', handlePointerLeave)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [followPointer])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    let disposed = false

    try {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'high-performance',
    })

    if (!gl) {
      onGlError?.('WebGL2 is not available in this browser.')
      return
    }

    onGlError?.(null)

    const sphereProgram = createProgram(gl, SPHERE_VERTEX_SHADER, SPHERE_FRAGMENT_SHADER)
    const blockProgram = createProgram(gl, BLOCK_WIREFRAME_VERTEX_SHADER, SPHERE_FRAGMENT_SHADER)
    const rayProgram = createProgram(gl, BLOCK_RAY_VERTEX_SHADER, RAY_STREAK_FRAGMENT_SHADER)
    const maskProgram = createProgram(gl, POST_VERTEX_SHADER, MASK_PASS_FRAGMENT_SHADER)
    const postProgram = createProgram(gl, POST_VERTEX_SHADER, POST_FRAGMENT_SHADER)
    const blitProgram = createProgram(gl, POST_VERTEX_SHADER, BLIT_FRAGMENT_SHADER)
    const backTarget = createSceneTarget(gl)
    const maskTarget = createSceneTarget(gl)
    const crystalTarget = createSceneTarget(gl)
    const videoTexture = createVideoTexture(gl)
    const backgroundTexture = createVideoTexture(gl)
    const vertexArray = gl.createVertexArray()
    const video = videoRef.current
    let frameId = 0
    const startTime = performance.now()

    gl.bindVertexArray(vertexArray)
    if (video) {
      video.play().catch(() => undefined)
    }

    const renderStructure = (
      depthMode: number,
      liveSettings: ShaderSettings,
      sphereMatrix: Float32Array,
      blockMatrix: Float32Array,
      elapsed: number,
      blockElapsed: number,
      pointCount: number,
      blockPointCount: number,
      rayPointCount: number,
    ) => {
      gl.disable(gl.DEPTH_TEST)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE)

      gl.useProgram(blockProgram)
      setBlockUniforms(
        gl,
        blockProgram,
        blockMatrix,
        liveSettings,
        blockElapsed,
        depthMode,
        blockEdgeFadeRef.current,
      )
      gl.drawArrays(gl.POINTS, 0, blockPointCount)

      gl.useProgram(rayProgram)
      setRayUniforms(gl, rayProgram, blockMatrix, liveSettings, blockElapsed, depthMode)
      gl.drawArrays(gl.POINTS, 0, rayPointCount)

      gl.useProgram(sphereProgram)
      setSphereUniforms(gl, sphereProgram, sphereMatrix, liveSettings, elapsed, pointCount, depthMode)
      gl.drawArrays(gl.POINTS, 0, pointCount)
    }

    const renderMaskPass = (liveSettings: ShaderSettings, width: number, height: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, maskTarget.framebuffer)
      gl.viewport(0, 0, width, height)
      gl.disable(gl.BLEND)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.useProgram(maskProgram)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, videoTexture)
      gl.uniform1i(gl.getUniformLocation(maskProgram, 'uVideoTexture'), 0)
      gl.uniform2f(gl.getUniformLocation(maskProgram, 'uResolution'), width, height)
      gl.uniform2f(
        gl.getUniformLocation(maskProgram, 'uVideoResolution'),
        video?.videoWidth || width,
        video?.videoHeight || height,
      )
      gl.uniform1f(gl.getUniformLocation(maskProgram, 'uVideoScale'), liveSettings.videoScale)
      gl.uniform1f(gl.getUniformLocation(maskProgram, 'uSphereRadius'), liveSettings.sphereRadius)
      gl.uniform1f(gl.getUniformLocation(maskProgram, 'uReferenceSphereRadius'), REFERENCE_SPHERE_RADIUS)
      gl.uniform1f(gl.getUniformLocation(maskProgram, 'uMaskContrast'), liveSettings.maskContrast)
      gl.uniform1f(gl.getUniformLocation(maskProgram, 'uMaskPosterize'), liveSettings.maskPosterize)
      gl.uniform1f(gl.getUniformLocation(maskProgram, 'uMaskThreshold'), liveSettings.maskThreshold)
      gl.uniform1f(gl.getUniformLocation(maskProgram, 'uMaskSoftness'), liveSettings.maskSoftness)
      gl.uniform1f(gl.getUniformLocation(maskProgram, 'uMaskGamma'), liveSettings.maskGamma)
      gl.uniform1f(gl.getUniformLocation(maskProgram, 'uMaskBrightness'), liveSettings.maskBrightness)
      gl.uniform1f(gl.getUniformLocation(maskProgram, 'uMaskInvert'), liveSettings.maskInvert)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const render = () => {
      const liveSettings = settingsRef.current
      const { width, height } = resizeCanvas(gl)
      resizeSceneTarget(gl, backTarget, width, height)
      resizeSceneTarget(gl, maskTarget, width, height)
      resizeSceneTarget(gl, crystalTarget, width, height)
      const aspect = width / height
      const elapsed = ((performance.now() - startTime) / 1000) * liveSettings.speed
      const pointCount = Math.round(liveSettings.density * 5)
      const blockPointCount =
        Math.round(liveSettings.blockCount) * BLOCK_EDGES * Math.round(liveSettings.blockPointDensity)
      const rayPointCount = Math.round(liveSettings.blockCount) * RAY_POINTS_PER_BLOCK
      const blockMotion = liveSettings.blockSpeed
      const clearColor = parseBackgroundColor(backgroundColorRef.current)
      const cameraDistance = DEFAULT_CAMERA_DISTANCE / Math.max(0.1, contentScaleRef.current)

      if (followPointerRef.current) {
        const target = pointerTargetRef.current
        const current = pointerCurrentRef.current
        current.x += (target.x - current.x) * 0.07
        current.y += (target.y - current.y) * 0.07
      } else {
        pointerCurrentRef.current.x = 0
        pointerCurrentRef.current.y = 0
      }

      const pointerX = pointerCurrentRef.current.x
      const pointerY = pointerCurrentRef.current.y
      const sceneTilt = liveSettings.tilt - 4 + pointerY * -11
      const sceneRotation = liveSettings.rotation + pointerX * 16

      let baseMatrix = perspective((42 * Math.PI) / 180, aspect, 0.1, 20)
      baseMatrix = translate(baseMatrix, 0, 0, -cameraDistance)
      baseMatrix = rotateX(baseMatrix, (sceneTilt * Math.PI) / 180)
      const sphereMatrix = rotateY(
        baseMatrix,
        ((sceneRotation + elapsed * 9) * Math.PI) / 180,
      )
      const blockMatrix = rotateY(
        baseMatrix,
        ((sceneRotation + elapsed * 9 * blockMotion) * Math.PI) / 180,
      )
      const blockElapsed = elapsed * blockMotion

      if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, videoTexture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, backTarget.framebuffer)
      gl.viewport(0, 0, width, height)
      gl.clearColor(clearColor[0], clearColor[1], clearColor[2], 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      renderStructure(
        -1,
        liveSettings,
        sphereMatrix,
        blockMatrix,
        elapsed,
        blockElapsed,
        pointCount,
        blockPointCount,
        rayPointCount,
      )

      renderMaskPass(liveSettings, width, height)

      gl.bindFramebuffer(gl.FRAMEBUFFER, crystalTarget.framebuffer)
      gl.viewport(0, 0, width, height)
      gl.disable(gl.BLEND)
      gl.useProgram(postProgram)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, backTarget.texture)
      gl.uniform1i(gl.getUniformLocation(postProgram, 'uSceneTexture'), 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, videoTexture)
      gl.uniform1i(gl.getUniformLocation(postProgram, 'uVideoTexture'), 1)
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_2D, maskTarget.texture)
      gl.uniform1i(gl.getUniformLocation(postProgram, 'uMaskTexture'), 2)
      gl.activeTexture(gl.TEXTURE3)
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture)
      gl.uniform1i(gl.getUniformLocation(postProgram, 'uBackgroundTexture'), 3)

      const backgroundImageElement = backgroundImageRef.current
      const hasBackground =
        backgroundReadyRef.current &&
        backgroundImageElement &&
        backgroundImageElement.complete &&
        backgroundImageElement.naturalWidth > 0

      if (hasBackground) {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          backgroundImageElement,
        )
      }

      gl.uniform1f(gl.getUniformLocation(postProgram, 'uHasBackground'), hasBackground ? 1 : 0)
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uBackgroundAnchorY'), liveSettings.backdropAnchorY)
      gl.uniform2f(
        gl.getUniformLocation(postProgram, 'uBackgroundResolution'),
        hasBackground ? backgroundImageElement.naturalWidth : 1,
        hasBackground ? backgroundImageElement.naturalHeight : 1,
      )
      gl.uniform2f(gl.getUniformLocation(postProgram, 'uResolution'), width, height)
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uTime'), elapsed)
      gl.uniform2f(
        gl.getUniformLocation(postProgram, 'uVideoResolution'),
        video?.videoWidth || width,
        video?.videoHeight || height,
      )
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uVideoOpacity'), liveSettings.videoOpacity)
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uVideoScale'), liveSettings.videoScale)
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uSphereRadius'), liveSettings.sphereRadius)
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uReferenceSphereRadius'), REFERENCE_SPHERE_RADIUS)
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uVideoContrast'), liveSettings.videoContrast)
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uVideoDodge'), liveSettings.videoDodge)
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uFacetFeather'), liveSettings.facetFeather)
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uFacetStrength'), liveSettings.facetStrength)
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uFacetScale'), liveSettings.facetScale)
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uFacetDrift'), liveSettings.facetDrift)
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uRefractionStrength'), liveSettings.refractionStrength)
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uRefractionChroma'), liveSettings.refractionChroma)
      gl.uniform1f(gl.getUniformLocation(postProgram, 'uRefractionGlow'), liveSettings.refractionGlow)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      gl.bindFramebuffer(gl.FRAMEBUFFER, crystalTarget.framebuffer)
      gl.viewport(0, 0, width, height)
      renderStructure(
        1,
        liveSettings,
        sphereMatrix,
        blockMatrix,
        elapsed,
        blockElapsed,
        pointCount,
        blockPointCount,
        rayPointCount,
      )

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, width, height)
      gl.clearColor(clearColor[0], clearColor[1], clearColor[2], 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.disable(gl.BLEND)
      gl.useProgram(blitProgram)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, showMaskRef.current ? maskTarget.texture : crystalTarget.texture)
      gl.uniform1i(gl.getUniformLocation(blitProgram, 'uSceneTexture'), 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      frameId = window.requestAnimationFrame(render)
    }

    frameId = window.requestAnimationFrame(render)

    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      gl.deleteProgram(sphereProgram)
      gl.deleteProgram(blockProgram)
      gl.deleteProgram(rayProgram)
      gl.deleteProgram(maskProgram)
      gl.deleteProgram(postProgram)
      gl.deleteProgram(blitProgram)
      gl.deleteFramebuffer(backTarget.framebuffer)
      gl.deleteTexture(backTarget.texture)
      gl.deleteFramebuffer(maskTarget.framebuffer)
      gl.deleteTexture(maskTarget.texture)
      gl.deleteFramebuffer(crystalTarget.framebuffer)
      gl.deleteTexture(crystalTarget.texture)
      gl.deleteTexture(videoTexture)
      gl.deleteTexture(backgroundTexture)
      gl.deleteVertexArray(vertexArray)
    }
    } catch (error) {
      if (!disposed) {
        onGlError?.(error instanceof Error ? error.message : String(error))
      }
    }
  }, [onGlError])

  return (
    <>
      <canvas
        ref={canvasRef}
        className={className ?? styles.canvas}
        aria-label="Crystal field shader background"
      />
      <video
        ref={videoRef}
        className={styles.videoSource}
        src={VIDEO_SOURCE}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        aria-hidden="true"
      />
    </>
  )
}
