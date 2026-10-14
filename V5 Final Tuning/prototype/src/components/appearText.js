// Reveal overlapping characters in reading order, preserving blur and upward motion.
export function playAppearLines(lines, maxDurationMs = Infinity, options = {}) {
  const words = lines.flat()
  const startTime = document.timeline.currentTime
  words.forEach(word => { word.style.opacity = '1' })
  const chars = words.flatMap(word => [...word.querySelectorAll('.appear-char')])
  const targets = chars.length ? chars : words
  const totalMs = Math.min(words.length * 200, maxDurationMs)
  const duration = options.lineDurationMs ?? Math.min(450, totalMs)
  const stagger = (totalMs - duration) / Math.max(1, targets.length - 1)
  // Optional row cadence keeps lists sequential while retaining the
  // heading's character-level blur, lift and scale within each row.
  const rowDelays = new Map()
  if (options.lineStaggerMs != null) {
    lines.forEach((line, row) => {
      const rowTargets = line.flatMap(word => {
        const letters = [...word.querySelectorAll('.appear-char')]
        return letters.length ? letters : [word]
      })
      rowTargets.forEach((target, index) => rowDelays.set(target,
        row * options.lineStaggerMs + index / Math.max(1, rowTargets.length - 1) * 100))
    })
  }
  const animations = targets.map((word, index) => {
    const animation = word.animate([
      { transform: 'translateY(12px) scale(0.98)', opacity: 0, filter: 'blur(10px)', offset: 0 },
      { transform: 'translateY(7px) scale(0.99)', opacity: 0.8, filter: 'blur(7px)', offset: 0.45 },
      { transform: 'translateY(0) scale(1)', opacity: 1, filter: 'blur(0px)' },
    ], {
      duration: duration / (options.speed ?? 1),
      delay: (rowDelays.get(word) ?? index * stagger) / (options.speed ?? 1),
      easing: 'cubic-bezier(0.37, 0, 0.63, 1)',
      fill: 'both',
    })
    if (startTime != null) animation.startTime = startTime
    animation.onfinish = () => {
      word.style.opacity = ''
      animation.cancel()
      if (index === targets.length - 1) options.onComplete?.()
    }
    return animation
  })
  return () => {
    animations.forEach((animation) => animation.cancel())
    words.forEach((word) => { word.style.opacity = '' })
  }
}

// Hero: each visual row moves as one unit, with overlapping reveals.
export function playSmoothLines(lines, maxDurationMs = Infinity, options = {}) {
  const totalMs = lines.flat().length * 200
  const duration = options.lineDurationMs ?? (lines.length > 1 ? totalMs * 0.8 : totalMs)
  const stagger = options.lineStaggerMs ?? ((totalMs - duration) / Math.max(1, lines.length - 1))
  const startTime = document.timeline.currentTime
  const animations = lines.flatMap((line, row) => line.map(word => {
    word.style.opacity = '1'
    const animation = word.animate([
      { transform: 'translateY(12px)', opacity: 0, filter: 'blur(10px)' },
      { transform: 'translateY(0)', opacity: 1, filter: 'blur(0px)' },
    ], {
      duration, delay: row * stagger,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both',
    })
    if (startTime != null) animation.startTime = startTime
    animation.onfinish = () => { word.style.opacity = ''; animation.cancel() }
    return animation
  }))
  return () => {
    animations.forEach(animation => animation.cancel())
    lines.flat().forEach(word => { word.style.opacity = '' })
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
