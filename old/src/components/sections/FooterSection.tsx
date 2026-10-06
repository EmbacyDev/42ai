import { NAV_LINKS } from '../../data/content'
import { LogoMark } from '../LogoMark'
import styles from './FooterSection.module.css'

export function FooterSection() {
  return (
    <footer className={styles.footer} id="about">
      <a className={styles.logo} href="#top" aria-label="42AI home">
        <LogoMark />
      </a>

      <nav className={styles.nav} aria-label="Footer">
        {NAV_LINKS.map((link) => (
          <a key={link.label} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
    </footer>
  )
}
