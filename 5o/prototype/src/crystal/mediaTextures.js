import * as THREE from 'three'

export function loadVideoTexture(url, signal) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'
    const release = () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    const cleanup = () => {
      clearTimeout(timeout)
      video.removeEventListener('loadeddata', ready)
      video.removeEventListener('error', fail)
      signal.removeEventListener('abort', abort)
    }
    const fail = () => {
      cleanup()
      release()
      reject(new Error(`Media unavailable: ${url}`))
    }
    const abort = () => fail()
    const ready = () => {
      cleanup()
      const texture = new THREE.VideoTexture(video)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.userData.release = release
      resolve(texture)
    }
    const timeout = setTimeout(fail, 10000)
    video.addEventListener('loadeddata', ready, { once: true })
    video.addEventListener('error', fail, { once: true })
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) return abort()
    video.src = url
    video.load()
  })
}

export function loadImageTexture(loader, url, signal) {
  return new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
    }
    const abort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(`Media unavailable: ${url}`))
    }
    const timeout = setTimeout(abort, 10000)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) return abort()
    loader.load(url, (texture) => {
      if (settled) { texture.dispose(); return }
      settled = true
      cleanup()
      texture.colorSpace = THREE.SRGBColorSpace
      resolve(texture)
    }, undefined, abort)
  })
}

export function releaseTexture(texture) {
  texture.userData.release?.()
  texture.dispose()
}

const pendingPlayback = new WeakSet()
const blockedPlayback = new WeakSet()
export function setPlayback(texture, active) {
  if (!texture.isVideoTexture) return
  const video = texture.image
  if (!active || document.hidden) {
    if (!video.paused) video.pause()
    blockedPlayback.delete(video)
    return
  }
  if (!video.paused || pendingPlayback.has(video) || blockedPlayback.has(video)) return
  pendingPlayback.add(video)
  video.play().catch(() => blockedPlayback.add(video)).finally(() => pendingPlayback.delete(video))
}

