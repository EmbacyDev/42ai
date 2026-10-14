import * as THREE from 'three'

const FLOW_COLOR_KEYS = [
  'friendFlowColor1',
  'friendFlowColor2',
  'friendFlowColor3',
  'friendFlowColor4',
  'friendFlowColor5',
]

function getFlowPalette(config) {
  const count = THREE.MathUtils.clamp(Math.round(config.friendColorCount ?? 4), 1, 5)
  const colors = []
  for (let i = 0; i < count; i += 1) {
    const hex = config[FLOW_COLOR_KEYS[i]]
    if (hex) colors.push(hex)
  }
  return colors.length ? colors : ['#ffffff']
}

// The soft shape a ray is drawn with. A flat rectangle carries no shading
// of its own — this alpha mask is what makes it read as a glow instead of
// a coloured panel: bright in a soft patch near the crystal end (u≈0.14),
// long soft tail fading to nothing by the tip (u=1), and fading to
// nothing at the top/bottom edges too (v=0/1), so there is no straight
// edge anywhere on the shape. Built once and shared by every ray — only
// the mesh's own tint colour differs per ray.
function createRayTexture() {
  const w = 256
  const h = 64
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  const along = ctx.createLinearGradient(0, 0, w, 0)
  along.addColorStop(0, 'rgba(255,255,255,0)')
  along.addColorStop(0.14, 'rgba(255,255,255,1)')
  along.addColorStop(0.4, 'rgba(255,255,255,0.55)')
  along.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = along
  ctx.fillRect(0, 0, w, h)

  // Multiply in the cross fade so the corners never show a hard edge.
  ctx.globalCompositeOperation = 'destination-in'
  const across = ctx.createLinearGradient(0, 0, 0, h)
  across.addColorStop(0, 'rgba(255,255,255,0)')
  across.addColorStop(0.5, 'rgba(255,255,255,1)')
  across.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = across
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// A plain rectangle, left edge at the local origin, extending outward
// along local +X — rotating its parent group around Y then sweeps it to
// any direction in the horizontal plane, so the geometry itself never
// needs to change. All the shape's softness comes from createRayTexture
// above, not from the geometry.
function createRayGeometry(length, width) {
  const geometry = new THREE.PlaneGeometry(length, width)
  geometry.translate(length / 2, 0, 0)
  return geometry
}

function createHoverBeamGeometry() {
  const geometry = new THREE.BufferGeometry()
  // A broad sheet, almost the same height at both ends. The old taper read
  // as a projector cone; the wave bands are painted inside this sheet and
  // the shader feathers every edge so the quad itself stays invisible.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, -1.2, 0,
    0, 1.2, 0,
    1, -1.2, 0,
    1, 1.2, 0,
  ], 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0,
    0, 1,
    1, 0,
    1, 1,
  ], 2))
  geometry.setIndex([0, 2, 1, 2, 3, 1])
  geometry.computeVertexNormals()
  return geometry
}

// A large, softly radial (fades to nothing well before its own edge, same
// idea as the ray texture but symmetric) glow disc, parked well behind the
// portrait shell. The point/spot lights above only reach the few cards
// close enough to be inside their falloff distance — this is what puts
// colour on the empty background around and behind the far cards too, so
// the crystal's light reads as filling the whole scene, not just the
// cards nearest to it.
function createGlowTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// A slow, transparent colour field behind the portrait shell. The RGB
// bands are deliberately offset from one another: at the edges of every
// moving ribbon they separate into a restrained chromatic-aberration
// fringe, while the centre stays a soft mixed haze. Because the plane is
// behind every card and keeps depth testing, none of this is painted over
// the photographs themselves.
function createFlowVeil(config) {
  const violet = new THREE.Color(config.friendFlowColor1 ?? '#756cff')
  const green = new THREE.Color(config.friendFlowColor2 ?? '#29ae57')
  const blue = new THREE.Color(config.friendFlowColor3 ?? '#1d81ed')
  const yellow = new THREE.Color(config.friendFlowColor4 ?? '#f0ff1f')
  const white = new THREE.Color('#ffffff')
  const paleGreen = green.clone().lerp(white, 0.22)
  // v4: far less blue and violet — they read as dark spots under the copy.
  // Both are mostly white now and violet is only one faint ribbon.
  const paleBlue = blue.clone().lerp(white, 0.68)
  const paleViolet = violet.clone().lerp(white, 0.78)
  const colors = [paleBlue, green, paleViolet, white, paleGreen]
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor0: { value: colors[0] },
      uColor1: { value: colors[1] },
      uColor2: { value: colors[2] },
      uColor3: { value: colors[3] },
      uColor4: { value: colors[4] },
      uYellow: { value: yellow },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColor0;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform vec3 uColor4;
      uniform vec3 uYellow;

      float rayShape(
        vec2 p,
        float angle,
        float width,
        float rayLength,
        float waveAmount,
        float frequency,
        float phase
      ) {
        float t = uTime;
        // Direction is only the hidden scaffold. Offset the origin inside
        // the crystal and bend the coordinate field before evaluating it,
        // so the result never exposes a set of straight radial spokes.
        vec2 innerOffset = vec2(cos(phase * 1.37), sin(phase * 1.11)) * 0.055;
        p -= innerOffset;
        float fieldWarp = sin(p.y * 3.1 + t * 0.14 + phase)
                        + cos(p.x * 2.4 - t * 0.11 + phase * 0.7);
        p += vec2(
          sin(p.y * 4.3 - t * 0.17 + phase),
          cos(p.x * 3.7 + t * 0.13 - phase)
        ) * (0.025 + 0.018 * fieldWarp);
        angle += sin(t * (0.075 + phase * 0.006) + phase) * 0.085;
        vec2 direction = vec2(cos(angle), sin(angle));
        vec2 normal = vec2(-direction.y, direction.x);
        float along = dot(p, direction);
        float progress = clamp(along / rayLength, 0.0, 1.0);
        float across = dot(p, normal);
        float wave = sin(along * frequency - t * (0.2 + phase * 0.018) + phase)
                   * waveAmount * (0.3 + progress * 0.7);
        wave += sin(along * frequency * 0.47 + t * 0.12 + phase * 1.7)
              * waveAmount * 0.42;
        float breathingWidth = 0.78
                             + 0.28 * sin(along * 5.1 - t * 0.23 + phase)
                             + 0.16 * sin(along * 9.3 + t * 0.17 - phase * 0.8);
        float spread = width * (0.72 + progress * 1.28) * breathingWidth;
        float primary = exp(-pow((across - wave) / max(spread, 0.001), 2.0));
        // A displaced secondary fold reads as refraction/caustics. It
        // merges back into the main body instead of tracing another line.
        float foldOffset = sin(along * 3.8 + t * 0.16 + phase * 1.9)
                         * spread * (1.1 + progress * 0.65);
        float secondary = exp(-pow(
          (across - wave - foldOffset) / max(spread * 1.65, 0.001),
          2.0
        ));
        float breakup = 0.52 + 0.48 * smoothstep(
          -0.35,
          0.72,
          sin(along * 7.4 - t * 0.29 + phase)
            + cos(across * 8.2 + t * 0.18 - phase * 1.3) * 0.55
        );
        float band = (primary * 0.62 + secondary * 0.42) * breakup;
        float leaveCentre = smoothstep(0.025, 0.17, along);
        float dissolve = 1.0 - smoothstep(rayLength * 0.7, rayLength, along);
        float floatPulse = 0.82 + 0.18 * sin(t * 0.31 + along * 4.2 + phase);
        return band * leaveCentre * dissolve * floatPulse;
      }

      void main() {
        // The plane is larger than the view so its edge stays off screen.
        // Coordinates stay locked to the original field size.
        vec2 world = (vUv - 0.5) * vec2(26.0, 16.0);
        vec2 p = vec2(world.x * (3.36 / 14.5), world.y * (2.0 / 8.6));

        float r0 = rayShape(p, 0.08, 0.105, 2.08, 0.11, 5.6, 0.4);
        float r1 = rayShape(p, 0.72, 0.18, 1.04, 0.15, 4.2, 1.7);
        float r2 = rayShape(p, 1.38, 0.125, 1.68, 0.12, 6.2, 2.8);
        float r3 = rayShape(p, 2.12, 0.21, 1.34, 0.17, 3.8, 4.2);
        float r4 = rayShape(p, 2.76, 0.115, 0.92, 0.13, 5.9, 5.4);
        float r5 = rayShape(p, 3.48, 0.19, 1.92, 0.16, 4.0, 6.6);
        float r6 = rayShape(p, 4.18, 0.095, 2.12, 0.105, 6.8, 7.8);
        float r7 = rayShape(p, 4.92, 0.155, 1.16, 0.145, 4.6, 8.9);
        float r8 = rayShape(p, 5.62, 0.13, 1.54, 0.12, 5.2, 10.1);

        float yellowAccent = r6 * 0.36;
        float weight = r0 + r1 + r2 + r3 + r4 + r5
                     + yellowAccent + r7 + r8;
        vec3 light = uColor0 * r0
                   + uColor1 * r1
                   + uColor2 * r2
                   + uColor3 * r3
                   + uColor4 * r4
                   + mix(uColor0, uColor1, 0.5) * r5
                   + uYellow * yellowAccent
                   + mix(uColor0, uColor1, 0.48) * r7
                   + mix(uColor2, uColor4, 0.34) * r8;
        light /= max(weight, 0.001);
        // Keep the palette chromatic on the pale hero background. Gamma
        // lifts its luminance; normalising by the strongest channel keeps
        // blue and green distinct instead of averaging to grey.
        light = pow(max(light, vec3(0.001)), vec3(0.84));
        light /= max(max(light.r, light.g), light.b);
        // White flares sit on the brightest ribbons and drift through the
        // same field, so the colour stays but the peaks open into light.
        float ribbonPeak = smoothstep(0.28, 0.95, weight);
        vec2 flareA = vec2(sin(uTime * 0.19 + 0.4), cos(uTime * 0.15)) * vec2(0.42, 0.28);
        vec2 flareB = vec2(cos(uTime * 0.13 + 2.1), sin(uTime * 0.17 + 1.2)) * vec2(0.55, 0.32);
        vec2 flareC = vec2(sin(uTime * 0.11 + 4.0), cos(uTime * 0.21 + 2.6)) * vec2(0.36, 0.24);
        float blooms = exp(-dot(p - flareA, p - flareA) * 4.8) * 0.9
                     + exp(-dot(p - flareB, p - flareB) * 5.6) * 0.75
                     + exp(-dot(p - flareC, p - flareC) * 4.2) * 0.65;
        float flare = blooms * (0.45 + ribbonPeak);
        // Soft pool under the crystal. A flat white step here was reading
        // as a hard shape in the lower corners.
        float lower = exp(-pow((p.y + 0.62) * 1.35, 2.0));
        float bottomPool = lower * exp(-pow(p.x * 0.72, 2.0));
        // v4: no bottom pool, it read as a white patch in the lower right.
        float whiteLight = clamp(flare * 0.7, 0.0, 1.0);
        light = mix(light, vec3(1.0), whiteLight);

        float alpha = min(weight * 0.32 + flare * 0.14, 0.72) * uOpacity;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(light, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    blending: THREE.NormalBlending,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), material)
  // Just behind the furthest portrait, close enough that the ribbons still
  // read as originating at the crystal instead of as a distant wallpaper.
  mesh.position.set(0, 0, -3.72)
  mesh.renderOrder = -4
  return { mesh, material }
}

/**
 * Stands in for the light the real crystal shader (Glass.jsx, in the
 * separate PageCrystal canvas) emits from its own facets. That
 * shader can only light pixels inside its own canvas — it cannot light
 * the portrait planes, which are meshes in this vanilla-Three scene.
 *
 * Every colour in the crystal's own flow palette (friendFlowColor1-5, the
 * same gradient the facets are painted with) gets an orbiting "comet"
 * mesh (see createRayTexture) — that part is cheap, it's an unlit,
 * additive-blended quad, so having several costs almost nothing. Real
 * dynamic lights are not cheap the same way: a portrait card's material
 * is lit, so the fragment shader evaluates every active light in the
 * scene on every pixel of every card, each frame — one THREE.SpotLight
 * per colour (5 lights on top of the existing hemi/3×directional/1×point
 * from createScene.js) was what actually made the whole hero stutter.
 * Instead there is exactly one dynamic SpotLight, re-aimed and
 * re-coloured each frame to match whichever ray currently has the most
 * brightness in its fire-and-fade cycle — visually still "the light
 * chases the currently-flaring ray", at a fixed lighting cost regardless
 * of how many colours are in the palette. `penumbra` gives it a genuinely
 * soft-edged cone the way a real beam falls off, instead of a hard-edged
 * disc of illumination.
 *
 * A dim white core point light stays on underneath so the crystal still
 * reads as glowing between flares.
 *
 * distance/decay on the lights keep them from washing out the whole
 * shell: the nearest portrait cards sit roughly 2-3 units from the
 * crystal (see sceneConfig.sphere), the far side 6+ units out, so falloff
 * naturally fades to nothing well before the outer cards.
 */
// Short broken filaments leaving the crystal in every direction. Same
// near-white light as the card ray, kept small so the ray aimed at a
// card stays the one you notice.
// A small extra bloom around the crystal, taken from the softer hero.
// It sits behind the glass and stays close, so the rays on the cards
// remain the light you actually follow.
// Light leaving the crystal toward the camera, the same idea as the
// flash in the third block: a hot centre in front of the glass, crystal
// colours only, fading before it becomes a wash.
// White light spinning around Z. One arm stays on the background. A second
// shaft sits in front of the glass and is rotated on Z, so the light aimed
// at the viewer turns with the same sweep instead of orbiting the backdrop.
const Z_LIGHT_SHADER = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec2 uSize;
  uniform float uGain;

  void main() {
    vec2 q = (vUv - 0.5) * uSize;
    float sweep = uTime * 0.28; // v4: slower
    vec2 dir = vec2(cos(sweep), sin(sweep));
    vec2 d = q - dir * 2.6;
    float along = dot(d, dir);
    float across = dot(d, vec2(-dir.y, dir.x));
    // Round spot on the background. A wedge had a straight side that
    // cut the lower corners into a white shape.
    float spot = exp(-pow(along * 0.46, 2.0) - pow(across * 0.7, 2.0));
    float beam = spot * uOpacity * uGain;
    gl_FragColor = vec4(vec3(beam), beam);
  }
`

function createZLightMaterial(size, gain, blending, premultiplied) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uSize: { value: size },
      uGain: { value: gain },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: Z_LIGHT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: !premultiplied,
    toneMapped: false,
    blending,
    premultipliedAlpha: premultiplied,
  })
}

const USER_BEAM_SHADER = /* glsl */ `
  varying vec2 vUv;
  uniform float uOpacity;
  uniform float uGain;

  void main() {
    float across = (vUv.y - 0.5) * 2.0;
    float along = vUv.x;
    float arm = exp(-pow(across / 0.24, 2.0));
    // Peak stays where it was. The ends of the sheet go dark before the
    // rectangle, so that edge cannot draw a white corner.
    float body = exp(-pow((along - 0.36) * 7.4, 2.0));
    float beam = arm * body * uOpacity * uGain;
    if (beam < 0.001) discard;
    gl_FragColor = vec4(vec3(beam), beam);
  }
`

function createUserBeamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uGain: { value: 0.78 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: USER_BEAM_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    blending: THREE.NormalBlending,
    premultipliedAlpha: true,
    side: THREE.DoubleSide,
  })
}

function createZLight() {
  const backMaterial = createZLightMaterial(
    new THREE.Vector2(26, 16),
    0.72,
    THREE.AdditiveBlending,
    false,
  )
  const back = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), backMaterial)
  back.position.set(0, 0, -3.68)
  back.renderOrder = -3

  const beamMaterial = createUserBeamMaterial()
  const beamGeometry = new THREE.PlaneGeometry(7.4, 3.2)
  const pivot = new THREE.Group()
  const beam = new THREE.Mesh(beamGeometry, beamMaterial)
  // Tilt the shaft toward the camera so rotation around Z swings it
  // across the viewer, not around the backdrop.
  beam.position.set(1.45, 0, 1.35)
  beam.rotation.y = -0.62
  beam.renderOrder = 4
  beam.layers.set(1)
  const beamCross = new THREE.Mesh(beamGeometry, beamMaterial)
  beamCross.position.set(1.45, 0, 1.35)
  beamCross.rotation.order = 'YXZ'
  beamCross.rotation.y = -0.62
  beamCross.rotation.x = 1.05
  beamCross.renderOrder = 4
  beamCross.layers.set(1)
  pivot.add(beam)
  pivot.add(beamCross)
  return { back, backMaterial, pivot, beamGeometry, beamMaterial }
}

function createFacingGlow(config) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uViolet: { value: new THREE.Color(config.friendFlowColor1 ?? '#756cff') },
      uGreen: { value: new THREE.Color(config.friendFlowColor2 ?? '#29ae57') },
      uBlue: { value: new THREE.Color(config.friendFlowColor3 ?? '#1d81ed') },
      uAcid: { value: new THREE.Color(config.friendFlowColor4 ?? '#f0ff1f') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uViolet;
      uniform vec3 uGreen;
      uniform vec3 uBlue;
      uniform vec3 uAcid;

      void main() {
        vec2 p = vUv - 0.5;
        float radius = length(p) * 2.0;
        float core = exp(-pow(radius * 2.15, 2.0));
        float halo = exp(-pow(radius * 1.72, 2.0));
        vec3 green = min(pow(uGreen, vec3(0.32)) * 1.35, vec3(1.0));
        vec3 blue = min(pow(uBlue, vec3(0.32)) * 1.35, vec3(1.0));
        vec3 tint = mix(blue, green, 0.5);
        vec3 color = mix(tint, vec3(1.0), smoothstep(0.08, 0.82, core));
        float pulse = 0.55 + 0.45 * (0.5 + 0.5 * sin(uTime * 1.8));
        float alpha = halo * 1.05 * uOpacity * pulse;
        if (alpha < 0.006) discard;
        alpha = min(alpha, 0.5);
        gl_FragColor = vec4(color * alpha, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    blending: THREE.NormalBlending,
    premultipliedAlpha: true,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 2.15), material)
  return { mesh, material }
}

function createSoftAura(config) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uViolet: { value: new THREE.Color(config.friendFlowColor1 ?? '#756cff') },
      uGreen: { value: new THREE.Color(config.friendFlowColor2 ?? '#29ae57') },
      uBlue: { value: new THREE.Color(config.friendFlowColor3 ?? '#1d81ed') },
      uAcid: { value: new THREE.Color(config.friendFlowColor4 ?? '#f0ff1f') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uViolet;
      uniform vec3 uGreen;
      uniform vec3 uBlue;
      uniform vec3 uAcid;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        p.x *= 1.12;
        float radius = length(p);
        float t = uTime;

        // Several offset clouds orbit at different speeds. Their overlap
        // produces a changing pearlescent halo instead of one flat radial
        // disc or a full-background colour wash.
        vec2 c0 = vec2(cos(t * 0.19), sin(t * 0.16)) * vec2(0.28, 0.18);
        vec2 c1 = vec2(cos(t * 0.13 + 2.1), sin(t * 0.21 + 1.4)) * vec2(0.34, 0.22);
        vec2 c2 = vec2(cos(t * 0.17 + 4.0), sin(t * 0.12 + 3.2)) * vec2(0.3, 0.2);
        float cloud0 = exp(-dot(p - c0, p - c0) * 3.5);
        float cloud1 = exp(-dot(p - c1, p - c1) * 4.2);
        float cloud2 = exp(-dot(p - c2, p - c2) * 3.8);
        float ring = exp(-pow((radius - 0.42) * 2.5, 2.0));
        float edge = 1.0 - smoothstep(0.58, 1.0, radius);
        // Keep the centre quieter: the crystal itself supplies the hot
        // highlights; this layer should expand around its silhouette.
        float centreCut = smoothstep(0.16, 0.42, radius);
        float density = (cloud0 * 0.42 + cloud1 * 0.34 + cloud2 * 0.32 + ring * 0.22)
                      * edge * centreCut;

        float flow = 0.5 + 0.5 * sin(t * 0.22 + p.x * 2.4 - p.y * 1.7);
        vec3 colorA = mix(uViolet, uGreen, flow);
        vec3 colorB = mix(uBlue, uAcid, 1.0 - flow);
        vec3 spectral = mix(colorA, colorB, 0.5 + 0.5 * sin(t * 0.15 + radius * 5.0));
        vec3 green = min(pow(uGreen, vec3(0.32)) * 1.42, vec3(1.0));
        vec3 blue = min(pow(uBlue, vec3(0.32)) * 1.42, vec3(1.0));
        vec3 softBase = mix(green, blue, 0.45);
        vec3 color = mix(softBase, spectral, 0.42);
        color = mix(color, vec3(1.0), 0.38);
        float breathe = 0.86 + 0.14 * sin(t * 0.39 + radius * 3.0);
        float alpha = density * 0.58 * breathe * uOpacity;
        if (alpha < 0.004) discard;
        alpha = min(alpha, 0.28);
        gl_FragColor = vec4(color * alpha, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    blending: THREE.NormalBlending,
    premultipliedAlpha: true,
    side: THREE.DoubleSide,
  })
  // Larger than the crystal but still tightly local to it; the shader
  // reaches transparency before the geometry's edge.
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.6), material)
  return { mesh, material }
}

function createAmbientRays(config) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.95 },
      uViolet: { value: new THREE.Color(config.friendFlowColor1 ?? '#756cff') },
      uGreen: { value: new THREE.Color(config.friendFlowColor2 ?? '#29ae57') },
      uBlue: { value: new THREE.Color(config.friendFlowColor3 ?? '#1d81ed') },
      uAcid: { value: new THREE.Color(config.friendFlowColor4 ?? '#f0ff1f') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uViolet;
      uniform vec3 uGreen;
      uniform vec3 uBlue;
      uniform vec3 uAcid;

      void main() {
        vec2 p = vUv - 0.5;
        float radius = length(p) * 2.0;
        float t = uTime;
        float core = exp(-pow(radius * 2.15, 2.0));
        float halo = exp(-pow(radius * 1.85, 2.0));
        vec3 green = min(pow(uGreen, vec3(0.32)) * 1.35, vec3(1.0));
        vec3 blue = min(pow(uBlue, vec3(0.32)) * 1.35, vec3(1.0));
        vec3 tint = mix(blue, green, 0.45 + 0.12 * sin(t * 0.4));
        vec3 color = mix(tint, vec3(1.0), smoothstep(0.05, 0.8, core));
        float pulse = 0.55 + 0.45 * (0.5 + 0.5 * sin(t * 1.8));
        float alpha = halo * 0.32 * uOpacity * pulse;
        if (alpha < 0.006) discard;
        alpha = min(alpha, 0.22);
        gl_FragColor = vec4(color * alpha, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    blending: THREE.NormalBlending,
    premultipliedAlpha: true,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 2.05), material)
  mesh.position.set(0, 0, 0)
  return { mesh, material }
}

export function createCrystalLight(crystalPosition, config) {
  if (!config) return { object: null, update() {}, dispose() {} }

  const center = crystalPosition.position
  const palette = getFlowPalette(config)
  const orbitSpeed = THREE.MathUtils.clamp(config.friendLightMotion ?? 0.15, 0.05, 0.6)
  const pulseAmount = THREE.MathUtils.clamp(config.friendPulse ?? 0.1, 0, 0.4)
  const orbitRadius = 0.4
  const rayLength = 5.2
  const rayWidth = 1.45

  const root = new THREE.Group()
  root.position.set(center[0], center[1], center[2])

  // Same light source as V1, but its intensity is gated by hover below.
  const core = new THREE.PointLight(new THREE.Color(config.friendCenterColor ?? '#fff4e8'), 0, 10, 1.7)
  root.add(core)

  const dynamicSpot = new THREE.SpotLight(new THREE.Color('#ffffff'), 0, 11, Math.PI / 6, 0.9, 1.5)
  const dynamicTarget = new THREE.Object3D()
  root.add(dynamicSpot)
  root.add(dynamicTarget)
  dynamicSpot.target = dynamicTarget

  // Sits behind the whole portrait shell (shell radius ~3.75, see
  // sceneConfig.sphere) so it never draws over a card, only in the gaps
  // between them and past their outer edge — one big wash, colour-mixed
  // each frame from whichever rays currently have the most brightness, so
  // it drifts through the same palette instead of sitting on one colour.
  const glowTexture = createGlowTexture()
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 13),
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  glow.position.set(0, 0, -5.5)
  root.add(glow)
  const glowColor = new THREE.Color()
  const flowVeil = createFlowVeil(config)
  root.add(flowVeil.mesh)
  const zLight = createZLight()
  root.add(zLight.back)
  root.add(zLight.pivot)

  const rayGeometry = createRayGeometry(rayLength, rayWidth)
  const rayTexture = createRayTexture()
  // Layered light between the crystal and the glanced-at portrait. Several
  // soft bands share one sheet so they overlap in the air; none of them is
  // a cone or a hard core.
  const hoverBeamGeometry = createHoverBeamGeometry()
  const hoverBeamMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      // 0 shows the whole sheet. The pass behind the photo starts later,
      // so it does not double the piece that stays in front.
      uStart: { value: 0 },
      // 0 is inside the crystal, 1 has reached the card.
      uReach: { value: 0 },
      // Local along = 1 is this far along the whole ray. The front sheet
      // covers only the near part, so both passes share one haze.
      uSpan: { value: 1 },
      // Sheet height divided by ray length, so a cloud stays round
      // instead of stretching into a stripe.
      uRound: { value: 1 },
      // Fades the front sheet before its straight far edge.
      uTipFade: { value: 0 },
      // The colours flowing inside the crystal. No extra hues.
      uViolet: { value: new THREE.Color(config.friendFlowColor1 ?? '#756cff') },
      uGreen: { value: new THREE.Color(config.friendFlowColor2 ?? '#29ae57') },
      uBlue: { value: new THREE.Color(config.friendFlowColor3 ?? '#1d81ed') },
      uAcid: { value: new THREE.Color(config.friendFlowColor4 ?? '#f0ff1f') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uStart;
      uniform float uReach;
      uniform float uSpan;
      uniform float uRound;
      uniform float uTipFade;
      uniform vec3 uViolet;
      uniform vec3 uGreen;
      uniform vec3 uBlue;
      uniform vec3 uAcid;

      void main() {
        float along = clamp(vUv.x, 0.0, 1.0);
        float alongW = along * uSpan;
        float t = uTime;
        // The light breathes and meanders like the colour inside the
        // crystal instead of holding one rigid projector axis.
        float drift = sin(alongW * 5.4 - t * 0.38) * 0.035
                    + sin(alongW * 10.2 + t * 0.21) * 0.016;
        float across = vUv.y - 0.5 + drift;
        float reach = clamp(uReach, 0.0, 1.0);
        // Gone before either long edge of the sheet, so those edges
        // cannot read as two lines.
        float body = exp(-pow(abs(across) * 3.4, 2.0));
        float open = 1.0 - smoothstep(max(reach - 0.16, 0.0), reach + 0.02, alongW);
        float dissolve = exp(-pow(alongW * 1.28, 2.0));
        vec3 violet = min(pow(uViolet, vec3(0.42)) * 1.08, vec3(1.0));
        vec3 green = min(pow(uGreen, vec3(0.32)) * 1.35, vec3(1.0));
        vec3 blue = min(pow(uBlue, vec3(0.32)) * 1.35, vec3(1.0));
        vec3 acid = min(pow(uAcid, vec3(0.48)) * 1.02, vec3(1.0));
        float paletteFlow = 0.5 + 0.5 * sin(t * 0.29 + alongW * 3.8);
        vec3 tintA = mix(blue, green, paletteFlow);
        // Yellow appears only as a small travelling accent. Letting the
        // full acid colour take over this branch was what made the field
        // flash unevenly yellow.
        vec3 tintB = mix(blue, acid, (1.0 - paletteFlow) * 0.16);
        vec3 tint = mix(tintA, tintB, 0.5 + 0.5 * sin(t * 0.19 - alongW * 2.6));
        vec3 color = mix(tint, vec3(1.0), smoothstep(0.32, 0.96, body) * 0.68);
        float behind = smoothstep(uStart, min(uStart + 0.12, 1.0), along);
        float breathe = 0.82 + 0.18 * sin(t * 0.55 + alongW * 4.0);
        float alpha = body * dissolve * 0.52 * open * behind * breathe * uOpacity;
        if (alpha < 0.008) discard;
        alpha = min(alpha, 0.16);
        gl_FragColor = vec4(color * alpha, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    blending: THREE.NormalBlending,
    premultipliedAlpha: true,
    side: THREE.DoubleSide,
  })
  const hoverBeam = new THREE.Mesh(hoverBeamGeometry, hoverBeamMaterial)
  hoverBeam.renderOrder = 2
  hoverBeam.position.set(0, 0, 0)
  // Same transparent foreground layer used by cards while they fly out of
  // the crystal. This is the only layer where the ray can visibly begin
  // inside the real PageCrystal and still brush the photograph.
  hoverBeam.layers.set(1)
  root.add(hoverBeam)
  // The long continuation lives in the portrait scene, under the hovered
  // card, so the photograph covers the middle of the ray.
  const hoverBeamBack = new THREE.Mesh(hoverBeamGeometry, hoverBeamMaterial.clone())
  hoverBeamBack.renderOrder = 1
  hoverBeamBack.position.set(0, 0, 0)
  hoverBeamBack.layers.set(0)
  root.add(hoverBeamBack)

  // A compact radial flare hides the geometric start of the plume and
  // makes the ray visibly originate inside the crystal. It shares the same
  // fully soft texture as the old V1 crystal glow, but stays local so the
  // beam remains much brighter than the crystal itself.
  const sourceGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.42, 1.42),
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    }),
  )
  sourceGlow.position.set(0, 0, -0.02)
  sourceGlow.renderOrder = 1.9
  sourceGlow.layers.set(1)
  root.add(sourceGlow)

  // A short leak in every direction, always on, much quieter than the ray
  // that reaches a card. It lives on the portrait canvas, so the glass
  // covers its middle and only the tips show around the crystal.
  const facingGlow = createFacingGlow(config)
  facingGlow.mesh.position.set(0, 0, 0.42)
  facingGlow.mesh.renderOrder = 1.85
  facingGlow.mesh.layers.set(1)
  root.add(facingGlow.mesh)
  const softAura = createSoftAura(config)
  softAura.mesh.renderOrder = -2
  softAura.mesh.layers.set(0)
  // The former green disc was concentrated directly behind the crystal.
  // Its colour now belongs to the screen-wide flow veil instead.
  softAura.mesh.visible = false
  root.add(softAura.mesh)
  const ambientRays = createAmbientRays(config)
  ambientRays.mesh.renderOrder = -1
  ambientRays.mesh.layers.set(0)
  ambientRays.mesh.visible = false
  root.add(ambientRays.mesh)
  // The same short rays, drawn above the glass, so they read on every
  // side of the crystal and not only where the gem is transparent.
  const ambientFront = new THREE.Mesh(ambientRays.mesh.geometry, ambientRays.material)
  ambientFront.renderOrder = 1.4
  ambientFront.layers.set(1)
  // The expanded iridescent aura now lives behind the crystal. Keeping a
  // duplicate of the whole radial layer in the foreground was what turned
  // the effect into a permanent wash over the glass.
  ambientFront.visible = false
  root.add(ambientFront)

  const orbiters = palette.map((hex, i) => {
    const color = new THREE.Color(hex)
    const group = new THREE.Group()

    const ray = new THREE.Mesh(
      rayGeometry,
      new THREE.MeshBasicMaterial({
        map: rayTexture,
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.NormalBlending,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    )
    group.add(ray)

    root.add(group)
    return {
      group,
      ray,
      color,
      angleOffset: (i / palette.length) * Math.PI * 2,
      heightOffset: (i % 2 === 0 ? 1 : -1) * 0.18,
      // Each ray fires on its own clock, not in lockstep — a different
      // period per colour (not just a phase offset on a shared one) so
      // they drift in and out of sync instead of repeating the same
      // pattern every cycle.
      firePeriod: 2.3 + i * 0.55,
      firePhase: i / palette.length,
      currentAngle: 0,
    }
  })

  const dynamicSpotDirection = new THREE.Vector3()
  const shownAim = new THREE.Vector3(0, 0, -2)
  const shownFront = new THREE.Vector2()
  const pendingAim = new THREE.Vector3()
  const pendingFront = new THREE.Vector2()
  const hoverOrigin = new THREE.Vector3(0, 0, 0)
  const hoverWhite = new THREE.Color('#fff8f2')
  const hoverBeamDirection = new THREE.Vector2()
  let hoverStrength = 0
  let frontStrength = 0
  let fieldStrength = 0
  let lastAimTime = -1
  let beamCardId = null
  let pendingCardId = null
  // idle → out (leave the crystal) → hold → in (return into the crystal).
  // A new card never swings the current ray. The ray finishes going back
  // in, then a new one leaves toward that card.
  let beamPhase = 'idle'
  let beamReach = 0
  let beamFrom = 0
  let beamTo = 0
  let beamT = 1
  let beamDwell = 0
  const BEAM_IN_DURATION = 0.82
  const BEAM_OUT_DURATION = 0.94
  const BEAM_DWELL = 0.24

  const beginBeam = (phase, target) => {
    beamPhase = phase
    beamFrom = beamReach
    beamTo = target
    beamT = 0
  }

  return {
    object: root,
    isFrontActive() {
      return frontStrength > 0.004
        || zLight.beamMaterial.uniforms.uOpacity.value > 0.04
    },
    update(time, aim = null, { heroReady = false } = {}) {
      // Nothing leaves the crystal during its own grow or while portraits
      // are still flying. The light sequence starts only once the complete
      // hero composition has settled.
      const aimLocal = heroReady ? (aim?.isVector3 ? aim : aim?.far ?? null) : null
      const frontAim = heroReady ? (aim?.front ?? null) : null
      // V1's light is now interaction-only: no card receives it until the
      // pointer activates one of the portrait hit areas.
      core.intensity = 0
      flowVeil.material.uniforms.uTime.value = time
      zLight.backMaterial.uniforms.uTime.value = time
      zLight.pivot.rotation.z = time * 0.28
      hoverBeam.material.uniforms.uTime.value = time
      hoverBeamBack.material.uniforms.uTime.value = time
      ambientRays.material.uniforms.uTime.value = time
      softAura.material.uniforms.uTime.value = time
      facingGlow.material.uniforms.uTime.value = time

      if (!heroReady) {
        // The first scroll tick must remove every part of the lighting
        // system in the same frame: background field, card beam, front
        // glint and real lights. Do not let the normal slow easing leave a
        // coloured afterimage over block two.
        fieldStrength = 0
        hoverStrength = 0
        frontStrength = 0
        beamPhase = 'idle'
        beamReach = 0
        beamCardId = null
        pendingCardId = null
        lastAimTime = time
        core.intensity = 0
        dynamicSpot.intensity = 0
        glow.material.opacity = 0
        flowVeil.material.uniforms.uOpacity.value = 0
        zLight.backMaterial.uniforms.uOpacity.value = 0
        zLight.beamMaterial.uniforms.uOpacity.value = 0
        softAura.material.uniforms.uOpacity.value = 0
        facingGlow.material.uniforms.uOpacity.value = 0
        hoverBeam.material.uniforms.uOpacity.value = 0
        hoverBeamBack.material.uniforms.uOpacity.value = 0
        sourceGlow.material.opacity = 0
        return
      }

      let totalBrightness = 0
      let r = 0
      let g = 0
      let b = 0
      let brightest = null
      let brightestValue = 0
      for (const orbiter of orbiters) {
        const angle = orbiter.angleOffset + time * orbitSpeed
        orbiter.currentAngle = angle
        // Screen-facing streams sit behind the portrait shell. The old
        // Y-rotation turned most quads edge-on to the camera, while
        // additive blending erased the rest against white — together they
        // made the requested seepage effectively invisible.
        orbiter.group.position.set(
          Math.cos(angle) * orbitRadius,
          orbiter.heightOffset + Math.sin(angle * 1.7) * 0.12,
          -3.68,
        )
        orbiter.group.rotation.y = 0
        orbiter.group.rotation.z = angle

        // Fire-and-fade: born faint and short right at the crystal,
        // stretches outward as it "flies" while brightening, then fades
        // back to nothing as it dissolves — never a static beam.
        const cyclePos = (((time / orbiter.firePeriod) + orbiter.firePhase) % 1 + 1) % 1
        const brightness = Math.sin(cyclePos * Math.PI)
        orbiter.ray.scale.x = 0.25 + cyclePos * 1.1
        // The visible leakage now belongs to the crystal's own canvas
        // (CrystalLeakage.jsx). These older background quads created the
        // detached grey wisps on white, so keep them as light-direction
        // drivers only and do not paint them.
        orbiter.ray.material.opacity = 0

        totalBrightness += brightness
        r += orbiter.color.r * brightness
        g += orbiter.color.g * brightness
        b += orbiter.color.b * brightness
        if (brightness > brightestValue) {
          brightestValue = brightness
          brightest = orbiter
        }
      }

      // The one real light in the rig chases whichever ray is currently
      // flaring brightest — same "light follows the flare" read as before,
      // one SpotLight's worth of shader cost instead of one per colour.
      if (brightest) {
        dynamicSpot.position.set(
          Math.cos(brightest.currentAngle) * 0.22,
          brightest.heightOffset * 0.45,
          0.18,
        )
        dynamicSpotDirection.set(
          Math.cos(brightest.currentAngle),
          Math.sin(brightest.currentAngle) * 0.55,
          -0.35,
        ).normalize()
        dynamicTarget.position.copy(brightest.group.position).addScaledVector(dynamicSpotDirection, rayLength)
        dynamicSpot.color.copy(brightest.color)
        dynamicSpot.intensity = 0
      }

      // The light stays out. It brightens and softens on one clock.
      // A new card is taken up during the quiet part of that same pulse,
      // so one edge does not grow out after a pause and then another.
      const dt = lastAimTime < 0
        ? 0.016
        : Math.min(Math.max(time - lastAimTime, 0), 0.05)
      lastAimTime = time
      const fieldTarget = heroReady ? 1 : 0
      fieldStrength += (fieldTarget - fieldStrength) * (1 - Math.exp(-1.25 * dt))
      flowVeil.material.uniforms.uOpacity.value = 1.05 * fieldStrength
      zLight.backMaterial.uniforms.uOpacity.value = 0.85 * fieldStrength
      zLight.beamMaterial.uniforms.uOpacity.value = 0 // v4: this front shaft drew the hard white patch in the lower right
      softAura.material.uniforms.uOpacity.value = 0.84 * fieldStrength
      const pulseWave = 0.5 + 0.5 * Math.sin(time * 0.46)
      const glowPulse = 0.82 + 0.18 * pulseWave
      const aimCardId = aim && !aim.isVector3 ? (aim.cardId ?? null) : null
      if (aimLocal) {
        pendingAim.copy(aimLocal)
        if (frontAim) pendingFront.set(frontAim.x, frontAim.y)
        else pendingFront.set(aimLocal.x * 0.42, aimLocal.y * 0.42)
        pendingCardId = aimCardId
      } else {
        pendingCardId = null
      }

      const targetChanged = Boolean(
        aimLocal
        && beamCardId != null
        && (
          pendingCardId !== beamCardId
          || shownAim.distanceTo(pendingAim) > 0.65
        ),
      )

      if (beamPhase === 'idle' && aimLocal) {
        shownAim.copy(pendingAim)
        shownFront.copy(pendingFront)
        beamCardId = pendingCardId
        beamReach = 0
        beginBeam('out', 1)
      } else if (
        (beamPhase === 'hold' || beamPhase === 'out')
        && (!aimLocal || targetChanged)
      ) {
        // Never turn a visible beam toward the next card. First collect it
        // back into the crystal; its new direction is chosen only while
        // the visible reach is zero.
        beginBeam('in', 0)
      } else if (beamPhase === 'hold' && aimLocal && !targetChanged) {
        // Only compensate for the card's very small ambient drift. This is
        // intentionally much slower than the source's internal motion.
        const follow = 1 - Math.exp(-0.45 * dt)
        shownAim.lerp(pendingAim, follow)
        shownFront.lerp(pendingFront, follow)
      }

      if (beamPhase === 'out' || beamPhase === 'in') {
        const duration = beamPhase === 'out' ? BEAM_OUT_DURATION : BEAM_IN_DURATION
        beamT = Math.min(1, beamT + dt / duration)
        const eased = beamT * beamT * (3 - 2 * beamT)
        beamReach = beamFrom + (beamTo - beamFrom) * eased
        if (beamT >= 1) {
          if (beamPhase === 'out') {
            beamReach = 1
            beamPhase = 'hold'
          } else {
            beamReach = 0
            beamCardId = null
            if (aimLocal) {
              beamPhase = 'dwell'
              beamDwell = 0
            } else {
              beamPhase = 'idle'
            }
          }
        }
      } else if (beamPhase === 'dwell') {
        beamReach = 0
        beamDwell += dt
        if (!aimLocal) {
          beamPhase = 'idle'
        } else if (beamDwell >= BEAM_DWELL) {
          shownAim.copy(pendingAim)
          shownFront.copy(pendingFront)
          beamCardId = pendingCardId
          beginBeam('out', 1)
        }
      }

      const strengthTarget = aimLocal || beamPhase !== 'idle' ? 1 : 0
      const strengthRate = aimLocal ? 2.4 : 1.8
      hoverStrength += (strengthTarget - hoverStrength) * (1 - Math.exp(-strengthRate * dt))
      // Most of the time the beam is physically behind the page crystal.
      // A slow window lets a faint part of it occasionally roll across the
      // front facets, so it feels emitted by the object without becoming a
      // permanent wash laid over the glass.
      const frontWave = 0.5 + 0.5 * Math.sin(time * 0.31 - 1.2)
      const frontWindow = THREE.MathUtils.smoothstep(frontWave, 0.68, 0.94)
      frontStrength = hoverStrength * frontWindow * 0.16 * fieldStrength
      facingGlow.material.uniforms.uOpacity.value = frontStrength * 0.42
      const beamTrace = (window.__beamTrace ??= [])
      beamTrace.push([performance.now(), shownAim.x, shownAim.y, beamReach, beamPhase === 'in' ? 1 : 0])
      if (beamTrace.length > 300) beamTrace.shift()
      const beamVisible = hoverStrength > 0.001 && beamReach > 0.001
      if (beamVisible) {
        dynamicTarget.position.copy(shownAim)
        dynamicSpot.color.copy(hoverWhite)
        // The card lights up as the ray arrives, and goes dark as the ray
        // returns into the crystal.
        const arrival = THREE.MathUtils.smoothstep(beamReach, 0.72, 1)
        dynamicSpot.intensity = 11 * hoverStrength * glowPulse * arrival
        dynamicSpot.angle = Math.PI / 3.4
        dynamicSpot.penumbra = 1
        core.color.copy(hoverWhite)
        core.intensity = 2.2 * hoverStrength * glowPulse * arrival

        hoverBeamDirection.set(shownAim.x, shownAim.y)
        const beamLength = Math.max(0.01, hoverBeamDirection.length())
        // Leave through the face toward the current card. The exit point
        // stays there until the ray has gone back in; it does not travel
        // around the gem to the next card.
        const reachEase = THREE.MathUtils.smoothstep(beamReach, 0, 1)
        const emitRadius = 0.46 * reachEase
        const driftAmount = 0.2 + reachEase * 0.8
        const floatX = (Math.cos(time * 0.29) * 0.075 + Math.sin(time * 0.13) * 0.035) * driftAmount
        const floatY = (Math.sin(time * 0.24) * 0.065 + Math.cos(time * 0.17) * 0.03) * driftAmount
        const emitX = (shownAim.x / beamLength) * emitRadius + floatX
        const emitY = (shownAim.y / beamLength) * emitRadius + floatY
        const frontLength = Math.max(0.01, shownFront.length())
        const drawnFront = Math.max(0.05, frontLength - emitRadius)
        const drawnLength = Math.max(drawnFront, beamLength - emitRadius)
        const frontFraction = THREE.MathUtils.clamp(drawnFront / drawnLength, 0.08, 0.96)
        const sheetHeight = 2.4 * 1.22
        const round = sheetHeight / drawnLength
        const rotation = Math.atan2(hoverBeamDirection.y, hoverBeamDirection.x)
        const beamOpacity = Math.min(1, hoverStrength * 1.15) * glowPulse
        hoverOrigin.set(emitX, emitY, 0.12)
        dynamicSpot.position.copy(hoverOrigin)
        core.position.set(emitX, emitY, 0)
        hoverBeam.position.set(emitX, emitY, 0)
        hoverBeam.rotation.z = rotation
        // Stops short of the photograph. The rest of the ray continues
        // behind that photo on the portrait canvas.
        hoverBeam.scale.set(drawnFront, 1.22, 1)
        hoverBeam.material.uniforms.uStart.value = 0
        hoverBeam.material.uniforms.uReach.value = beamReach
        hoverBeam.material.uniforms.uSpan.value = frontFraction
        hoverBeam.material.uniforms.uRound.value = round
        hoverBeam.material.uniforms.uTipFade.value = 1
        hoverBeam.material.uniforms.uOpacity.value = beamOpacity * frontWindow * 0.16
        hoverBeamBack.position.set(emitX, emitY, 0)
        hoverBeamBack.rotation.z = rotation
        hoverBeamBack.scale.set(drawnLength, 1.22, 1)
        // The full soft sheet is always present behind the crystal. The
        // occasional front pass above is only a faint glint, not the beam's
        // main body, so there is no gap when that glint fades away.
        hoverBeamBack.material.uniforms.uStart.value = 0
        hoverBeamBack.material.uniforms.uReach.value = beamReach
        hoverBeamBack.material.uniforms.uSpan.value = 1
        hoverBeamBack.material.uniforms.uRound.value = round
        hoverBeamBack.material.uniforms.uTipFade.value = 0
        hoverBeamBack.material.uniforms.uOpacity.value = beamOpacity * 0.72
        sourceGlow.position.set(emitX, emitY, -0.02)
        sourceGlow.material.opacity = 0.1 * frontStrength
      } else {
        dynamicSpot.angle = Math.PI / 6
        hoverBeam.material.uniforms.uOpacity.value *= 0.82
        hoverBeamBack.material.uniforms.uOpacity.value *= 0.82
        sourceGlow.material.opacity *= 0.82
      }

      // The background wash mixes whichever colours are currently firing,
      // weighted by how bright each one is right now — so it drifts
      // through the palette instead of holding one flat colour, and its
      // own opacity rises and falls with the same flares instead of
      // sitting there as a constant tint.
      if (totalBrightness > 0.001) {
        glowColor.setRGB(r / totalBrightness, g / totalBrightness, b / totalBrightness)
        glow.material.color.copy(glowColor)
      }
      glow.material.opacity = 0
    },
    dispose() {
      rayGeometry.dispose()
      hoverBeamGeometry.dispose()
      hoverBeamMaterial.dispose()
      hoverBeamBack.material.dispose()
      rayTexture.dispose()
      glowTexture.dispose()
      glow.material.dispose()
      sourceGlow.geometry.dispose()
      sourceGlow.material.dispose()
      ambientRays.mesh.geometry.dispose()
      ambientRays.material.dispose()
      softAura.mesh.geometry.dispose()
      softAura.material.dispose()
      facingGlow.mesh.geometry.dispose()
      facingGlow.material.dispose()
      flowVeil.mesh.geometry.dispose()
      flowVeil.material.dispose()
      zLight.back.geometry.dispose()
      zLight.backMaterial.dispose()
      zLight.beamGeometry.dispose()
      zLight.beamMaterial.dispose()
      for (const orbiter of orbiters) {
        orbiter.ray.material.dispose()
      }
    },
  }
}
