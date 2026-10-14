import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { loadVideoTexture, loadImageTexture, releaseTexture, setPlayback } from './mediaTextures.js'

const PLACEHOLDER_PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#eef2f5"/>
          <stop offset="1" stop-color="#c9d3da"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#g)"/>
    </svg>
  `)

// Crystal shell circumradius is 1 (vertex-to-center); its INSCRIBED
// radius (face-to-center — the tightest the silhouette ever gets) is
// around 0.7. A cube's own corners reach further than its half-width by
// sqrt(3), so the half-width has to stay under ~0.7/sqrt(3) for even the
// corners to clear every facet without poking directly through it.
const ENCLOSING_HALF_SIZE = 0.38
// Fraction of each cycle spent actually crossfading — the rest of the
// interval holds the current photo steady before the next transition
// starts, rather than blending continuously the whole time.
const CROSSFADE_FRACTION = 0.3

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uMapA;
  uniform sampler2D uMapB;
  uniform float uMix;
  uniform float uReady;
  varying vec2 vUv;
  void main() {
    // Each texture has colorSpace = SRGBColorSpace set (see the loader
    // effect below), so the GPU sampler already linearizes on read here
    // — just mix and let colorspace_fragment re-encode for display.
    vec3 a = texture2D(uMapA, vUv).rgb;
    vec3 b = texture2D(uMapB, vUv).rgb;
    vec3 color = mix(a, b, uMix) * uReady;
    gl_FragColor = vec4(color, 1.0);
  }
`

function useMediaTextureList(items) {
  const [textures, setTextures] = useState([])
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    const loader = new THREE.TextureLoader()
    const loaded = []
    setTextures([])
    const pause = () => {
      if (document.hidden) loaded.forEach(texture => {
        if (texture.isVideoTexture) texture.image.pause()
      })
    }
    document.addEventListener('visibilitychange', pause)
    // Publish each ready item; a slow or failed clip cannot blank the list.
    // Only one download starts at a time, and playback is controlled below.
    const load = async () => {
      for (const item of items) {
        if (signal.aborted) break
        try {
          const texture = item.kind === 'video'
            ? await loadVideoTexture(item.url, signal)
            : await loadImageTexture(loader, item.url, signal)
          if (signal.aborted) { releaseTexture(texture); break }
          loaded.push(texture)
          setTextures([...loaded])
        } catch {
          // Keep the successful items and continue to the next source.
        }
      }
    }
    void load()
    return () => {
      controller.abort()
      document.removeEventListener('visibilitychange', pause)
      loaded.forEach(releaseTexture)
    }
  }, [items])
  return textures
}

const PhotoBox = forwardRef(function PhotoBox({ items, motion, cycleTime }, ref) {
  const textures = useMediaTextureList(items)
  const meshRef = useRef(null)
  const materialRef = useRef(null)
  const elapsed = useRef(0)
  // Only used for the material's initial mount — see the note above on
  // why per-frame writes go through materialRef instead.
  const uniforms = useMemo(() => ({
    uMapA: { value: null },
    uMapB: { value: null },
    uMix: { value: 0 },
    uReady: { value: 0 },
  }), [])

  useImperativeHandle(ref, () => ({
    // Called once per frame from Glass.jsx's own useFrame.
    update(dt) {
      const mesh = meshRef.current
      if (mesh) {
        const speed = Math.max(0, motion ?? 0.12)
        mesh.rotation.x += dt * speed * 0.6
        mesh.rotation.y += dt * speed * 0.4
        mesh.rotation.z += dt * speed * 0.25
      }

      const u = materialRef.current?.uniforms
      if (!u) return

      const count = textures.length
      if (count === 0) {
        if (mesh) mesh.visible = false
        u.uReady.value = 0
        return
      }
      if (mesh) mesh.visible = true
      const period = Math.max(1, cycleTime ?? 6)
      elapsed.current += dt
      const cyclePos = (elapsed.current / period) % count
      const indexA = Math.floor(cyclePos) % count
      const indexB = (indexA + 1) % count
      const localT = cyclePos - Math.floor(cyclePos)
      const mixT = count > 1
        ? THREE.MathUtils.smoothstep(localT, 1 - CROSSFADE_FRACTION, 1)
        : 0

      textures.forEach((texture, index) => setPlayback(texture,
        index === indexA || (index === indexB && mixT > 0)))
      u.uMapA.value = textures[indexA]
      u.uMapB.value = textures[indexB]
      u.uMix.value = mixT
      u.uReady.value = 1
    },
  }), [textures, motion, cycleTime])

  const size = ENCLOSING_HALF_SIZE * 2
  return (
    <mesh ref={meshRef} visible={false}>
      <boxGeometry args={[size, size, size]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        toneMapped={false}
      />
    </mesh>
  )
})

const FALLBACK_ITEMS = [{ url: PLACEHOLDER_PHOTO, kind: 'image' }]

const PhotoBackdrop = forwardRef(function PhotoBackdrop({ items, motion, cycleTime }, ref) {
  const list = items && items.length > 0 ? items : FALLBACK_ITEMS
  return <PhotoBox ref={ref} items={list} motion={motion} cycleTime={cycleTime} />
})

export default PhotoBackdrop
