import test from 'node:test'
import assert from 'node:assert/strict'
import { extendTransparentColors } from '../src/components/rendering/extendTransparentColors.js'

test('transparent border inherits colour without changing coverage or visible RGB', () => {
  const data = new Uint8Array([0,0,0,0, 220,160,80,128, 0,0,0,0])
  extendTransparentColors(data, 3, 1, 1)
  assert.deepEqual([...data], [220,160,80,0, 220,160,80,128, 220,160,80,0])
  // Bilinear edge sampling no longer halves RGB before alpha blending.
  assert.equal((data[0] + data[4]) / 2, 220)
})
test('empty textures stay transparent and dilation stays within its radius', () => {
  const empty = new Uint8Array(16)
  extendTransparentColors(empty, 2, 2)
  assert.deepEqual([...empty], Array(16).fill(0))
  const data = new Uint8Array([200,100,50,255, 0,0,0,0, 0,0,0,0])
  extendTransparentColors(data, 3, 1, 1)
  assert.deepEqual([...data.slice(4)], [200,100,50,0, 0,0,0,0])
})
