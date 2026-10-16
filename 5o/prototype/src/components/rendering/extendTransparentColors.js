// Fill only RGB in fully transparent texels. Keep alpha and visible pixels
// unchanged so mipmaps interpolate edge colour instead of transparent black.
export function extendTransparentColors(data, width, height, radius = 16) {
  const count = width * height
  const filled = new Uint8Array(count)
  let edge = []
  for (let i = 0; i < count; i++) {
    if (data[i * 4 + 3] === 0) continue
    filled[i] = 1
    const x = i % width
    const y = Math.floor(i / width)
    if ((x > 0 && data[(i - 1) * 4 + 3] === 0)
      || (x + 1 < width && data[(i + 1) * 4 + 3] === 0)
      || (y > 0 && data[(i - width) * 4 + 3] === 0)
      || (y + 1 < height && data[(i + width) * 4 + 3] === 0)) edge.push(i)
  }
  for (let pass = 0; pass < radius && edge.length; pass++) {
    const next = []
    for (const i of edge) {
      const x = i % width
      const y = Math.floor(i / width)
      const spread = (to) => {
        if (filled[to]) return
        filled[to] = 1
        data[to * 4] = data[i * 4]
        data[to * 4 + 1] = data[i * 4 + 1]
        data[to * 4 + 2] = data[i * 4 + 2]
        next.push(to)
      }
      if (x > 0) spread(i - 1)
      if (x + 1 < width) spread(i + 1)
      if (y > 0) spread(i - width)
      if (y + 1 < height) spread(i + width)
    }
    edge = next
  }
  return data
}
