import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

/**
 * The user's photo(s) for the "Photo" material — wrapped around a small
 * cube that fully encloses the crystal (BackSide, so we see its inner
 * walls), rendered as a CHILD of the same rotating group as the shell
 * itself (see Glass.jsx, where this is mounted inside <group ref={group}>).
 *
 * Earlier attempts at the enclosing shape each had a real problem:
 *  - A single flat plane facing the camera, sitting in world/camera
 *    space outside the rotating group: the crystal spins away from it,
 *    so at many rotations a facet's refracted ray misses the plane
 *    entirely (a blind spot showing nothing).
 *  - The same plane sized to fill the camera's whole view: no more
 *    blind spots, but the same undistorted photo was then also visible
 *    outside the crystal's silhouette.
 *  - A sphere (fixes both of the above, rotates rigidly with the shell,
 *    sized to stay hidden inside it): a sphere's UV mapping still has
 *    two poles where the image's whole width collapses to a point, and
 *    with free orbit controls on top of autorotation there's no fixed
 *    rotation offset that keeps every possible camera angle away from
 *    both poles forever.
 * A cube has no poles or seams at all: each of its 6 faces gets a full,
 * undistorted copy of whichever photo is showing (three.js's default box
 * UV mapping), so literally every direction shows real image detail.
 *
 * With more than one photo/video, they cycle through in place on that
 * same cube — a custom two-texture shader crossfades the current one
 * into the next, so a swap reads as part of the same continuous, slow
 * motion everything else here already has, not a jump cut.
 *
 * Photos and videos share this exact cycle: each item is {url, kind}
 * (see parseMediaList in Panel.jsx). A 'video' item becomes a hidden,
 * muted, looping <video> wrapped in THREE.VideoTexture instead of a
 * THREE.TextureLoader texture — from there on it's just another
 * sampler2D to the crossfade shader below, no shader changes needed.
 * three.js's renderer detects VideoTexture instances and refreshes their
 * GPU data every frame on its own (checking video.readyState), so unlike
 * a still image there's nothing to mark dirty here per frame.
 *
 * The per-frame animation (rotation drift, cycling) is driven from
 * Glass.jsx's OWN useFrame (via the imperative `update` handle below)
 * rather than a useFrame subscription of its own — a useFrame registered
 * directly on this component's mesh never actually fired in testing
 * (mounted fine, rendered fine, but its callback was never invoked for
 * reasons that didn't resolve after extensive isolation — texture
 * loading, useLoader vs. plain effects, memoized props, StrictMode, a
 * from-scratch dev server all made no difference). Routing the tick
 * through the parent's already-reliable frame loop sidesteps whatever
 * that was instead of continuing to chase it.
 *
 * update() writes straight into the mounted <shaderMaterial>'s OWN
 * `.uniforms` (via `materialRef`), not into the plain object passed
 * through the `uniforms` JSX prop below. react-three-fiber special-cases
 * a material's `uniforms` prop: on every render where it reapplies props,
 * it COPIES each named uniform's `.value` from the prop object into the
 * material's own (separate) uniform wrapper, rather than binding the
 * prop object as the live uniforms store — see applyProps' `key ===
 * 'uniforms'` branch in @react-three/fiber. Since this component never
 * re-renders on its own (update() mutates refs, not React state), that
 * copy only ever ran once, at mount, baking in the initial zeros/nulls;
 * the shader kept sampling those forever, reading real values again only
 * when some unrelated re-render happened to trigger react-three-fiber's
 * copy again. That looked exactly like the reported bug: a flat, dark
 * cube with no photo, "fixed" only by incidental interaction. Writing to
 * materialRef.current.uniforms directly touches the exact object bound
 * to the compiled shader program, with no prop-diffing in between.
 */

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

function loadVideoTexture(url) {
  return new Promise((resolve, reject) => {
    // Not attached to the DOM tree — three.js only needs the element
    // itself as a per-frame pixel source, it never has to be visible or
    // laid out. Muted is required for autoplay to be allowed at all
    // without a user gesture; loop keeps a single video cycling on its
    // own between this item's crossfade turns.
    const video = document.createElement('video')
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.autoplay = true
    video.src = url
    const onReady = () => {
      video.removeEventListener('loadeddata', onReady)
      video.play().catch(() => {})
      const tex = new THREE.VideoTexture(video)
      tex.colorSpace = THREE.SRGBColorSpace
      resolve(tex)
    }
    video.addEventListener('loadeddata', onReady)
    video.addEventListener('error', () => reject(new Error(`video failed to load: ${url}`)))
    video.load()
  })
}

function loadImageTexture(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex) },
      undefined,
      reject
    )
  })
}

// Same list-of-slots for photos and videos — each item picks its own
// loader by `kind`, but from here on both produce a plain THREE texture
// the crossfade shader below can't tell apart.
function useMediaTextureList(items) {
  const [textures, setTextures] = useState([])
  useEffect(() => {
    let cancelled = false
    const loader = new THREE.TextureLoader()
    const videoElements = []
    Promise.all(
      items.map((item) => {
        if (item.kind === 'video') {
          return loadVideoTexture(item.url).then((tex) => {
            videoElements.push(tex.image)
            return tex
          })
        }
        return loadImageTexture(loader, item.url)
      })
    ).then((loadedTextures) => {
      if (!cancelled) setTextures(loadedTextures)
    }).catch(() => {
      if (!cancelled) setTextures([])
    })
    return () => {
      cancelled = true
      // Stop decoding video the moment this list of items is replaced —
      // an image texture needs no such teardown, but a playing <video>
      // keeps decoding frames in the background forever otherwise, even
      // once nothing on screen still references its texture.
      videoElements.forEach((video) => { video.pause(); video.removeAttribute('src'); video.load() })
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
        u.uReady.value = 0
        return
      }
      const period = Math.max(1, cycleTime ?? 6)
      elapsed.current += dt
      const cyclePos = (elapsed.current / period) % count
      const indexA = Math.floor(cyclePos) % count
      const indexB = (indexA + 1) % count
      const localT = cyclePos - Math.floor(cyclePos)
      const mixT = count > 1
        ? THREE.MathUtils.smoothstep(localT, 1 - CROSSFADE_FRACTION, 1)
        : 0

      u.uMapA.value = textures[indexA]
      u.uMapB.value = textures[indexB]
      u.uMix.value = mixT
      u.uReady.value = 1
    },
  }), [textures, motion, cycleTime])

  const size = ENCLOSING_HALF_SIZE * 2
  return (
    <mesh ref={meshRef}>
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

const PhotoBackdrop = forwardRef(function PhotoBackdrop({ items, motion, cycleTime }, ref) {
  const list = items && items.length > 0 ? items : [{ url: PLACEHOLDER_PHOTO, kind: 'image' }]
  return <PhotoBox ref={ref} items={list} motion={motion} cycleTime={cycleTime} />
})

export default PhotoBackdrop
