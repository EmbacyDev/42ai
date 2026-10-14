import * as THREE from 'three'

// Inset only the twenty broad faces, never the small bevel/corner triangles.
export function insetCrystalFaces(source, width = 0.22 / 6, depth = 0.022 / 6) {
  const geometry = source.index ? source.toNonIndexed() : source
  const position = geometry.attributes.position
  const normal = geometry.attributes.normal
  const base = new THREE.IcosahedronGeometry(1, 0)
  const directions = []
  const point = (attribute, index) => new THREE.Vector3().fromBufferAttribute(attribute, index)
  for (let i = 0; i < base.attributes.position.count; i += 3) {
    const a = point(base.attributes.position, i)
    const b = point(base.attributes.position, i + 1)
    const c = point(base.attributes.position, i + 2)
    directions.push(b.sub(a).cross(c.sub(a)).normalize())
  }
  base.dispose()
  const selected = new Map()
  for (let i = 0; i < position.count; i += 3) {
    const a = point(position, i), b = point(position, i + 1), c = point(position, i + 2)
    const cross = b.sub(a).cross(c.sub(a))
    const area = cross.length()
    const n = cross.normalize()
    const face = directions.findIndex(direction => n.dot(direction) > 0.99999)
    if (face >= 0 && area > (selected.get(face)?.area ?? 0)) selected.set(face, { index: i, area, n })
  }
  const targets = new Map([...selected.values()].map(face => [face.index, face.n]))
  const vertices = [], normals = []
  const push = (v, n) => { vertices.push(v.x, v.y, v.z); normals.push(n.x, n.y, n.z) }
  const amount = THREE.MathUtils.clamp(width, 0, 0.4)
  const insetDepth = THREE.MathUtils.clamp(depth, 0, 0.04)
  for (let i = 0; i < position.count; i += 3) {
    const outer = [0, 1, 2].map(k => point(position, i + k))
    const faceNormal = targets.get(i)
    if (!faceNormal) {
      outer.forEach((v, k) => push(v, point(normal, i + k)))
      continue
    }
    const center = outer[0].clone().add(outer[1]).add(outer[2]).divideScalar(3)
    // Two rings with different slopes catch light independently while the
    // broad central pane stays flat and clear.
    const shoulder = outer.map(v => v.clone().lerp(center, amount * 0.45)
      .addScaledVector(faceNormal, -insetDepth * 0.2))
    const inner = outer.map(v => v.clone().lerp(center, amount)
      .addScaledVector(faceNormal, -insetDepth))
    inner.forEach(v => push(v, faceNormal))
    for (const [outside, inside] of [[outer, shoulder], [shoulder, inner]]) {
      for (let k = 0; k < 3; k++) {
        const next = (k + 1) % 3
        const facetNormal = outside[next].clone().sub(outside[k])
          .cross(inside[next].clone().sub(outside[k])).normalize()
        // Each trapezoid is one optical facet, with no diagonal shading seam.
        push(outside[k], facetNormal); push(outside[next], facetNormal); push(inside[next], facetNormal)
        push(outside[k], facetNormal); push(inside[next], facetNormal); push(inside[k], facetNormal)
      }
    }
  }
  const result = new THREE.BufferGeometry()
  result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  result.computeBoundingSphere()
  if (geometry !== source) geometry.dispose()
  return result
}
