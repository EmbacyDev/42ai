import { useRef } from 'react'
import { useSequentialReveal } from '../scrollReveal.js'
import '../scrollReveal.css'
import './siteFooter.css'

/**
 * Figma footer (307:31233). Nav row over the 42AI wordmark.
 */
export default function SiteFooter() {
  const rootRef = useRef(null)
  useSequentialReveal(rootRef)

  return (
    <footer className="site-footer" id="contact" ref={rootRef}>
      <div className="site-footer__inner">
        <nav className="site-footer__nav scroll-reveal" data-reveal="0" aria-label="Footer">
          <div className="site-footer__group">
            <a href="#technology">Technology</a>
            <a href="#applications">Product</a>
          </div>
          <div className="site-footer__group site-footer__group--end">
            <a href="#vision">About us</a>
            <a href="#contact">Contact Us</a>
          </div>
        </nav>
        <div className="site-footer__mark scroll-reveal" data-reveal="1">
          <img src="/images/v2/footer-mark.svg" alt="42AI" width={1128} height={239} />
          <span className="site-footer__chip">Personalised AI</span>
        </div>
      </div>
    </footer>
  )
}
