import { useEffect, useRef, useState } from 'react'
import './requestDemoButton.css'
import ScrambleText from '../Scramble/ScrambleText.jsx'

export const DEMO_REST_PATH = 'M11.874 6.903L8.796 11.692C8.004 13.427 7.464 15.266 7.193 17.154C6.921 19.042 6.921 20.958 7.193 22.846C7.464 24.734 8.004 26.573 8.796 28.308L11.874 33.097C13.123 34.539 14.572 35.794 16.176 36.825C17.781 37.856 19.524 38.653 21.354 39.19C23.184 39.727 25.082 40 26.989 40H136.989C138.896 40 140.794 39.727 142.624 39.19C144.454 38.653 146.197 37.856 147.802 36.825C149.406 35.794 150.855 34.539 152.104 33.097L155.182 28.308C155.974 26.573 156.514 24.734 156.785 22.846C157.057 20.958 157.057 19.042 156.785 17.154C156.514 15.266 155.974 13.427 155.182 11.692L152.104 6.903C150.855 5.461 149.406 4.206 147.802 3.175C146.197 2.144 144.454 1.347 142.624 0.81C140.794 0.273 138.896 0 136.989 0H26.989C25.082 0 23.184 0.273 21.354 0.81C19.524 1.347 17.781 2.144 16.176 3.175C14.572 4.206 13.123 5.461 11.874 6.903Z'
const REST_PATH = DEMO_REST_PATH
export const DEMO_HOVER_PATH = 'M 13.793067 2.135067 L 0.92264 18.223111 C 0.415308 18.857244 0.161641 19.174311 0.064358 19.525956 C -0.021453 19.836178 -0.021453 20.163822 0.064358 20.474044 C 0.161641 20.825689 0.415307 21.142756 0.92264 21.776889 L 13.793067 37.864889 C 14.420267 38.648978 14.733956 39.040978 15.1232 39.3232 C 15.468089 39.573156 15.855022 39.7592 16.265689 39.872267 C 16.729244 40 17.231289 40 18.235378 40 H 145.742444 C 146.746889 40 147.248222 40 147.712222 39.872267 C 148.122889 39.7592 148.509556 39.573156 148.854444 39.3232 C 149.243778 39.040978 149.557556 38.648978 150.184222 37.864889 L 163.055333 21.776889 C 163.562 21.142756 163.816222 20.825689 163.913111 20.474044 C 163.999333 20.163822 163.999333 19.836178 163.913111 19.525956 C 163.816222 19.174311 163.562 18.857244 163.055333 18.223111 L 150.184222 2.135067 C 149.557556 1.351013 149.243778 0.958978 148.854444 0.676796 C 148.509556 0.426808 148.122889 0.24082 147.712222 0.127695 C 147.248222 0 146.746889 0 145.742444 0 H 18.235289 C 17.231289 0 16.729244 0 16.265689 0.127695 C 15.855022 0.24082 15.468089 0.426808 15.1232 0.676796 C 14.733956 0.958978 14.420267 1.351004 13.793067 2.135067 Z'
const HOVER_PATH = DEMO_HOVER_PATH

const NUMBER = /-?\d*\.?\d+/g
const REST_VALUES = REST_PATH.match(NUMBER).map(Number)
const HOVER_VALUES = HOVER_PATH.match(NUMBER).map(Number)
const PATH_TEMPLATE = REST_PATH.replace(NUMBER, '#')
const MORPH_MS = 420

// Match the width transition: cubic-bezier(.22, 1, .36, 1).
function easeShape(t) {
  if (t <= 0 || t >= 1) return t
  let low = 0
  let high = 1
  for (let i = 0; i < 16; i += 1) {
    const u = (low + high) / 2
    const x = 3 * (1 - u) ** 2 * u * 0.22 + 3 * (1 - u) * u ** 2 * 0.36 + u ** 3
    if (x < t) low = u
    else high = u
  }
  return 1 - (1 - (low + high) / 2) ** 3
}

export function demoShapePathAt(amount) {
  let index = 0
  return PATH_TEMPLATE.replace(/#/g, () => {
    const value = REST_VALUES[index] + (HOVER_VALUES[index] - REST_VALUES[index]) * amount
    index += 1
    const rounded = Math.round(value * 1000) / 1000
    return String(rounded)
  })
}

const VIEW_WIDTH = 163.978
// A longer button keeps the shape's rounded ends as drawn and lengthens
// only its straight middle: every x right of the centre moves by `extra`
// viewBox units (H takes an x; M, L and C take x,y pairs).
export function widenDemoPath(d, extra) {
  if (!extra) return d
  let command = ''
  let index = 0
  return d.replace(/[A-Za-z]|-?\d*\.?\d+/g, (token) => {
    if (/[A-Za-z]/.test(token)) {
      command = token
      index = 0
      return token
    }
    const isX = command === 'H' || (command !== 'V' && index % 2 === 0)
    index += 1
    const value = Number(token)
    if (!isX || value <= VIEW_WIDTH / 2) return token
    return String(Math.round((value + extra) * 1000) / 1000)
  })
}

export function useDemoShape(active, extra = 0) {
  const pathRef = useRef(null)
  const amountRef = useRef(0)
  const frameRef = useRef(0)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = amountRef.current
    const to = active ? 1 : 0
    if (reduced || from === to) {
      amountRef.current = to
      pathRef.current?.setAttribute('d', widenDemoPath(demoShapePathAt(to), extra))
      return undefined
    }

    const started = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - started) / MORPH_MS)
      const amount = from + (to - from) * easeShape(t)
      amountRef.current = amount
      pathRef.current?.setAttribute('d', widenDemoPath(demoShapePathAt(amount), extra))
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [active, extra])

  return pathRef
}

export default function RequestDemoButton({
  className = '',
  compact = false,
  tabIndex,
  hidden = false,
  fit = 'meet',
  label = 'Request demo',
  preserveCase = true,
  href = '#request-demo',
  forceHover = false,
  shapeFill = '#000000',
  // viewBox units added to the shape's straight middle (wider buttons).
  widen = 0,
  ...anchorProps
}) {
  const [hovering, setHovering] = useState(false)
  const hot = hovering || forceHover
  const pathRef = useDemoShape(hot, widen)

  return (
    <a
      {...anchorProps}
      className={`request-demo${compact ? ' request-demo--compact' : ''}${hot ? ' request-demo--hot' : ''}${className ? ` ${className}` : ''}`}
      href={href}
      tabIndex={tabIndex}
      aria-hidden={hidden || undefined}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <svg
        className="request-demo__shape"
        viewBox={`0 0 ${VIEW_WIDTH + widen} 40`}
        preserveAspectRatio={fit === 'stretch' ? 'none' : undefined}
        aria-hidden="true"
      >
        <path ref={pathRef} fill={shapeFill} d={widenDemoPath(REST_PATH, widen)} />
      </svg>
      <span className="request-demo__label">
        <ScrambleText text={preserveCase ? label : label.toUpperCase()} active={hot} />
      </span>
    </a>
  )
}
