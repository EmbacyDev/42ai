import * as THREE from 'three'
import { createScene } from './createScene.js'
import { createCrystal } from './Crystal.js'
import { createCrystalLight } from './crystalLight.js'
import { createPortraitPlanes } from './PortraitPlanes.js'
import { createParallax } from './parallax.js'
import { createChipLayer } from './chipLayer.js'
import { createCardUiLayer } from './cardUiLayer.js'
import { updateAmbient } from './ambientMotion.js'
import { startRenderLoop } from './renderLoop.js'
import { bindResize } from './responsive.js'
import { sceneConfig } from './sceneConfig.js'
import { layoutHeroCopy } from './heroCopyLayout.js'
import {
  shrinkFactor,
  descendProgress,
  backgroundWashProgress,
  easeInOutQuart,
  CRYSTAL_DESCEND_DISTANCE,
  CRYSTAL_EXTRA_SPIN,
} from './scrollShrink.js'

// skipCrystal: true when PageCrystal.jsx (the page's own R3F crystal, which
// travels past this section into the carousel) is in play — see
// HeroTestPage.jsx/HeroScene.jsx. Keeps this exactly the placeholder-swap
// point the Crystal.js comment describes; the placeholder just becomes
// conditional rather than being replaced in place, since the tuned crystal
// lives in a separate, page-level React Three Fiber canvas this vanilla-
// Three scene can't host.
//
// crystalConfig: the same built-in config, passed through so this vanilla
// scene can (a) paint its matching background (see createScene.js) and
// (b) light the portraits with a point light
// standing in for the light the real crystal shader emits — that shader
// lives in the other canvas and can't itself light objects in this one.
//
// onProgress/onReady: the loading screen. The crystal itself never waits —
// it has no textures to fetch (the placeholder is a plain material, the
// tuned shader generates its own) — so it is already spinning the moment
// this mounts. What the page actually waits on is the six portrait photos;
// onProgress reports that fraction (see PortraitPlanes.js) and onReady
// fires once, the instant they've all settled, which is also when the
// cards themselves start their fade-and-settle entrance (`planes.reveal`)
// — the caller uses the same onReady to fade in the DOM layer (labels,
// headline, CTA) so both halves of the reveal start on the same frame.
export function mountHeroScene({
  canvas,
  element,
  portraits,
  labels,
  skipCrystal = false,
  crystalConfig = null,
  onProgress = () => {},
  onAssetsReady = () => {},
  onReady = () => {},
  canReveal = () => true,
  // Reads a ref's `.current` (heroTransition.js's pin progress) each
  // frame — a plain function rather than the value itself, since this
  // render loop reads it fresh every frame rather than re-running
  // mountHeroScene per tick.
  getTransitionProgress = () => 0,
  cardHoverRef = null,
}) {
  const sceneApi = createScene(canvas, crystalConfig)
  const crystal = skipCrystal
    ? { object: null, update() {}, dispose() {} }
    : createCrystal(sceneConfig.crystal)
  const crystalLight = skipCrystal
    ? createCrystalLight(sceneConfig.crystal, crystalConfig)
    : { object: null, update() {}, dispose() {} }
  let assetsReadyPending = false
  let portraitRevealAt = null
  let contentRevealAt = null
  let contentReleased = false
  let assetsLoaded = false
  let hasLeftHero = false
  let readyTimeout = null
  const planes = createPortraitPlanes(portraits, sceneConfig.sphere, (fraction) => {
    onProgress(fraction)
    // A short hold once the bar reaches 100%, rather than firing the
    // reveal on the exact same frame it fills — otherwise the bar never
    // visibly reads as "done" before it starts fading out under it.
    if (fraction >= 1 && !readyTimeout) {
      readyTimeout = setTimeout(() => {
        assetsLoaded = true
        assetsReadyPending = true
        onAssetsReady()
      }, 280)
    }
  })

  // Small while it's alone on the loading screen, growing to full size as
  // the rest of the hero arrives — the same "settle into place" beat as
  // the photos (see ambientMotion.js), just scale instead of position.
  // `revealScale` and the scroll-driven `shrinkFactor` (scrollShrink.js)
  // both scale the same object, so they're combined multiplicatively
  // each frame below rather than each owning the scale outright — either
  // can be mid-animation while the other is doing nothing (scale 1) and
  // the result still comes out right.
  const CRYSTAL_LOADING_SCALE = 0.55
  const CRYSTAL_REVEAL_DURATION = 1.5
  // The page crystal holds its small pose for 0.32s, then grows for 1.5s.
  // Photos leave a little before the halfway size — at 40% of the grow —
  // while the gem is still clearly enlarging.
  const CRYSTAL_SOLO_DURATION = 0.32 + 1.5 * 0.4
  // A longer rest-to-rest flight gives each card enough time to accelerate
  // and visibly brake. The tighter stagger keeps the sequence feeling like
  // one composed burst rather than six separate slow animations.
  const PORTRAIT_REVEAL_DURATION = 0.82
  const PORTRAIT_REVEAL_STAGGER = 0.095
  const CONTENT_REVEAL_DELAY = 0.18
  let crystalRevealStart = null
  let introReadyAt = null
  let revealScale = CRYSTAL_LOADING_SCALE
  if (crystal.object) crystal.object.scale.setScalar(CRYSTAL_LOADING_SCALE)

  if (crystal.object) sceneApi.rig.add(crystal.object)
  if (crystalLight.object) sceneApi.rig.add(crystalLight.object)
  sceneApi.rig.add(planes.object)

  // The real crystal lives in a separate page-level canvas. A second,
  // transparent renderer lets only the camera-facing cards paint above it
  // during the entrance spiral, while rear-facing cards remain in the main
  // scene below it. Once every card has settled this layer fades away and
  // the normal single-renderer hero continues as before.
  const FRONT_CARD_LAYER = 1
  const frontCanvas = document.createElement('canvas')
  frontCanvas.setAttribute('aria-hidden', 'true')
  Object.assign(frontCanvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '31',
    opacity: '0',
    transition: 'opacity 160ms ease-out',
  })
  document.body.appendChild(frontCanvas)
  // This layer is viewport-fixed. Once the hero has scrolled away, the
  // render loop stops and would otherwise leave its last frame painted
  // over every section below.
  const frontVisibility = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) frontCanvas.style.opacity = '0'
  })
  frontVisibility.observe(element)
  const frontRenderer = new THREE.WebGLRenderer({
    canvas: frontCanvas,
    antialias: true,
    alpha: true,
    // The browser composites this renderer as a transparent foreground
    // layer. Premultiplied alpha prevents low-opacity white light from
    // being multiplied twice and turning into the grey rectangular bands
    // that used to appear during hover and reverse scroll.
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
  })
  frontRenderer.outputColorSpace = THREE.SRGBColorSpace
  frontRenderer.toneMapping = THREE.NeutralToneMapping
  frontRenderer.toneMappingExposure = 1.08
  frontRenderer.setClearColor(0x000000, 0)
  frontRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, sceneConfig.dprCap))
  sceneApi.scene.traverse((node) => {
    if (node.isLight) node.layers.enable(FRONT_CARD_LAYER)
  })
  let frontLayerActive = false
  let frontDisposed = false
  const disposeFrontLayer = () => {
    if (frontDisposed) return
    frontDisposed = true
    frontLayerActive = false
    frontRenderer.dispose()
    frontCanvas.remove()
  }

  // There is only one intro per page load. If the user starts leaving the
  // hero before it has finished, settle it immediately and remember that
  // state. Returning from block two therefore reveals the finished hero,
  // never a paused or newly-started copy of the spiral.
  const finishIntro = () => {
    if (contentReleased) return
    contentReleased = true
    assetsReadyPending = false
    portraitRevealAt = null
    contentRevealAt = null
    crystalRevealStart = null
    revealScale = 1
    planes.finishReveal()
    frontLayerActive = false
    frontCanvas.style.opacity = '0'
    onReady()
  }

  const parallax = createParallax()
  window.__heroRig = sceneApi.rig
  // After the rig is populated: the chips solve their place on a card's
  // surface from its world matrix, so the cards have to be in the graph.
  sceneApi.rig.updateMatrixWorld(true)
  const chips = createChipLayer({
    labels,
    cardsById: planes.byId,
    camera: sceneApi.camera,
    element,
  })
  const cardUi = createCardUiLayer({
    meshes: planes.meshes,
    sources: portraits.map((item) => item.src),
    camera: sceneApi.camera,
    element,
  })

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2(10, 10)
  const beamHit = new THREE.Vector3()
  const beamLocal = new THREE.Vector3()
  const beamAnchor = new THREE.Vector3()
  const beamDir = new THREE.Vector3()
  const beamScreenTarget = new THREE.Vector3()
  const beamPlane = new THREE.Plane()
  const hoveredWorld = new THREE.Vector3()
  const projectedCorner = new THREE.Vector3()
  const projectedCenter = new THREE.Vector3()
  // How long the crystal keeps glancing at one card on its own, and how
  // long it waits after a real hover before it starts again.
  const AUTO_HOLD_MIN = 1.7
  const AUTO_HOLD_MAX = 2.8
  const AUTO_IDLE = 2.4
  let userHovered = null
  let autoCard = null
  let autoUntil = 0
  let userHoverIdleSince = null

  const projectedCardAt = (clientX, clientY, rect) => {
    let best = null
    let bestDistance = Infinity
    sceneApi.camera.updateMatrixWorld()
    sceneApi.rig.updateMatrixWorld(true)

    for (const mesh of planes.meshes) {
      const size = mesh.userData.size
      if (!size || mesh.material.opacity < 0.08) continue
      const halfW = size.width * 0.5
      const halfH = size.height * 0.5
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const x of [-halfW, halfW]) {
        for (const y of [-halfH, halfH]) {
          projectedCorner
            .set(x, y, 0)
            .applyMatrix4(mesh.matrixWorld)
            .project(sceneApi.camera)
          const px = rect.left + (projectedCorner.x * 0.5 + 0.5) * rect.width
          const py = rect.top + (1 - (projectedCorner.y * 0.5 + 0.5)) * rect.height
          minX = Math.min(minX, px)
          maxX = Math.max(maxX, px)
          minY = Math.min(minY, py)
          maxY = Math.max(maxY, py)
        }
      }
      // A small forgiving halo follows the projected image itself. This
      // avoids the old situation where the pointer was visibly on a curved
      // card but missed its thin 3D triangles by a few pixels.
      const pad = 14
      if (
        clientX < minX - pad || clientX > maxX + pad
        || clientY < minY - pad || clientY > maxY + pad
      ) continue

      mesh.getWorldPosition(projectedCenter).project(sceneApi.camera)
      const centerX = rect.left + (projectedCenter.x * 0.5 + 0.5) * rect.width
      const centerY = rect.top + (1 - (projectedCenter.y * 0.5 + 0.5)) * rect.height
      const distance = Math.hypot(clientX - centerX, clientY - centerY)
      if (distance < bestDistance) {
        bestDistance = distance
        best = mesh
      }
    }
    return best
  }

  const updateHoveredCard = (event) => {
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    if (
      event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom
    ) {
      clearHoveredCard()
      return
    }
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, sceneApi.camera)
    userHovered = raycaster.intersectObjects(planes.meshes, false)[0]?.object
      ?? projectedCardAt(event.clientX, event.clientY, rect)
      ?? null
    if (userHovered) {
      userHovered.userData.hoverPointer = { x: pointer.x, y: pointer.y }
    }
  }

  const clearHoveredCard = () => {
    userHovered = null
  }

  const settledCards = () => planes.meshes.filter((mesh) => (
    mesh.userData.hasRevealed
    && !mesh.userData.reveal
    && mesh.material.opacity > 0.45
  ))

  const pickAutoCard = (time) => {
    const cards = settledCards()
    if (!cards.length) {
      autoCard = null
      return
    }
    let next = cards[Math.floor(Math.random() * cards.length)]
    if (cards.length > 1 && next === autoCard) {
      const others = cards.filter((mesh) => mesh !== autoCard)
      next = others[Math.floor(Math.random() * others.length)]
    }
    autoCard = next
    autoUntil = time + AUTO_HOLD_MIN + Math.random() * (AUTO_HOLD_MAX - AUTO_HOLD_MIN)
  }

  const publishActiveCard = (mesh) => {
    for (const card of planes.meshes) {
      card.userData.hoverTarget = card === mesh ? 1 : 0
      // Light selection must never lower the photographs' opacity. Their
      // depth and focus now come from illumination and subtle movement.
      card.userData.dimOthers = 0
    }
    if (!cardHoverRef) return
    if (!mesh) {
      if (cardHoverRef.current?.active) {
        cardHoverRef.current = { ...cardHoverRef.current, active: false }
      }
      return
    }
    mesh.getWorldPosition(hoveredWorld)
    projectedCenter.copy(hoveredWorld).project(sceneApi.camera)
    // Find the first point where the centre-to-card ray enters the
    // projected photo, then move only a fifth of the way from that edge to
    // its centre. PageCrystal uses this exact contact point for the narrow
    // foreground tip, so different card sizes and desktop widths all get
    // the same small amount of light on the photograph.
    let contactX = projectedCenter.x
    let contactY = projectedCenter.y
    let farX = projectedCenter.x
    let farY = projectedCenter.y
    const size = mesh.userData.size
    if (size && crystalLight.object) {
      const halfW = size.width * 0.5
      const halfH = size.height * 0.5
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const x of [-halfW, halfW]) {
        for (const y of [-halfH, halfH]) {
          projectedCorner
            .set(x, y, 0)
            .applyMatrix4(mesh.matrixWorld)
            .project(sceneApi.camera)
          minX = Math.min(minX, projectedCorner.x)
          maxX = Math.max(maxX, projectedCorner.x)
          minY = Math.min(minY, projectedCorner.y)
          maxY = Math.max(maxY, projectedCorner.y)
        }
      }
      crystalLight.object.getWorldPosition(beamAnchor)
      beamAnchor.project(sceneApi.camera)
      const dx = projectedCenter.x - beamAnchor.x
      const dy = projectedCenter.y - beamAnchor.y
      const x0 = Math.abs(dx) < 1e-6 ? -Infinity : (minX - beamAnchor.x) / dx
      const x1 = Math.abs(dx) < 1e-6 ? Infinity : (maxX - beamAnchor.x) / dx
      const y0 = Math.abs(dy) < 1e-6 ? -Infinity : (minY - beamAnchor.y) / dy
      const y1 = Math.abs(dy) < 1e-6 ? Infinity : (maxY - beamAnchor.y) / dy
      const enter = THREE.MathUtils.clamp(
        Math.max(Math.min(x0, x1), Math.min(y0, y1)),
        0,
        1,
      )
      const edge = enter * 0.9
      const far = enter + (1 - enter) * 1.65
      contactX = beamAnchor.x + dx * edge
      contactY = beamAnchor.y + dy * edge
      farX = beamAnchor.x + dx * far
      farY = beamAnchor.y + dy * far
    }
    cardHoverRef.current = {
      active: true,
      x: projectedCenter.x,
      y: projectedCenter.y,
      contactX,
      contactY,
      farX,
      farY,
      cardId: mesh.userData.cardId,
    }
  }

  // The beam lives on the plane through the crystal centre and points at
  // the card, not at the cursor.
  const aimAtCard = (mesh) => {
    if (!crystalLight.object || !mesh) return null
    crystalLight.object.updateMatrixWorld(true)
    crystalLight.object.getWorldPosition(beamAnchor)
    sceneApi.camera.getWorldDirection(beamDir)
    beamPlane.setFromNormalAndCoplanarPoint(beamDir, beamAnchor)
    const contact = cardHoverRef?.current
    const aimScreen = (x, y) => {
      beamScreenTarget.set(x, y, 0.5).unproject(sceneApi.camera)
      beamDir.copy(beamScreenTarget).sub(sceneApi.camera.position)
      if (beamDir.lengthSq() < 1e-8) return null
      beamDir.normalize()
      raycaster.ray.origin.copy(sceneApi.camera.position)
      raycaster.ray.direction.copy(beamDir)
      if (!raycaster.ray.intersectPlane(beamPlane, beamHit)) return null
      return beamLocal.copy(beamHit).clone()
    }
    if (
      contact?.active
      && Number.isFinite(contact.farX)
      && Number.isFinite(contact.farY)
    ) {
      const far = aimScreen(contact.farX, contact.farY)
      if (!far) return null
      const front = Number.isFinite(contact.contactX)
        ? aimScreen(contact.contactX, contact.contactY)
        : null
      crystalLight.object.worldToLocal(far)
      if (front) crystalLight.object.worldToLocal(front)
      return {
        far,
        front,
        cardId: mesh.userData.cardId,
      }
    }
    mesh.getWorldPosition(hoveredWorld)
    beamDir.copy(hoveredWorld).sub(sceneApi.camera.position)
    if (beamDir.lengthSq() < 1e-8) return null
    beamDir.normalize()
    raycaster.ray.origin.copy(sceneApi.camera.position)
    raycaster.ray.direction.copy(beamDir)
    if (!raycaster.ray.intersectPlane(beamPlane, beamHit)) return null
    beamLocal.copy(beamHit)
    crystalLight.object.worldToLocal(beamLocal)
    return {
      far: beamLocal.clone(),
      cardId: mesh.userData.cardId,
    }
  }

  // Listen at window level: the real shader canvas is a fixed transparent
  // layer above this section. It has pointer-events:none, but relying on a
  // move event to bubble through the section was still inconsistent across
  // browsers. A global passive listener makes every visible card respond.
  window.addEventListener('pointermove', updateHoveredCard, { passive: true })
  window.addEventListener('blur', clearHoveredCard)

  let viewport = { width: 0, height: 0 }
  const contentEl = element.querySelector('.hero-content')
  const unbindResize = bindResize(element, (width, height) => {
    viewport = { width, height }
    sceneApi.resize(width, height)
    if (!frontDisposed) frontRenderer.setSize(width, height, false)
    layoutHeroCopy(contentEl, width, height)
  })

  const stopLoop = startRenderLoop({
    renderer: sceneApi.renderer,
    scene: sceneApi.scene,
    camera: sceneApi.camera,
    element,
    update(time, delta) {
      const transitionProgress = getTransitionProgress()
      const transitionClamped = Math.min(Math.max(transitionProgress, 0), 1)
      if (transitionClamped > 0.001) hasLeftHero = true

      // Do not let an off-screen, paused intro resume on the way back up.
      // Once the first scroll toward block two begins, its final state is
      // permanent for the rest of this page load.
      if (
        !contentReleased
        && assetsLoaded
        && canReveal()
        && hasLeftHero
      ) {
        finishIntro()
      }
      if (assetsReadyPending && canReveal()) {
        assetsReadyPending = false
        // Photos leave a little before the crystal reaches half size, while
        // it is still enlarging.
        portraitRevealAt = time + CRYSTAL_SOLO_DURATION
        crystalRevealStart = time
        introReadyAt = time
      }
      if (portraitRevealAt !== null && time >= portraitRevealAt) {
        const portraitRevealTotal = planes.reveal(
          time,
          PORTRAIT_REVEAL_STAGGER,
          PORTRAIT_REVEAL_DURATION,
        )
        frontLayerActive = true
        frontCanvas.style.opacity = '1'
        contentRevealAt = time
          + portraitRevealTotal
          + CONTENT_REVEAL_DELAY
        portraitRevealAt = null
      }
      if (!contentReleased && contentRevealAt !== null && time >= contentRevealAt) {
        finishIntro()
      }
      const descendEased = descendProgress(transitionClamped)
      sceneApi.updateBackground(time, backgroundWashProgress(transitionClamped))
      if (crystal.object) {
        if (crystalRevealStart !== null) {
          const t = Math.min(Math.max((time - crystalRevealStart) / CRYSTAL_REVEAL_DURATION, 0), 1)
          revealScale = CRYSTAL_LOADING_SCALE
            + (1 - CRYSTAL_LOADING_SCALE) * easeInOutQuart(t)
          if (t >= 1) crystalRevealStart = null
        }
        crystal.object.scale.setScalar(revealScale * shrinkFactor(transitionProgress))
      }
      parallax.apply(sceneApi.rig, delta)
      crystal.update(time)
      if (crystal.object) {
        // Applied after crystal.update(time), which sets rotation.y
        // outright each frame (it doesn't know about this) — composing
        // here rather than there keeps the idle spin and the transition
        // spin as two independent, addable things.
        crystal.object.position.y = sceneConfig.crystal.position[1] - CRYSTAL_DESCEND_DISTANCE * descendEased
        crystal.object.rotation.y += CRYSTAL_EXTRA_SPIN * descendEased
      }
      // Stays put at its initial position (createCrystalLight already set
      // it from sceneConfig.crystal) rather than chasing the crystal it
      // stands in for — that crystal is PageCrystal.jsx now, a page-level
      // element this vanilla scene has no reference to, and by the time
      // it would have moved far enough for the light's old position to
      // read as wrong, the portraits it's lighting are already faded out
      // (see fadeProgress in scrollShrink.js).
      // A real card hover wins and pauses the crystal's own glances.
      // After the pointer has stayed off the cards, those glances resume.
      let activeCard = null
      const heroLightVisible = contentReleased && transitionClamped <= 0.001
      if (heroLightVisible && userHovered) {
        activeCard = userHovered
        userHoverIdleSince = time
        autoCard = null
      } else if (
        heroLightVisible
        && (userHoverIdleSince == null || time - userHoverIdleSince >= AUTO_IDLE)
      ) {
        if (!autoCard || time >= autoUntil || autoCard.userData.reveal) pickAutoCard(time)
        activeCard = autoCard
      } else {
        autoCard = null
      }
      publishActiveCard(activeCard)
      crystalLight.update(time, aimAtCard(activeCard), {
        heroReady: heroLightVisible,
      })
      updateAmbient(planes.meshes, time, delta, {
        progress: transitionProgress,
        introElapsed: introReadyAt == null ? null : time - introReadyAt,
        camera: sceneApi.camera,
        viewport,
      })
      sceneApi.rig.updateMatrixWorld()
      chips.update(viewport.width, viewport.height)
      cardUi.update(viewport.width, viewport.height)
      const frontBeamActive = crystalLight.isFrontActive?.() ?? false
      if (frontLayerActive || frontBeamActive) {
        for (const mesh of planes.meshes) {
          if (frontLayerActive && mesh.userData.entranceInFront) {
            mesh.layers.enable(FRONT_CARD_LAYER)
            mesh.layers.disable(0)
          } else {
            mesh.layers.disable(FRONT_CARD_LAYER)
            mesh.layers.enable(0)
          }
        }
        const background = sceneApi.scene.background
        const cameraMask = sceneApi.camera.layers.mask
        sceneApi.scene.background = null
        sceneApi.camera.layers.set(FRONT_CARD_LAYER)
        frontRenderer.render(sceneApi.scene, sceneApi.camera)
        sceneApi.camera.layers.mask = cameraMask
        sceneApi.scene.background = background
        frontCanvas.style.opacity = '1'
      } else {
        frontCanvas.style.opacity = '0'
      }
    },
  })

  return () => {
    if (readyTimeout) clearTimeout(readyTimeout)
    stopLoop()
    unbindResize()
    window.removeEventListener('pointermove', updateHoveredCard)
    window.removeEventListener('blur', clearHoveredCard)
    chips.dispose()
    cardUi.dispose()
    planes.dispose()
    crystal.dispose()
    crystalLight.dispose()
    frontVisibility.disconnect()
    disposeFrontLayer()
    sceneApi.dispose()
  }
}
