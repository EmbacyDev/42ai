import * as THREE from 'three'

/**
 * Режет икосаэдр на 20 сплошных кусков.
 *
 * Каждый кусок — тетраэдр: одна внешняя треугольная грань плюс три
 * внутренние стенки, сходящиеся в центре объекта. При нулевом разлёте
 * куски складываются обратно в исходную фигуру без зазоров.
 *
 * Возвращает массив: { geometry, position, direction, rotationAxis }.
 * `position` — центр внешней грани, вокруг него кусок и вращается.
 * `direction` — наружная нормаль, вдоль неё кусок улетает.
 */
export function buildShards(radius = 1) {
  const source = new THREE.IcosahedronGeometry(radius, 0)
  const positions = source.attributes.position
  const shards = []

  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const apex = new THREE.Vector3(0, 0, 0)

  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i)
    b.fromBufferAttribute(positions, i + 1)
    c.fromBufferAttribute(positions, i + 2)

    const centroid = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3)
    const direction = centroid.clone().normalize()

    const verts = []
    const push = (p, q, r) => {
      verts.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z)
    }

    // Внешняя грань сохраняет намотку икосаэдра, внутренние — развёрнуты,
    // чтобы все нормали смотрели наружу тетраэдра.
    push(a, b, c)
    push(apex, b, a)
    push(apex, c, b)
    push(apex, a, c)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    geometry.computeVertexNormals()
    geometry.translate(-centroid.x, -centroid.y, -centroid.z)

    // Ось для лёгкого доворота куска при разлёте — любая, перпендикулярная нормали.
    const rotationAxis = new THREE.Vector3()
      .subVectors(a, centroid)
      .normalize()

    shards.push({
      geometry,
      position: centroid.toArray(),
      direction: direction.toArray(),
      rotationAxis,
    })
  }

  source.dispose()
  return shards
}
