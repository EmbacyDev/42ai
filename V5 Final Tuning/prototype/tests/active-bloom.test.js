import assert from 'node:assert/strict'
import test from 'node:test'
import { ActiveBloomEffect } from '../src/crystal/rendering/ActiveBloomEffect.js'

test('zero → pulse → zero skips blur only at zero and keeps the same buffers', () => {
  const effect = new ActiveBloomEffect({ mipmapBlur: true, intensity: 0 })
  const renderer = {}
  const input = {}
  const target = effect.mipmapBlurPass.renderTarget
  const calls = []
  effect.luminancePass.render = (...args) => calls.push(['luminance', ...args])
  effect.mipmapBlurPass.render = (...args) => calls.push(['blur', ...args])

  try {
    effect.update(renderer, input, 1 / 60)
    assert.equal(calls.length, 0)

    effect.intensity = 0.28
    effect.update(renderer, input, 1 / 60)
    assert.deepEqual(calls, [
      ['luminance', renderer, input],
      ['blur', renderer, effect.luminancePass.renderTarget],
    ])
    assert.equal(effect.mipmapBlurPass.renderTarget, target)

    effect.intensity = 0
    effect.update(renderer, input, 1 / 60)
    assert.equal(calls.length, 2)
    assert.equal(effect.mipmapBlurPass.renderTarget, target)
  } finally {
    effect.dispose()
  }
})
