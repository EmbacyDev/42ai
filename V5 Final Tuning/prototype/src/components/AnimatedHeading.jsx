import { Children, cloneElement, isValidElement, useLayoutEffect, useRef } from 'react'
import { playAppearLines, visualLines } from './appearText.js'
import './animatedHeading.css'

function splitText(children) {
  return Children.map(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return String(child).split(/(\s+)/).map((word, index) => /\s/.test(word) ? word : (
        <span className="appear-word" key={index}>
          {word}
        </span>
      ))
    }
    return isValidElement(child) && child.props.children
      ? cloneElement(child, {}, splitText(child.props.children)) : child
  })
}

function textKey(children) {
  return Children.toArray(children).map((child) => isValidElement(child)
    ? `${child.type}:${textKey(child.props.children)}` : String(child)).join('')
}

export default function AnimatedHeading({ as: Tag = 'h2', children, ...props }) {
  const ref = useRef(null)
  const contentKey = textKey(children)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const chars = [...el.querySelectorAll('.appear-word')]
    let frame = 0
    let stop = null
    let played = false
    chars.forEach((char) => { char.style.opacity = '0' })
    const check = () => {
      let visible = true
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (Number(style.opacity) < 0.1 || style.visibility === 'hidden' || style.display === 'none') { visible = false; break }
      }
      if (!visible) { frame = setTimeout(check, 100); return }
      played = true
      stop = playAppearLines(visualLines(chars))
      observer.disconnect()
    }
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(frame)
      if (entry.isIntersecting && !played) check()
    }, { threshold: 0.3 })
    observer.observe(el)
    return () => {
      observer.disconnect()
      clearTimeout(frame)
      stop?.()
      chars.forEach((char) => { char.style.opacity = '' })
    }
  }, [contentKey])
  return <Tag {...props} ref={ref}>{splitText(children)}</Tag>
}
