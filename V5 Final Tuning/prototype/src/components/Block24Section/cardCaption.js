// Shared raster layout makes the moving WebGL and resting DOM captions identical.
export function cardCaption(text, photo = false) {
  const canvas = document.createElement('canvas')
  canvas.width = 930
  canvas.height = 1104
  const ctx = canvas.getContext('2d')
  ctx.scale(3, 3)
  if (photo) {
    ctx.fillStyle = 'rgba(0,0,0,.2)'
    ctx.fillRect(0, 0, 310, 368)
  }
  const fontSize = 16 * 310 / 227
  const lineHeight = fontSize * 1.15
  const frameWidth = 137 * 310 / 227
  ctx.font = `450 ${fontSize}px "Public Sans", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.letterSpacing = `${-fontSize * .02}px`
  const lines = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > frameWidth) { lines.push(line); line = word }
    else line = next
  }
  if (line) lines.push(line)
  const top = 184 - lines.length * lineHeight / 2
  ctx.fillStyle = photo ? '#ffffff' : '#121212'
  lines.forEach((value, i) => ctx.fillText(value, 155, top + i * lineHeight))
  if (photo) {
    ctx.font = '500 10px "Geist Mono", monospace'
    ctx.letterSpacing = '.5px'
    ctx.fillStyle = 'rgba(255,255,255,.7)'
    ctx.fillText('BUILT FOR', 155, top - 24)
  }
  return canvas
}
