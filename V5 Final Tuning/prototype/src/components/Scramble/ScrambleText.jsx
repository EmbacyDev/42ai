import { useEffect, useRef, useState } from 'react'
import './scramble.css'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+[]{}|;:,.<>?~'
const SCRAMBLE_WINDOW = 6
// ms per decoded letter (55 / 1.3).
const SCRAMBLE_SPEED = 42

function decodeFrame(text, step) {
  return text.split('').map((char, index) => {
    if (char === ' ' || index < step) return { char, state: 'set' }
    if (index < step + SCRAMBLE_WINDOW) {
      return { char: GLYPHS[Math.floor(Math.random() * GLYPHS.length)], state: 'scramble' }
    }
    return { char, state: 'wait' }
  })
}

/**
 * Hover glitch: the label decodes left to right once each time `active`
 * turns on, then rests as plain text (its colour is the host's hover
 * colour). Leaving and coming back plays it again; staying does not loop.
 */
export default function ScrambleText({ text, active }) {
  const [frame, setFrame] = useState(null)
  const timer = useRef(0)
  const wasActive = useRef(false)

  useEffect(() => () => window.clearInterval(timer.current), [])

  useEffect(() => {
    const starting = active && !wasActive.current
    wasActive.current = active
    if (!starting) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    window.clearInterval(timer.current)
    let step = 0
    setFrame(decodeFrame(text, step))
    timer.current = window.setInterval(() => {
      step += 1
      if (step > text.length) {
        window.clearInterval(timer.current)
        setFrame(null)
        return
      }
      setFrame(decodeFrame(text, step))
    }, SCRAMBLE_SPEED)
  }, [active, text])

  return (
    <span className="scramble" aria-label={text}>
      <span className="scramble__sizer" aria-hidden="true">{text}</span>
      <span className="scramble__live" aria-hidden="true">
        {frame
          ? frame.map((glyph, index) => (
            <span key={index} className={`scramble__glyph scramble__glyph--${glyph.state}`}>
              {glyph.char}
            </span>
          ))
          : text}
      </span>
    </span>
  )
}

/** Hover/focus state for a host element, for passing to ScrambleText. */
export function useHoverFlag() {
  const [active, setActive] = useState(false)
  return [active, {
    onPointerEnter: () => setActive(true),
    onPointerLeave: () => setActive(false),
    onFocus: () => setActive(true),
    onBlur: () => setActive(false),
  }]
}

/** An anchor whose label glitches once on hover. */
export function ScrambleLink({ text, children, ...props }) {
  const [active, handlers] = useHoverFlag()
  return (
    <a {...props} {...handlers}>
      <ScrambleText text={text ?? String(children)} active={active} />
    </a>
  )
}

/** A button with the same one-shot decode interaction as the header links. */
export function ScrambleButton({ text, children, ...props }) {
  const [active, handlers] = useHoverFlag()
  return (
    <button {...props} {...handlers}>
      {children}
      <ScrambleText text={text ?? String(children)} active={active} />
    </button>
  )
}
