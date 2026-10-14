import test from 'node:test'
import assert from 'node:assert/strict'
import { backgroundWashProgress } from '../src/components/HeroScene/scrollShrink.js'

test('hero background blends throughout the return instead of switching at the end', () => {
  assert.equal(backgroundWashProgress(0), 0)
  assert.equal(backgroundWashProgress(1), 1)
  assert.equal(backgroundWashProgress(0.5), 0.5)
  let previous = 1
  for (let i = 99; i >= 0; i--) {
    const value = backgroundWashProgress(i / 100)
    assert.ok(value < previous)
    assert.ok(previous - value < 0.02)
    previous = value
  }
})
