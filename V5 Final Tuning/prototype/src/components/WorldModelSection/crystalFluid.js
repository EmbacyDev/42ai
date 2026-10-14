import * as THREE from 'three'

// One low-resolution GPU surface feeds the field and its transition masks.
// They share a clock and image, so opening/closing cannot change the palette.
export function createCrystalFluid(hosts, isActive, getMaskScale = () => 1) {
  const surfaces = hosts.filter(Boolean).map(host => {
    const canvas = document.createElement('canvas')
    canvas.className = 'crystal-fluid'
    canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(canvas)
    return { isMask: host.classList.contains('world-model-mask__field'), canvas, context: canvas.getContext('2d', { alpha: false }) }
  })
  let renderer
  try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' }) }
  catch { surfaces.forEach(({ canvas }) => canvas.remove()); return () => {} }
  renderer.setPixelRatio(1)
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uAspect: { value: 1 }, uZoom: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uAspect;
      uniform float uZoom;
      // Smooth moving colour volumes, warped twice so their boundaries flow
      // and merge rather than rotating a rigid gradient image.
      float volume(vec2 p, vec2 center, vec2 stretch) {
        vec2 d=(p-center)*stretch;
        return exp(-dot(d,d)*5.2);
      }
      void main(){
        vec2 p=(vUv-.5)*vec2(uAspect,1.)/uZoom;
        float t=uTime*.34;
        vec2 flow=vec2(
          sin(p.y*2.2+t*.83)+.45*cos(p.x*2.7-t*.61),
          cos(p.x*1.9-t*.72)+.45*sin(p.y*2.6+t*.57)
        );
        vec2 q=p+.24*flow;
        q+=.12*vec2(sin(q.y*3.1-t*.64),cos(q.x*2.8+t*.76));
        float green=volume(q,vec2(-.42+.42*sin(t*.81),.28+.32*cos(t*.67)),vec2(.95,1.25));
        float blue=volume(q,vec2(.36+.38*cos(t*.73),-.28+.35*sin(t*.91)),vec2(1.1,.9));
        float lime=volume(q,vec2(.58*cos(t*.59+1.),.38*sin(t*.77+1.6)),vec2(1.,1.4));
        float lavender=volume(q,vec2(-.42+.3*sin(t*.68+2.),-.42+.27*cos(t*.88)),vec2(1.4,1.1));
        float ice=volume(q,vec2(.28+.4*cos(t*.62+2.4),.24+.38*sin(t*.74+2.)),vec2(.85,1.15));
        // Existing site palette, lifted enough for the dark reading copy.
        vec3 color=(
          green*vec3(.30,.80,.68)+
          blue*vec3(.43,.70,.96)+
          lime*vec3(.87,.97,.73)+
          lavender*.48*vec3(.73,.75,.94)+
          ice*.85*vec3(.82,.96,.95)+
          .035*vec3(.76,.89,.94)
        )/(green+blue+lime+lavender*.48+ice*.85+.035);
        // A broad, soft highlight follows the same flow without sharp edges.
        float glow=volume(q,vec2(.15*sin(t*.6),.4*cos(t*.7)),vec2(1.5,.75));
        color=mix(color,vec3(.91,.98,.96),glow*.16);
        gl_FragColor=vec4(color,1.);
      }`,
  })
  const geometry = new THREE.PlaneGeometry(2, 2)
  const scene = new THREE.Scene()
  scene.add(new THREE.Mesh(geometry, material))
  const camera = new THREE.Camera()
  let frame = 0, last = 0, elapsed = 0, dirty = true
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const resize = () => {
    const width = Math.min(960, window.innerWidth)
    const height = Math.round(width * window.innerHeight / window.innerWidth)
    renderer.setSize(width, height, false)
    material.uniforms.uAspect.value = width / height
    surfaces.forEach(({ canvas }) => { canvas.width = width; canvas.height = height })
    dirty = true
  }
  const draw = now => {
    frame = requestAnimationFrame(draw)
    if (document.hidden || (!dirty && !isActive())) { last = now; return }
    if (!dirty && (reduced.matches || now-last < 1000/30)) return
    elapsed += Math.min((now-last)/1000, .05)
    last = now
    material.uniforms.uTime.value = reduced.matches ? 0 : elapsed
    material.uniforms.uZoom.value = 1
    renderer.render(scene, camera)
    surfaces.filter(surface => !surface.isMask).forEach(({ canvas, context }) =>
      context.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height))
    const zoom = getMaskScale()
    if (zoom > 0) {
      material.uniforms.uZoom.value = Math.max(.025, Math.min(1, zoom))
      if (zoom < 1) renderer.render(scene, camera)
      surfaces.filter(surface => surface.isMask).forEach(({ canvas, context }) =>
        context.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height))
    }
    dirty = false
  }
  resize()
  window.addEventListener('resize', resize)
  frame = requestAnimationFrame(draw)
  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', resize)
    geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss()
    surfaces.forEach(({ canvas }) => canvas.remove())
  }
}
