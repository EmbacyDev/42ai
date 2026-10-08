import { useEffect, useRef, useState } from 'react'
import './requestDemoButton.css'

export const DEMO_REST_PATH = 'M11.874 6.903L8.796 11.692C8.004 13.427 7.464 15.266 7.193 17.154C6.921 19.042 6.921 20.958 7.193 22.846C7.464 24.734 8.004 26.573 8.796 28.308L11.874 33.097C13.123 34.539 14.572 35.794 16.176 36.825C17.781 37.856 19.524 38.653 21.354 39.19C23.184 39.727 25.082 40 26.989 40H136.989C138.896 40 140.794 39.727 142.624 39.19C144.454 38.653 146.197 37.856 147.802 36.825C149.406 35.794 150.855 34.539 152.104 33.097L155.182 28.308C155.974 26.573 156.514 24.734 156.785 22.846C157.057 20.958 157.057 19.042 156.785 17.154C156.514 15.266 155.974 13.427 155.182 11.692L152.104 6.903C150.855 5.461 149.406 4.206 147.802 3.175C146.197 2.144 144.454 1.347 142.624 0.81C140.794 0.273 138.896 0 136.989 0H26.989C25.082 0 23.184 0.273 21.354 0.81C19.524 1.347 17.781 2.144 16.176 3.175C14.572 4.206 13.123 5.461 11.874 6.903Z'
const REST_PATH = DEMO_REST_PATH
export const DEMO_HOVER_PATH = 'M15.286 1.709L1.735 17.805C0.763 18.959 0.277 19.536 0.104 20.178C-0.049 20.742 -0.033 21.34 0.149 21.896C0.357 22.527 0.872 23.077 1.904 24.178L15.302 38.482C15.826 39.041 16.089 39.321 16.4 39.521C16.675 39.699 16.978 39.83 17.296 39.91C17.655 40 18.039 40 18.805 40H145.173C145.939 40 146.323 40 146.682 39.91C147 39.83 147.303 39.699 147.578 39.521C147.889 39.321 148.151 39.041 148.676 38.482L162.074 24.178C163.106 23.077 163.621 22.527 163.828 21.896C164.011 21.34 164.027 20.742 163.874 20.178C163.701 19.536 163.215 18.959 162.243 17.805L148.692 1.709C148.163 1.08 147.898 0.766 147.575 0.541C147.289 0.341 146.97 0.192 146.632 0.102C146.251 0 145.841 0 145.02 0H18.958C18.137 0 17.726 0 17.346 0.102C17.008 0.192 16.689 0.341 16.403 0.541C16.08 0.766 15.815 1.08 15.286 1.709Z'
const HOVER_PATH = DEMO_HOVER_PATH

const NUMBER = /-?\d*\.?\d+/g
const REST_VALUES = REST_PATH.match(NUMBER).map(Number)
const HOVER_VALUES = HOVER_PATH.match(NUMBER).map(Number)
const PATH_TEMPLATE = REST_PATH.replace(NUMBER, '#')
const MORPH_MS = 260

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2
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

export function useDemoShape(active) {
  const pathRef = useRef(null)
  const amountRef = useRef(0)
  const frameRef = useRef(0)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = amountRef.current
    const to = active ? 1 : 0
    if (reduced || from === to) {
      amountRef.current = to
      pathRef.current?.setAttribute('d', demoShapePathAt(to))
      return undefined
    }

    const started = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - started) / MORPH_MS)
      const amount = from + (to - from) * easeInOutCubic(t)
      amountRef.current = amount
      pathRef.current?.setAttribute('d', demoShapePathAt(amount))
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [active])

  return pathRef
}

export default function RequestDemoButton({
  className = '',
  compact = false,
  tabIndex,
  hidden = false,
  fit = 'meet',
  label = 'Request demo',
  href = '#request-demo',
  forceHover = false,
}) {
  const [hovering, setHovering] = useState(false)
  const hot = hovering || forceHover
  const pathRef = useDemoShape(hot)

  return (
    <a
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
        viewBox="0 0 163.978 40"
        preserveAspectRatio={fit === 'stretch' ? 'none' : undefined}
        aria-hidden="true"
      >
        <path ref={pathRef} fill="#000000" d={REST_PATH} />
      </svg>
      <span className="request-demo__label">{label}</span>
    </a>
  )
}
