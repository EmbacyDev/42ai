// v4: the 2→3 band, drawn in WebGL so its leading edge can behave like the
// glass fold that carries a gradient card in on block two (PhotoRail3D):
// block three's field wells up from the bottom edge in a dome, and the
// rim of that dome is a lens — the picture under it is magnified and
// pulled along the edge, with a soft sheen on the crest.

const VERTEX = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uField;
uniform vec2 uRes;
uniform float uBand;     // 0 → 1: dome size
uniform float uOpacity;
uniform float uTime;

// Same crop as the CSS field: background-size 210%, position 42% 44%.
vec2 fieldUv(vec2 screenUv) {
  vec2 top = vec2(screenUv.x, 1.0 - screenUv.y);
  vec2 img = (top + vec2(0.462, 0.484)) / 2.1;
  return vec2(img.x, 1.0 - img.y);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / max(uRes.y, 1.0);
  // Dome: ellipse anchored at the bottom centre, growing with uBand.
  // Measured in viewport heights, so the dome stays round on any aspect.
  vec2 q = vec2((uv.x - 0.5) * aspect, uv.y);
  vec2 radii = vec2((0.30 + uBand * 1.50) * aspect, uBand * 2.3 + 0.01) * 0.7;
  vec2 n = q / radii;
  float d = length(n);                 // 0 at the centre, 1 on the rim
  float inside = 1.0 - smoothstep(0.86, 1.0, d);
  if (inside <= 0.001) discard;

  // The lens: a band just inside the rim magnifies toward the centre and
  // drags the picture along the edge, like the card's optical fold.
  float rim = smoothstep(0.55, 0.9, d) * (1.0 - smoothstep(0.9, 1.0, d));
  vec2 dir = normalize(n + 1e-5);
  float bulge = rim * (0.07 + 0.03 * sin(uTime * 1.3 + uv.x * 6.0));
  vec2 lensUv = uv - vec2(dir.x / aspect, dir.y) * bulge;
  // A slight chromatic split on the fold, as on the card's edge.
  float split = rim * 0.006;
  vec2 fuv = fieldUv(lensUv);
  vec3 col;
  col.r = texture(uField, fuv + vec2(split, 0.0), 2.5).r;
  col.g = texture(uField, fuv, 2.5).g;
  col.b = texture(uField, fuv - vec2(split, 0.0), 2.5).b;
  // Sheen riding the crest.
  float sheen = smoothstep(0.78, 0.95, d) * (1.0 - smoothstep(0.95, 1.0, d));
  col = mix(col, min(col * 1.12 + vec3(0.07), vec3(1.0)), sheen * 0.7);
  outColor = vec4(col, inside * uOpacity);
}`

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}

export function createBandRenderer(canvas, imageUrl) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, alpha: true })
  if (!gl) return null
  const program = gl.createProgram()
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 150, 122, 255]))
  const image = new Image()
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }
  image.src = imageUrl

  const u = {
    res: gl.getUniformLocation(program, 'uRes'),
    band: gl.getUniformLocation(program, 'uBand'),
    opacity: gl.getUniformLocation(program, 'uOpacity'),
    time: gl.getUniformLocation(program, 'uTime'),
  }
  const start = performance.now()

  return {
    draw(band, opacity) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25)
      const w = Math.round(canvas.clientWidth * dpr)
      const h = Math.round(canvas.clientHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      if (opacity <= 0.001 || band <= 0.0005) return
      gl.useProgram(program)
      gl.uniform2f(u.res, w, h)
      gl.uniform1f(u.band, band)
      gl.uniform1f(u.opacity, opacity)
      gl.uniform1f(u.time, (performance.now() - start) / 1000)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    },
    dispose() {
      gl.deleteBuffer(buffer)
      gl.deleteTexture(texture)
      gl.deleteProgram(program)
    },
  }
}
