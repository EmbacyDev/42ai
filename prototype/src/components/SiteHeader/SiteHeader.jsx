import { useEffect, useRef, useState } from 'react'
import RequestDemoButton from '../RequestDemoButton/RequestDemoButton.jsx'

/** The single fixed page header from Figma node 450:4450. */

const NAV_LINKS = [
  ['Vision', '#vision'],
  ['Technology', '#technology'],
  ['Applications', '#applications'],
]

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+[]{}|;:,.<>?~'
const SCRAMBLE_WINDOW = 6
const SCRAMBLE_SPEED = 85

function decodeFrame(text, step) {
  return text.split('').map((char, index) => {
    if (index < step) return { char, state: 'set' }
    if (index < step + SCRAMBLE_WINDOW) {
      const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
      return { char: glyph, state: 'scramble' }
    }
    return { char, state: 'wait' }
  })
}

function ScrambleLink({ href, children, tabIndex }) {
  const text = String(children).toUpperCase()
  const [frame, setFrame] = useState(null)
  const timer = useRef(0)

  useEffect(() => () => window.clearInterval(timer.current), [])

  const play = () => {
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
  }

  return (
    <a href={href} tabIndex={tabIndex} aria-label={children} onMouseEnter={play} onFocus={play}>
      <span className="site-header__link-sizer" aria-hidden="true">{text}</span>
      <span className="site-header__link-live" aria-hidden="true">
        {frame
          ? frame.map((glyph, index) => (
            <span key={index} className={`site-header__glyph site-header__glyph--${glyph.state}`}>
              {glyph.char}
            </span>
          ))
          : text}
      </span>
    </a>
  )
}

function HeroBar() {
  return (
    <nav className="site-header__bar site-header__bar--hero">
      <div className="site-header__main">
        <a className="site-header__logo" href="#top" aria-label="42AI">
          <img src="/hero/logo-header-v2.svg" alt="" width={105.714} height={40} />
        </a>
        <ul className="site-header__links">
          {NAV_LINKS.map(([label, href]) => (
            <li key={href}>
              <ScrambleLink href={href}>{label}</ScrambleLink>
            </li>
          ))}
        </ul>
      </div>
      <RequestDemoButton className="site-header__cta" fit="stretch" />
    </nav>
  )
}

export default function SiteHeader({ ready = true }) {
  return (
    <header
      className={`site-header site-header--top${ready ? '' : ' site-header--pending'}`}
      aria-hidden={!ready}
      inert={!ready}
    >
      <HeroBar />
    </header>
  )
}
