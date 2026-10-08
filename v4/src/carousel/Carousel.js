import * as THREE from 'three'
import gsap from 'gsap'
import { vertexShader, cardVertexShader, fragmentShader, screenGlassFragmentShader } from './shaders.js'

// Fallback only — the real value comes from params.clearColor
// (GlassCardCarousel.jsx passes the hero's own resolved background, see
// heroBackground.js, so the two sections always match exactly instead of
// this component assuming a fixed colour).
const DEFAULT_CLEAR_COLOR = '#f7f7f6'

// Figma Block 14 (1440×760), intentionally rounded to whole pixels.
const ACTIVE_W = 369
const ACTIVE_H = 430
const REST_W = 328
const REST_H = 328
const FIGMA_GAP = 61
const CORNER_RADIUS_PX = 8
const CRYSTAL_W = 100
const CRYSTAL_H = 86

const CARD_ASPECT = ACTIVE_W / ACTIVE_H
const CARD_WIDTH = 2.12
const CARD_HEIGHT = CARD_WIDTH / CARD_ASPECT
const SCALE_X_REST = REST_W / ACTIVE_W
const SCALE_Y_REST = REST_H / ACTIVE_H
const BAKE_W = 640
const BAKE_H = Math.round(BAKE_W / CARD_ASPECT)
const REPEAT = 6
const SEGMENTS_X = 24
const SEGMENTS_Y = 14
const CORNER_RADIUS = CORNER_RADIUS_PX / ACTIVE_H
const CARD_Y = -10 * (CARD_HEIGHT / ACTIVE_H)
const CRYSTAL_WIDTH = CARD_WIDTH * (CRYSTAL_W / ACTIVE_W)
const CRYSTAL_HEIGHT = CRYSTAL_WIDTH * (CRYSTAL_H / CRYSTAL_W)
// The Figma glass layers are independent from the card artwork, but their
// visible bounds terminate exactly on the neighbouring cards. Keeping the
// pass separate lets it refract the composed scene while its transform is
// driven by the live card below, so the two edges cannot drift apart.
const FIGMA_GLASSES = [
  {
    side: -1,
    lightAngle: 330,
  },
  {
    side: 1,
    lightAngle: 30,
  },
]

function lerp(a, b, t) {
  return a + (b - a) * t
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

async function bakeColorCardTexture(baseColor, blobUrl) {
  const canvas = document.createElement('canvas')
  canvas.width = BAKE_W
  canvas.height = BAKE_H
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, BAKE_W, BAKE_H)

  const blob = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = blobUrl
  })

  ctx.save()
      ctx.filter = 'blur(8px)'
  ctx.globalAlpha = 0.96
  const bw = BAKE_W * 1.22
  const bh = bw * (blob.height / blob.width)
  ctx.drawImage(blob, (BAKE_W - bw) * 0.5, BAKE_H * -0.06, bw, bh)
  ctx.restore()

  ctx.save()
  const sheen = ctx.createRadialGradient(
    BAKE_W * 0.52,
    BAKE_H * 0.32,
    0,
    BAKE_W * 0.52,
    BAKE_H * 0.32,
    BAKE_W * 0.55
  )
  sheen.addColorStop(0, 'rgba(255,255,255,0.14)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, BAKE_W, BAKE_H)
  ctx.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
  return { texture, gradient: texture, scale: [1, 1], offset: [0, 0], hasPhoto: 0 }
}

// Figma node 121:1328. The downloaded SVG is the node's actual vector
// asset, not a recreated CSS approximation. It is positioned and flipped
// using the exact ratios from the 327.862px card specification; the wide
// 20% white rectangle covers the complete clipped card, so baking that
// layer here is pixel-equivalent to the Figma glass fill.
async function bakeExactFigmaCardTexture(baseColor, artUrl) {
  const canvas = document.createElement('canvas')
  canvas.width = BAKE_W
  canvas.height = BAKE_H
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, BAKE_W, BAKE_H)

  const art = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = artUrl
  })

  // These ratios come directly from the Figma node:
  // card 327.862²; image 330.936×349.378; centre offset +0.83px; top 0.
  const artW = BAKE_W * (330.936 / 327.862)
  const artH = BAKE_H * (349.378 / 327.862)
  const artX = BAKE_W * (((327.862 - 330.936) * 0.5 + 0.83) / 327.862)
  ctx.save()
  ctx.translate(artX, artH)
  ctx.scale(1, -1)
  ctx.drawImage(art, 0, 0, artW, artH)
  ctx.restore()

  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.fillRect(0, 0, BAKE_W, BAKE_H)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
  return { texture, gradient: texture, scale: [1, 1], offset: [0, 0], hasPhoto: 0 }
}

function loadPhotoTextures(url, fallbackColor) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader()
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.NoColorSpace
        texture.anisotropy = 4
        texture.needsUpdate = true
        const img = texture.image

        // Figma 13:723: 686.974×457.983 image in a 409.828×430.319 frame,
        // center shifted +43.14px, bottom-aligned.
        const frameW = 410
        const frameH = 430
        const placedW = 687
        const placedH = 458
        const visibleLeft = frameW / 2 + 43 - placedW / 2
        const u0 = -visibleLeft / placedW
        const u1 = (frameW - visibleLeft) / placedW
        const v0 = 0
        const v1 = frameH / placedH
        const sx = u1 - u0
        const sy = v1 - v0
        const ox = u0 + 0.5 * sx - 0.5
        const oy = v0 + 0.5 * sy - 0.5

        const gradCanvas = document.createElement('canvas')
        gradCanvas.width = BAKE_W
        gradCanvas.height = BAKE_H
        const gctx = gradCanvas.getContext('2d')
        gctx.fillStyle = fallbackColor || '#5c4a38'
        gctx.fillRect(0, 0, BAKE_W, BAKE_H)
        gctx.save()
        gctx.filter = 'blur(36px)'
        const dw = BAKE_W * 1.8
        const dh = dw * (img.height / img.width)
        gctx.drawImage(img, BAKE_W * 0.5 - dw * 0.55, BAKE_H * 0.02, dw, dh)
        gctx.restore()
        const gradTex = new THREE.CanvasTexture(gradCanvas)
        gradTex.colorSpace = THREE.NoColorSpace
        gradTex.needsUpdate = true

        resolve({
          texture,
          gradient: gradTex,
          scale: [sx, sy],
          offset: [ox, oy],
          hasPhoto: 1,
        })
      },
      undefined,
      reject
    )
  })
}

export const CAROUSEL_REV = 'figma-hedge-yellow-light-v14'

export class Carousel {
  constructor(container, cardData, params, callbacks = {}) {
    this.container = container
    this.cardData = cardData
    this.params = { ...params }
    this.callbacks = callbacks
    this.clearColor = new THREE.Color(params.clearColor || DEFAULT_CLEAR_COLOR)

    this.activeIndex = Math.floor((REPEAT * cardData.length) / 2)
    this.activeIndex -= this.activeIndex % cardData.length
    const photoIdx = cardData.findIndex((c) => c.kind === 'photo')
    if (photoIdx >= 0) this.activeIndex += photoIdx
    this.displayIndex = this.activeIndex
    this.dragStartIndex = this.displayIndex
    this.isDragging = false
    this.dragMoved = false
    this.dragStartX = 0
    this.velocityTracker = []
    this.motionEnergy = 0
    this.travelDirection = 0
    this.crystalActivation = 0
    this.crystalLean = 0
    this.crystalOriginIndex = this.displayIndex
    this.lastDisplayIndex = this.displayIndex
    this.lastTickTime = performance.now()
    this.nextAutoAt = Infinity
    this.isInViewport = true
    this._buildId = 0

    this.disposed = false
    this.meshes = []
    this.glassMeshes = []
    this.tween = null
    this._v = new THREE.Vector3()
    this._renderSize = new THREE.Vector2(1, 1)
    this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    this._initScene()
    this._buildCards()
    this._bindEvents()
    this._observeVisibility()
    this._resize()
    this._raf = requestAnimationFrame(this._tick)
  }

  _initScene = () => {
    this.scene = new THREE.Scene()
    this.glassScene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    this.camera.position.set(0, 0, 9)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    })
    // PageCrystal remains active above this canvas. A DPR-2 carousel plus
    // that full-screen shader was the main reason the crystal stuttered in
    // the prototype while moving smoothly in the single-canvas lab.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    this.renderer.setClearColor(0x000000, 0)
    this.container.appendChild(this.renderer.domElement)
    this.canvas = this.renderer.domElement

    this.renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
    })

    this.raycaster = new THREE.Raycaster()
    this.pointerNDC = new THREE.Vector2()

    // No sprite/texture here any more — there is only one crystal on the
    // whole page (the hero's own tuned shader, see PageCrystal.jsx), which
    // travels down into this section and settles at this position. This
    // stays a plain, invisible hit-test target (never rendered — opacity
    // 0, no map) purely so clicking where the crystal visually sits still
    // advances the carousel, the way clicking the old placeholder sprite
    // used to.
    this.crystalMat = new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false })
    this.crystal = new THREE.Sprite(this.crystalMat)
    this.crystal.scale.set(CRYSTAL_WIDTH, CRYSTAL_HEIGHT, 1)
    this.crystal.position.set(0, CARD_Y + CARD_HEIGHT / 2 + 0.18, 1.2)
    this.scene.add(this.crystal)

    this._buildFigmaGlasses()
  }

  _buildFigmaGlasses() {
    const geometry = new THREE.PlaneGeometry(1, 1)
    this.glassMeshes = FIGMA_GLASSES.map((spec) => {
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader: screenGlassFragmentShader,
        uniforms: {
          uScene: { value: this.renderTarget.texture },
          uResolution: { value: this._renderSize },
          uSide: { value: spec.side },
          uRefract: { value: 0.77 },
          uDepthPx: { value: 71 },
          uDispersionPx: { value: 1 },
          uSplay: { value: 0.64 },
          uMotion: { value: 0 },
          uLightAngle: { value: spec.lightAngle },
          uCornerRadius: { value: CORNER_RADIUS_PX / REST_H },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.frustumCulled = false
      mesh.renderOrder = 180
      mesh.userData.spec = spec
      this.glassScene.add(mesh)
      return mesh
    })
  }

  async _buildCards() {
    const n = this.cardData.length
    const geometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT, SEGMENTS_X, SEGMENTS_Y)

    const buildId = ++this._buildId
    const bakes = await Promise.all(
      this.cardData.map(async (card) => {
        if (card.kind === 'photo') {
          try {
            return await loadPhotoTextures(card.photo, card.baseColor)
          } catch (err) {
            console.warn('[carousel] photo bake failed', card.id, err)
            return bakeColorCardTexture(card.baseColor, '/images/blob-brown.svg')
          }
        }
        if (card.figmaCard && card.exactArt) {
          return bakeExactFigmaCardTexture(card.baseColor, card.exactArt)
        }
        return bakeColorCardTexture(card.baseColor, card.blob)
      })
    )
    if (this.disposed || buildId !== this._buildId) return

    const total = REPEAT * n
    for (let vi = 0; vi < total; vi++) {
      const card = this.cardData[vi % n]
      const bake = bakes[vi % n]
      const uniforms = {
        uMap: { value: bake.texture },
        uGradient: { value: bake.gradient },
        uMapScale: { value: new THREE.Vector2(...bake.scale) },
        uMapOffset: { value: new THREE.Vector2(...bake.offset) },
        uSide: { value: 0 },
        uMotion: { value: 0 },
        uActivation: { value: 0 },
        uGlass: { value: 0 },
        uRefract: { value: 0 },
        uGlassDepth: { value: 0 },
        uDispersion: { value: 0 },
        uSplay: { value: 0 },
        uBlur: { value: 0 },
        uFocus: { value: 0 },
        uHasPhoto: { value: bake.hasPhoto },
        uTonalGradient: { value: card.kind === 'color' && !card.figmaCard ? 1 : 0 },
        uGradientColor: { value: new THREE.Color(card.gradientColor || card.baseColor) },
        uCrystalGlass: { value: card.crystalGlass ? 1 : 0 },
        uYellowLight: { value: card.yellowLight ? 1 : 0 },
        uOpacity: { value: 0.97 },
        uCornerRadius: { value: CORNER_RADIUS },
        uRim: { value: 0.48 },
        uTime: { value: 0 },
        uDebug: { value: 0 },
        uFold: { value: 0 },
      }
      const material = new THREE.ShaderMaterial({
        vertexShader: cardVertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.userData.virtualIndex = vi
      mesh.userData.card = card
      mesh.userData.hasPhoto = bake.hasPhoto
      this.scene.add(mesh)
      this.meshes.push(mesh)
    }

    this.nextAutoAt = performance.now() + (this.params.autoInterval ?? 5) * 1000
    this._layout()
    window.__carousel = this
  }

  _bindEvents() {
    this._onResize = () => this._resize()
    window.addEventListener('resize', this._onResize)

    this._onPointerDown = (e) => {
      e.preventDefault()
      this._markUserInteraction()
      this.isDragging = true
      this.dragMoved = false
      this.dragStartX = e.clientX
      this.dragStartIndex = this.displayIndex
      this.velocityTracker = [{ x: e.clientX, t: performance.now() }]
      if (this.tween) this.tween.kill()
      this.crystalActivation = 0
      this.crystalLean = 0
      this.canvas.classList.add('is-dragging')
      this.canvas.setPointerCapture?.(e.pointerId)
    }

    this._onPointerMove = (e) => {
      if (!this.isDragging) return
      const dx = e.clientX - this.dragStartX
      if (Math.abs(dx) > 3) this.dragMoved = true
      // The crystal light reacts while the user is actually dragging,
      // rather than waiting for the snap tween after pointer-up.
      this.crystalActivation = clamp(Math.abs(dx) / 110, 0, 1)
      this.crystalLean = clamp(-dx / 180, -1, 1)
      const unitsPerIndex = this._worldSpacing() * this._pixelsPerWorldUnit()
      this.displayIndex = this.dragStartIndex - dx / unitsPerIndex
      this.velocityTracker.push({ x: e.clientX, t: performance.now() })
      if (this.velocityTracker.length > 6) this.velocityTracker.shift()
    }

    this._onPointerUp = (e) => {
      if (!this.isDragging) return
      this.isDragging = false
      this.canvas.classList.remove('is-dragging')
      this.canvas.releasePointerCapture?.(e.pointerId)

      let velocity = 0
      const track = this.velocityTracker
      if (track.length >= 2) {
        const a = track[0]
        const b = track[track.length - 1]
        const dt = (b.t - a.t) / 1000
        if (dt > 0) velocity = (b.x - a.x) / dt
      }
      const unitsPerIndex = this._worldSpacing() * this._pixelsPerWorldUnit()
      const momentum = -velocity / unitsPerIndex / 3.2
      const target = Math.round(this.displayIndex + momentum)

      if (!this.dragMoved) {
        this._handleClick(e)
        return
      }
      this._goTo(target, true)
    }

    this.canvas.addEventListener('pointerdown', this._onPointerDown)
    window.addEventListener('pointermove', this._onPointerMove)
    window.addEventListener('pointerup', this._onPointerUp)

    this._onKeyDown = (e) => {
      if (e.key === 'ArrowRight') this.next(true)
      if (e.key === 'ArrowLeft') this.prev(true)
    }
    window.addEventListener('keydown', this._onKeyDown)

    this._onWheel = (e) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return
      e.preventDefault()
      if (this._wheelLock) return
      this._wheelLock = true
      if (e.deltaX > 8) this.next(true)
      else if (e.deltaX < -8) this.prev(true)
      setTimeout(() => {
        this._wheelLock = false
      }, 260)
    }
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false })
  }

  _handleClick(e) {
    const rect = this.canvas.getBoundingClientRect()
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointerNDC, this.camera)
    const crystalHit = this.raycaster.intersectObject(this.crystal)
    if (crystalHit.length) {
      this.next(true)
      return
    }
    const hits = this.raycaster.intersectObjects(this.meshes)
    if (hits.length) {
      const vi = hits[0].object.userData.virtualIndex
      this._goTo(vi, true)
    }
  }

  _pixelsPerWorldUnit() {
    const dist = this.camera.position.z
    const vFovRad = (this.camera.fov * Math.PI) / 180
    const worldHeightAtZ0 = 2 * Math.tan(vFovRad / 2) * dist
    return this.height / worldHeightAtZ0
  }

  _worldSpacing() {
    const scale = this.params.activeScale || 1
    const gap = FIGMA_GAP * (this.params.sideGap ?? 1)
    return ((ACTIVE_W + REST_W) * 0.5 + gap) * (CARD_WIDTH / ACTIVE_W) * scale
  }

  _restSpacing() {
    const scale = this.params.activeScale || 1
    const gap = FIGMA_GAP * (this.params.sideGap ?? 1)
    return (REST_W + gap) * (CARD_WIDTH / ACTIVE_W) * scale
  }

  next(userInitiated = true) {
    this._goTo(Math.round(this.displayIndex) + 1, userInitiated)
  }

  prev(userInitiated = true) {
    this._goTo(Math.round(this.displayIndex) - 1, userInitiated)
  }

  goToCardId(id) {
    const n = this.cardData.length
    const baseIdx = this.cardData.findIndex((c) => c.id === id)
    if (baseIdx === -1) return
    const current = this.displayIndex
    const currentLoop = Math.round((current - baseIdx) / n)
    this._goTo(currentLoop * n + baseIdx, true)
  }

  _markUserInteraction() {
    this.nextAutoAt = performance.now() + (this.params.autoResumeDelay ?? 8) * 1000
  }

  _recenterIndex(index) {
    const n = this.cardData.length
    const total = REPEAT * n
    const mid = Math.floor(total / 2)
    const offset = ((Math.round(index) % n) + n) % n
    return mid - (mid % n) + offset
  }

  _goTo(virtualIndex, userInitiated = false) {
    if (userInitiated) this._markUserInteraction()
    else this.nextAutoAt = performance.now() + (this.params.autoInterval ?? 5) * 1000
    const n = this.cardData.length
    const total = REPEAT * n
    if (virtualIndex < n || virtualIndex > total - n) {
      const shift = this._recenterIndex(this.displayIndex) - Math.round(this.displayIndex)
      this.displayIndex += shift
      virtualIndex += shift
    }
    this.activeIndex = virtualIndex
    if (this.tween) this.tween.kill()
    const direction = Math.sign(virtualIndex - this.displayIndex) || 1
    const duration = this.params.transitionDuration
    this.tween = gsap.timeline({ overwrite: true })
      .to(this, {
        crystalActivation: 1,
        crystalLean: direction,
        duration: 0.18,
        ease: 'power2.out',
      })
      .to(this, {
        displayIndex: virtualIndex,
        duration,
        ease: 'power3.inOut',
      }, 0.10)
      .to(this, {
        crystalActivation: 0,
        crystalLean: 0,
        duration: 0.42,
        ease: 'power2.out',
      }, Math.max(0.38, duration * 0.62))
  }

  _observeVisibility() {
    if (!('IntersectionObserver' in window)) return
    this.visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = this.isInViewport
        this.isInViewport = entry.isIntersecting && entry.intersectionRatio >= 0.35
        if (!wasVisible && this.isInViewport) {
          this.nextAutoAt = performance.now() + (this.params.autoInterval ?? 5) * 1000
        }
      },
      { threshold: [0, 0.35, 0.7] }
    )
    this.visibilityObserver.observe(this.container)
  }

  updateParams(next) {
    this.params = { ...this.params, ...next }
    this._fitCamera()
    this._layout()
  }

  _layout() {
    if (!this.meshes.length) return
    const p = this.params
    const overlays = []
    const glassTargets = { '-1': null, '1': null }

    for (let meshIndex = 0; meshIndex < this.meshes.length; meshIndex++) {
      const mesh = this.meshes[meshIndex]
      const vi = mesh.userData.virtualIndex
      const offset = vi - this.displayIndex
      const absOffset = Math.abs(offset)
      const side = absOffset < 0.001 ? 0 : Math.sign(offset)

      const focus = clamp(1 - absOffset, 0, 1)
      // Deformation must evolve across the *whole* trip between centre and
      // side. The previous smoothstep reached almost 1 very early, making
      // the card look like a rigid pre-bent object for most of its travel.
      const neighbor = clamp(absOffset, 0, 1)
      const nearestEdge = 1 - smoothstep(1.15, 1.75, absOffset)
      const edgeInfluence = neighbor * nearestEdge
      const moving = this.reduceMotion ? 0 : this.motionEnergy
      const entering = moving > 0.015 && side !== 0 && side === this.travelDirection
      // The side shape is positional, not velocity-driven. Previously it
      // was multiplied by motionEnergy, so the attractive stretched state
      // appeared first and then visibly collapsed after the carousel had
      // already stopped. Keeping the full positional curve makes that first
      // state the stable resting silhouette. Motion still affects only the
      // extra optical ripple below.
      const directionalCurve = entering ? Math.sqrt(edgeInfluence) : edgeInfluence
      const shapeProgress = clamp(directionalCurve, 0, 1)
      // Refraction follows position as well. A velocity-driven pulse made
      // the lens flare up during the gesture and then shrink after the card
      // stopped. This eased positional curve stays fully present on the
      // side card and gives both entry and exit a long, soft transition.
      const glassProgress = smoothstep(0.04, 0.96, shapeProgress) * 0.48
      const beyond = clamp(absOffset - 1, 0, 3)

      const sx = lerp(p.activeScale, SCALE_X_REST * p.activeScale, neighbor) * (1 - beyond * 0.03)
      const sy = lerp(p.activeScale, SCALE_Y_REST * p.activeScale, neighbor) * (1 - beyond * 0.03)
      const spacing = this._worldSpacing()
      const restSpacing = this._restSpacing()
      const dist = Math.abs(offset)
      const x =
        side * (dist <= 1 ? dist * spacing : spacing + (dist - 1) * restSpacing)
      const z = 0.08 * focus
      const visOpacity = 1 - smoothstep(1.6, 2.2, absOffset)

      mesh.position.set(x, CARD_Y, z)
      mesh.scale.set(Math.max(sx, 0.35), Math.max(sy, 0.35), 1)
      mesh.rotation.y = 0

      const u = mesh.material.uniforms
      u.uSide.value = side
      u.uMotion.value = moving * glassProgress
      u.uActivation.value = this.crystalActivation * smoothstep(0.18, 0.96, focus)
      u.uGlass.value = glassProgress
      u.uRefract.value = p.distortionStrength ?? 0.77
      u.uGlassDepth.value = (p.glassDepth ?? 71) / 100
      u.uDispersion.value = p.glassDispersion ?? 1
      u.uSplay.value = p.glassSplay ?? 0.64
      u.uBlur.value = p.blurAmount * neighbor
      u.uFocus.value = focus
      u.uOpacity.value = 0.98 * visOpacity
      u.uCornerRadius.value = lerp(CORNER_RADIUS_PX / ACTIVE_H, CORNER_RADIUS_PX / REST_H, neighbor)
      u.uRim.value = lerp(0.18, 0.06, neighbor)
      u.uDebug.value = p.debugWireframe ? 1 : 0
      u.uFold.value = clamp(
        (p.cardFold ?? 1) * shapeProgress,
        0,
        1,
      )

      mesh.renderOrder = 100 - Math.round(absOffset * 10)
      mesh.visible = visOpacity > 0.01

      // Track the card nearest each side position. The separate refraction
      // pass receives this exact transform below, including the live scale
      // while entering/leaving centre.
      if (side !== 0 && visOpacity > 0.01) {
        const score = Math.abs(absOffset - 1)
        const current = glassTargets[String(side)]
        if (!current || score < current.score) {
          glassTargets[String(side)] = {
            score,
            x,
            y: CARD_Y,
            z,
            sx: Math.max(sx, 0.35),
            sy: Math.max(sy, 0.35),
            neighbor,
            glassProgress,
            opacity: visOpacity,
          }
        }
      }

      if (absOffset < 2.05) {
        mesh.updateMatrixWorld()
        const padX = lerp(33 / ACTIVE_W, 25 / REST_W, neighbor)
        const padY = lerp(33 / ACTIVE_H, 25 / REST_H, neighbor)
        const innerPad = side > 0 ? lerp(0, 0.08, neighbor) : 0
        const localLeft = -CARD_WIDTH / 2 + CARD_WIDTH * (padX + innerPad)
        const localBottom = -CARD_HEIGHT / 2 + CARD_HEIGHT * padY
        const localRight = CARD_WIDTH / 2 - CARD_WIDTH * padX
        this._v.set(localLeft, localBottom, 0).applyMatrix4(mesh.matrixWorld)
        const blx = this._v.x
        const bly = this._v.y
        const blz = this._v.z
        this._v.set(localRight, localBottom, 0).applyMatrix4(mesh.matrixWorld)
        overlays.push({
          id: `${mesh.userData.card.id}-${vi}`,
          card: mesh.userData.card,
          worldX: blx,
          worldY: bly,
          worldZ: blz,
          worldRightX: this._v.x,
          focus,
          absOffset,
          neighbor,
          side,
          deformation: shapeProgress,
        })
      }
    }

    this.crystal.position.x = lerp(this.crystal.position.x, this.crystalLean * 0.08, 0.14)
    this.crystal.position.y = CARD_Y + CARD_HEIGHT * 0.5 * this.params.activeScale + 0.18

    this._layoutFigmaGlasses(glassTargets)

    // The page's one crystal (PageCrystal.jsx) travels down from the hero
    // and settles here — `crystalWorld` is this spot, in this scene's own
    // world space, so the caller can project it to a live screen position
    // every frame (GlassCardCarousel.jsx does that, via this same
    // camera). There is no visible sprite here any more to mark the spot.
    this.callbacks.onLayout?.(overlays, {
      camera: this.camera,
      renderer: this.renderer,
      crystalWorld: this.crystal.position,
    })
  }

  _layoutFigmaGlasses(targets) {
    const p = this.params
    for (const mesh of this.glassMeshes) {
      const spec = mesh.userData.spec
      const target = targets?.[String(spec.side)]
      if (!target) {
        mesh.visible = false
        continue
      }

      mesh.position.set(target.x, target.y, target.z)
      mesh.scale.set(CARD_WIDTH * target.sx, CARD_HEIGHT * target.sy, 1)

      const uniforms = mesh.material.uniforms
      uniforms.uRefract.value = p.distortionStrength ?? 0.77
      uniforms.uDepthPx.value = p.glassDepth ?? 71
      uniforms.uDispersionPx.value = p.glassDispersion ?? 1
      uniforms.uSplay.value = p.glassSplay ?? 0.64
      uniforms.uMotion.value = this.reduceMotion
        ? 0
        : clamp(target.glassProgress * target.opacity, 0, 1)
      uniforms.uLightAngle.value = spec.lightAngle
      uniforms.uCornerRadius.value = lerp(
        CORNER_RADIUS_PX / ACTIVE_H,
        CORNER_RADIUS_PX / REST_H,
        target.neighbor,
      )
      mesh.visible = target.opacity > 0.01
    }
  }

  _resize() {
    const rect = this.container.getBoundingClientRect()
    this.width = Math.max(1, rect.width)
    this.height = Math.max(1, rect.height)
    this.camera.aspect = this.width / this.height
    this._fitCamera()
    this.renderer.setSize(this.width, this.height)
    this.renderer.getDrawingBufferSize(this._renderSize)
    this.renderTarget.setSize(this._renderSize.x, this._renderSize.y)
    this._layout()
  }

  _fitCamera() {
    const aspect = Math.max(this.camera.aspect, 0.4)
    const vFov = (this.camera.fov * Math.PI) / 180
    const twoTan = 2 * Math.tan(vFov / 2)
    // Keep the camera calibrated to the original Figma stage. Card scale is
    // deliberately NOT included here: otherwise shrinking the cards also
    // zooms the camera in by the same amount and cancels the visible change.
    const zHero = CARD_HEIGHT / (ACTIVE_H / 760) / twoTan
    if (aspect >= 1.2) {
      this.camera.position.z = zHero
    } else {
      const span = this._worldSpacing() * 1.08 + CARD_WIDTH * 0.38
      this.camera.position.z = Math.max(zHero, span / aspect / twoTan)
    }
    this.camera.updateProjectionMatrix()
  }

  _tick = (t) => {
    if (this.disposed) return
    const time = t * 0.001
    const dt = Math.max(1 / 120, Math.min(0.1, (t - this.lastTickTime) / 1000))
    const displayDelta = this.displayIndex - this.lastDisplayIndex
    const displaySpeed = Math.abs(displayDelta) / dt
    if (Math.abs(displayDelta) > 0.00001) this.travelDirection = Math.sign(displayDelta)
    const motionTarget = clamp(displaySpeed * 0.45, 0, 1)
    this.motionEnergy = lerp(
      this.motionEnergy,
      motionTarget,
      motionTarget > this.motionEnergy ? 0.32 : 0.08
    )
    if (this.motionEnergy < 0.01 && motionTarget === 0) this.travelDirection = 0
    this.lastDisplayIndex = this.displayIndex
    this.lastTickTime = t

    if (
      this.params.autoPlay !== false &&
      this.isInViewport &&
      !this.isDragging &&
      document.visibilityState === 'visible' &&
      t >= this.nextAutoAt
    ) {
      this.next(false)
    }

    this._layout()
    for (const mesh of this.meshes) {
      mesh.material.uniforms.uTime.value = time
    }
    // this.crystal itself is an invisible hit-test target only now (see
    // _initScene) — its position is set in _layout(), nothing further to
    // animate here. The visible crystal is PageCrystal.jsx, tracking this
    // scene's crystal anchor from outside (see onLayout in _layout()).
    //
    // The two render passes below (render-target + composite-with-glass)
    // are the expensive part of this loop — a real, GPU-bound cost that
    // used to run continuously from page load, even while this whole
    // section sat off-screen below the fold and nobody could see it. That
    // was competing for GPU time with PageCrystal.jsx's own idle spin in
    // the hero, reading as stutter there. `_layout()` above still runs
    // unconditionally either way — cheap (plain math, no GPU work), and
    // PageCrystal.jsx needs its projected crystal anchor kept live even
    // before this section is actually visible, since it starts blending
    // toward that anchor partway through the hero's own pinned scroll.
    if (this.isInViewport) {
      // Pass 1 captures the complete carousel. Pass 2 draws that scene to
      // screen and then places the two independent Figma glass meshes over
      // it; those meshes sample the capture, so they refract whatever card
      // is actually underneath them during the transition.
      this.renderer.setRenderTarget(this.renderTarget)
      this.renderer.setClearColor(this.clearColor, 1)
      this.renderer.clear(true, true, true)
      this.renderer.render(this.scene, this.camera)

      this.renderer.setRenderTarget(null)
      this.renderer.setClearColor(this.clearColor, 1)
      this.renderer.clear(true, true, true)
      this.renderer.autoClear = false
      this.renderer.render(this.scene, this.camera)
      this.renderer.render(this.glassScene, this.camera)
      this.renderer.autoClear = true
    }
    this._raf = requestAnimationFrame(this._tick)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this._raf)
    if (this.tween) this.tween.kill()
    this.visibilityObserver?.disconnect()
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('pointermove', this._onPointerMove)
    window.removeEventListener('pointerup', this._onPointerUp)
    window.removeEventListener('keydown', this._onKeyDown)
    this.canvas.removeEventListener('pointerdown', this._onPointerDown)
    this.canvas.removeEventListener('wheel', this._onWheel)
    for (const mesh of this.meshes) {
      const u = mesh.material.uniforms
      u.uMap.value?.dispose()
      if (u.uGradient.value && u.uGradient.value !== u.uMap.value) u.uGradient.value.dispose()
      mesh.material.dispose()
    }
    this.meshes[0]?.geometry.dispose()
    for (const glassMesh of this.glassMeshes) glassMesh.material.dispose()
    this.glassMeshes[0]?.geometry.dispose()
    this.renderTarget.dispose()
    this.crystalMat.dispose()
    this.renderer.dispose()
    this.container.removeChild(this.canvas)
  }
}

export const FIGMA = {
  ACTIVE_W,
  ACTIVE_H,
  REST_W,
  REST_H,
  FIGMA_GAP,
  CARD_WIDTH,
  CARD_HEIGHT,
}
