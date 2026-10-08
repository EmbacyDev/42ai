import { useEffect, useState } from 'react'
import RequestDemoButton from '../RequestDemoButton/RequestDemoButton.jsx'
import { ScrambleLink } from '../Scramble/ScrambleText.jsx'

/** The single fixed page header from Figma node 450:4450. */

const NAV_LINKS = [
  ['Vision', '#vision'],
  ['Technology', '#technology'],
  ['Applications', '#applications'],
]

function HeroBar({ onDark }) {
  return (
    <nav className="site-header__bar site-header__bar--hero">
      <div className="site-header__main">
        <a className="site-header__logo" href="#top" aria-label="42AI">
          {/* v4: the static Figma logo (450:4406 → 476:8561), 95.739×36. */}
          <img src="/images/figma/logo-header-v4.svg" alt="" />
        </a>
        <ul className="site-header__links">
          {NAV_LINKS.map(([label, href]) => (
            <li key={href}>
              <ScrambleLink href={href} text={label.toUpperCase()} />
            </li>
          ))}
        </ul>
      </div>
      <RequestDemoButton className="site-header__cta" widen={3.5} />
    </nav>
  )
}

export default function SiteHeader({ ready = true }) {
  const [onDark, setOnDark] = useState(false)

  useEffect(() => {
    const updateTheme = () => {
      const probeY = 40
      const darkSections = // Block five's dark card starts below the header, which stays in its
      // regular colours there (black logo and button, grey links).
      document.querySelectorAll('.breakthroughs-section, .site-footer')
      // Block five (the full-screen network) is dark too.
      const physics = document.querySelector('.physics-behavior-section')
      const onBlockFive = physics?.dataset.darkCard === 'true'
        && physics.getBoundingClientRect().top <= probeY
        && physics.getBoundingClientRect().bottom > probeY
      setOnDark(onBlockFive || Array.from(darkSections).some((section) => {
        const rect = section.getBoundingClientRect()
        return rect.top <= probeY && rect.bottom > probeY
      }))
    }
    updateTheme()
    window.addEventListener('scroll', updateTheme, { passive: true })
    window.addEventListener('resize', updateTheme)
    // Block five turns dark inside a locked animation; follow its flag
    // directly instead of waiting for the next scroll event.
    const physics = document.querySelector('.physics-behavior-section')
    const observer = physics ? new MutationObserver(updateTheme) : null
    observer?.observe(physics, { attributes: true, attributeFilter: ['data-dark-card'] })
    return () => {
      observer?.disconnect()
      window.removeEventListener('scroll', updateTheme)
      window.removeEventListener('resize', updateTheme)
    }
  }, [])

  return (
    <header
      className={`site-header site-header--top${ready ? '' : ' site-header--pending'}${onDark ? ' site-header--dark' : ''}`}
      aria-hidden={!ready}
      inert={!ready}
    >
      <HeroBar onDark={onDark} />
    </header>
  )
}
