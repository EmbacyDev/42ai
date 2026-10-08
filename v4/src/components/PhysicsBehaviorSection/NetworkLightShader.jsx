import { useEffect, useRef } from 'react'

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

const FRAGMENT = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float progress;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = mat2(1.62, 1.18, -1.18, 1.62) * p + 0.17;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy - 0.5;
  uv.x *= resolution.x / resolution.y;
  // A moving camera: the space turns slowly all the time and swings with
  // block five's progress (most on step two), so the points read as
  // floating in depth rather than over a still backdrop.
  float spin = time * 0.018 + progress * 2.2;
  uv = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * uv;
  uv *= 1.0 - 0.16 * sin(progress * 3.14159) + 0.04 * sin(time * 0.11);
  float t = time * 0.08;
  float n1 = fbm(uv * 1.55 + vec2(t, -t * 0.62));
  float n2 = fbm(uv * 2.35 + vec2(n1 * 1.15 - t * 0.4, n1 * 0.72 + t));
  vec2 warped = uv + vec2(n1 - 0.5, n2 - 0.5) * 0.28;

  // Lighter field in the crystal's own colours (it is the crystal's light
  // spread into a card), not the former deep navy.
  // The page's own blues, dark: the ocean/steel blue of the blog's teal
  // card (#2F74A4, #3D8EB8) over a near-black blue that sits next to the
  // #121212 of the blog and footer. No green.
  vec3 deep = vec3(0.043, 0.078, 0.125);    // #0B1420
  vec3 blue = vec3(0.118, 0.298, 0.431);    // #1E4C6E
  vec3 green = vec3(0.239, 0.557, 0.722);   // #3D8EB8 (light patches)
  vec3 violet = vec3(0.29, 0.416, 0.549);   // #4A6A8C (slate blue)
  vec3 color = mix(deep, blue, smoothstep(0.28, 0.78, n1 + uv.y * 0.2));
  color = mix(color, green, smoothstep(0.42, 0.92, n2 - uv.y * 0.3) * 0.85);
  color = mix(color, violet, smoothstep(0.58, 0.95, n1 - uv.x * 0.16) * 0.8);
  // Pools of the deepest blue give the field its darker outlines.
  color *= 0.62 + 0.5 * smoothstep(0.18, 0.62, fbm(warped * 1.6 - t * 0.3));

  // Light through space, after Shopify Editions: no bright star in the
  // middle, but many soft zoom-blurred streaks flying out of a wide, dim
  // glow. Noise on the direction only, drifting outward.
  vec2 corePos = vec2(0.02, 0.12);
  // Straight rays: measured on the unwarped plane.
  vec2 d = uv - corePos;
  float radius = length(d);
  float angle = atan(d.y, d.x);
  float flow = time * 0.22 - radius * 1.4;
  // Broad, heavily softened streaks: no fine high-frequency rays, so no
  // hard edges between them.
  // Fewer, wider streaks: softer and more blurred than before.
  float s1 = noise(vec2(angle * 8.0, flow));
  float s3 = noise(vec2(angle * 4.0 - 2.1, flow * 0.5));
  float streak = smoothstep(0.15, 1.0, 0.55 * s1 + 0.45 * s3);
  // Rays start a little away from the centre and fade far out.
  float reach = smoothstep(0.05, 0.35, radius) * exp(-radius * 0.7);
  float glow = exp(-radius * radius * 1.6);
  float halo = exp(-radius * 1.3);
  float veil = smoothstep(0.52, 0.9, fbm(warped * 2.2 + vec2(-t, t * 0.6))) * halo;
  // Each streak takes a hue of its own.
  float hue = noise(vec2(angle * 3.0 + 1.3, radius * 0.4 - t));
  // The crystal's own interior colours: grass green, blue, a little
  // violet, and a pale yellow-white core.
  vec3 rayColor = mix(vec3(0.62, 0.85, 0.89), vec3(0.40, 0.72, 0.78), smoothstep(0.3, 0.7, hue));
  rayColor = mix(rayColor, vec3(0.55, 0.62, 0.72), smoothstep(0.78, 0.97, hue));

  color += vec3(0.82, 0.92, 1.0) * glow * 0.12;
  color += vec3(0.40, 0.72, 0.78) * halo * 0.14;
  // Half as strong: the rays read as soft light, not lines.
  color += rayColor * streak * reach * 0.09;
  // Light blue, not green: the green veil read as chemical stains.
  color += vec3(0.24, 0.56, 0.72) * veil * 0.2;
  // Depth: a pale grey haze drifting through the space (Shopify Editions),
  // thicker toward the edges, so the field reads as volume, not a flat card.
  float fog = fbm(warped * 1.3 + vec2(t * 0.7, -t * 0.4));
  float fogMask = smoothstep(0.35, 0.85, fog) * (0.55 + 0.45 * smoothstep(0.2, 0.9, length(uv)));
  // A tint per step over the same base, in soft patches: the crystal's
  // green on step one, a pink-lavender on step two (the yellow-green read
  // as a swamp), its violet on step three. progress is block five's stage / 4 (step two = 1..3).
  float stage = progress * 4.0;
  float stepTwo = smoothstep(1.1, 1.9, stage);
  float stepThree = smoothstep(3.0, 3.6, stage);
  vec3 tint = mix(vec3(0.16, 0.68, 0.34), vec3(0.85, 0.66, 0.94), stepTwo);
  tint = mix(tint, vec3(0.46, 0.42, 1.0), stepThree);
  float tintMask = smoothstep(0.45, 0.85, fbm(warped * 1.2 + vec2(t * 0.4, -t * 0.25)));
  color = mix(color, color + tint * 0.22, tintMask * smoothstep(0.0, 0.3, stage));
  // Only a thin haze now: the grey made the colours read pastel.
  color = mix(color, vec3(0.30, 0.40, 0.52), fogMask * 0.1);
  color *= 0.9 + 0.1 * smoothstep(0.95, 0.18, length(uv));
  color += vec3(0.01, 0.02, 0.03);
  color += (hash(gl_FragCoord.xy + time) - 0.5) / 255.0;
  gl_FragColor = vec4(color, 1.0);
}
`

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export default function NetworkLightShader({ motionRef }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' })
    if (!gl) return undefined
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    if (!vertex || !fragment) return undefined
    const program = gl.createProgram()
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined
    gl.useProgram(program)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const resolution = gl.getUniformLocation(program, 'resolution')
    const time = gl.getUniformLocation(program, 'time')
    const progress = gl.getUniformLocation(program, 'progress')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0

    const draw = (now) => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const width = Math.max(1, Math.round(rect.width * dpr))
      const height = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      gl.viewport(0, 0, width, height)
      gl.uniform2f(resolution, width, height)
      gl.uniform1f(time, reduced ? 0 : now * 0.001)
      gl.uniform1f(progress, motionRef.current?.network ?? 0)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      frame = onScreen ? window.requestAnimationFrame(draw) : 0
    }
    // v4: only draws while the canvas is on screen. It used to run (and
    // measure its own rect) every frame from page load, costing frames on
    // every other screen.
    let onScreen = false
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (onScreen && !frame) frame = window.requestAnimationFrame(draw)
    })
    visibility.observe(canvas)
    return () => {
      visibility.disconnect()
      window.cancelAnimationFrame(frame)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
    }
  }, [motionRef])

  return <canvas ref={canvasRef} className="physics-behavior-section__network-light" aria-hidden="true" />
}
