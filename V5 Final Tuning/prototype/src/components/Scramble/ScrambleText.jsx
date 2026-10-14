import { useState } from 'react'
import './scramble.css'

export default function ScrambleText({ text, active = false, origin = 'left' }) {
  const letters = Array.from(text)
  const middle = (letters.length - 1) / 2
  const maxDistance = Math.max(1, origin === 'center' ? middle : letters.length - 1)
  return (
    <span className={`scramble${active ? ' scramble--active' : ''}`} aria-label={text}>
      <span className="scramble__sizer" aria-hidden="true">{text}</span>
      <span className="scramble__live" aria-hidden="true">
        {letters.map((char, index) => (
          <span key={index} className="scramble__glyph" style={{
            '--reveal-delay': `${(origin === 'center' ? Math.abs(index - middle) : index) / maxDistance * 220}ms`,
          }}>{char}</span>
        ))}
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

/** An anchor whose label reveals once on hover. */
export function ScrambleLink({ text, children, ...props }) {
  const [active, handlers] = useHoverFlag()
  return (
    <a {...props} {...handlers}>
      <ScrambleText text={text ?? String(children)} active={active} />
    </a>
  )
}

/** A button with the same one-shot reveal interaction as the header links. */
export function ScrambleButton({ text, children, ...props }) {
  const [active, handlers] = useHoverFlag()
  return (
    <button {...props} {...handlers}>
      {children}
      <ScrambleText text={text ?? String(children)} active={active} />
    </button>
  )
}
