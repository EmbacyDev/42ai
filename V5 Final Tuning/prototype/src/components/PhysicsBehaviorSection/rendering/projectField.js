const mix = (a, b, t) => a + (b - a) * t

// Keep index order for labels/chains; only the later paint list is depth-sorted.
// Reuse records and seeded fill radii instead of allocating several arrays and
// an object per point per frame. All arithmetic matches the original projection.
export function projectField(field, count, pool, { fill, assembly, tilt, tc, ts,
  cameraPush, width, height, unit, flight, cameraY }) {
  const result = []
  const tiltCos = Math.cos(tilt), tiltSin = Math.sin(tilt)
  const centerY = height * mix(0.38, cameraY, flight)
  for (let index = 0; index < Math.min(field.length, count); index++) {
    const point = field[index]
    let item = pool[index]
    if (!item) {
      const sample = Math.sin((index + 1) * 127.1 + 311.7) * 43758.5453
      item = pool[index] = { point, index, radial: Math.cbrt(sample - Math.floor(sample)) }
    }
    const fillScale = mix(1, item.radial, fill)
    const rawX = mix(point.scatter[0] * .66, point.crystal[0] * fillScale, assembly)
    const rawY = mix(point.scatter[1] * .66, point.crystal[1] * fillScale, assembly)
    const rawZ = mix(point.scatter[2] * .66, point.crystal[2] * fillScale, assembly)
    const tiltedY = rawY * tiltCos - rawZ * tiltSin
    const tiltedZ = rawY * tiltSin + rawZ * tiltCos
    const x = rawX * tc + tiltedZ * ts
    item.z = -rawX * ts + tiltedZ * tc - cameraPush
    item.perspective = 5.8 / Math.max(.12, 5.8 + item.z)
    item.x = width * .5 + x * unit * item.perspective * (1 + flight * .65)
    item.y = centerY + tiltedY * unit * item.perspective * (1 + flight * .4)
    result.push(item)
  }
  return result
}
