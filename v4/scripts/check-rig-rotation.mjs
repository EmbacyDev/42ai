import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const PORT = 9334
const userData = mkdtempSync(join(tmpdir(), 'hero-rig-'))
const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userData}`,
    '--window-size=1440,900',
    '--disable-background-timer-throttling',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

let nextId = 0
const pending = new Map()

function send(ws, method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId
    const timer = setTimeout(() => reject(new Error(`timeout ${method}`)), 20000)
    pending.set(id, { resolve, reject, timer })
    const payload = { id, method, params }
    if (sessionId) payload.sessionId = sessionId
    ws.send(JSON.stringify(payload))
  })
}

async function connect(url) {
  const ws = new WebSocket(url)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', () => reject(new Error('websocket failed')), { once: true })
  })
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (!msg.id || !pending.has(msg.id)) return
    const waiter = pending.get(msg.id)
    clearTimeout(waiter.timer)
    pending.delete(msg.id)
    if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error)))
    else waiter.resolve(msg.result)
  })
  return ws
}

async function waitDebug() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (response.ok) return response.json()
    } catch {
      // Chrome is still starting.
    }
    await delay(150)
  }
  throw new Error('Chrome debug port did not open')
}

const SNAPSHOT = `(() => {
  const rig = window.__heroRig
  if (!rig) return null
  rig.updateMatrixWorld(true)
  const cards = []
  rig.traverse((object) => {
    if (!object.isMesh || !object.userData?.cardId) return
    const e = object.matrixWorld.elements
    cards.push({
      id: object.userData.cardId,
      x: e[12], y: e[13], z: e[14],
      opacity: object.material?.opacity ?? 0,
      revealed: Boolean(object.userData.hasRevealed),
    })
  })
  return {
    rot: { x: rig.rotation.x, y: rig.rotation.y, z: rig.rotation.z },
    scrollY: window.scrollY,
    cards,
  }
})()`

const SWEEP = `(() => {
  const points = [[40, 80], [480, 160], [960, 280], [1380, 420], [220, 640], [1100, 180]]
  for (const [x, y] of points) {
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: x, clientY: y, bubbles: true, pointerId: 1, pointerType: 'mouse',
    }))
  }
  const hero = document.querySelector('.hero-scene')
  if (hero) {
    hero.dispatchEvent(new WheelEvent('wheel', { deltaY: 240, bubbles: true, cancelable: true }))
    hero.dispatchEvent(new WheelEvent('wheel', { deltaY: -260, bubbles: true, cancelable: true }))
  }
  return true
})()`

function maxCardShift(before, after) {
  const byId = new Map(before.cards.map((card) => [card.id, card]))
  let worst = 0
  let moved = 0
  for (const card of after.cards) {
    const prev = byId.get(card.id)
    if (!prev) continue
    const delta = Math.hypot(card.x - prev.x, card.y - prev.y, card.z - prev.z)
    worst = Math.max(worst, delta)
    if (delta > 0.05) moved += 1
  }
  return { worst, moved }
}

try {
  const version = await waitDebug()
  const ws = await connect(version.webSocketDebuggerUrl)
  const { targetId } = await send(ws, 'Target.createTarget', {
    url: 'http://[::1]:5182/hero-test',
    width: 1440,
    height: 900,
  })
  const { sessionId } = await send(ws, 'Target.attachToTarget', { targetId, flatten: true })
  await send(ws, 'Runtime.enable', {}, sessionId)
  await send(ws, 'Page.enable', {}, sessionId)

  const evaluate = async (expression) => {
    const result = await send(ws, 'Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    }, sessionId)
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'evaluate failed')
    }
    return result.result.value
  }

  let ready = null
  for (let i = 0; i < 80; i += 1) {
    ready = await evaluate(SNAPSHOT)
    const revealed = ready?.cards?.filter((card) => card.revealed && card.opacity > 0.45).length ?? 0
    if (revealed >= 4) break
    await delay(250)
    ready = null
  }
  if (!ready) throw new Error('portrait field did not finish revealing')

  await delay(400)
  const settled = await evaluate(SNAPSHOT)
  await evaluate(SWEEP)
  await delay(700)
  const afterPointer = await evaluate(SNAPSHOT)

  await evaluate('window.scrollTo(0, window.innerHeight)')
  await delay(1600)
  const inBlock2 = await evaluate(SNAPSHOT)
  await evaluate('window.scrollTo(0, 0)')
  await delay(1600)
  await evaluate(SWEEP)
  await delay(700)
  const back = await evaluate(SNAPSHOT)

  await evaluate('window.scrollTo(0, window.innerHeight)')
  await delay(1600)
  await evaluate('window.scrollTo(0, 0)')
  await delay(1600)
  await evaluate(SWEEP)
  await delay(700)
  const backAgain = await evaluate(SNAPSHOT)

  const ui = await evaluate(`(() => ({
    title: document.querySelector('.hero-content__title')?.textContent?.trim() ?? '',
    cta: document.querySelector('.hero-content__cta-label')?.textContent?.trim() ?? '',
    header: Boolean(document.querySelector('header, .site-header')),
    chips: document.querySelectorAll('.hero-labels, [data-label-id]').length,
  }))()`)

  const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' }, sessionId)
  writeFileSync(new URL('./rig-check.png', import.meta.url), Buffer.from(shot.data, 'base64'))

  const report = {
    settledRot: settled.rot,
    afterPointer: {
      rot: afterPointer.rot,
      shift: maxCardShift(settled, afterPointer),
    },
    inBlock2: { scrollY: inBlock2.scrollY, rot: inBlock2.rot },
    back: {
      scrollY: back.scrollY,
      rot: back.rot,
      shift: maxCardShift(settled, back),
    },
    backAgain: {
      scrollY: backAgain.scrollY,
      rot: backAgain.rot,
      shift: maxCardShift(settled, backAgain),
    },
    ui,
  }
  console.log(JSON.stringify(report, null, 2))

  const rotations = [settled, afterPointer, back, backAgain].map((frame) => frame.rot)
  const turned = rotations.some((rot) => Math.abs(rot.x) > 0.0001 || Math.abs(rot.y) > 0.0001)
  const fieldMoved = [report.afterPointer.shift, report.back.shift, report.backAgain.shift]
    .some((shift) => shift.moved >= 3)
  if (turned || fieldMoved) process.exitCode = 1
  if (back.scrollY > 30 || backAgain.scrollY > 30) {
    console.error('did not return to the hero')
    process.exitCode = 1
  }
} finally {
  chrome.kill()
}
