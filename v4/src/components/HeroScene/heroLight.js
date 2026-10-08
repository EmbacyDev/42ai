import * as THREE from 'three'

/**
 * Crystal light for the hero, drawn inside the hero scene between its
 * background and the portrait cards, so the photographs sit on top of it.
 *
 * Hover (real pointer only): a focused fan of zoom-blurred rays from the
 * crystal to the selected card, after the "Agentic" light in Shopify
 * Editions Spring '26. All maths in CSS pixels; the quad is in clip space.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform vec2 uRes;
  uniform vec2 uOrigin;
  uniform vec2 uTarget;
  uniform vec4 uRect;
  uniform float uCrystalR;
  uniform float uStrength;
  uniform float uReach;
  // Block four: how much of the crystal's colour has poured out (0 in the
  // hero), and whether this light draws the shared glow at all.
  uniform float uVolume;
  uniform float uRingOn;
  uniform float uGain;
  uniform float uTime;
  uniform float uIdle;
  uniform float uSpin;
  uniform float uSpin2;
  // v4: 1 in the hero; smaller on block two, where the rays stay close.
  uniform float uSpread;
  // v4: opening block three, the light takes on that screen's field colour.
  uniform vec3 uTint;
  uniform float uTintAmount;
  uniform vec3 uC0;
  uniform vec3 uC1;
  uniform vec3 uC2;
  uniform vec3 uC3;
  uniform vec3 uCore;
  uniform vec4 uMaskA[16];
  uniform vec4 uMaskB[16];
  uniform int uMaskCount;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // The crystal's own flow colours, cycled smoothly.
  vec3 palette(float t) {
    t = fract(t) * 4.0;
    vec3 a = mix(uC0, uC1, smoothstep(0.0, 1.0, t));
    a = mix(a, uC2, smoothstep(1.0, 2.0, t));
    a = mix(a, uC3, smoothstep(2.0, 3.0, t));
    return mix(a, uC0, smoothstep(3.0, 4.0, t));
  }

  // Signed distance to a convex quad (corners in order); negative inside.
  float edgeDist(vec2 p, vec2 a, vec2 b, float wind) {
    vec2 e = b - a;
    vec2 n = normalize(vec2(e.y, -e.x)) * wind;
    return dot(p - a, n);
  }
  float quadMask(vec2 p, vec4 ab, vec4 cd, float feather) {
    vec2 a = ab.xy; vec2 b = ab.zw; vec2 c = cd.xy; vec2 d = cd.zw;
    vec2 e1 = b - a; vec2 e2 = c - b;
    float wind = sign(e1.x * e2.y - e1.y * e2.x);
    // v4: rounded corners, like the photographs. A sharp-cornered cut-out
    // left a pointed patch of different light at each rounded photo corner.
    const float R = 8.0;
    float u = max(edgeDist(p, a, b, wind), edgeDist(p, c, d, wind)) + R;
    float v = max(edgeDist(p, b, c, wind), edgeDist(p, d, a, wind)) + R;
    float dist = length(max(vec2(u, v), 0.0)) + min(max(u, v), 0.0) - R;
    return 1.0 - smoothstep(-feather, feather, dist);
  }

  void main() {
    if (uStrength < 0.002 && uIdle < 0.002) discard;
    vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;

    vec2 d = p - uOrigin;
    float dist = max(length(d), 0.001);
    vec2 toCard = uTarget - uOrigin;
    float L = max(length(toCard), 1.0);
    vec2 axis = toCard / L;
    float along = dot(d, axis);
    float across = d.x * axis.y - d.y * axis.x;
    float ang = atan(across, along);

    // Cone wide enough to bathe the whole card, soft at the rim.
    vec2 halfSize = (uRect.zw - uRect.xy) * 0.5;
    float cardR = length(halfSize);
    // Focused: the cone just covers the card instead of fanning wide.
    float halfAng = atan(cardR * 1.0, L) + 0.045;
    float coneT = ang / halfAng;
    float cone = exp(-coneT * coneT * 1.35);
    float coreCone = exp(-coneT * coneT * 7.0);

    // Zoom-blur streaks: noise in angle only, drifting outward, so it
    // reads as long radial bands of light rather than a smooth wedge.
    // Few, broad waves: big soft bands rather than fine striping.
    float flow = uTime * 0.35 - dist * 0.0018;
    float s1 = noise(vec2(ang * 34.0, flow));
    float s2 = noise(vec2(ang * 95.0 + 7.3, flow * 1.7));
    float s3 = noise(vec2(ang * 12.0 - 2.1, flow * 0.6));
    float streak = 0.32 + 0.42 * s1 + 0.26 * s2 + 0.3 * s3;

    // Leaves the glass, grows out to the card and a little past it.
    float leave = smoothstep(uCrystalR * 0.45, uCrystalR * 1.05, dist);
    float front = (L + cardR * 1.4) * uReach;
    float reach = 1.0 - smoothstep(front - cardR * 2.4, front + cardR * 0.6, dist);
    float falloff = 1.0 / (1.0 + max(dist - uCrystalR, 0.0) / (L * 1.4));
    float beam = cone * streak * leave * reach * falloff;

    // Gradient bands travel outward from the crystal along the rays.
    // Colour runs along the rays (noise on the angle, drifting slowly
    // outward) instead of curling round them in spiral bands.
    float phase = noise(vec2(ang * 3.2 + 1.3, dist * 0.0005 - uTime * 0.1)) * 1.25 + uTime * 0.02;
    vec3 beamColor = palette(phase);
    beamColor = mix(beamColor, uCore, coreCone * 0.42 + 0.1);

    // The crystal's colours bleeding past its silhouette, strongest on
    // the side facing the card.
    float facing = smoothstep(-0.3, 1.0, along / dist);
    // With every separated facet the colour runs further past the glass.
    float ringT = (dist - uCrystalR * 0.9) / (uCrystalR * (0.95 + uVolume * 1.15));
    float ring = exp(-ringT * ringT) * (0.4 + 0.6 * facing) * uReach;
    // The colour spilling out of the gem: lobes of noise that travel
    // outward, fuller and further with every separated facet.
    vec2 spillDir = (p - uOrigin) / max(length(p - uOrigin), 0.001);
    float spill = noise(spillDir * 2.4 + vec2(1.7, dist / max(uCrystalR, 1.0) * 0.9 - uTime * 0.32)) * 0.7
                + noise(spillDir * 5.1 + vec2(dist / max(uCrystalR, 1.0) * 1.6 - uTime * 0.45, 4.2)) * 0.45;
    ring *= mix(1.0, (0.4 + spill) * (1.0 + uVolume * 0.6), min(uVolume * 2.0, 1.0));
    ring *= uRingOn;
    float polar = atan(d.y, d.x);
    // Colour drifts through slow, unstructured noise (not by angle, which
    // read as a cross) and is kept soft and pale.
    vec2 dn = d / max(uCrystalR, 1.0);
    // Large, slow colour patches.
    float hueA = noise(dn * 0.38 + vec2(uTime * 0.04, -uTime * 0.03));
    float hueB = noise(dn * 0.85 + vec2(4.7 - uTime * 0.025, 1.9 + uTime * 0.045));
    vec3 ringColor = mix(palette(hueA * 0.7 + hueB * 0.5 + uTime * 0.02), uCore, 0.5);
    float ringVar = 0.7 + 0.3 * noise(dn * 0.55 + vec2(uTime * 0.05, 2.3));

    // Idle glow: without a hover the crystal still radiates the same
    // light, all around it and only a short way out, with broad, slow
    // waves of its colours drifting outward.
    vec2 dirv = d / dist;
    // A long, soft tail with no rim: it simply thins out into the page.
    float haloT = max(dist - uCrystalR * 0.35, 0.0) / (uCrystalR * 2.1);
    float halo = exp(-haloT * haloT * 1.15) / (1.0 + haloT * 0.6);
    float waveA = noise(dirv * 1.7 + vec2(uTime * 0.16 - dist * 0.0022, 3.1));
    float waveB = noise(dirv * 3.2 + vec2(5.7, uTime * 0.11 - dist * 0.0016));
    float idleWave = 0.62 + 0.26 * waveA + 0.14 * waveB;
    vec3 idleColor = mix(palette(polar / 6.2831853 + dist * 0.0014 - uTime * 0.07), uCore, 0.2);

    // Drawn in the hero scene behind the cards and copy, so the photos
    // simply sit on top of the light; their edge light is per card.
    // A soft, chaotic haze around the beam: big drifting noise blobs along
    // its length, wider than the rays.
    float hazeCone = exp(-coneT * coneT * 0.35);
    vec2 hz = vec2(along, across) / max(uCrystalR, 1.0);
    // Stretched along the beam so it mixes with the rays rather than
    // reading as swirls.
    float hazeN = noise(hz * vec2(0.22, 1.1) + vec2(-uTime * 0.14, uTime * 0.03))
                * 0.65 + noise(hz * vec2(0.5, 2.2) + vec2(3.1 - uTime * 0.2, 7.0)) * 0.45;
    float haze = hazeCone * smoothstep(0.25, 0.95, hazeN) * leave * reach * falloff;
    vec3 light = beamColor * beam * 1.1 + ringColor * ring * ringVar * 0.5
               + mix(beamColor, uCore, 0.4) * haze * 0.22;
    light *= uStrength * uGain;
    // Without a hover the same glow stays around the crystal: half as
    // strong and spread wider. No beam.
    float idleT = (dist - uCrystalR * 0.85) / (uCrystalR * 1.6 * uSpread);
    float idleRing = exp(-idleT * idleT) * smoothstep(uCrystalR * 0.3, uCrystalR * 0.9, dist);
    // Soft rays fan out of the glow in every direction: long radial
    // streaks (noise on the direction only) drifting slowly outward,
    // dimmer than the hover beam and coloured like the crystal.
    // On hover the rays fold in toward the card: their directions are
    // squeezed onto the beam axis and the ones left outside it fade.
    float s = smoothstep(0.0, 1.0, uStrength);
    float foldAng = ang * (1.0 - 0.82 * s);
    vec2 dirIdle = axis * cos(foldAng) + vec2(-axis.y, axis.x) * sin(foldAng) * -1.0;
    dirIdle = mix(d / dist, dirIdle, step(0.001, s));
    // v4: the rays turn with the crystal (uSpin, eased in JS).
    float spinC = cos(uSpin);
    float spinS = sin(uSpin);
    dirIdle = vec2(dirIdle.x * spinC - dirIdle.y * spinS, dirIdle.x * spinS + dirIdle.y * spinC);
    float rayGate = mix(1.0, exp(-coneT * coneT * 0.12), s);
    float rayN = noise(dirIdle * 7.0 + vec2(uTime * 0.05, 1.7))
               * 0.6 + noise(dirIdle * 15.0 + vec2(4.2, -uTime * 0.07)) * 0.4;
    float rayMask = pow(smoothstep(0.35, 0.95, rayN), 1.4);
    float rayT = max(dist - uCrystalR * 0.7, 0.0) / (uCrystalR * 1.5 * uSpread);
    float rayFall = exp(-rayT * 1.6) * smoothstep(uCrystalR * 0.45, uCrystalR * 1.0, dist);
    // Saturated crystal colours, not white: each ray takes its own hue.
    float rayHue = noise(dirIdle * 3.0 + vec2(9.1, uTime * 0.03));
    vec3 rayColor = palette(rayHue * 1.3 + hueA * 0.4 + uTime * 0.015);
    // Lifted toward white so a faint ray brightens the page instead of
    // tinting it grey; the hue still reads clearly.
    // v4: mostly white light, the crystal hue only as a tint.
    rayColor = mix(rayColor, vec3(1.0), 0.6);
    vec3 idleRingColor = mix(palette(hueA * 0.7 + hueB * 0.5 + uTime * 0.02), uCore, 0.15);
    light += idleRingColor * idleRing * ringVar * 0.14 * uIdle * (1.0 - uStrength);
    light += rayColor * rayMask * rayFall * rayGate * 0.34 * uIdle * (1.0 - 0.55 * s);
    // v4: a second, finer set of rays turning a little faster than the
    // first. Where the two sets cross they add up, so the light seems to
    // shimmer and move instead of sitting as one flat fan.
    {
      float c2 = cos(uSpin2);
      float s2 = sin(uSpin2);
      vec2 d0 = d / dist;
      vec2 dir2 = vec2(d0.x * c2 - d0.y * s2, d0.x * s2 + d0.y * c2);
      // Broader than the first set: lower angular frequency, softer edge.
      float rayN2 = noise(dir2 * 4.0 + vec2(-uTime * 0.04, 6.3))
                  * 0.6 + noise(dir2 * 8.5 + vec2(2.9, uTime * 0.06)) * 0.4;
      float rayMask2 = pow(smoothstep(0.38, 0.92, rayN2), 1.2);
      float rayT2 = max(dist - uCrystalR * 0.65, 0.0) / (uCrystalR * 1.9 * uSpread);
      float rayFall2 = exp(-rayT2 * 1.4) * smoothstep(uCrystalR * 0.45, uCrystalR * 1.0, dist);
      vec3 rayColor2 = mix(palette(noise(dir2 * 2.4 + vec2(1.3, uTime * 0.02)) * 1.3 + uTime * 0.01), vec3(1.0), 0.72);
      light += rayColor2 * rayMask2 * rayFall2 * rayGate * 0.13 * uIdle * (1.0 - 0.55 * s);
    }

    // Over the crystal, under the portraits and their tags.
    for (int i = 0; i < 16; i++) {
      if (i >= uMaskCount) break;
      light *= 1.0 - quadMask(p, uMaskA[i], uMaskB[i], 1.0);
    }
    // First version: the hover beam only, no idle glow.

    float lum = dot(light, vec3(0.333));
    // v4: a saturated teal-green, not a tinted white — the light should
    // read as the colour that then becomes block three's field.
    light = mix(light, uTint * (0.35 + lum) * 1.6, uTintAmount);
    light *= 2.0;
    float peak = max(max(light.r, light.g), light.b);
    float alpha = clamp(peak, 0.0, 1.0);
    if (alpha < 0.0008) discard;
    vec3 straight = min(light / alpha, vec3(1.0));
    gl_FragColor = vec4(straight * alpha, alpha);
  }
`


export function createHeroLight(config) {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    // Own canvas with the default premultiplied alpha: the same result in
    // Safari and Chrome.
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uRes: { value: new THREE.Vector2(1, 1) },
      uOrigin: { value: new THREE.Vector2() },
      uTarget: { value: new THREE.Vector2() },
      uRect: { value: new THREE.Vector4() },
      uCrystalR: { value: 100 },
      uStrength: { value: 0 },
      uReach: { value: 0 },
      uVolume: { value: 0 },
      uRingOn: { value: 1 },
      uGain: { value: 1 },
      uIdle: { value: 0 },
      uSpin: { value: 0 },
      uSpin2: { value: 0 },
      uSpread: { value: 1 },
      uTint: { value: new THREE.Color('#13a57e') },
      uTintAmount: { value: 0 },
      uTime: { value: 0 },
      uC0: { value: new THREE.Color(config?.friendFlowColor1 ?? '#756cff') },
      uC1: { value: new THREE.Color(config?.friendFlowColor2 ?? '#29ae57') },
      uC2: { value: new THREE.Color(config?.friendFlowColor3 ?? '#1d81ed') },
      // The acid yellow is softened toward the warm core so it accents
      // the rays instead of flooding them.
      uC3: { value: new THREE.Color(config?.friendFlowColor4 ?? '#f0ff1f').lerp(new THREE.Color(config?.friendCenterColor ?? '#fff4e8'), 0.55) },
      uCore: { value: new THREE.Color(config?.friendCenterColor ?? '#fff4e8') },
      uMaskA: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uMaskB: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uMaskCount: { value: 0 },
    },
  })
  const geometry = new THREE.PlaneGeometry(2, 2)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  // After the glass in the crystal canvas; cards are masked out.
  mesh.renderOrder = 200
  mesh.visible = false

  let strength = 0
  let reach = 0
  let idle = 0
  let spin = 0
  let spin2 = 0
  let targetId = null
  const u = material.uniforms

  /**
   * crystal: { x, y, r } in CSS px or null; hover: { cardId, x, y, rect }
   * in CSS px (rect = [x0, y0, x1, y1]) for a real pointer hover, or null.
   */
  function update(time, delta, { width, height, crystal, hover, inHero, masks = [], idleOff = false, volume = 0, ringOn = 1, gain = 1, spread = 1, tint = 0 }) {
    u.uGain.value += (gain - u.uGain.value) * (1 - Math.exp(-3 * Math.min(delta, 0.05)))
    u.uVolume.value += (volume - u.uVolume.value) * (1 - Math.exp(-2.4 * Math.min(delta, 0.05)))
    u.uRingOn.value = ringOn
    u.uTintAmount.value = tint
    u.uSpread.value += (spread - u.uSpread.value) * (1 - Math.exp(-3 * Math.min(delta, 0.05)))
    const dt = Math.min(delta, 0.05)
    const active = Boolean(inHero && crystal && hover)
    if (active) {
      if (targetId !== hover.cardId) {
        if (targetId != null) reach = Math.min(reach, 0.25)
        targetId = hover.cardId
      }
      u.uTarget.value.set(hover.x, hover.y)
      u.uRect.value.set(...hover.rect)
    }
    const goal = active ? 1 : 0
    strength += (goal - strength) * (1 - Math.exp(-(active ? 6 : 3.2) * dt))
    reach += (goal - reach) * (1 - Math.exp(-(active ? 4.2 : 2.4) * dt))
    if (!active && strength < 0.01) targetId = null
    const idleGoal = inHero && crystal && !idleOff ? 1 : 0
    idle += (idleGoal - idle) * (1 - Math.exp(-(idleGoal ? 1.6 : 6) * dt))

    u.uStrength.value = strength
    u.uReach.value = reach
    u.uIdle.value = idle
    u.uTime.value = time
    // Follow the crystal's turn smoothly, without its jitter.
    if (crystal && Number.isFinite(crystal.spin)) {
      // Plus a slow idle turn of its own, the same way as the white
      // light over the crystal, so the rays drift even when nobody drags.
      spin += (crystal.spin * 0.42 + time * 0.06 - spin) * (1 - Math.exp(-2.5 * dt))
    }
    u.uSpin.value = spin
    if (crystal && Number.isFinite(crystal.spin)) {
      spin2 += (crystal.spin * 0.42 - time * 0.09 - spin2) * (1 - Math.exp(-2.5 * dt))
    }
    u.uSpin2.value = spin2
    mesh.visible = Boolean(crystal) && (strength > 0.003 || idle > 0.003)
    if (!mesh.visible) return
    u.uRes.value.set(width, height)
    const count = Math.min(masks.length, 16)
    for (let i = 0; i < count; i += 1) {
      const [a, b, c, d] = masks[i]
      u.uMaskA.value[i].set(a[0], a[1], b[0], b[1])
      u.uMaskB.value[i].set(c[0], c[1], d[0], d[1])
    }
    u.uMaskCount.value = count
    u.uOrigin.value.set(crystal.x, crystal.y)
    u.uCrystalR.value = Math.max(24, crystal.r)
  }

  return {
    object: mesh,
    update,
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
