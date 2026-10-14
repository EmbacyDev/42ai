// Words in each visual line share keyframes and start time. Keep the
// reveal effect on word groups instead of hundreds of individual letters.
export function playAppearLines(lines, totalSeconds = Math.max(0.9, lines.length * 0.65)) {
  const words = lines.flat()
  const duration = Math.max(1.05, totalSeconds * 0.65)
  const delay = Math.max(0.24, (totalSeconds * 1.25 - duration) / Math.max(1, lines.length - 1))
  const animations = []
  const clear = () => words.forEach((word) => { word.style.opacity = '' })
  words.forEach((word) => { word.style.opacity = '1' })
  const startTime = document.timeline.currentTime
  lines.forEach((row, lineIndex) => {
    row.forEach((word) => {
      const animation = word.animate([
        { transform: 'translateY(26px) scale(0.98)', opacity: 0, filter: 'blur(8px)' },
        { transform: 'translateY(0) scale(1)', opacity: 1, filter: 'blur(0px)' },
      ], {
        duration: duration * 800,
        delay: lineIndex * delay * 800,
        easing: 'cubic-bezier(0.37, 0, 0.63, 1)',
        fill: 'both',
      })
      if (startTime != null) animation.startTime = startTime
      animation.onfinish = () => {
        word.style.opacity = ''
        animation.cancel()
      }
      animations.push(animation)
    })
  })
  return () => { animations.forEach((animation) => animation.cancel()); clear() }
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
