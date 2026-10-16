import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadVideoTexture, loadImageTexture, releaseTexture, setPlayback } from '../src/crystal/mediaTextures.js'

class Video extends EventTarget {
  paused = true
  src = ''
  plays = 0
  load() {}
  pause() { this.paused = true }
  play() { this.paused = false; this.plays++; return Promise.resolve() }
  removeAttribute(name) { if (name === 'src') this.src = '' }
}
let video
const documentMock = { hidden: false, createElement: () => (video = new Video()) }
globalThis.document = documentMock

test('aborting a pending clip releases its source and rejects loading', async () => {
  const controller = new AbortController()
  const result = loadVideoTexture('/slow.mp4', controller.signal)
  controller.abort()
  await assert.rejects(result, /Media unavailable/)
  assert.equal(video.src, '')
  assert.equal(video.paused, true)
})

test('ready clips stay paused until selected; hidden pages and disposal stop decoding', async () => {
  const result = loadVideoTexture('/clip.mp4', new AbortController().signal)
  video.dispatchEvent(new Event('loadeddata'))
  const texture = await result
  assert.equal(video.plays, 0)
  setPlayback(texture, true)
  assert.equal(video.plays, 1)
  setPlayback(texture, false)
  assert.equal(video.paused, true)
  documentMock.hidden = true
  setPlayback(texture, true)
  assert.equal(video.plays, 1)
  documentMock.hidden = false
  releaseTexture(texture)
  assert.equal(video.src, '')
})

test('a failed clip releases its source', async () => {
  const result = loadVideoTexture('/broken.mp4', new AbortController().signal)
  video.dispatchEvent(new Event('error'))
  await assert.rejects(result, /Media unavailable/)
  assert.equal(video.src, '')
})

test('an image arriving after cancellation is disposed instead of retained', async () => {
  const controller = new AbortController()
  let loaded
  let disposed = false
  const result = loadImageTexture({ load(url, onLoad) { loaded = onLoad } }, '/late.png', controller.signal)
  controller.abort()
  await assert.rejects(result, /Media unavailable/)
  loaded({ dispose() { disposed = true } })
  assert.equal(disposed, true)
})
