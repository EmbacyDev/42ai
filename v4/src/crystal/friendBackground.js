// Paints the prototype crystal's solid, linear, or radial background.
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function renderFriendBackgroundCanvas(config, size = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const mode = config.friendBackgroundMode ?? 'solid'
  const color1 = config.friendBackgroundColor1 ?? '#ffffff'
  const color2 = config.friendBackgroundColor2 ?? '#eef4ff'
  const color3 = config.friendBackgroundColor3 ?? '#fff1e8'

  if (mode === 'solid') {
    ctx.fillStyle = color1
    ctx.fillRect(0, 0, size, size)
    return canvas
  }

  let gradient

  // Hero-specific side wash: colour now lives on the left and right
  // perimeter while the centre stays clean for the crystal and copy. A
  // horizontal multi-stop gradient is intentionally used instead of two
  // opaque overlays, so it remains one smooth colour field in WebGL.
  if (mode === 'side') {
    const center = config.friendBackgroundUseThird ? color3 : '#ffffff'
    const softness = clamp(config.friendBackgroundSoftness ?? 0.55, 0.08, 0.9)
    const inner = 0.26 + softness * 0.22
    const outer = 0.5 - inner
    gradient = ctx.createLinearGradient(0, size * 0.5, size, size * 0.5)
    gradient.addColorStop(0, color1)
    gradient.addColorStop(Math.max(0.18, outer), color1)
    gradient.addColorStop(inner, center)
    gradient.addColorStop(1 - inner, center)
    gradient.addColorStop(Math.min(0.82, 1 - outer), color2)
    gradient.addColorStop(1, color2)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    return canvas
  }

  if (mode === 'radial') {
    const x = (config.friendBackgroundCenterX ?? 0.5) * size
    const y = (config.friendBackgroundCenterY ?? 0.5) * size
    gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 0.78)
  } else {
    const angle = ((config.friendBackgroundAngle ?? 135) * Math.PI) / 180
    const dx = Math.cos(angle) * size * 0.72
    const dy = Math.sin(angle) * size * 0.72
    gradient = ctx.createLinearGradient(
      size * 0.5 - dx,
      size * 0.5 - dy,
      size * 0.5 + dx,
      size * 0.5 + dy,
    )
  }

  const position = clamp(config.friendBackgroundPosition ?? 0.5, 0.05, 0.95)
  const halfSoftness = clamp(config.friendBackgroundSoftness ?? 0.42, 0.02, 0.8) * 0.5
  const left = Math.max(0, position - halfSoftness)
  const right = Math.min(1, position + halfSoftness)
  gradient.addColorStop(0, color1)
  gradient.addColorStop(left, color1)
  if (config.friendBackgroundUseThird) {
    gradient.addColorStop(position, color2)
    gradient.addColorStop(right, color3)
    gradient.addColorStop(1, color3)
  } else {
    gradient.addColorStop(right, color2)
    gradient.addColorStop(1, color2)
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return canvas
}
