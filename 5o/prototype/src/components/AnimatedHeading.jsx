import { Children, cloneElement, isValidElement, useLayoutEffect, useRef } from 'react'
import { playAppearLines, playSmoothLines, visualLines } from './appearText.js'
import './animatedHeading.css'

function splitText(children, byLine = false) {
  return Children.map(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return String(child).split(/(\s+)/).map((word, index) => /\s/.test(word) ? word : (
        <span className="appear-word" key={index}>
          {byLine ? word : Array.from(word).map((char, i) => <span className="appear-char" key={i}>{char}</span>)}
        </span>
      ))
    }
    return isValidElement(child) && child.props.children
      ? cloneElement(child, {}, splitText(child.props.children, byLine)) : child
  })
}

function textKey(children) {
  return Children.toArray(children).map((child) => isValidElement(child)
    ? `${child.type}:${textKey(child.props.children)}` : String(child)).join('')
}

export default function AnimatedHeading({ as: Tag = 'h2', children, reveal = 'characters', maxDurationMs = Infinity, delayMs = 0, visibilityCheckMs = 100, once = false, viewportStart = 1, observeViewport = true, enabled = true, lineDurationMs, lineStaggerMs, blurPx = Tag === 'ul' ? 0 : 10, speed = 1, onRevealStart, onRevealComplete, onRevealReset, ...props }) {
  const ref = useRef(null)
  const callbacks = useRef({})
  callbacks.current = { onRevealStart, onRevealComplete, onRevealReset }
  const contentKey = textKey(children)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el?.closest('.physics-behavior-section__state')) return
    const syncGradient = () => {
      el.querySelectorAll('strong').forEach(phrase => {
        const words = [...phrase.querySelectorAll('.appear-word')].filter(word => word.textContent.trim())
        if (!words.length) return
        const left = Math.min(...words.map(word => word.offsetLeft))
        const right = Math.max(...words.map(word => word.offsetLeft + word.offsetWidth))
        phrase.style.setProperty('--phrase-gradient-width', `${right - left}px`)
        words.forEach(word => word.style.setProperty('--phrase-gradient-x', `${left - word.offsetLeft}px`))
      })
    }
    syncGradient()
    const observer = new ResizeObserver(syncGradient)
    observer.observe(el)
    document.fonts.ready.then(syncGradient)
    return () => observer.disconnect()
  }, [contentKey])

  useLayoutEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      callbacks.current.onRevealStart?.()
      callbacks.current.onRevealComplete?.()
      return
    }
    callbacks.current.onRevealReset?.()
    const chars = [...el.querySelectorAll('.appear-word')]
    let frame = 0
    let stop = null
    let played = false
    chars.forEach((char) => { char.style.opacity = '0' })
    let inView = !observeViewport
    const reset = () => {
      stop?.()
      stop = null
      played = false
      callbacks.current.onRevealReset?.()
      chars.forEach(char => { char.style.opacity = '0' })
    }
    let playAt = null
    const check = () => {
      if (!inView) return
      let visible = true
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node)
        // Let an outgoing facet finish fading before hiding its individual words.
        const opacityThreshold = node.classList.contains('is-copy-exiting') ? 0.001 : 0.1
        if (Number(style.opacity) < opacityThreshold || style.visibility === 'hidden' || style.display === 'none') { visible = false; break }
      }
      if (!visible) {
        if (played && !once) reset()
        playAt = null
      } else if (!played) {
        if (playAt === null) playAt = performance.now() + delayMs
        if (performance.now() >= playAt) {
          played = true
          callbacks.current.onRevealStart?.()
          stop = (reveal === 'lines' ? playSmoothLines : playAppearLines)(visualLines(chars), maxDurationMs, { lineDurationMs, lineStaggerMs, blurPx, speed, onComplete: () => callbacks.current.onRevealComplete?.() })
        }
      }
      frame = setTimeout(check, visibilityCheckMs)
    }
    // Explicitly enabled child reveals already have a visible parent. Do not
    // wait for a second intersection notification after visibility changes.
    const observer = observeViewport ? new IntersectionObserver(([entry]) => {
      clearTimeout(frame)
      inView = entry.isIntersecting
      if (inView) check()
      else { if (!once) reset(); playAt = null }
    }, { threshold: 0, rootMargin: `0px 0px -${window.innerHeight * (1 - viewportStart)}px 0px` })
    : null
    if (observer) observer.observe(el)
    else check()
    return () => {
      observer?.disconnect()
      clearTimeout(frame)
      stop?.()
      chars.forEach((char) => { char.style.opacity = '' })
    }
  }, [contentKey, reveal, maxDurationMs, delayMs, visibilityCheckMs, once, viewportStart, observeViewport, enabled, lineDurationMs, lineStaggerMs, blurPx, speed])
  return <Tag {...props} ref={ref} style={{ ...props.style, visibility: enabled ? props.style?.visibility : 'hidden' }}>{splitText(children, reveal !== 'characters')}</Tag>
}
