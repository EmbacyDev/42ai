import * as THREE from 'three'
import { sceneConfig } from './sceneConfig.js'
import { resizeRenderer } from './responsive.js'
import { renderFriendBackgroundCanvas } from '../../crystal/friendBackground.js'
import { resolveHeroBackgroundColor } from './heroBackground.js'

function mixHexTowardWhite(hex, t) {
  const raw = String(hex || '#ffffff').replace('#', '')
  const v = parseInt(raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw, 16)
  if (Number.isNaN(v)) return '#ffffff'
  const mix = (c) => Math.round(c + (255 - c) * t)
  return `#${[mix((v >> 16) & 255), mix((v >> 8) & 255), mix(v & 255)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`
}

function createStudioEnvironment() {
  const env = new THREE.Scene()
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial({ color: '#f3f5f4', side: THREE.BackSide })
  )
  room.scale.set(14, 14, 14)
  env.add(room)

  const panels = [
    { color: '#5eb8bc', position: [-4.4, 1.2, -2.6], scale: [5.2, 3.4, 1] },
    { color: '#d8f0ee', position: [3.8, 2.4, -2.2], scale: [4.4, 2.8, 1] },
    { color: '#ffffff', position: [-0.4, 4.4, -1.2], scale: [6.5, 2.4, 1] },
    { color: '#8fd0ea', position: [2.8, -1.2, 2.4], scale: [3.2, 2.6, 1] },
  ]

  for (const panel of panels) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: panel.color })
    )
    mesh.position.set(panel.position[0], panel.position[1], panel.position[2])
    mesh.scale.set(panel.scale[0], panel.scale[1], panel.scale[2])
    mesh.lookAt(0, 0, 0)
    env.add(mesh)
  }

  return env
}

// The page's built-in crystal config also supplies this scene's background,
// so the portrait canvas and page-level crystal share one authored field.
export function createScene(canvas, backgroundConfig) {
  const scene = new THREE.Scene()
  let backgroundTexture = null
  // Throttled well below frame rate — the colour drift is slow and subtle
  // by design (see BACKGROUND_TONE_PERIOD above), so redrawing the
  // gradient canvas on every single frame would be pure waste.
  let lastBackgroundUpdate = -Infinity
  let lastWash = 0
  const whiteColor = new THREE.Color('#ffffff')
  const liveColor = new THREE.Color()
  const solidBaseHex = backgroundConfig
    ? resolveHeroBackgroundColor(backgroundConfig)
    : sceneConfig.background
  const backgroundMode = backgroundConfig?.friendBackgroundMode ?? 'solid'
  if (backgroundConfig && backgroundMode !== 'solid') {
    // Only gradients need the canvas-texture path. scene.background as a
    // Texture is drawn through a background shader that respects the
    // renderer's tone mapping, while scene.background as a Color is just
    // the WebGL clear colour (untouched by tone mapping) — using a
    // texture even for a flat colour made that solid white render a shade
    // darker than the overlay canvas's own (un-tonemapped) white,
    // showing up as a soft grey halo around the crystal.
    backgroundTexture = new THREE.CanvasTexture(renderFriendBackgroundCanvas(backgroundConfig))
    backgroundTexture.colorSpace = THREE.SRGBColorSpace
    scene.background = backgroundTexture
  } else if (backgroundConfig) {
    scene.background = new THREE.Color(solidBaseHex)
  } else {
    scene.background = new THREE.Color(sceneConfig.background)
  }

  const { fov, near, far, position, lookAt } = sceneConfig.camera
  const camera = new THREE.PerspectiveCamera(fov, 1, near, far)
  camera.position.set(position[0], position[1], position[2])
  camera.lookAt(lookAt[0], lookAt[1], lookAt[2])

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.transmissionResolutionScale = 0.5

  const pmrem = new THREE.PMREMGenerator(renderer)
  const environmentScene = createStudioEnvironment()
  const environment = pmrem.fromScene(environmentScene, 0.04).texture
  scene.environment = environment
  environmentScene.traverse((node) => {
    if (node.geometry) node.geometry.dispose()
    if (node.material) node.material.dispose()
  })

  const hemi = new THREE.HemisphereLight('#ffffff', '#d7e4e8', 0.9)
  const key = new THREE.DirectionalLight('#ffffff', 2.1)
  key.position.set(-3.2, 4.2, 6)
  const cool = new THREE.DirectionalLight('#b7e4ee', 1.15)
  cool.position.set(4.5, 1.2, 3.5)
  const warm = new THREE.DirectionalLight('#f4efe6', 0.28)
  warm.position.set(-1, -2.4, 2)
  scene.add(hemi, key, cool, warm)

  const rig = new THREE.Group()
  scene.add(rig)

  return {
    scene,
    camera,
    renderer,
    rig,
    resize(width, height) {
      resizeRenderer(renderer, camera, width, height)
    },
    // wash: 0 keeps the authored gradient, 1 is solid white. Driven from
    // the hero pin so the coloured sides disappear as soon as the crystal
    // starts shrinking, matching block 2's flat white.
    updateBackground(time, wash = 0) {
      const t = Math.min(1, Math.max(0, wash))
      if (t >= 0.96) {
        if (scene.background !== whiteColor) scene.background = whiteColor
        lastWash = t
        return
      }
      if (!backgroundTexture) {
        liveColor.set(solidBaseHex).lerp(whiteColor, t)
        scene.background = liveColor
        lastWash = t
        return
      }
      scene.background = backgroundTexture
      if (time - lastBackgroundUpdate < 0.1 && Math.abs(t - lastWash) < 0.02) return
      lastBackgroundUpdate = time
      lastWash = t
      const nextCanvas = renderFriendBackgroundCanvas({
        ...backgroundConfig,
        friendBackgroundColor1: mixHexTowardWhite(backgroundConfig.friendBackgroundColor1 ?? '#d4e7f8', t),
        friendBackgroundColor2: mixHexTowardWhite(backgroundConfig.friendBackgroundColor2 ?? '#eef2f5', t),
        friendBackgroundColor3: mixHexTowardWhite(backgroundConfig.friendBackgroundColor3 ?? '#ffffff', t),
      })
      backgroundTexture.image = nextCanvas
      backgroundTexture.needsUpdate = true
    },
    dispose() {
      environment.dispose()
      pmrem.dispose()
      renderer.dispose()
      backgroundTexture?.dispose()
    },
  }
}
