import { NAV_LINKS } from '../data/content'
import { LogoMark } from './LogoMark'
import styles from './SiteHeader.module.css'

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <a className={styles.logo} href="#top">
        <LogoMark />
        <span className="srOnly">42AI</span>
      </a>

      <nav className={styles.nav} aria-label="Primary">
        {NAV_LINKS.map((link) => (
          <a key={link.label} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  )
}
