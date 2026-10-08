function whiteCore(ctx, x, y, radius) {
  const paint = ctx.createRadialGradient(x, y, 0, x, y, radius)
  paint.addColorStop(0, 'rgba(255, 255, 255, 0.96)')
  paint.addColorStop(0.18, 'rgba(255, 255, 255, 0.72)')
  paint.addColorStop(0.46, 'rgba(255, 255, 255, 0.28)')
  paint.addColorStop(0.72, 'rgba(255, 255, 255, 0.08)')
  paint.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = paint
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

function patch(ctx, x, y, radius, rgb, alpha) {
  if (radius <= 0 || alpha <= 0) return
  const paint = ctx.createRadialGradient(x, y, 0, x, y, radius)
  paint.addColorStop(0, `rgba(${rgb}, ${alpha})`)
  paint.addColorStop(0.35, `rgba(${rgb}, ${alpha * 0.45})`)
  paint.addColorStop(0.7, `rgba(${rgb}, ${alpha * 0.12})`)
  paint.addColorStop(1, `rgba(${rgb}, 0)`)
  ctx.fillStyle = paint
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

function drawCrystalLight(ctx, width, height, px, py, time, spread) {
  // The source is white. Crystal colour is only the halo around it, so the
  // letters brighten where the light falls instead of wearing their own tint.
  const reach = Math.max(width * 0.72, height * 2.2) * (0.72 + spread * 0.28)
  const wash = ctx.createRadialGradient(px, py, height * 0.02, px, py, reach)
  wash.addColorStop(0, 'rgba(255, 255, 255, 0.28)')
  wash.addColorStop(0.2, 'rgba(140, 214, 255, 0.22)')
  wash.addColorStop(0.46, 'rgba(80, 200, 146, 0.16)')
  wash.addColorStop(0.7, 'rgba(198, 210, 86, 0.1)')
  wash.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, width, height)

  const breathe = 0.5 + 0.5 * Math.sin(time * 0.9)
  const sway = Math.sin(time * 0.6) * height * 0.08
  const sway2 = Math.cos(time * 0.45) * height * 0.06
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  patch(ctx, px - reach * 0.14 + sway, py - reach * 0.03, reach * 0.4, '120, 206, 255', 0.28)
  patch(ctx, px + reach * 0.02, py + reach * 0.04 + sway2, reach * 0.36, '72, 198, 140', 0.24)
  patch(ctx, px + reach * 0.16 - sway, py + reach * 0.06, reach * 0.34, '200, 210, 78', 0.18)
  whiteCore(ctx, px, py, height * (0.28 + spread * 0.22 + breathe * 0.03))
  ctx.restore()
}

export function drawFooterHoverLight(ctx, width, height, time, px, py, reduceMotion, spread = 1) {
  ctx.clearRect(0, 0, width, height)
  const t = reduceMotion ? 0 : time
  drawCrystalLight(ctx, width, height, px, py, t, reduceMotion ? 1 : spread)
}
