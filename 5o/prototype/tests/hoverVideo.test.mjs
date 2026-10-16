import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createHoverVideo } from '../src/components/HeroScene/hoverVideo.js'

test('hero video preloads and crossfades, then stops after return or when hidden', async (t) => {
  const previousDocument = globalThis.document
  let now = 0
  t.mock.method(performance, 'now', () => now)
  const mediaEvents = new Map()
  const events = new Map()
  const video = {
    readyState: 2, currentTime: 0, videoWidth: 960, videoHeight: 540,
    paused: true, loads: 0,
    addEventListener(name, fn) { mediaEvents.set(name, fn) },
    load() { this.loads++ },
    play() { this.paused = false; return Promise.resolve() },
    pause() { this.paused = true },
    removeAttribute(name) { delete this[name] },
  }
  const context = { clearRect() {}, drawImage() {} }
  globalThis.document = {
    hidden: false,
    createElement: name => name === 'video' ? video : { getContext: () => context },
    addEventListener: (name, handler) => events.set(name, handler),
    removeEventListener: name => events.delete(name),
  }
  const poster = new THREE.Texture()
  poster.userData.sourceCanvas = {}
  const mesh = { material: { map: poster }, userData: { cleanMaterial: { map: poster } } }
  const controller = createHoverVideo(mesh, { video: { src: '/hero.mp4', zoom: 1, centerX: .5, centerY: .5, offsetY: 0 }, sheet: { w: 188, h: 152 }, mask: { x: 5, y: 6, w: 171, h: 136 } }, poster)
  try {
    mediaEvents.get('loadeddata')()
    await controller.ready
    controller.update(true, false)
    assert.equal(video.src, '/hero.mp4')
    assert.equal(video.paused, true)
    controller.update(false, true)
    assert.equal(video.loads, 1)
    assert.equal(video.paused, true)
    controller.update(true, true)
    await Promise.resolve()
    assert.equal(video.paused, false)
    assert.notEqual(mesh.material.map, poster)
    video.currentTime = 1.5
    controller.update(true, true)
    now = 350
    controller.update(true, true)
    controller.update(false, true)
    assert.equal(video.paused, false)
    now = 700
    controller.update(false, true)
    assert.equal(video.paused, true)
    assert.equal(video.currentTime, 0)
    assert.notEqual(mesh.material.map, poster)
    assert.equal(mesh.userData.cleanMaterial.map, mesh.material.map)
    controller.update(true, true)
    document.hidden = true
    events.get('visibilitychange')()
    assert.equal(video.paused, true)
    assert.notEqual(mesh.material.map, poster)
  } finally {
    controller.dispose()
    globalThis.document = previousDocument
    poster.dispose()
  }
  assert.equal(video.src, undefined)
})
