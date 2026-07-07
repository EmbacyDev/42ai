import { NAV_LINKS } from '../../data/content'
import styles from './FooterSection.module.css'

export function FooterSection() {
  return (
    <footer className={styles.footer} id="about">
      <p className={`${styles.logo} gradientText`}>42AI</p>

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
