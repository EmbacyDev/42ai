import * as THREE from 'three'

export function drawVideoCrop(context, source, item, width, height) {
  const sx = width / item.sheet.w, sy = height / item.sheet.h
  const { x, y, w, h } = item.mask
  const crop = item.video
  const sw = source.videoWidth || source.naturalWidth
  const sh = source.videoHeight || source.naturalHeight
  const scale = Math.max(w * sx / sw, h * sy / sh) * crop.zoom
  const dw = sw * scale, dh = sh * scale
  context.drawImage(source, (x + w / 2 + (crop.offsetX ?? 0)) * sx - dw * crop.centerX,
    (y + h * (crop.anchorY ?? .5) + crop.offsetY) * sy - dh * crop.centerY, dw, dh)
}

// Keep the authored photo silhouette while replacing only its contents.
export function createHoverVideo(mesh, item, poster) {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.loop = true
  video.preload = 'auto'
  const canvas = document.createElement('canvas')
  canvas.width = 480
  canvas.height = Math.round(480 * item.sheet.h / item.sheet.w)
  const context = canvas.getContext('2d')
  const mask = poster.userData.sourceCanvas
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.repeat.copy(poster.repeat)
  texture.offset.copy(poster.offset)
  let active = false, disposed = false, failed = false, lastTime = -1
  const firstFrame = document.createElement('canvas')
  firstFrame.width = canvas.width
  firstFrame.height = canvas.height
  let returnMix = 1, lastMix = -1
  let blend = null, waitingForPlayback = false, playRequest = 0
  const blendTo = (to, now) => {
    blend = { from: returnMix, to, at: now, duration: Math.max(1, 300 * Math.abs(to - returnMix)) }
  }
  const startPlayback = () => {
    if (!active || disposed || failed || video.seeking || video.readyState < 2) return
    const request = ++playRequest
    video.play().catch(() => {
      if (request !== playRequest || disposed || !active) return
      active = false
      waitingForPlayback = false
      blendTo(1, performance.now())
    })
  }
  video.addEventListener('seeked', () => { if (active) startPlayback() })
  const draw = () => {
    if (disposed || (returnMix < 1 && video.readyState < 2)) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (returnMix < 1) drawVideoCrop(context, video, item, canvas.width, canvas.height)
    if (returnMix > 0) {
      context.globalAlpha = returnMix
      context.drawImage(firstFrame, 0, 0)
      context.globalAlpha = 1
    }
    context.globalCompositeOperation = 'destination-in'
    context.drawImage(mask, 0, 0, canvas.width, canvas.height)
    context.globalCompositeOperation = 'source-over'
    texture.needsUpdate = true
    mesh.material.map = texture
    mesh.userData.cleanMaterial.map = texture
    lastTime = video.currentTime
    lastMix = returnMix
  }
  let resolveReady, rejectReady
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject })
  const timeout = setTimeout(() => rejectReady(new Error('Hero video load timed out')), 15000)
  video.addEventListener('loadeddata', () => {
    clearTimeout(timeout)
    drawVideoCrop(firstFrame.getContext('2d'), video, item, canvas.width, canvas.height)
    draw()
    resolveReady()
  }, { once: true })
  video.addEventListener('error', () => {
    failed = true
    video.pause()
    clearTimeout(timeout)
    rejectReady(new Error('Hero video failed to load'))
  })
  const onVisibility = () => {
    if (!document.hidden) return
    active = false
    video.pause()
    returnMix = 1
    blend = null
    waitingForPlayback = false
    playRequest += 1
    if (video.readyState > 0) video.currentTime = 0
    draw()
  }
  document.addEventListener('visibilitychange', onVisibility)
  video.src = item.video.src
  video.load()
  return {
    ready,
    update(selected, allowed) {
      if (disposed || failed) return
      const now = performance.now()
      // Finish the existing blend before changing direction, so fast hover
      // reversals never reset the displayed frame's opacity.
      if (blend) {
        const p = Math.min(1, (now - blend.at) / blend.duration)
        returnMix = blend.from + (blend.to - blend.from) * (p * p * (3 - 2 * p))
        if (p === 1) blend = null
      }
      const shouldPlay = selected && allowed && !document.hidden
      if (shouldPlay !== active) {
        active = shouldPlay
        playRequest += 1
        if (active) {
          blend = null
          waitingForPlayback = true
          startPlayback()
        } else {
          waitingForPlayback = false
          blendTo(1, now)
        }
      }
      // Keep the first frame over a pending seek/decode. Reveal only once
      // playback has actually advanced, not merely when play() was called.
      if (active && waitingForPlayback && !video.paused && !video.seeking
          && video.readyState >= 2 && video.currentTime > 0) {
        waitingForPlayback = false
        blendTo(0, now)
      }
      if (!active && !blend && returnMix === 1) {
        video.pause()
        // Draw the fully restored poster BEFORE the asynchronous rewind.
        if (lastMix !== 1) draw()
        if (!video.seeking && video.readyState > 0 && video.currentTime > 0) video.currentTime = 0
      }
      if (lastTime !== video.currentTime || returnMix !== lastMix) draw()
    },
    dispose() {
      disposed = true
      playRequest += 1
      clearTimeout(timeout)
      resolveReady()
      video.pause()
      document.removeEventListener('visibilitychange', onVisibility)
      video.removeAttribute('src')
      video.load()
      texture.dispose()
    },
  }
}
