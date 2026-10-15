import test from 'node:test'
import assert from 'node:assert/strict'
import { createLandingGestureGuard } from '../src/components/PhysicsBehaviorSection/landingGestureGuard.js'

test('landing absorbs momentum but accepts a new gesture after 100ms quiet', () => {
  const guard = createLandingGestureGuard()
  guard.arm(1000)
  assert.equal(guard.consume(1040, 1), true)
  assert.equal(guard.consume(1100, 1), true)
  assert.equal(guard.consume(1200, 1), false)
  assert.equal(guard.consume(1210, 1), false)
})
test('continuous input cannot lock scrolling indefinitely', () => {
  const guard = createLandingGestureGuard()
  guard.arm(1000)
  for (let now = 1050; now < 1700; now += 50) assert.equal(guard.consume(now, 1), true)
  assert.equal(guard.consume(1700, 1), false)
})
test('reverse scrolling is immediately available', () => {
  const guard = createLandingGestureGuard()
  guard.arm(1000)
  assert.equal(guard.consume(1010, -1), false)
  assert.equal(guard.consume(1020, 1), false)
})
