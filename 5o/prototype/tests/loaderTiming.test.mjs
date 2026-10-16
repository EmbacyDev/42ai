import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createIntroGate } from '../src/components/HeroScene/loaderTiming.js'
function setup() {
  let now = 0, id = 0
  const timers = new Map(), changes = []
  const gate = createIntroGate(s => changes.push(s), (fn, delay) => {
    timers.set(++id, { at: now + delay, fn }); return id
  }, key => timers.delete(key))
  const advance = time => {
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= time).sort((a,b) => a[1].at-b[1].at)[0]
      if (!due) break
      now = due[1].at; timers.delete(due[0]); due[1].fn()
    }
    now = time
  }
  return { gate, changes, advance }
}
test('fast readiness reveals without showing a loader', () => {
  const {gate,changes,advance} = setup()
  advance(300); gate.setReady(); advance(12000)
  assert.deepEqual(changes,[{shown:false,released:true}])
})
test('slow loading shows the complete five-second cycle', () => {
  const {gate,changes,advance} = setup()
  advance(1000); advance(1400); gate.setReady(); advance(5999)
  assert.deepEqual(changes,[{shown:true,released:false}])
  advance(6000); assert.deepEqual(changes.at(-1),{shown:true,released:true})
})
test('very slow loading waits for readiness after five seconds', () => {
  const {gate,changes,advance} = setup()
  advance(20000); assert.equal(changes.length,1)
  gate.setReady(); assert.equal(changes.at(-1).released,true)
})
test('unmount cancels pending and active timers', () => {
  for(const time of [300,1300]) {
    const {gate,changes,advance} = setup()
    advance(time); gate.dispose(); const count=changes.length
    gate.setReady(); advance(20000); assert.equal(changes.length,count)
  }
})
test('repeated readiness never restarts intro', () => {
  const {gate,changes} = setup()
  gate.setReady(); gate.setReady(); assert.equal(changes.length,1)
})
