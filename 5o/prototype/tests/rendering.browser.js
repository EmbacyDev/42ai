import * as THREE from 'three'
import { EffectComposer, EffectPass, RenderPass, BloomEffect, BlendFunction } from 'postprocessing'
import { ActiveBloomEffect } from '../src/crystal/rendering/ActiveBloomEffect.js'

// Real GPU regression: transparent HDR content, the same half-float composer,
// MSAA and additive blend, before/during/after the website's Bloom pulse.
const result = document.getElementById('result')
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: false })
renderer.setSize(96, 96)
renderer.toneMapping = THREE.NoToneMapping
renderer.info.autoReset = false
document.body.append(renderer.domElement)
const scene = new THREE.Scene()
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
camera.position.z = 2
const material = new THREE.ShaderMaterial({
  transparent: true,
  vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: `varying vec2 vUv;
    void main(){
      float d=length(vUv-.5);
      float a=1.-smoothstep(.12,.48,d);
      vec3 c=mix(vec3(.05,.8,.25),vec3(.15,.4,2.5),vUv.x);
      c+=vec3(2.0)*exp(-d*d*90.);
      gl_FragColor=vec4(c,a*.82);
    }`,
})
const geometry = new THREE.PlaneGeometry(2, 2)
scene.add(new THREE.Mesh(geometry, material))

const pipelines = [BloomEffect, ActiveBloomEffect].map((Effect) => {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 8 })
  const bloom = new Effect({ mipmapBlur: true, intensity: 0, luminanceThreshold: 0.94,
    luminanceSmoothing: 0.3, blendFunction: BlendFunction.ADD })
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new EffectPass(camera, bloom))
  composer.autoRenderToScreen = false
  composer.setSize(96, 96)
  return { composer, bloom }
})

try {
  const checks = []
  for (const intensity of [0, 0.05, 0.28, 0.1, 0]) {
    const renders = pipelines.map(({ composer, bloom }) => {
      bloom.intensity = intensity
      renderer.info.reset()
      composer.render(1 / 60)
      const calls = renderer.info.render.calls
      const pixels = new Uint16Array(96 * 96 * 4)
      renderer.readRenderTargetPixels(composer.outputBuffer, 0, 0, 96, 96, pixels)
      return { calls, pixels }
    })
    let changedChannels = 0
    for (let i = 0; i < renders[0].pixels.length; i++) {
      if (renders[0].pixels[i] !== renders[1].pixels[i]) changedChannels++
    }
    checks.push({ intensity, baselineDraws: renders[0].calls, optimizedDraws: renders[1].calls, changedChannels })
  }
  const pass = checks.every((c) => c.changedChannels === 0
    && (c.intensity > 0 ? c.optimizedDraws === c.baselineDraws : c.optimizedDraws < c.baselineDraws))
  result.textContent = JSON.stringify({ pass, checks }, null, 2)
  document.title = `${pass ? 'PASS' : 'FAIL'} — 5o rendering regression`
} catch (error) {
  result.textContent = `FAIL: ${error.stack}`
  document.title = 'FAIL — 5o rendering regression'
} finally {
  pipelines.forEach(({ composer }) => composer.dispose())
  geometry.dispose()
  material.dispose()
  renderer.dispose()
}
