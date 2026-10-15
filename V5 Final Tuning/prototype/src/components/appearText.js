// Shared editorial cadence, with optional blur and character-level reveal.
export function playSmoothLines(lines, maxDurationMs = Infinity, options = {}) {
  const words = lines.flat()
  const speed = options.speed ?? 1
  const duration = (options.lineDurationMs ?? 700) / speed
  const stagger = (options.lineStaggerMs ?? 150) / speed
  const total = duration + Math.max(0, lines.length - 1) * stagger
  const scale = Math.min(1, maxDurationMs / total)
  const startTime = document.timeline.currentTime
  const animations = lines.flatMap((line, row) => line.map(word => {
    word.style.opacity = '1'
    const animation = word.animate([
      { transform: 'translateY(20px)', opacity: 0, ...(options.blurPx ? { filter: `blur(${options.blurPx}px)` } : {}) },
      { transform: 'translateY(0)', opacity: 1, ...(options.blurPx ? { filter: 'blur(0px)' } : {}) },
    ], {
      duration: duration * scale, delay: row * stagger * scale,
      easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)', fill: 'both',
    })
    if (startTime != null) animation.startTime = startTime
    return animation
  }))
  let cancelled = false
  Promise.all(animations.map(animation => animation.finished)).then(() => {
    if (cancelled) return
    animations.forEach(animation => animation.cancel())
    words.forEach(word => { word.style.opacity = '' })
    options.onComplete?.()
  }).catch(() => {})
  return () => {
    cancelled = true
    animations.forEach(animation => animation.cancel())
    words.forEach(word => { word.style.opacity = '' })
  }
}

export function playAppearLines(lines, maxDurationMs = Infinity, options = {}) {
  if (!options.characters) return playSmoothLines(lines, maxDurationMs, options)
  const words = lines.flat()
  const chars = words.flatMap(word => [...word.querySelectorAll('.appear-char')])
  if (!chars.length) return playSmoothLines(lines, maxDurationMs, options)
  words.forEach(word => { word.style.opacity = '1' })
  const total = Math.min(maxDurationMs, Math.max(700, words.length * 200))
  const duration = Math.min(450, total)
  const stagger = (total - duration) / Math.max(1, chars.length - 1)
  const stop = playSmoothLines(chars.map(char => [char]), total, {
    ...options, lineDurationMs: duration, lineStaggerMs: stagger,
    onComplete: () => {
      words.forEach(word => { word.style.opacity = '' })
      options.onComplete?.()
    },
  })
  return () => {
    stop()
    words.forEach(word => { word.style.opacity = '' })
  }
}

export function visualLines(chars) {
  const rows = []
  chars.forEach((char) => {
    const top = char.getBoundingClientRect().top
    let row = rows.find((entry) => Math.abs(entry.top - top) < 4)
    if (!row) { row = { top, chars: [] }; rows.push(row) }
    row.chars.push(char)
  })
  return rows.sort((a, b) => a.top - b.top).map((row) => row.chars)
}
