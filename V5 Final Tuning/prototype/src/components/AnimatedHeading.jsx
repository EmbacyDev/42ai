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

export default function AnimatedHeading({ as: Tag = 'h2', children, reveal = 'characters', maxDurationMs = Infinity, delayMs = 0, enabled = true, lineDurationMs, lineStaggerMs, speed = 1, onRevealStart, onRevealComplete, onRevealReset, ...props }) {
  const ref = useRef(null)
  const callbacks = useRef({})
  callbacks.current = { onRevealStart, onRevealComplete, onRevealReset }
  const contentKey = textKey(children)
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
    let inView = false
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
        if (Number(style.opacity) < 0.1 || style.visibility === 'hidden' || style.display === 'none') { visible = false; break }
      }
      if (!visible) {
        if (played) reset()
        playAt = null
      } else if (!played) {
        if (playAt === null) playAt = performance.now() + delayMs
        if (performance.now() >= playAt) {
          played = true
          callbacks.current.onRevealStart?.()
          stop = (reveal === 'lines' ? playSmoothLines : playAppearLines)(visualLines(chars), maxDurationMs, { lineDurationMs, lineStaggerMs, speed, onComplete: () => callbacks.current.onRevealComplete?.() })
        }
      }
      frame = setTimeout(check, 100)
    }
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(frame)
      inView = entry.isIntersecting
      if (inView) check()
      else { reset(); playAt = null }
    }, { threshold: 0, rootMargin: '0px' })
    observer.observe(el)
    return () => {
      observer.disconnect()
      clearTimeout(frame)
      stop?.()
      chars.forEach((char) => { char.style.opacity = '' })
    }
  }, [contentKey, reveal, maxDurationMs, delayMs, enabled, lineDurationMs, lineStaggerMs, speed])
  return <Tag {...props} ref={ref} style={{ ...props.style, visibility: enabled ? props.style?.visibility : 'hidden' }}>{splitText(children, reveal !== 'characters')}</Tag>
}
