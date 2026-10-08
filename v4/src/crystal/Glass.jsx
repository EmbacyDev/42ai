import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import BeamPullGroup from './BeamPullGroup.jsx'
import { crystalSlosh } from '../components/HeroScene/crystalSlosh.js'
import { crystalScreen } from '../components/HeroScene/crystalScreen.js'
import { Billboard, MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { buildShards } from './shards.js'
import { facetBeamState, FACET_STEP_TILT_X, FACET_DETACH_START } from './facetBeamState.js'
import ColorCore from './ColorCore.jsx'
import PhotoBackdrop from './PhotoBackdrop.jsx'
import { parseMediaList } from './mediaList.js'
import { crystalHeroBlend, smootherstep } from '../components/HeroScene/scrollShrink.js'

// В «Сайте» кристалл рендерится заметно мельче, чем в Редакторе (см.
// scale у <group> ниже) — вынесено в общую константу, а не значение
// только внутри этого файла, потому что CursorLight (App.jsx) позиционирует
// свои спрайты/поинт-лайты в ТЕХ ЖЕ мировых координатах, что и сам
// кристалл, и его собственные константы (глубина/разлёт/размер свечения)
// должны схлопываться вместе с объектом на этот же коэффициент — см.
// комментарий у CursorLight про баг «цветная тень позади кристалла».
export const SITE_MODE_SCALE = 0.42

// Форма самого кристалла (не фигуры внутри) — икосаэдр. Разлёт на осколки
// (shards.js) построен именно под икосаэдр (двадцать треугольных граней,
// каждая — свой отдельный кусок), поэтому оболочка — фиксированная
// геометрия, а не одна из нескольких взаимозаменяемых форм.
/**
 * Округление самой ФОРМЫ, а не только рёбер.
 *
 * Фаска и фillet режут углы, но силуэт всё равно остаётся многогранником —
 * объект читается угловатым. Здесь берётся подразбитый икосаэдр (все его
 * вершины лежат на сфере) и каждая вершина сдвигается вдоль своего
 * направления между двумя положениями: на плоской грани исходного
 * икосаэдра и на описанной сфере. 0 — прежняя гранёная форма, 1 — шар,
 * между ними — мягкий «скруглённый кристалл»: грани ещё угадываются, но
 * ни одного острого угла в силуэте не остаётся.
 */
function buildRoundedShell(roundness) {
  const detail = 3
  const geo = new THREE.IcosahedronGeometry(1, detail)

  // Плоскости граней исходного икосаэдра: нормали и расстояние до центра
  // (инрадиус). Точка многогранника вдоль направления d лежит там, где луч
  // протыкает ближайшую из этих плоскостей.
  const flat = new THREE.IcosahedronGeometry(1, 0)
  const fp = flat.attributes.position
  const faceNormals = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  let inradius = Infinity
  for (let t = 0; t < fp.count / 3; t++) {
    a.fromBufferAttribute(fp, t * 3)
    b.fromBufferAttribute(fp, t * 3 + 1)
    c.fromBufferAttribute(fp, t * 3 + 2)
    const n = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize()
    if (n.dot(a) < 0) n.negate()
    faceNormals.push(n)
    inradius = Math.min(inradius, Math.abs(n.dot(a)))
  }
  flat.dispose()

  const pos = geo.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    let best = 0
    for (const n of faceNormals) best = Math.max(best, v.dot(n))
    const polyScale = inradius / Math.max(best, 1e-4)
    const scale = polyScale + (1 - polyScale) * roundness
    pos.setXYZ(i, v.x * scale, v.y * scale, v.z * scale)
  }
  pos.needsUpdate = true

  // Полное сглаживание: у скруглённой формы плоских граней уже нет, и
  // пороговое сглаживание оставило бы на ней сетку подразбиения.
  smoothNormals(geo, 180)
  return geo
}

function buildShellGeometry() {
  return new THREE.IcosahedronGeometry(1, 0)
}

/**
 * Removes the flat centre of one authored face while preserving the bevels
 * around it. The previous block-four hole was a depth mask plus a painted
 * triangle, which could only ever read as another pale facet. Keeping this
 * as real open geometry lets the coloured volume behind the shell supply the
 * depth and avoids a solid-looking cap at oblique angles.
 */
function buildShellWithOpenFaces(sourceGeometry, faceDirections) {
  const position = sourceGeometry.attributes.position
  const normal = sourceGeometry.attributes.normal
  const index = sourceGeometry.index
  const triangleCount = index ? index.count / 3 : position.count / 3
  const directions = faceDirections.map((faceDirection) => (
    new THREE.Vector3(...faceDirection).normalize()
  ))
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const centroid = new THREE.Vector3()
  const centroidDirection = new THREE.Vector3()
  const faceNormal = new THREE.Vector3()
  const positions = []
  const normals = []

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const i0 = index ? index.getX(triangle * 3) : triangle * 3
    const i1 = index ? index.getX(triangle * 3 + 1) : triangle * 3 + 1
    const i2 = index ? index.getX(triangle * 3 + 2) : triangle * 3 + 2
    a.fromBufferAttribute(position, i0)
    b.fromBufferAttribute(position, i1)
    c.fromBufferAttribute(position, i2)
    centroid.copy(a).add(b).add(c).divideScalar(3)
    centroidDirection.copy(centroid).normalize()
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    faceNormal.crossVectors(ab, ac).normalize()
    if (faceNormal.dot(centroid) < 0) faceNormal.negate()

    // The inset centre of the selected icosahedron face keeps its original
    // normal. Adjacent chamfers deliberately fall below this threshold, so
    // they remain as a narrow physical rim around the opening.
    const isOpeningFace = directions.some((direction) => (
      faceNormal.dot(direction) > 0.995
      && centroidDirection.dot(direction) > 0.94
    ))
    if (isOpeningFace) continue

    for (const vertexIndex of [i0, i1, i2]) {
      positions.push(
        position.getX(vertexIndex),
        position.getY(vertexIndex),
        position.getZ(vertexIndex),
      )
      if (normal) {
        normals.push(
          normal.getX(vertexIndex),
          normal.getY(vertexIndex),
          normal.getZ(vertexIndex),
        )
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (normals.length === positions.length) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  } else {
    geometry.computeVertexNormals()
  }
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * Инсфера (радиус вписанной сферы) для ЛЮБОЙ выпуклой геометрии с
 * плоскими гранями и центром в начале координат: минимум расстояний от
 * центра до плоскости каждого треугольника. У разных форм кристалла
 * это расстояние совсем разное (у куба — намного меньше, чем у
 * икосаэдра при том же радиусе до вершин), а именно оно, а не радиус
 * до вершин, определяет, насколько крупной может быть фигура внутри,
 * не протыкая стекло ни при каком повороте.
 */
function computeInsphereRadius(geometry) {
  const pos = geometry.attributes.position
  const index = geometry.index
  const triCount = index ? index.count / 3 : pos.count / 3
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const normal = new THREE.Vector3()
  let minDist = Infinity
  for (let i = 0; i < triCount; i++) {
    const i0 = index ? index.getX(i * 3) : i * 3
    const i1 = index ? index.getX(i * 3 + 1) : i * 3 + 1
    const i2 = index ? index.getX(i * 3 + 2) : i * 3 + 2
    a.fromBufferAttribute(pos, i0)
    b.fromBufferAttribute(pos, i1)
    c.fromBufferAttribute(pos, i2)
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    normal.crossVectors(ab, ac).normalize()
    const dist = Math.abs(normal.dot(a))
    if (dist < minDist) minDist = dist
  }
  return minDist
}

// Небольшой запас от точной инсферы — фигура вращается независимо от
// оболочки, и без запаса острые углы фигуры иногда касаются стекла
// ровно по границе.
const SAFE_MARGIN = 0.9

// Первая попытка фаски была трюком с нормалями (flat↔smooth shading) без
// правки самой геометрии — дёшево, но неправильно: силуэт кристалла
// оставался идеально острым при любом значении, а на средних-высоких
// значениях заливка внутри острого контура выглядела как отдельная
// скруглённая «подушка» с шумными краями — визуально расходилось с
// контуром. Настоящая фаска обязана резать новые грани по рёбрам, чтобы
// скруглился именно силуэт — см. bevelGeometry ниже.

/**
 * Настоящая геометрическая фаска (chamfer) для любого выпуклого
 * многогранника из треугольников: каждая исходная грань стягивается
 * к своему центру на долю bevelFraction (остаётся плоской и на той же
 * плоскости — недо-сжатая «сердцевина» грани), а промежутки между
 * соседними стянутыми гранями зашиваются новыми плоскими полосками
 * вдоль каждого ребра и маленькими гранями-«скосами» в каждой вершине.
 * Именно поэтому силуэт при этом реально скругляется, а не только
 * заливка внутри него, как в прежней версии на нормалях.
 *
 * Источник — geometry, собранная как треугольный «суп» (у каждой грани
 * свои три вершины, даже если геометрически они совпадают с вершиной
 * соседней грани — так строит икосаэдр buildShellGeometry). Раз явной
 * связности граней/рёбер нет, шаг 1 её восстанавливает — «сваривает»
 * совпадающие по координатам вершины в общий список и строит из них
 * индексированные грани, чтобы затем найти, какие две грани делят одно
 * ребро и какие грани сходятся в одной вершине.
 */
function bevelGeometry(sourceGeometry, bevelFraction) {
  if (bevelFraction <= 0) return sourceGeometry

  const pos = sourceGeometry.attributes.position
  const triCount = pos.count / 3

  // Шаг 1: сварка вершин по координатам → уникальные точки + грани-индексы.
  const uniquePositions = []
  const posIndexMap = new Map()
  const faces = []
  const tmp = new THREE.Vector3()
  const keyFor = (v) => `${v.x.toFixed(4)}|${v.y.toFixed(4)}|${v.z.toFixed(4)}`

  function weldedIndex(vertexOffset) {
    tmp.fromBufferAttribute(pos, vertexOffset)
    const k = keyFor(tmp)
    let idx = posIndexMap.get(k)
    if (idx === undefined) {
      idx = uniquePositions.length
      uniquePositions.push(tmp.clone())
      posIndexMap.set(k, idx)
    }
    return idx
  }

  for (let t = 0; t < triCount; t++) {
    faces.push([weldedIndex(t * 3), weldedIndex(t * 3 + 1), weldedIndex(t * 3 + 2)])
  }

  // Шаг 2: смежность — какие грани делят ребро, какие грани сходятся
  // в вершине.
  const edgeFaces = new Map()
  const vertexFaces = new Map()
  faces.forEach((f, fi) => {
    for (let k = 0; k < 3; k++) {
      const a = f[k]
      const b = f[(k + 1) % 3]
      const ek = a < b ? `${a}_${b}` : `${b}_${a}`
      if (!edgeFaces.has(ek)) edgeFaces.set(ek, [])
      edgeFaces.get(ek).push(fi)
    }
    for (const v of f) {
      if (!vertexFaces.has(v)) vertexFaces.set(v, [])
      vertexFaces.get(v).push(fi)
    }
  })

  // Шаг 3: у каждой грани — свой центр, нормаль (наружу от центра фигуры)
  // и «стянутая» к центру копия трёх вершин на долю bevelFraction. Стяжка
  // ВНУТРИ той же плоскости не меняет расстояние грани до центра фигуры —
  // поэтому инсфера (см. computeInsphereRadius) от фаски не зависит.
  const faceCentroids = []
  const faceNormals = []
  const insetPositions = []
  faces.forEach((f) => {
    const p0 = uniquePositions[f[0]]
    const p1 = uniquePositions[f[1]]
    const p2 = uniquePositions[f[2]]
    const centroid = p0.clone().add(p1).add(p2).divideScalar(3)
    const normal = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0)).normalize()
    if (normal.dot(centroid) < 0) normal.negate()
    faceCentroids.push(centroid)
    faceNormals.push(normal)
    insetPositions.push([p0.clone().lerp(centroid, bevelFraction), p1.clone().lerp(centroid, bevelFraction), p2.clone().lerp(centroid, bevelFraction)])
  })

  const outPositions = []

  // Порядок вершин каждого нового треугольника подгоняется под наружную
  // нормаль (а не просто записывается «как есть») — иначе часть новых
  // граней рендерилась бы с обратным порядком обхода и пропадала бы как
  // задняя грань, независимо от того, что говорит атрибут normal.
  function pushTriOutward(a, b, c) {
    const centroid = a.clone().add(b).add(c).divideScalar(3)
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
    if (normal.dot(centroid) < 0) {
      outPositions.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z)
    } else {
      outPositions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    }
  }

  // Сердцевины граней — плоские, как и были, только меньше.
  faces.forEach((f, fi) => {
    const [a, b, c] = insetPositions[fi]
    pushTriOutward(a, b, c)
  })

  // Полоски вдоль рёбер — соединяют стянутые края двух соседних граней.
  for (const [ek, faceList] of edgeFaces) {
    if (faceList.length !== 2) continue // на швах/разомкнутых краях фаска не строится
    const [ia, ib] = ek.split('_').map(Number)
    const [f1, f2] = faceList
    const p1a = insetPositions[f1][faces[f1].indexOf(ia)]
    const p1b = insetPositions[f1][faces[f1].indexOf(ib)]
    const p2a = insetPositions[f2][faces[f2].indexOf(ia)]
    const p2b = insetPositions[f2][faces[f2].indexOf(ib)]
    pushTriOutward(p1a, p1b, p2b)
    pushTriOutward(p1a, p2b, p2a)
  }

  // Скосы в вершинах — веером из маленького n-угольника, закрывающего
  // дыру там, где сходятся 3 и более гранёй.
  const u = new THREE.Vector3()
  const w = new THREE.Vector3()
  for (const [vi, faceList] of vertexFaces) {
    if (faceList.length < 3) continue
    const outward = uniquePositions[vi].clone().normalize()
    const pts = faceList.map((fi) => insetPositions[fi][faces[fi].indexOf(vi)])
    const center = pts.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(pts.length)

    u.set(Math.abs(outward.x) < 0.9 ? 1 : 0, Math.abs(outward.x) < 0.9 ? 0 : 1, 0)
    u.cross(outward).normalize()
    w.crossVectors(outward, u)

    const sorted = pts
      .map((p) => {
        const d = p.clone().sub(center)
        return { p, angle: Math.atan2(d.dot(w), d.dot(u)) }
      })
      .sort((a, b) => a.angle - b.angle)

    for (let k = 0; k < sorted.length; k++) {
      pushTriOutward(center, sorted[k].p, sorted[(k + 1) % sorted.length].p)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(outPositions, 3))
  geo.computeVertexNormals()
  return geo
}

// Настоящее скругление (fillet), а не плоская фаска (chamfer) — bevelGeometry
// сама режет только ОДНУ плоскую полоску на ребро. Повторное применение той
// же функции к её же результату несколько раз подряд, каждый раз на чуть
// меньшую долю, режет несколько всё более мелких полосок подряд — вместе
// они приближают гладкую дугу вместо одной плоской грани. Доля на шаг
// подобрана так, чтобы N повторов дали ТОТ ЖЕ суммарный отступ грани, что
// один проход с fillet=0 — «скруглённость» не меняет общую «срезанность»
// силуэта, только гладкость перехода.
function computeFilletSchedule(totalFraction, segments) {
  if (segments <= 1 || totalFraction <= 0) return [totalFraction]
  const perStep = 1 - Math.pow(1 - totalFraction, 1 / segments)
  return Array.from({ length: segments }, () => perStep)
}

/**
 * Сглаживание нормалей по углу.
 *
 * bevelGeometry отдаёт НЕиндексированную геометрию, а computeVertexNormals
 * на такой даёт плоские нормали: у каждого треугольника своя, ни с кем не
 * усреднённая. Поэтому фаска, даже разбитая на несколько полосок, читается
 * ребристой — глаз видит не дугу, а набор плоскостей.
 *
 * Здесь нормали усредняются между соседними треугольниками, но ТОЛЬКО если
 * угол между ними меньше порога. У икосаэдра соседние большие грани
 * расходятся на ~41.8°, а полоски фаски между собой — на единицы градусов.
 * Порог около 32° разделяет эти два случая: рёбра становятся гладкими,
 * а сами грани остаются плоскими и кристалл не превращается в шар.
 */
function smoothNormals(geometry, maxAngleDeg = 32) {
  const pos = geometry.attributes.position
  const triCount = pos.count / 3
  const cosLimit = Math.cos((maxAngleDeg * Math.PI) / 180)

  const key = (x, y, z) => `${x.toFixed(4)}|${y.toFixed(4)}|${z.toFixed(4)}`
  const faceNormals = []
  const vertexFaces = new Map()

  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()

  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(pos, t * 3)
    b.fromBufferAttribute(pos, t * 3 + 1)
    c.fromBufferAttribute(pos, t * 3 + 2)
    const n = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize()
    faceNormals.push(n)
    for (let k = 0; k < 3; k++) {
      const v = k === 0 ? a : k === 1 ? b : c
      const kk = key(v.x, v.y, v.z)
      let list = vertexFaces.get(kk)
      if (!list) { list = []; vertexFaces.set(kk, list) }
      list.push(t)
    }
  }

  const normals = new Float32Array(pos.count * 3)
  const acc = new THREE.Vector3()
  for (let t = 0; t < triCount; t++) {
    const own = faceNormals[t]
    for (let k = 0; k < 3; k++) {
      a.fromBufferAttribute(pos, t * 3 + k)
      const list = vertexFaces.get(key(a.x, a.y, a.z)) || [t]
      acc.set(0, 0, 0)
      for (const other of list) {
        // Усредняем только с теми соседями, чья плоскость близка к нашей —
        // иначе через общую вершину сгладились бы и большие грани.
        if (faceNormals[other].dot(own) >= cosLimit) acc.add(faceNormals[other])
      }
      if (acc.lengthSq() === 0) acc.copy(own)
      acc.normalize()
      const o = (t * 3 + k) * 3
      normals[o] = acc.x
      normals[o + 1] = acc.y
      normals[o + 2] = acc.z
    }
  }

  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  return geometry
}

function applyFillet(base, totalFraction, segments) {
  const schedule = computeFilletSchedule(totalFraction, segments)
  let geo = base
  for (const frac of schedule) geo = bevelGeometry(geo, frac)
  // Само по себе дробление фаски на полоски даёт дугу только геометрически;
  // без сглаживания нормалей она всё равно освещается как набор плоскостей.
  // Сглаживаем ровно там, где просили скругление.
  if (segments > 0) smoothNormals(geo)
  return geo
}

function FriendLightVolume({ colors, colorCount, opacity, scale, flow, paintFlow = 0, isLight = false, isOverlay = false }) {
  const material = useRef(null)
  const colorAt = (index) => colors[Math.min(index, Math.max(colorCount - 1, 0))] ?? colors[0] ?? '#ffffff'
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uFlow: { value: flow },
    uPaintFlow: { value: paintFlow },
    uOpacity: { value: opacity },
    uColorCount: { value: colorCount },
    uIsLight: { value: isLight ? 1 : 0 },
    uColor0: { value: new THREE.Color(colorAt(0)) },
    uColor1: { value: new THREE.Color(colorAt(1)) },
    uColor2: { value: new THREE.Color(colorAt(2)) },
    uColor3: { value: new THREE.Color(colorAt(3)) },
    uColor4: { value: new THREE.Color(colorAt(4)) },
  }), [])

  useFrame(({ clock }) => {
    if (!material.current) return
    material.current.uniforms.uTime.value = clock.elapsedTime
    material.current.uniforms.uFlow.value = flow
    material.current.uniforms.uPaintFlow.value = paintFlow
    material.current.uniforms.uOpacity.value = opacity
    material.current.uniforms.uColorCount.value = colorCount
    material.current.uniforms.uIsLight.value = isLight ? 1 : 0
    material.current.uniforms.uColor0.value.set(colorAt(0))
    material.current.uniforms.uColor1.value.set(colorAt(1))
    material.current.uniforms.uColor2.value.set(colorAt(2))
    material.current.uniforms.uColor3.value.set(colorAt(3))
    material.current.uniforms.uColor4.value.set(colorAt(4))
  })

  const volume = (
    <mesh scale={scale} renderOrder={isLight ? 4.5 : isOverlay ? 4.25 : -2}>
      {isLight
        ? <planeGeometry args={[2, 2, 1, 1]} />
        : <sphereGeometry args={[1, 48, 48]} />}
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={!isLight && !isOverlay}
        side={THREE.FrontSide}
        toneMapped={false}
        blending={isLight ? THREE.AdditiveBlending : THREE.NormalBlending}
        vertexShader={`
          uniform float uTime;
          uniform float uFlow;
          uniform float uPaintFlow;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;
          varying vec3 vLocalPosition;
          void main() {
            vec3 deformed = position;
            float deformation = min(uPaintFlow, 1.6) * (0.09 + uFlow * 0.12);
            float time = uTime * (0.34 + uFlow * 0.22);
            float waveX = sin(position.y * 3.4 + time + sin(position.z * 2.1 - time * 0.7));
            float waveY = sin(position.z * 2.8 - time * 0.82 + sin(position.x * 3.0 + time * 0.54));
            float waveZ = sin(position.x * 3.2 + time * 0.66 + cos(position.y * 2.4 - time));
            deformed += normalize(position) * vec3(waveX, waveY, waveZ) * deformation;
            deformed.x += waveY * deformation * 0.34;
            deformed.y += waveX * deformation * 0.26;
            vLocalPosition = deformed;
            vec4 viewPosition = modelViewMatrix * vec4(deformed, 1.0);
            vNormalView = normalize(normalMatrix * normal);
            vViewDirection = normalize(-viewPosition.xyz);
            gl_Position = projectionMatrix * viewPosition;
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uFlow;
          uniform float uPaintFlow;
          uniform float uOpacity;
          uniform float uIsLight;
          uniform float uColorCount;
          uniform vec3 uColor0;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform vec3 uColor3;
          uniform vec3 uColor4;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;
          varying vec3 vLocalPosition;

          float paintHash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }

          float paintNoise(vec2 p) {
            vec2 cell = floor(p);
            vec2 local = fract(p);
            local = local * local * (3.0 - 2.0 * local);
            float a = paintHash(cell);
            float b = paintHash(cell + vec2(1.0, 0.0));
            float c = paintHash(cell + vec2(0.0, 1.0));
            float d = paintHash(cell + vec2(1.0, 1.0));
            return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
          }

          float paintFbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.54;
            mat2 turn = mat2(0.80, -0.60, 0.60, 0.80);
            for (int i = 0; i < 3; i++) {
              value += paintNoise(p) * amplitude;
              p = turn * p * 1.92 + vec2(1.7, -0.9);
              amplitude *= 0.5;
            }
            return value;
          }

          vec3 paintPalette(float t) {
            t = smoothstep(0.0, 1.0, clamp(t, 0.0, 1.0));
            if (uColorCount < 1.5) return uColor0;
            float position = t * (uColorCount - 1.0);
            if (position < 1.0) return mix(uColor0, uColor1, smoothstep(0.0, 1.0, position));
            if (position < 2.0) return mix(uColor1, uColor2, smoothstep(0.0, 1.0, position - 1.0));
            if (position < 3.0) return mix(uColor2, uColor3, smoothstep(0.0, 1.0, position - 2.0));
            return mix(uColor3, uColor4, smoothstep(0.0, 1.0, position - 3.0));
          }

          void main() {
            float facing = max(dot(normalize(vNormalView), normalize(vViewDirection)), 0.0);
            float softDisc = smoothstep(0.0, 0.92, pow(facing, 0.78));
            if (uIsLight > 0.5) {
              float lightTime = uTime * (0.12 + uFlow * 0.08);
              vec2 lightUv = vLocalPosition.xy;
              float lightWarpA = paintFbm(lightUv * 1.45 + vec2(lightTime, -lightTime * 0.63));
              float lightWarpB = paintFbm(
                lightUv * 1.72 + vec2(-lightTime * 0.52, lightTime * 0.74) + lightWarpA * 1.25
              );
              vec2 liquidUv = lightUv + (vec2(lightWarpA, lightWarpB) - 0.5) * 0.58;
              liquidUv.x += sin(liquidUv.y * 3.1 + lightTime * 1.7) * 0.09;
              liquidUv.y += sin(liquidUv.x * 2.4 - lightTime * 1.2) * 0.07;

              float liquidDistance = length(liquidUv * vec2(0.92, 1.08));
              float breathingEdge = (lightWarpA - 0.5) * 0.34 + (lightWarpB - 0.5) * 0.2;
              float cloud = 1.0 - smoothstep(0.22, 0.93, liquidDistance + breathingEdge);
              float verticalPlume = exp(-pow(abs(liquidUv.x) * 2.1, 2.0))
                * (1.0 - smoothstep(0.25, 1.05, abs(liquidUv.y + 0.08)));
              float lightShape = 1.0 - smoothstep(0.2, 1.2, liquidDistance);
              lightShape *= smoothstep(0.0, 0.42, facing);

              float hotCore = exp(-dot(liquidUv, liquidUv) * 1.45) * lightShape;
              float aura = exp(-liquidDistance * 1.05) * lightShape;
              float shimmer = 0.97 + sin(uTime * 0.62) * 0.03;
              vec3 centerColor = paintPalette(0.0);
              vec3 radiantColor = mix(centerColor * 0.95, vec3(1.0, 0.95, 0.76) * 1.12, hotCore * 0.55);
              float radiantAlpha = uOpacity * (lightShape * 0.28 + aura * 0.34 + hotCore * 0.24);
              gl_FragColor = vec4(radiantColor * shimmer, radiantAlpha);
              #include <colorspace_fragment>
              return;
            }
            float amount = clamp(uPaintFlow, 0.0, 2.2);
            float time = uTime * (0.075 + uFlow * 0.05);
            vec2 uv = vLocalPosition.xy * 0.72;
            float warpA = paintFbm(uv + vec2(time, -time * 0.72));
            float warpB = paintFbm(uv * 1.12 + vec2(-time * 0.58, time * 0.83) + warpA * 1.35);
            vec2 warpedUv = uv + (vec2(warpA, warpB) - 0.5) * (2.1 * amount);
            float field = paintFbm(warpedUv * 0.82 + vec2(time * 0.34, -time * 0.27));
            float broadBand = smoothstep(0.3, 0.7, field);
            float silkEdge = 1.0 - smoothstep(0.0, 0.16, abs(field - 0.53));
            float liquidDisc = smoothstep(
              0.025,
              0.92,
              softDisc + (field - 0.5) * 0.38 * min(amount, 1.25)
            );
            float paintLight = 0.84 + broadBand * 0.22 + silkEdge * 0.24;
            paintLight = mix(1.0, paintLight, min(amount, 1.0));
            float palettePosition = clamp(field * 0.88 + warpA * 0.2 - 0.04, 0.0, 1.0);
            vec3 flowingColor = paintPalette(palettePosition);
            flowingColor *= 1.0 + silkEdge * min(amount, 1.15) * 0.24;
            float flowingAlpha = 0.94 + broadBand * 0.06;
            gl_FragColor = vec4(flowingColor * paintLight, liquidDisc * uOpacity * flowingAlpha);
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  )

  return isLight
    ? <Billboard follow lockX={false} lockY={false} lockZ={false}>{volume}</Billboard>
    : volume
}

function FriendLightCore({ config }) {
  const group = useRef(null)
  const centerColor = config.friendCenterColor ?? '#ffdf7d'
  const size = config.friendCoreSize ?? 0.6
  const centerSize = config.friendCenterSize ?? 1
  const stretch = config.friendCoreStretch ?? 0.86
  const pulseAmount = config.friendPulse ?? 0.175
  const flowAmount = config.friendFlow ?? 0.79
  const centerPower = config.friendCenterPower ?? 0.56
  // Внутри читается одно тёплое тело лампы — как на референсе с матовым
  // кубом. Полная палитра давала вдобавок отдельное сиреневое пятно сбоку,
  // которого на референсе нет и которое спорило с пятном проекции.
  //
  // Тело лампы — часть той же «жёлтой середины», что и горячее ядро
  // проекции, поэтому сжимается тем же ползунком «center size».
  const entitySize = Math.min(size, 0.42) * centerSize
  // Дочерний объём масштабируется ещё раз — предел по высоте считается из
  // реального множителя. Ближайшая грань икосаэдра лежит примерно на 0.795
  // от центра, 0.76 — запас, чтобы светящаяся сущность не выходила наружу
  // ни при каком сочетании «light stretch», «light pulse» и «center size».
  const childScale = [1.3, 1.36, 1.2]
  const INSIDE_LIMIT = 0.76

  useFrame(({ clock }) => {
    if (!group.current) return
    const time = clock.elapsedTime
    const pulse = Math.sin(time * 0.43) * pulseAmount
    const drift = flowAmount * 0.035
    group.current.position.set(
      Math.sin(time * 0.19) * drift,
      0.02 + Math.sin(time * 0.16 + 0.8) * drift * 1.25,
      Math.cos(time * 0.17) * drift * 0.6,
    )
    const scaleY = Math.min(
      entitySize * stretch * (1 + pulse),
      INSIDE_LIMIT / childScale[1],
    )
    const scaleXZ = Math.min(
      entitySize * (1 + pulse * 0.35),
      INSIDE_LIMIT / Math.max(childScale[0], childScale[2]),
    )
    group.current.scale.set(scaleXZ, scaleY, scaleXZ)
  })

  return (
    <group ref={group}>
      <FriendLightVolume
        colors={[centerColor]}
        colorCount={1}
        opacity={0.3}
        scale={childScale}
        flow={flowAmount}
        paintFlow={0}
      />
      <FriendLightVolume
        colors={[centerColor]}
        colorCount={1}
        opacity={Math.min(0.16 + centerPower * 0.08, 0.42)}
        scale={[1.12, 1.42, 1.0]}
        flow={flowAmount}
        paintFlow={0}
        isLight
      />
    </group>
  )
}

function FriendShellGlow({ geometry, config }) {
  const material = useRef(null)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPower: { value: 4.1 },
    uFlow: { value: 0.79 },
    uSpread: { value: 0.25 },
    uMatte: { value: 0.41 },
    uSize: { value: 0.6 },
    uStretch: { value: 0.86 },
    uCenterPower: { value: 0.56 },
    uLightColor: { value: new THREE.Color('#ffdf7d') },
    uHaloColor: { value: new THREE.Color('#ff4a2d') },
  }), [])

  useFrame(({ clock }) => {
    if (!material.current) return
    const live = material.current.uniforms
    live.uTime.value = clock.elapsedTime
    live.uPower.value = FRIEND_LIGHT_POWER
    live.uFlow.value = config.friendFlow ?? 0.79
    live.uSpread.value = config.friendLightSpread ?? 0.25
    live.uMatte.value = config.friendMatte ?? 0.41
    live.uSize.value = config.friendCoreSize ?? 0.6
    live.uStretch.value = config.friendCoreStretch ?? 0.86
    live.uCenterPower.value = config.friendCenterPower ?? 0.56
    live.uLightColor.value.set(config.friendCenterColor ?? '#ffdf7d')
    live.uHaloColor.value.set(config.friendFlowColor1 ?? '#ff4a2d')
  })

  return (
    <mesh geometry={geometry} scale={1.002} renderOrder={4}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        vertexShader={`
          varying vec3 vLocalPosition;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;
          void main() {
            vLocalPosition = position;
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            vNormalView = normalize(normalMatrix * normal);
            vViewDirection = normalize(-viewPosition.xyz);
            gl_Position = projectionMatrix * viewPosition;
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uPower;
          uniform float uFlow;
          uniform float uSpread;
          uniform float uMatte;
          uniform float uSize;
          uniform float uStretch;
          uniform float uCenterPower;
          uniform vec3 uLightColor;
          uniform vec3 uHaloColor;
          varying vec3 vLocalPosition;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;

          void main() {
            float t = uTime * (0.16 + uFlow * 0.08);
            vec3 lightPosition = vec3(
              sin(t * 1.13) * 0.035 * uFlow,
              0.02 + sin(t * 0.91 + 0.8) * 0.044 * uFlow,
              cos(t * 1.07) * 0.02 * uFlow
            );
            vec3 delta = vLocalPosition - lightPosition;
            delta.y /= max(uStretch, 0.55);
            float radialDistance = length(delta) / max(uSize, 0.15);
            float diffusion = exp(-radialDistance * mix(1.1, 0.58, uSpread));
            float hot = exp(-radialDistance * 1.3);
            vec3 localNormal = normalize(cross(dFdx(vLocalPosition), dFdy(vLocalPosition)));
            float planeResponse = 0.68 + abs(dot(localNormal, normalize(-delta))) * 0.32;
            float fresnel = pow(1.0 - max(dot(normalize(vNormalView), normalize(vViewDirection)), 0.0), 1.7);
            float matteDiffusion = mix(0.58, 1.12, uMatte);
            float energy = diffusion * uPower * matteDiffusion * planeResponse * 0.68;
            vec3 warmLight = mix(uHaloColor, uLightColor, clamp(diffusion * 1.72, 0.0, 1.0));
            vec3 color = warmLight * energy;
            color += vec3(1.0, 0.95, 0.78) * hot * uCenterPower * 0.15;
            color += uLightColor * fresnel * energy * 0.08;
            float alpha = clamp(energy * mix(0.08, 0.16, uMatte), 0.0, 0.36);
            gl_FragColor = vec4(color, alpha);
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  )
}

function FriendFrostLayer({ geometry, config }) {
  const material = useRef(null)
  const uniforms = useMemo(() => ({
    uFrost: { value: 0 },
    uBlur: { value: 0.37 },
    uEdgeClarity: { value: 0.01 },
    uDiffusion: { value: 0.18 },
    uTransparency: { value: 0.42 },
    uSize: { value: 0.6 },
    uStretch: { value: 0.86 },
    uLightColor: { value: new THREE.Color('#ffdf7d') },
    uHaloColor: { value: new THREE.Color('#ff4a2d') },
    uColorCount: { value: 3 },
    uColor0: { value: new THREE.Color('#ff4a2d') },
    uColor1: { value: new THREE.Color('#ff9d12') },
    uColor2: { value: new THREE.Color('#ffe66d') },
    uColor3: { value: new THREE.Color('#ff3f88') },
    uColor4: { value: new THREE.Color('#7f4cff') },
  }), [])

  useFrame(() => {
    if (!material.current) return
    const live = material.current.uniforms
    live.uFrost.value = config.friendFrost ?? 0
    live.uBlur.value = config.friendGlassBlur ?? 0.37
    live.uEdgeClarity.value = config.friendEdgeClarity ?? 0.01
    live.uDiffusion.value = config.friendLightDiffusion ?? 0.18
    live.uTransparency.value = config.friendTransparency ?? 0.42
    live.uSize.value = config.friendCoreSize ?? 0.6
    live.uStretch.value = config.friendCoreStretch ?? 0.86
    live.uLightColor.value.set(config.friendCenterColor ?? '#ffdf7d')
    live.uHaloColor.value.set(config.friendFlowColor1 ?? '#ff4a2d')
    live.uColorCount.value = Math.round(config.friendColorCount ?? 3)
    live.uColor0.value.set(config.friendFlowColor1 ?? '#ff4a2d')
    live.uColor1.value.set(config.friendFlowColor2 ?? '#ff9d12')
    live.uColor2.value.set(config.friendFlowColor3 ?? '#ffe66d')
    live.uColor3.value.set(config.friendFlowColor4 ?? '#ff3f88')
    live.uColor4.value.set(config.friendFlowColor5 ?? '#7f4cff')
  })

  return (
    <mesh geometry={geometry} scale={1.003} renderOrder={2.8}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
        blending={THREE.NormalBlending}
        vertexShader={`
          varying vec3 vLocalPosition;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;
          void main() {
            vLocalPosition = position;
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            vNormalView = normalize(normalMatrix * normal);
            vViewDirection = normalize(-viewPosition.xyz);
            gl_Position = projectionMatrix * viewPosition;
          }
        `}
        fragmentShader={`
          uniform float uFrost;
          uniform float uBlur;
          uniform float uEdgeClarity;
          uniform float uDiffusion;
          uniform float uTransparency;
          uniform float uSize;
          uniform float uStretch;
          uniform vec3 uLightColor;
          uniform vec3 uHaloColor;
          uniform float uColorCount;
          uniform vec3 uColor0;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform vec3 uColor3;
          uniform vec3 uColor4;
          varying vec3 vLocalPosition;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;

          vec3 surfacePalette(float t) {
            float count = clamp(floor(uColorCount + 0.5), 2.0, 5.0);
            float scaled = clamp(t, 0.0, 0.9999) * (count - 1.0);
            if (scaled < 1.0) return mix(uColor0, uColor1, scaled);
            if (scaled < 2.0) return mix(uColor1, uColor2, scaled - 1.0);
            if (scaled < 3.0) return mix(uColor2, uColor3, scaled - 2.0);
            return mix(uColor3, uColor4, scaled - 3.0);
          }

          void main() {
            float facing = abs(dot(normalize(vNormalView), normalize(vViewDirection)));
            float edge = pow(1.0 - facing, 1.25);
            float clearEdge = 1.0 - edge * uEdgeClarity;
            float faceVeil = smoothstep(0.05, 0.92, facing);

            vec3 coreDelta = vLocalPosition;
            coreDelta.y /= max(uStretch, 0.55);
            float radialDistance = length(coreDelta) / max(uSize, 0.15);
            float lightVeil = exp(-radialDistance * mix(1.0, 0.3, uDiffusion));

            float frostAlpha = uFrost * (0.14 + uBlur * 0.28) * faceVeil * clearEdge;
            frostAlpha *= mix(1.18, 0.92, uTransparency);
            frostAlpha += lightVeil * uDiffusion * 0.07;

            float microA = sin(dot(vLocalPosition, vec3(43.1, 57.7, 71.3)));
            float microB = sin(dot(vLocalPosition, vec3(-67.4, 38.6, 52.9)) + microA * 0.7);
            float microFrost = 0.5 + 0.5 * microA * microB;
            float broadHaze = 0.5 + 0.5 * sin(
              vLocalPosition.x * 4.1 + sin(vLocalPosition.y * 3.3) + vLocalPosition.z * 2.7
            );
            frostAlpha *= 0.94 + microFrost * 0.08 + broadHaze * 0.04 * uFrost;

            // A permanent inner-contact veil: the glass keeps the same
            // warm, milky character as the areas touched by the entity,
            // even while the entity moves away from a particular facet.
            float contactVeil = (0.94 + broadHaze * 0.06)
              * mix(0.92, 1.0, faceVeil)
              * mix(0.96, 1.0, clearEdge);
            frostAlpha += contactVeil * (0.105 + uBlur * 0.115);

            vec3 warmMilk = vec3(1.0, 0.965, 0.9);
            float palettePosition = clamp(
              broadHaze * 0.72 + 0.14 + vLocalPosition.y * 0.08,
              0.0,
              1.0
            );
            vec3 paletteColor = surfacePalette(palettePosition);
            // The selected palette dyes the milky glass itself. Keeping this
            // contribution outside lightVeil makes cool/green choices remain
            // visible instead of being washed back to the warm centre light.
            float paletteStrength = 0.46 + broadHaze * 0.12 + uDiffusion * 0.08;
            vec3 glassTint = mix(warmMilk, paletteColor, paletteStrength);
            vec3 color = mix(glassTint, uLightColor, lightVeil * (0.12 + uDiffusion * 0.22));
            color = mix(color, paletteColor, contactVeil * 0.16);
            color *= 0.992 + microFrost * 0.016;
            gl_FragColor = vec4(color, clamp(frostAlpha, 0.0, 0.38));
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  )
}

function FriendShellDefinition({ geometry, config }) {
  const material = useRef(null)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uMatte: { value: 0.41 },
    uTransparency: { value: 0.42 },
    uVertical: { value: 0 },
    uTintStrength: { value: 1 },
    uSize: { value: 0.6 },
    uStretch: { value: 0.86 },
    uFlow: { value: 0.79 },
    uPower: { value: 4.1 },
    uLightColor: { value: new THREE.Color('#ffdf7d') },
    uColorCount: { value: 3 },
    uColor0: { value: new THREE.Color('#ff4a2d') },
    uColor1: { value: new THREE.Color('#ff9d12') },
    uColor2: { value: new THREE.Color('#ffe66d') },
    uColor3: { value: new THREE.Color('#ff3f88') },
    uColor4: { value: new THREE.Color('#7f4cff') },
  }), [])

  useFrame(({ clock }) => {
    if (!material.current) return
    const live = material.current.uniforms
    live.uTime.value = clock.elapsedTime
    live.uMatte.value = config.friendMatte ?? 0.41
    live.uTransparency.value = config.friendTransparency ?? 0.42
    live.uVertical.value = 0
    // В VOLUME цвет целиком рисует объёмный шейдер. Собственная палитра
    // этого слоя добавляла поверх него ещё одно широкое пятно с дальним,
    // холодным концом палитры — оно и оставляло серо-сиреневую вуаль по
    // всему кристаллу. Здесь от слоя нужна только кромка.
    // Все три версии теперь на одной модели, разводить этот слой по ним
    // незачем: он у всех даёт кромку и лёгкий общий подтон.
    live.uTintStrength.value = 1
    live.uSize.value = config.friendCoreSize ?? 0.6
    live.uStretch.value = config.friendCoreStretch ?? 0.86
    live.uFlow.value = config.friendFlow ?? 0.79
    live.uPower.value = FRIEND_LIGHT_POWER
    live.uLightColor.value.set(config.friendCenterColor ?? '#ffdf7d')
    live.uColorCount.value = Math.round(config.friendColorCount ?? 3)
    live.uColor0.value.set(config.friendFlowColor1 ?? '#ff4a2d')
    live.uColor1.value.set(config.friendFlowColor2 ?? '#ff9d12')
    live.uColor2.value.set(config.friendFlowColor3 ?? '#ffe66d')
    live.uColor3.value.set(config.friendFlowColor4 ?? '#ff3f88')
    live.uColor4.value.set(config.friendFlowColor5 ?? '#7f4cff')
  })

  return (
    <mesh geometry={geometry} scale={1.004} renderOrder={3}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
        vertexShader={`
          varying vec3 vLocalPosition;
          varying vec3 vZonePosition;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;
          void main() {
            vLocalPosition = position;
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            // Стопка зон должна оставаться ВЕРТИКАЛЬНОЙ при вращении
            // кристалла: у настоящей лампы внутренности не крутятся вместе
            // с колбой. В локальных координатах стопка вращалась вместе с
            // мешем, и при взгляде вдоль её оси три зоны схлопывались в
            // концентрические кольца одного цвета. Здесь позиция берётся в
            // мировых осях, но с началом в центре объекта и в его же
            // масштабе, поэтому сама фигура ничего не теряет.
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vZonePosition = (worldPosition.xyz - modelMatrix[3].xyz)
                          / max(length(modelMatrix[0].xyz), 0.0001);
            vNormalView = normalize(normalMatrix * normal);
            vViewDirection = normalize(-viewPosition.xyz);
            gl_Position = projectionMatrix * viewPosition;
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uMatte;
          uniform float uTransparency;
          uniform float uVertical;
          uniform float uTintStrength;
          uniform float uSize;
          uniform float uStretch;
          uniform float uFlow;
          uniform float uPower;
          uniform vec3 uLightColor;
          uniform float uColorCount;
          uniform vec3 uColor0;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform vec3 uColor3;
          uniform vec3 uColor4;
          varying vec3 vLocalPosition;
          varying vec3 vZonePosition;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;

          vec3 shellPalette(float t) {
            float count = clamp(floor(uColorCount + 0.5), 2.0, 5.0);
            float p = clamp(t, 0.0, 0.9999) * (count - 1.0);
            if (p < 1.0) return mix(uColor0, uColor1, p);
            if (p < 2.0) return mix(uColor1, uColor2, p - 1.0);
            if (p < 3.0) return mix(uColor2, uColor3, p - 2.0);
            return mix(uColor3, uColor4, p - 3.0);
          }

          void main() {
            vec3 normal = normalize(vNormalView);
            float facing = max(dot(normal, normalize(vViewDirection)), 0.0);
            float fresnel = pow(1.0 - facing, 1.35);
            float facetShade = 1.0 - (0.5 + 0.5 * dot(normal, normalize(vec3(-0.42, 0.58, 0.7))));
            float edgeStrength = 0.045 + (1.0 - uTransparency) * 0.12;
            float alpha = fresnel * edgeStrength
                        + facetShade * (0.012 + uMatte * 0.022) * (1.0 - uVertical * 0.7);
            float t = uTime * (0.11 + uFlow * 0.045);
            vec3 axis = vec3(1.0, 1.0 / max(uStretch, 0.55), 1.0);
            vec3 s0 = mix(vec3(-0.2 + sin(t) * 0.025, 0.17, 0.05),
                          vec3(sin(t * 0.62) * 0.02, 0.44, 0.0), uVertical);
            vec3 s1 = mix(vec3(0.2, -0.14 + cos(t * 0.73) * 0.025, -0.04),
                          vec3(cos(t * 0.7) * 0.02, 0.0, 0.0), uVertical);
            vec3 s2 = mix(vec3(0.0, 0.0, 0.14),
                          vec3(sin(t * 0.65) * 0.02, -0.44, 0.0), uVertical);
            vec3 zoneSpace = mix(vLocalPosition, vZonePosition, uVertical);
            vec3 q0 = (zoneSpace - s0) * axis;
            vec3 q1 = (zoneSpace - s1) * axis;
            vec3 q2 = (zoneSpace - s2) * axis;
            // Уже по горизонтали в SHELL: снаружи должны читаться те же
            // узкие вертикальные зоны, что и внутри, а не общее облако.
            float broadness = mix(2.8, 5.4, uVertical) / max(uSize, 0.3);
            float l0 = exp(-dot(q0, q0) * broadness);
            float l1 = exp(-dot(q1, q1) * broadness);
            float l2 = exp(-dot(q2, q2) * broadness);
            float illumination = clamp(max(max(l0, l1), l2), 0.0, 1.0);
            vec3 lightTint = shellPalette(0.02) * l0 + shellPalette(0.5) * l1 + shellPalette(0.98) * l2;
            float peak = max(max(lightTint.r, lightTint.g), lightTint.b);
            lightTint /= max(peak, 0.001);
            vec3 warmGlass = mix(vec3(1.0, 0.975, 0.93), vec3(1.0, 0.995, 0.98), uMatte);
            vec3 color = mix(warmGlass, lightTint,
                             illumination * (0.44 + uPower * 0.03 + uVertical * 0.22) * uTintStrength);
            color = mix(color, uLightColor, illumination * 0.08 * uTintStrength);
            alpha += illumination * (0.018 + uMatte * 0.02) * uTintStrength;
            gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.2));
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  )
}

/**
 * «Light power» всегда на максимуме: ниже свет просто тускнел, полезного
 * диапазона у ползунка не было, и он только занимал место в панели.
 * Значение осталось уникформой — шейдеры не переписаны, просто им больше
 * нечего настраивать.
 */
const FRIEND_LIGHT_POWER = 8

/**
 * Три направления доработки Friend.
 *
 * Модель у всех трёх одна и та же — проекция MILKY: одно крупное пятно,
 * радиус которого считается в плоскости экрана, с дышащей неравномерной
 * сердцевиной и перемешанным градиентом. Прежние собственные шейдеры
 * SHELL (силуэты) и VOLUME (raymarch) удалены целиком.
 *
 * Сейчас коэффициенты у всех трёх одинаковые — версии намеренно
 * идентичны, чтобы разводить их дальше от общей точки. Разводить нужно
 * ЗДЕСЬ: шейдер у трёх версий общий, отличаются только эти числа.
 *
 *  spotScale    — размер всего пятна вместе с градиентами
 *  verticalBias — вытянутость пятна по вертикали сверх «light stretch»
 *  density      — укрывистость: насколько плотно свет красит стекло
 *  colorReach   — как далеко от центра успевает развернуться палитра
 *  ribbon       — 1: внутри не пятно, а НЕПРЕРЫВНАЯ ЛЕНТА, свёрнутая в
 *                 S: у неё есть ось и толщина, ядро тёмное, края светлее.
 *                 Она перетекает между тонкой и набухшей формой
 *  diffuser     — 1: стекло перестаёт быть прозрачным и становится
 *                 матовой колбой, как на всех трёх референсах: сквозь неё
 *                 не видно фона, свет заперт внутри
 *  rays         — 1: цвета идут ЛУЧАМИ через весь кристалл, каждый под
 *                 своим медленно поворачивающимся углом, и вдоль луча
 *                 бежит волна. Общего пятна нет, поэтому нет и овала;
 *                 свет остаётся отдельным подвижным сгустком
 *  unify        — 0: форма, цвет и ядро живут каждый в своей системе
 *                 координат и читаются тремя наложенными сущностями;
 *                 1: все три считаются по ОДНОМУ полю и читаются единой
 *                 массой света с градиентом внутри
 */
// Версия 02 (organic-metaball) — ДУБЛЬ версии 01: тот же набор коэффициентов,
// включая organic/glassOnly-флаги (сейчас отсутствуют у обеих), чтобы вкладки
// рендерились идентично, пока дорабатывается только 01.
//
// continuousColor — флаг только у 01: включает более поздние правки самого
// градиента (сплошной переход цвета + светлая, а не цветная, середина).
// У 02 он явно выключен, чтобы дальнейшие правки 01 не утекали в дубль.
//
// 2026-09-23: the comment below this one ("frozenGen2 does nothing yet on
// its own") stopped being true a while ago — uFrozenGen2 has since grown
// into the gate for a whole set of live-'01'-only brightness/glow tuning
// (inner-source drift/wobble/sharpness, per-blob hot cores, saturation
// contrast — search uFrozenGen2/isFrozenSource in FriendProjection). That
// is why '01' visibly carried MORE light than '02' despite identical JS
// defaults: the two were never actually rendering the same thing. Per an
// explicit request to fully reset live '01' back to '02''s look, frozenGen2
// is set to 1 here too — '01' now resolves every one of those gates to the
// exact same frozen value '02' uses. circleFix is the one deliberate
// exception: it is its own flag (not folded into frozenGen2) specifically
// so this reset does not also switch off the anti-circle fix on the inner
// light source. Any FUTURE live-'01'-only work should follow circleFix's
// example — its own flag, not a new frozenGen2 branch — so the next reset
// only has to flip flags back off instead of hunting through the shader.
const MILKY_PROJECTION_VARIANT = { spotScale: 1, verticalBias: 1, density: 1, colorReach: 1, unify: 1, rays: 0, diffuser: 0, continuousColor: 1, legacyPainted: 0, frozenGen2: 1, circleFix: 0, livingVolume: 1 }

// '02': frozen snapshot of '01' taken 2026-09-22 (the blob-light colour
// model, saturation pass, bloom-off, etc.). circleFix explicitly off — this
// checkpoint keeps its own exact old inner-source falloff, untouched by
// live '01' work.
const BLOB_LIGHT_PROJECTION_VARIANT = { ...MILKY_PROJECTION_VARIANT, frozenGen2: 1, circleFix: 0, livingVolume: 0 }

export const FRIEND_VARIANTS = {
  'milky-projection': MILKY_PROJECTION_VARIANT,
  'blob-light-projection': BLOB_LIGHT_PROJECTION_VARIANT,
  'organic-metaball': { spotScale: 1, verticalBias: 1, density: 1, colorReach: 1, unify: 1, rays: 0, diffuser: 0, continuousColor: 0, legacyPainted: 0 },
  'painted-continuous': { spotScale: 1, verticalBias: 1, density: 1, colorReach: 1, unify: 1, rays: 0, diffuser: 0, continuousColor: 1, legacyPainted: 1 },
}

/**
 * Version 04 is a real volume rather than another colour projection on the
 * crystal faces.  A ray is marched through a safely inscribed sphere and
 * accumulates absorption/emission from one smoothly-unioned, animated body.
 *
 * Keeping the carrier sphere inside the crystal guarantees that the viscous
 * mass can press against its container without ever leaking through a facet.
 * The density field has a readable boundary, a thick core and only broad
 * internal variation: it should feel heavy and cohesive, never like fog.
 */
function FriendOrganicVolume({ config, maxRadius, continuousColor = 0, legacyPainted = 0, frozenGen2 = 0, livingVolume = 0 }) {
  const mesh = useRef(null)
  const material = useRef(null)
  const cameraLocal = useMemo(() => new THREE.Vector3(), [])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uCameraLocal: { value: new THREE.Vector3(0, 0, 5) },
    uSize: { value: 0.64 },
    uStretch: { value: 1.38 },
    uSpread: { value: 1 },
    uFlow: { value: 1.5 },
    uFlowDrift: { value: 0.7 },
    uPaintFlow: { value: 2.08 },
    uPulse: { value: 0.255 },
    uWindSpeed: { value: 1 },
    uWindAmount: { value: 1 },
    uCenterPower: { value: 3 },
    uColorMotion: { value: 0.5 },
    uColorBoost: { value: 0.5 },
    uContinuousColor: { value: 0 },
    uLegacyPainted: { value: 0 },
    // '02' (blob-light-projection) is a frozen snapshot of '01' taken
    // 2026-09-22 — same values as '01' today, so this defaults to 0 and
    // nothing currently branches on it. From here on, any NEW shader tweak
    // made only for live '01' must be gated
    // mix(newValueForLiveOnly, currentSharedValue, uFrozenGen2) so it does
    // not silently leak into '02', the same way uLegacyPainted already
    // protects the older frozen '04' (painted-continuous).
    uFrozenGen2: { value: 0 },
    uLivingVolume: { value: 0 },
    uVolumeScale: { value: 1.65 },
    uLightColor: { value: new THREE.Color('#ffdf7d') },
    uColorCount: { value: 3 },
    uColor0: { value: new THREE.Color('#ff4a2d') },
    uColor1: { value: new THREE.Color('#ff9d12') },
    uColor2: { value: new THREE.Color('#756cff') },
    uColor3: { value: new THREE.Color('#ff3f88') },
    uColor4: { value: new THREE.Color('#7f4cff') },
  }), [])

  useFrame(({ clock, camera }) => {
    if (!mesh.current || !material.current) return
    mesh.current.worldToLocal(cameraLocal.copy(camera.position))

    const live = material.current.uniforms
    live.uTime.value = clock.elapsedTime
    live.uCameraLocal.value.copy(cameraLocal)
    live.uSize.value = config.friendCoreSize ?? 0.64
    live.uStretch.value = config.friendCoreStretch ?? 1.38
    live.uSpread.value = config.friendLightSpread ?? 1
    live.uFlow.value = config.friendFlow ?? 1.5
    live.uFlowDrift.value = config.friendFlowDrift ?? 0.7
    live.uPaintFlow.value = config.friendPaintFlow ?? 2.08
    live.uPulse.value = config.friendPulse ?? 0.255
    live.uWindSpeed.value = config.friendWindSpeed ?? 1
    live.uWindAmount.value = config.friendWindAmount ?? 1
    live.uCenterPower.value = config.friendCenterPower ?? 3
    live.uColorMotion.value = config.friendColorMotion ?? 0.5
    live.uColorBoost.value = config.friendColorBoost ?? 0.5
    live.uContinuousColor.value = continuousColor
    live.uLegacyPainted.value = legacyPainted
    live.uFrozenGen2.value = frozenGen2
    live.uLivingVolume.value = livingVolume
    live.uVolumeScale.value = config.friendVolumeScale ?? 1.65
    live.uLightColor.value.set(config.friendCenterColor ?? '#ffdf7d')
    live.uColorCount.value = Math.round(config.friendColorCount ?? 3)
    live.uColor0.value.set(config.friendFlowColor1 ?? '#ff4a2d')
    live.uColor1.value.set(config.friendFlowColor2 ?? '#ff9d12')
    live.uColor2.value.set(config.friendFlowColor3 ?? '#756cff')
    live.uColor3.value.set(config.friendFlowColor4 ?? '#ff3f88')
    live.uColor4.value.set(config.friendFlowColor5 ?? '#7f4cff')
  })

  // maxRadius already contains SAFE_MARGIN. Version 04 may come closer to the
  // wall, but retains six percent clearance from the exact insphere.
  const radius = maxRadius * (0.94 / SAFE_MARGIN)

  return (
    <mesh
      ref={mesh}
      scale={radius}
      renderOrder={2.95 + continuousColor * 0.2}
    >
      <sphereGeometry args={[1, 36, 24]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        side={THREE.BackSide}
        toneMapped={false}
        blending={THREE.NormalBlending}
        vertexShader={`
          varying vec3 vLocalPosition;

          void main() {
            vLocalPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          precision highp float;

          uniform float uTime;
          uniform vec3 uCameraLocal;
          uniform float uSize;
          uniform float uStretch;
          uniform float uSpread;
          uniform float uFlow;
          uniform float uFlowDrift;
          uniform float uPaintFlow;
          uniform float uPulse;
          uniform float uWindSpeed;
          uniform float uWindAmount;
          uniform float uCenterPower;
          uniform float uColorMotion;
          uniform float uColorBoost;
          uniform float uContinuousColor;
          uniform float uLegacyPainted;
          uniform float uFrozenGen2;
          uniform float uLivingVolume;
          uniform float uVolumeScale;
          uniform vec3 uLightColor;
          uniform float uColorCount;
          uniform vec3 uColor0;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform vec3 uColor3;
          uniform vec3 uColor4;

          varying vec3 vLocalPosition;

          vec3 palette(float t) {
            float count = clamp(floor(uColorCount + 0.5), 2.0, 5.0);
            float p = clamp(t, 0.0, 0.9999) * (count - 1.0);
            if (p < 1.0) return mix(uColor0, uColor1, p);
            if (p < 2.0) return mix(uColor1, uColor2, p - 1.0);
            if (p < 3.0) return mix(uColor2, uColor3, p - 2.0);
            return mix(uColor3, uColor4, p - 3.0);
          }

          // 01 only: raymarching accumulates many samples at slightly
          // different colorPosition values along each ray, so a plain
          // continuous palette() blends smoothly through every hue between
          // the four picked colours — with the saturation raised elsewhere
          // this read as a full rainbow instead of our four brand colours.
          // Holding each identity colour over most of its share of the
          // ramp, with only a narrow handoff, keeps every sample close to
          // one of the four actual swatches. 03 does not call this at all
          // (its palette(colorPosition) call is untouched).
          float colorSplitRamp(float t) {
            float count = clamp(floor(uColorCount + 0.5), 2.0, 5.0);
            if (count < 1.5) return t;
            float seg = clamp(t, 0.0, 0.9999) * (count - 1.0);
            float segIndex = floor(seg);
            float segFrac = seg - segIndex;
            float edge = 0.12;
            float snapped = segIndex + smoothstep(0.5 - edge, 0.5 + edge, segFrac);
            return snapped / (count - 1.0);
          }

          float hash12(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * 0.1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
          }

          mat2 rotate2(float a) {
            float c = cos(a);
            float s = sin(a);
            return mat2(c, -s, s, c);
          }

          float smoothUnion(float a, float b, float k) {
            float h = clamp(0.5 + 0.5 * (b - a) / max(k, 0.0001), 0.0, 1.0);
            return mix(b, a, h) - k * h * (1.0 - h);
          }

          float ellipsoidDistance(vec3 p, vec3 radii) {
            float k0 = length(p / radii);
            float k1 = length(p / (radii * radii));
            return k0 * (k0 - 1.0) / max(k1, 0.0001);
          }

          // A few broad waves are cheaper and, more importantly, calmer than
          // high-frequency noise. They alter density without breaking the
          // body into smoke or independent blobs.
          float broadVariation(vec3 p, float phase) {
            float n = sin(dot(p, vec3(1.73, 2.11, 1.37)) + phase);
            n += sin(dot(p, vec3(-2.03, 1.31, 1.83)) - phase * 0.73) * 0.62;
            n += sin(dot(p, vec3(1.17, -2.37, 2.09)) + phase * 0.51) * 0.38;
            return n / 2.0;
          }

          float bodyDensity(vec3 p, out float core, out float colorPosition, out float internal) {
            float speed = (0.16 + uFlow * 0.055) * max(uWindSpeed, 0.05);
            float time = uTime * speed
              + sin(uTime * 0.16) * 0.5 * uFlowDrift;

            // The connected body turns in space while it flows. Rotation is
            // applied to the entire density field, so the mass never breaks
            // into independently moving pieces.
            vec3 q = p;
            float turn = time * 1.2 + sin(time * 0.53) * 0.55;
            q.xz = rotate2(turn) * q.xz;
            q.xy = rotate2(-time * 0.52 + sin(time * 0.78 + 1.2) * 0.4) * q.xy;
            q.yz = rotate2(sin(time * 0.72 + 2.0) * 0.34) * q.yz;

            float stretchControl = clamp((uStretch - 0.55) / 1.25, 0.0, 1.0);
            float sizeControl = clamp((uSize - 0.15) / 1.25, 0.0, 1.0);
            float baseSize = mix(0.42, 0.72, sizeControl) * mix(0.9, 1.03, uSpread);
            // 02 keeps the exact frozen scale. Live 01 leaves a little room
            // inside the raymarch carrier so its animated density can bend
            // and re-form without exposing the carrier sphere itself.
            float safeVolumeScale = mix(uVolumeScale,
                                        min(uVolumeScale, 1.94),
                                        uLivingVolume);
            baseSize *= mix(1.0, safeVolumeScale, uContinuousColor);

            // Live 01 only: the frozen 02 density is intentionally left
            // untouched above. 01 continuously changes its internal frame
            // before the SDF is evaluated: three broad, incommensurate
            // waves push different axes at different rates, so the mass
            // cannot settle into a sphere, capsule or other stable object.
            float livingPhase = time * 1.72
                              + sin(time * 0.47 + 0.8) * 0.96;
            vec3 livingWarp = vec3(
              sin(q.y * 2.15 + livingPhase)
                + 0.55 * sin(q.z * 3.1 - livingPhase * 0.63),
              sin(q.z * 1.87 - livingPhase * 0.82)
                + 0.5 * cos(q.x * 2.74 + livingPhase * 0.47),
              cos(q.x * 2.03 + livingPhase * 0.71)
                + 0.48 * sin(q.y * 2.91 - livingPhase * 0.56)
            );
            q += livingWarp * baseSize * 0.28 * uLivingVolume;

            float livingFrameTurn = sin(time * 0.58) * 0.82
                                  + sin(time * 0.27 + 1.4) * 0.48;
            q.xy = rotate2(livingFrameTurn * uLivingVolume) * q.xy;
            q.x *= mix(1.0,
                       0.62 + 0.26 * sin(time * 0.83 + 0.5),
                       uLivingVolume);
            q.y *= mix(1.0,
                       1.34 + 0.32 * sin(time * 0.71 + 2.1),
                       uLivingVolume);
            q.z *= mix(1.0,
                       0.72 + 0.28 * cos(time * 0.59 + 1.2),
                       uLivingVolume);

            // Reference motion alternates between a calm rounded body and a
            // pronounced S-shaped fold. The bend travels through the whole
            // field, then changes plane, rather than moving separate lobes.
            float bendCycle = 0.5 + 0.5 * sin(time * 1.75 + sin(time * 0.68) * 0.62);
            float bendPhase = time * 2.55 + sin(time * 0.91) * 0.78;
            float activeBend = mix(0.12, 0.34, bendCycle) * min(uWindAmount, 1.8);
            float axial = q.x / max(baseSize, 0.001);
            float endBias = smoothstep(0.05, 1.15, abs(axial));
            float curve = sin(axial * 1.72 + bendPhase);
            float counterCurve = sin(axial * 3.05 - bendPhase * 0.77);
            q.y -= curve * activeBend * (0.62 + endBias * 0.68);
            q.z -= counterCurve * activeBend * 0.72 * (0.45 + endBias);
            q.yz = rotate2(
              axial * (0.42 + bendCycle * 0.56)
              + sin(bendPhase * 0.58) * 0.24
            ) * q.yz;

            // Secondary broad waves keep the fold fluid while preserving a
            // readable, heavy silhouette.
            float warpStrength = (0.03 + uPaintFlow * 0.028) * min(uWindAmount, 1.8);
            vec3 warp = vec3(
              sin(q.y * 2.0 + time * 1.07) + sin(q.z * 1.4 - time * 0.61) * 0.45,
              sin(q.z * 1.8 - time * 0.83) + sin(q.x * 1.5 + time * 0.49) * 0.4,
              sin(q.x * 1.7 + time * 0.71) + sin(q.y * 1.3 - time * 0.57) * 0.45
            );
            q += warp * warpStrength;
            q.y += sin(q.x * 2.35 + bendPhase * 0.78) * 0.1 * min(uWindAmount, 1.5);
            q.z += sin(q.x * 1.65 - bendPhase * 0.52) * 0.065 * min(uWindAmount, 1.5);

            // Two overlapping lobes plus a broad bridge form a single smooth
            // viscous mass. The lobes never separate: stretching changes the
            // whole silhouette rather than sending pieces through space.
            float stretchWave = 0.5 + 0.5 * sin(bendPhase * 0.78 + sin(time * 0.33));
            float elongation = mix(0.09, 0.34, stretchControl)
                             * mix(0.7, 1.35, stretchWave);
            float compression = 1.0 - uPulse * 0.18 * sin(time * 0.91 + 0.8);
            vec3 bend = vec3(
              0.0,
              sin(bendPhase * 0.91) * 0.16 * (0.45 + bendCycle * 0.55),
              cos(bendPhase * 0.61) * 0.1
            );

            vec3 leftCenter = vec3(-elongation, 0.0, 0.0) - bend;
            vec3 rightCenter = vec3(elongation, 0.0, 0.0) + bend;
            vec3 lobeRadii = vec3(
              baseSize * (0.7 + stretchControl * 0.16),
              baseSize * mix(0.82, 0.67, bendCycle) * compression,
              baseSize * mix(0.83, 0.7, bendCycle)
            );
            vec3 bridgeRadii = vec3(
              baseSize * (0.74 + elongation * 0.95),
              baseSize * mix(0.62, 0.46, bendCycle) * compression,
              baseSize * mix(0.68, 0.54, bendCycle)
            );

            float dLeft = ellipsoidDistance(q - leftCenter, lobeRadii);
            float dRight = ellipsoidDistance(
              q - rightCenter,
              lobeRadii * vec3(1.08, 0.88, 1.04)
            );
            float dBridge = ellipsoidDistance(q, bridgeRadii);
            float bodyBase = smoothUnion(dLeft, dRight, baseSize * 0.2);
            bodyBase = smoothUnion(bodyBase, dBridge, baseSize * 0.16);

            // 01 only: two lobes plus a bridge alone read as a clean,
            // recognisable "peanut" — too legible as a simple fixed shape
            // rather than an indeterminate living mass. A third, smaller
            // lobe on its own independent, incommensurate orbit breaks the
            // left-right symmetry: depending on time it sits above, below,
            // in front of or behind the main pair, so the silhouette keeps
            // changing which part reads as "extra" instead of settling into
            // two predictable lumps. Its orbit radius is kept well inside
            // the main body's own extent so it always overlaps and reads as
            // ONE mass through the smooth union below, never as a separate
            // part stuck to the side. 03's body (bodyBase) is kept
            // byte-for-byte via the mix at the end — this lobe never
            // contributes to it.
            // uLegacyPainted is uniform across this whole draw call, so this
            // branch is free — for 03 it skips the third-lobe maths below
            // entirely, on every raymarch step, instead of computing and
            // then discarding it via mix().
            float body = bodyBase;
            if (uLegacyPainted < 0.5) {
              float thirdPhase = time * 0.71 + sin(time * 0.24 + 1.3) * 0.85;
              float thirdOrbitR = baseSize * (0.4 + 0.12 * sin(time * 0.31 + 2.1));
              vec3 thirdCenter = vec3(
                sin(thirdPhase * 0.63) * thirdOrbitR * 0.55,
                cos(thirdPhase * 0.81 + 0.7) * thirdOrbitR,
                sin(thirdPhase * 0.52 + 1.9) * thirdOrbitR * 0.85
              );
              float thirdPulse = 0.5 + 0.5 * sin(thirdPhase * 1.15 + 0.4);
              vec3 thirdRadii = vec3(
                baseSize * mix(0.26, 0.38, thirdPulse),
                baseSize * mix(0.22, 0.34, thirdPulse) * compression,
                baseSize * mix(0.24, 0.36, thirdPulse)
              );
              float dThird = ellipsoidDistance(q - thirdCenter, thirdRadii);
              body = smoothUnion(bodyBase, dThird, baseSize * 0.15);
            }

            // Live 01 adds one continuously migrating fold. It always
            // overlaps the main body, but changes axis, depth and thickness
            // independently. This prevents the silhouette from resolving
            // into the frozen two-lobe/bridge construction while keeping a
            // single connected substance rather than several floating dots.
            if (uLivingVolume > 0.5) {
              float foldPhase = time * 1.26
                              + sin(time * 0.41 + 2.4) * 1.36;
              vec3 foldCenter = vec3(
                sin(foldPhase * 0.73) * baseSize * 0.46,
                cos(foldPhase * 0.91 + 0.8) * baseSize * 0.54,
                sin(foldPhase * 0.57 + 2.0) * baseSize * 0.49
              );
              vec3 foldRadii = vec3(
                baseSize * (0.25 + 0.16 * sin(foldPhase * 0.61 + 0.4)),
                baseSize * (0.46 + 0.2 * cos(foldPhase * 0.79)),
                baseSize * (0.21 + 0.14 * sin(foldPhase * 1.07 + 1.7))
              );
              float dFold = ellipsoidDistance(q - foldCenter, foldRadii);
              body = smoothUnion(body, dFold, baseSize * 0.16);
            }

            // Internal variation changes optical density, not topology.
            float variation = broadVariation(q * 2.15, time * 1.7);
            float fine = broadVariation(q * 3.8 + vec3(1.7, -0.8, 0.9), -time * 1.13);
            body += (variation * 0.052 + fine * 0.018)
                  * baseSize * min(uWindAmount, 1.5);

            // A concise silhouette, a soft skin, and a substantially denser
            // centre. The outer softness is narrow enough to avoid fog.
            // 01 only: that concise, smooth-curved silhouette is exactly
            // what made it read as "a specific creature" rather than an
            // ambiguous living presence — the brief explicitly asks for
            // "noticeable but not fully understandable in shape". A higher-
            // frequency ripple bent into the SDF itself (not just optical
            // colour on top of it) breaks the outline into an irregular,
            // unreadable edge, and a much wider skin band turns the crisp
            // boundary into a diffuse one. 03's frozen narrow/smooth skin
            // is untouched.
            float edgeRipple = broadVariation(q * 6.2 + vec3(-1.1, 2.3, 0.6), time * 2.1);
            float bodyForSkin = mix(body + edgeRipple * baseSize * 0.1, body, uLegacyPainted);
            float skinLoContinuous = mix(-baseSize * 0.22, -baseSize * 0.025, uLegacyPainted);
            float skinHiContinuous = mix(baseSize * 0.34, baseSize * 0.07, uLegacyPainted);
            float skin = 1.0 - smoothstep(skinLoContinuous, skinHiContinuous, bodyForSkin);
            core = 1.0 - smoothstep(-baseSize * 0.3, -baseSize * 0.055, body);
            internal = clamp(0.5 + variation * 0.38 + fine * 0.12, 0.0, 1.0);
            float livingDensityWave = broadVariation(
              q * 4.65 + vec3(-0.9, 1.6, 2.1),
              time * 2.37
            );
            float densityVariation = clamp(
              0.84 + variation * 0.2 + fine * 0.075
              + livingDensityWave * 0.36 * uLivingVolume,
              0.28,
              1.46
            );
            float density = skin * mix(0.54, 1.46, core) * densityVariation;

            // Different colour regions share the same flow, so they move
            // through the body without reading as separate coloured clouds.
            float colourFlow = broadVariation(q * 1.35 + vec3(0.7, -0.4, 0.2), time * 0.83);
            colorPosition = clamp(
              0.5 + q.x * 0.18 + q.y * 0.08
              + colourFlow * (0.2 + uColorMotion * 0.24),
              0.0,
              1.0
            );
            colorPosition = clamp(
              colorPosition
              + livingDensityWave * 0.19 * uLivingVolume
              + sin(time * 1.08 + q.z * 2.4) * 0.085 * uLivingVolume,
              0.0,
              1.0
            );

            // Frozen versions use the original radial guard. Live 01 must
            // never reveal that technical sphere: its density fades through
            // an animated, anisotropic and locally broken envelope well
            // before reaching the carrier. The mass therefore stays large,
            // but its visible perimeter can never close into a circle.
            float frozenCarrier = 1.0 - smoothstep(0.86, 1.0, length(p));

            float envelopeTurn = time * 0.37
                               + sin(time * 0.21 + 1.1) * 0.72;
            vec3 envelopeP = p;
            envelopeP.xy = rotate2(envelopeTurn) * envelopeP.xy;
            envelopeP.yz = rotate2(
              sin(time * 0.31 + 2.0) * 0.56
            ) * envelopeP.yz;
            envelopeP *= vec3(
              0.92 + 0.1 * sin(time * 0.43),
              1.15 + 0.12 * cos(time * 0.37 + 0.8),
              1.0 + 0.12 * sin(time * 0.29 + 2.2)
            );

            // Bend the plane system itself using fields that are already
            // available. This is a positional warp, not a radial one.
            envelopeP += vec3(
              variation * 0.11 + fine * 0.04,
              fine * 0.09 - livingDensityWave * 0.055,
              livingDensityWave * 0.1 - variation * 0.045
            );

            // Reuse the density fields already evaluated above instead of
            // running two more three-wave noise stacks at every ray step.
            // This keeps the same animated breakup while substantially
            // lowering the cost of live 01 during rotation.
            float envelopeWarp = variation * 0.065 + fine * 0.03;

            // Crucially, no length() is used for the live envelope. The
            // maximum of several independently oriented plane distances is
            // a soft moving polyhedron, never a sphere. Even if the three
            // axis scales briefly approach one another, the diagonal planes
            // keep breaking rotational symmetry, so a circular silhouette
            // is mathematically impossible.
            vec3 envelopeAbs = abs(envelopeP);
            float axisPlanes = max(
              envelopeAbs.x * 1.02,
              max(envelopeAbs.y * 1.1, envelopeAbs.z * 1.06)
            );
            float diagonalA = abs(dot(envelopeP,
                                      vec3(0.72, 0.58, 0.42)));
            float diagonalB = abs(dot(envelopeP,
                                      vec3(-0.54, 0.76, 0.46)));
            float diagonalC = abs(dot(envelopeP,
                                      vec3(0.48, -0.39, 0.79)));
            float envelopeDistance = max(
              axisPlanes,
              max(diagonalA, max(diagonalB, diagonalC))
            );
            float liveCarrier = 1.0 - smoothstep(
              0.48 + envelopeWarp,
              0.84 + envelopeWarp,
              envelopeDistance
            );

            // Large migrating gaps dissolve the outer edge into separate
            // currents. They affect only the perimeter; the centre remains
            // connected, so this reads as one changing substance rather
            // than several detached blobs.
            float breakField = clamp(livingDensityWave * 0.5 + 0.5,
                                     0.0,
                                     1.0);
            float edgeZone = smoothstep(0.32, 0.82, envelopeDistance);
            float brokenEdge = mix(1.0,
                                   0.28 + smoothstep(0.2, 0.78, breakField) * 0.72,
                                   edgeZone);
            liveCarrier *= brokenEdge;

            // Final safety guard has no visual role unless a deformation
            // approaches the actual raymarch sphere.
            liveCarrier *= 1.0 - smoothstep(0.93, 0.995, length(p));
            density *= mix(frozenCarrier, liveCarrier, uLivingVolume);
            return max(density, 0.0);
          }

          void main() {
            vec3 rayOrigin = uCameraLocal;
            vec3 rayDirection = normalize(vLocalPosition - rayOrigin);

            float b = dot(rayOrigin, rayDirection);
            float c = dot(rayOrigin, rayOrigin) - 1.0;
            float h = b * b - c;
            if (h < 0.0) discard;

            h = sqrt(h);
            float rayStart = max(-b - h, 0.0);
            float rayEnd = -b + h;
            if (rayEnd <= rayStart) discard;

            // The volume is deliberately broad and smooth, so 28 midpoint
            // samples retain its silhouette while cutting the fragment cost
            // almost in half during interactive crystal rotation.
            const int STEPS = 28;
            // 01 only: each step got noticeably heavier this session (the
            // extra third-lobe distance field below, plus the surface
            // projection/light-leak layers drawn on top of this one), and
            // together they were the reported stutter while dragging to
            // rotate. uLegacyPainted is the same for every pixel in this
            // draw call, so branching on it is a free "uniform branch", not
            // a per-pixel cost — it only changes how many of the 28 loop
            // iterations actually run. 03 keeps its full frozen 28 steps.
            int maxSteps = STEPS;
            if (uLegacyPainted < 0.5) maxSteps = 20;
            // Live 01's density function is intentionally much richer than
            // the frozen variants. Fifteen wider midpoint samples are enough
            // for its broad soft volume and remove the frame stalls caused
            // by evaluating the full deformation stack twenty times.
            if (uLivingVolume > 0.5) maxSteps = 15;
            // Step size is derived from maxSteps, not the fixed STEPS: fewer
            // steps must be correspondingly WIDER to still cover the full
            // rayStart..rayEnd span, otherwise 01 would raymarch through
            // only 20/28 of the sphere and visibly clip the volume.
            float stepSize = (rayEnd - rayStart) / float(maxSteps);
            // A stable midpoint sample avoids the glittering edge produced by
            // per-pixel stochastic jitter on a slowly moving translucent body.
            float travel = rayStart + stepSize * 0.5;
            float transmittance = 1.0;
            vec3 accumulated = vec3(0.0);
            float internalAccumulated = 0.0;
            float coreAccumulated = 0.0;

            for (int i = 0; i < STEPS; i++) {
              if (i >= maxSteps) break;
              vec3 samplePosition = rayOrigin + rayDirection * travel;
              float core;
              float colorPosition;
              float internal;
              float density = bodyDensity(samplePosition, core, colorPosition, internal);

              if (density > 0.001) {
                float colorPositionForPalette = mix(
                  colorPosition,
                  colorSplitRamp(colorPosition),
                  uContinuousColor * (1.0 - uLegacyPainted)
                );
                vec3 bodyColor = palette(colorPositionForPalette);
                float luminance = dot(bodyColor, vec3(0.2126, 0.7152, 0.0722));
                // Live 01: modest luminance-preserving chroma lift. Working
                // away from each colour's own luminance makes the selected
                // swatches cleaner without shifting green toward cyan or
                // lime toward yellow. Frozen 02 keeps the previous factor.
                float chromaLift = 1.0 + uColorBoost * 1.45
                                 + 0.18 * uLivingVolume;
                bodyColor = luminance + (bodyColor - luminance) * chromaLift;

                // The core is optically thicker and still coloured. It glows
                // from within instead of becoming a detached white oval.
                vec3 denseColor = mix(bodyColor * 1.02, bodyColor * 0.68, core * 0.72);
                // Eight percent more depth only in dense parts of live 01:
                // contrast comes from optical thickness, not global neon
                // saturation across the whole crystal.
                denseColor *= 1.0 - core * 0.08 * uLivingVolume;
                vec3 glowColor = mix(bodyColor, uLightColor, 0.22);
                float innerLight = smoothstep(0.52, 0.88, internal);
                float glow = core * innerLight * (0.12 + uCenterPower * 0.085);
                // Live 01: light travels through the changing density rather
                // than sitting at one fixed centre. Two crossing waves make
                // broad regions brighten and disappear without outlining a
                // new object. Frozen 02 receives no contribution here.
                float lightCurrent = sin(
                  dot(samplePosition, vec3(2.1, -1.55, 1.72))
                  + uTime * 0.94
                  + sin(samplePosition.y * 2.6 - uTime * 0.61) * 1.42
                ) * 0.5 + 0.5;
                float lightCounter = cos(
                  dot(samplePosition, vec3(-1.34, 2.28, 1.43))
                  - uTime * 0.76
                ) * 0.5 + 0.5;
                float movingLight = smoothstep(
                  0.38,
                  0.88,
                  lightCurrent * 0.62 + lightCounter * 0.38
                ) * uLivingVolume;
                glow += movingLight * (0.09 + core * 0.15);
                vec3 sampleColor = denseColor + glowColor * glow;
                sampleColor += mix(bodyColor, uLightColor, 0.18)
                             * movingLight * 0.08;
                // A small coloured lift follows the moving current itself;
                // unlike white bloom it preserves the four chosen hues.
                sampleColor += bodyColor * movingLight * 0.035;

                float extinction = density * (4.2 + uSpread * 2.2);
                float opacity = 1.0 - exp(-extinction * stepSize * 3.4);
                float contribution = transmittance * opacity;
                accumulated += contribution * sampleColor;
                internalAccumulated += contribution * internal;
                coreAccumulated += contribution * core;
                transmittance *= 1.0 - opacity;
              }

              travel += stepSize;
              if (transmittance < 0.025) break;
            }

            float alpha = 1.0 - transmittance;
            if (alpha < 0.008) discard;

            vec3 color = accumulated / max(alpha, 0.001);
            float internalMean = internalAccumulated / max(alpha, 0.001);
            float coreMean = coreAccumulated / max(alpha, 0.001);
            // Broad density differences survive integration through the
            // volume as quiet light-and-dark movement inside the same body.
            color *= 0.82 + internalMean * 0.28;
            color = mix(color, color * 0.76, coreMean * 0.26);
            float innerGlow = smoothstep(0.64, 0.9, internalMean)
                            * coreMean * (0.04 + uCenterPower * 0.025);
            color += mix(color, uLightColor, 0.2) * innerGlow;
            // Preserve headroom for the existing bloom pass without washing
            // the chroma out to white.
            color *= 0.88 + alpha * 0.22;
            // 02 keeps its original dense volume.  In 01 the same living
            // current sits behind the milky projection as a quieter depth
            // layer, so colour reads as substance inside glass.
            // 01 only: 0.42, then 0.52, still left this real volume mostly
            // hidden under the projection shell drawn on top of it, so the
            // crystal leaned on the flatter facet-projected gradient alone
            // for most of its visible "life". Pushed past 03's frozen 0.55
            // (see the matching cut to the projection's own opacity below)
            // so the actual organic body — not the surface projection —
            // becomes the dominant source of colour and movement.
            float tab1VolumeAlpha = mix(alpha * 0.78, alpha * 0.55, uLegacyPainted);
            float volumeAlpha = mix(alpha * 0.96, tab1VolumeAlpha, uContinuousColor);
            gl_FragColor = vec4(color, volumeAlpha);
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  )
}

/**
 * A very thin, animated light envelope around the crystal.
 *
 * The main FriendProjection is drawn on the crystal geometry, so it can
 * never paint a pixel beyond the silhouette.  This second copy is scaled
 * only a few percent and rendered before the projection: most of it remains
 * under the glass, while the narrow uncovered rim reads as light seeping
 * through the material.  The component is mounted for 01 only (see Glass
 * below), and uContinuousColor is kept as a second explicit guard.
 */
function FriendLightLeak({ geometry, config }) {
  const material = useRef(null)
  // 01 only: even tied to the light source's position, a shell enlarged by
  // 12% still reads as a visible outline once its baseline (far-from-source)
  // floor is composited against a dark background — that is what kept
  // getting reported as "обводка" after the bloom fix removed the other
  // source of it. Shrinking the shell itself for 01 so it barely extends
  // past the true silhouette makes that baseline floor nearly invisible,
  // while still leaving room for it to brighten near the source. 03's
  // frozen 1.12 scale is untouched (a JS-level prop, so it can't be gated
  // through the shader's uLegacyPainted uniform the way everything else is).
  const isLegacyPainted = (FRIEND_VARIANTS[config.friendVersion]?.legacyPainted ?? 0) > 0
  const leakScale = isLegacyPainted ? 1.12 : 1.025
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uContinuousColor: { value: 0 },
    uLegacyPainted: { value: 0 },
    // See the matching comment in FriendOrganicVolume: frozen snapshot of
    // '01' as it stood 2026-09-22. 0 for both live '01' and the frozen '02'
    // today; future '01'-only tweaks here must gate through it.
    uFrozenGen2: { value: 0 },
    uColorMotion: { value: 0.5 },
    uWindSpeed: { value: 1 },
    uWindAmount: { value: 1 },
    uLightMotion: { value: 0.13 },
    uLightColor: { value: new THREE.Color('#ffdf7d') },
    uColorCount: { value: 3 },
    uColor0: { value: new THREE.Color('#ff4a2d') },
    uColor1: { value: new THREE.Color('#ff9d12') },
    uColor2: { value: new THREE.Color('#756cff') },
    uColor3: { value: new THREE.Color('#ff3f88') },
    uColor4: { value: new THREE.Color('#7f4cff') },
  }), [])

  useFrame(({ clock }) => {
    if (!material.current) return
    const live = material.current.uniforms
    const variant = FRIEND_VARIANTS[config.friendVersion] ?? FRIEND_VARIANTS['milky-projection']
    live.uTime.value = clock.elapsedTime
    live.uContinuousColor.value = variant.continuousColor ?? 0
    live.uLegacyPainted.value = variant.legacyPainted ?? 0
    live.uFrozenGen2.value = variant.frozenGen2 ?? 0
    live.uColorMotion.value = config.friendColorMotion ?? 0.5
    live.uWindSpeed.value = config.friendWindSpeed ?? 1
    live.uWindAmount.value = config.friendWindAmount ?? 1
    live.uLightMotion.value = config.friendLightMotion ?? 0.13
    live.uLightColor.value.set(config.friendCenterColor ?? '#ffdf7d')
    live.uColorCount.value = Math.round(config.friendColorCount ?? 3)
    live.uColor0.value.set(config.friendFlowColor1 ?? '#ff4a2d')
    live.uColor1.value.set(config.friendFlowColor2 ?? '#ff9d12')
    live.uColor2.value.set(config.friendFlowColor3 ?? '#756cff')
    live.uColor3.value.set(config.friendFlowColor4 ?? '#ff3f88')
    live.uColor4.value.set(config.friendFlowColor5 ?? '#7f4cff')
  })

  return (
    <mesh geometry={geometry} scale={leakScale} renderOrder={3.05}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthTest
        depthWrite={false}
        side={THREE.BackSide}
        toneMapped={false}
        blending={THREE.NormalBlending}
        vertexShader={`
          varying vec3 vLocal;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;
          varying vec3 vProjected;
          void main() {
            vLocal = position;
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            vec3 centerView = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            vProjected = (viewPosition.xyz - centerView)
                       / max(length(modelMatrix[0].xyz), 0.0001);
            vNormalView = normalize(normalMatrix * normal);
            vViewDirection = normalize(-viewPosition.xyz);
            gl_Position = projectionMatrix * viewPosition;
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uContinuousColor;
          uniform float uLegacyPainted;
          uniform float uFrozenGen2;
          uniform float uColorMotion;
          uniform float uWindSpeed;
          uniform float uWindAmount;
          uniform float uLightMotion;
          uniform vec3 uLightColor;
          uniform float uColorCount;
          uniform vec3 uColor0;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform vec3 uColor3;
          uniform vec3 uColor4;
          varying vec3 vLocal;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;
          varying vec3 vProjected;

          vec3 paletteAt(float index) {
            if (index < 0.5) return uColor0;
            if (index < 1.5) return uColor1;
            if (index < 2.5) return uColor2;
            if (index < 3.5) return uColor3;
            return uColor4;
          }

          // Keep transitions inside the supplied identity palette. Near a
          // boundary the ordinary RGB mix is strongly desaturated, so it
          // reads as luminous haze rather than an unapproved third colour.
          vec3 brandBlend(vec3 a, vec3 b, float t) {
            // Broad enough to stay hazy like 02, but not spread across the
            // entire region: each identity colour gets room to read clearly.
            float softT = smoothstep(0.22, 0.78, t);
            vec3 direct = mix(a, b, softT);
            float bridge = 4.0 * softT * (1.0 - softT);
            return mix(direct, vec3(1.0), bridge * 0.025);
          }

          vec3 paletteCyclic(float t) {
            float count = clamp(floor(uColorCount + 0.5), 2.0, 5.0);
            float p = fract(t) * count;
            float idx = floor(p);
            return brandBlend(paletteAt(mod(idx, count)),
                              paletteAt(mod(idx + 1.0, count)), p - idx);
          }

          void main() {
            vec2 p = vProjected.xy;
            float radius = length(p);
            float angle = atan(p.y, p.x) / 6.2831853 + 0.5;
            float t = uTime * (0.16 + uWindSpeed * 0.12);

            // Wide, mismatched waves keep the escaping light organic.  The
            // local-coordinate term makes the haze respond to crystal
            // rotation instead of behaving like a fixed screen-space disc.
            float boil = sin(p.x * 4.2 + t * 2.1 + sin(p.y * 2.3 - t) * 1.2) * 0.48
                       + cos(p.y * 3.7 - t * 1.7 + vLocal.z * 2.1) * 0.32
                       + sin((vLocal.x - vLocal.y) * 3.1 + t * 2.6) * 0.2;
            boil = boil * 0.5 + 0.5;

            float facing = abs(dot(normalize(vNormalView), normalize(vViewDirection)));
            float rim = pow(1.0 - facing, 1.35);
            float reach = 1.0 - smoothstep(0.62, 1.3, radius);
            float breathe = 0.88 + sin(uTime * 0.43 + boil * 1.8) * 0.12;

            // Approximate where FriendProjection's inner light source sits
            // on screen right now (it stays near the crystal's physical
            // centre and drifts slowly — see its sourceDrift/sourceP in
            // Glass.jsx). Same frequencies, same uTime, so the two stay
            // visually in sync without this layer needing the full mesh-
            // gradient pipeline that actually drives that source.
            float sourceTime = uTime * (0.18 + uColorMotion * 0.24)
                              * (0.65 + uWindSpeed * 0.35);
            vec2 sourceDrift = vec2(
              sin(sourceTime * 0.73 + 0.8),
              cos(sourceTime * 0.61 + 1.7)
            ) * (0.03 + uLightMotion * 0.07);
            vec2 sourcePos = -sourceDrift * 0.6;

            // This is the actual fix for "I only see an outline, not
            // light": strength used to depend only on facing/radius, so it
            // traced the WHOLE silhouette evenly regardless of where the
            // light inside actually is. Gating it by distance to the
            // source's screen position instead means the rim is bright only
            // where it is closest to the real light, and fades elsewhere —
            // reading as light escaping FROM that point, not a border
            // drawn around the crystal. 03's frozen uniform rim (no source
            // gating at all) is kept byte-for-byte via the mix below.
            float distToSource = length(p - sourcePos);
            float sourceProximity = exp(-distToSource * distToSource * 2.2);
            float strengthOld = (0.052 + boil * 0.105 * uWindAmount)
                               * mix(0.42, 1.0, rim) * reach * breathe;
            float strengthNew = (0.09 + boil * 0.16 * uWindAmount)
                               * mix(0.42, 1.0, rim) * reach * breathe
                               * mix(0.04, 1.0, sourceProximity);
            float strength = mix(strengthNew, strengthOld, uLegacyPainted);

            // Keep the leaked rim on the same non-radial language as the
            // inner mesh gradient: colour travels across the silhouette,
            // never outward from its centre in another rainbow ring.
            float gradientPosition = p.x * 0.34 + p.y * 0.23
                                   + sin(angle * 6.2831853 + t) * 0.08
                                   + boil * 0.15 * uColorMotion
                                   + uTime * (0.025 + uColorMotion * 0.035);
            vec3 gradientColor = paletteCyclic(gradientPosition);
            vec3 leakColor = mix(gradientColor, vec3(1.0), 0.18 + boil * 0.06);
            leakColor = mix(leakColor, uLightColor, 0.1 + boil * 0.05);
            // Close to the source the escaping light should read as an
            // extension of the warm core itself, not the travelling brand
            // palette — that is what sells it as "the same light", not a
            // separately coloured decoration. 03 gets no extra pull here.
            leakColor = mix(leakColor, uLightColor,
                            sourceProximity * 0.65 * (1.0 - uLegacyPainted));

            gl_FragColor = vec4(leakColor, strength * uContinuousColor);
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  )
}

/**
 * Soft pieces of the living colour escaping beyond individual facets.
 *
 * This deliberately is not a second shell: several camera-facing plumes
 * overlap at different facet edges, with torn animated silhouettes. The
 * palette and timing are shared with FriendProjection, so the result reads
 * as the same substance continuing through the glass rather than a grey
 * halo pasted behind the crystal.
 */
function FriendAuraPlume({ config, active, position, scale, rotation, phase }) {
  const material = useRef(null)
  const opacityRef = useRef(0)
  const activationAtRef = useRef(null)
  const wasActiveRef = useRef(false)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uPhase: { value: phase },
    uColorMotion: { value: 0.5 },
    uWindSpeed: { value: 1 },
    uWindAmount: { value: 1 },
    uLightColor: { value: new THREE.Color('#ffdf7d') },
    uColorCount: { value: 3 },
    uColor0: { value: new THREE.Color('#ff4a2d') },
    uColor1: { value: new THREE.Color('#ff9d12') },
    uColor2: { value: new THREE.Color('#756cff') },
    uColor3: { value: new THREE.Color('#ff3f88') },
    uColor4: { value: new THREE.Color('#7f4cff') },
  }), [phase])

  useFrame(({ clock }, delta) => {
    if (!material.current) return
    const elapsed = clock.elapsedTime
    if (active && !wasActiveRef.current) activationAtRef.current = elapsed
    if (!active) activationAtRef.current = null
    wasActiveRef.current = active

    const activeAge = activationAtRef.current === null
      ? 0
      : elapsed - activationAtRef.current
    const photoGate = smootherstep(THREE.MathUtils.clamp((activeAge - 1.12) / 0.48, 0, 1))
    const heroAmount = 1 - smootherstep(
      THREE.MathUtils.clamp(crystalHeroBlend(window.scrollY) * 1.35, 0, 1),
    )
    const targetOpacity = active ? photoGate * heroAmount : 0
    const follow = 1 - Math.exp(-4.8 * Math.min(delta, 0.05))
    opacityRef.current += (targetOpacity - opacityRef.current) * follow

    const live = material.current.uniforms
    live.uTime.value = elapsed
    live.uOpacity.value = opacityRef.current
    live.uColorMotion.value = config.friendColorMotion ?? 0.5
    live.uWindSpeed.value = config.friendWindSpeed ?? 1
    live.uWindAmount.value = config.friendWindAmount ?? 1
    live.uLightColor.value.set(config.friendCenterColor ?? '#ffdf7d')
    live.uColorCount.value = Math.round(config.friendColorCount ?? 3)
    live.uColor0.value.set(config.friendFlowColor1 ?? '#ff4a2d')
    live.uColor1.value.set(config.friendFlowColor2 ?? '#ff9d12')
    live.uColor2.value.set(config.friendFlowColor3 ?? '#756cff')
    live.uColor3.value.set(config.friendFlowColor4 ?? '#ff3f88')
    live.uColor4.value.set(config.friendFlowColor5 ?? '#7f4cff')
  })

  return (
    <Billboard position={position} follow>
      <mesh scale={scale} rotation-z={rotation} renderOrder={2.92}>
        <planeGeometry args={[1.35, 1.35, 20, 20]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          transparent
          depthTest
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
          blending={THREE.NormalBlending}
          vertexShader={`
            uniform float uTime;
            uniform float uPhase;
            varying vec2 vUv;
            varying float vWarp;
            void main() {
              vUv = uv;
              vec3 p = position;
              float t = uTime * 0.42 + uPhase * 6.2831853;
              float warp = sin(uv.y * 7.0 + t)
                         + cos(uv.x * 5.0 - t * 0.83);
              p.x += warp * 0.018 * sin(uv.y * 3.1415926);
              p.y += sin(uv.x * 8.0 + t * 1.14) * 0.014;
              vWarp = warp;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uOpacity;
            uniform float uPhase;
            uniform float uColorMotion;
            uniform float uWindSpeed;
            uniform float uWindAmount;
            uniform vec3 uLightColor;
            uniform float uColorCount;
            uniform vec3 uColor0;
            uniform vec3 uColor1;
            uniform vec3 uColor2;
            uniform vec3 uColor3;
            uniform vec3 uColor4;
            varying vec2 vUv;
            varying float vWarp;

            vec3 paletteAt(float index) {
              if (index < 0.5) return uColor0;
              if (index < 1.5) return uColor1;
              if (index < 2.5) return uColor2;
              if (index < 3.5) return uColor3;
              return uColor4;
            }

            vec3 paletteCyclic(float t) {
              float count = clamp(floor(uColorCount + 0.5), 2.0, 5.0);
              float p = fract(t) * count;
              float idx = floor(p);
              return mix(paletteAt(mod(idx, count)),
                         paletteAt(mod(idx + 1.0, count)),
                         smoothstep(0.43, 0.57, p - idx));
            }

            void main() {
              vec2 p = (vUv - 0.5) * 2.0;
              float t = uTime * (0.18 + uWindSpeed * 0.13) + uPhase * 9.1;

              // Uneven drifting matter: a broad soft cloud plus two curved
              // tendrils. Their centres move independently, preventing the
              // aura from becoming a circular ring or a static blur.
              float bendA = sin(p.y * 2.5 + t * 1.4) * 0.22;
              float bendB = cos(p.y * 3.1 - t * 1.1) * 0.18;
              float cloud = exp(-(p.x * p.x * 2.0 + p.y * p.y * 1.25));
              float tendrilA = exp(-pow(abs(p.x + bendA - 0.12), 2.0) * 9.5
                                   - pow(abs(p.y + 0.04), 1.55) * 1.55);
              float tendrilB = exp(-pow(abs(p.x + bendB + 0.22), 2.0) * 13.0
                                   - pow(abs(p.y - 0.16), 1.45) * 2.0);
              float folds = sin(p.x * 5.7 + t * 1.7 + sin(p.y * 4.1 - t) * 1.4)
                          + cos(p.y * 6.2 - t * 1.3 + vWarp * 0.5);
              folds = folds * 0.25 + 0.5;

              float edge = 1.0 - smoothstep(0.46, 1.13, length(p * vec2(0.86, 1.04)));
              float density = (cloud * 0.11 + tendrilA * 0.78 + tendrilB * 0.58)
                            * edge * mix(0.62, 1.18, folds)
                            * (0.72 + uWindAmount * 0.28);
              density = smoothstep(0.035, 0.61, density);

              float colorTravel = uPhase + p.x * 0.09 + p.y * 0.075
                                + folds * 0.095
                                + uTime * (0.018 + uColorMotion * 0.028);
              vec3 color = paletteCyclic(colorTravel);
              float hot = pow(max(tendrilA, tendrilB), 2.2);
              color = mix(color, uLightColor, hot * 0.055);
              // Keep the identity palette saturated. The previous white
              // lift plus broad interpolation between complementary green
              // and violet made the result neutral-grey after overlap.
              // A short transition chooses a real palette colour almost
              // everywhere; normal blending then turns it into coloured
              // light against white without washing its hue away.
              float peak = max(max(color.r, color.g), max(color.b, 0.001));
              color /= peak;
              color = pow(color, vec3(1.48)) * 0.96;

              float alpha = min(density * uOpacity * 0.16, 0.15);
              if (alpha < 0.002) discard;
              gl_FragColor = vec4(color, alpha);
              #include <colorspace_fragment>
            }
          `}
        />
      </mesh>
    </Billboard>
  )
}

function FriendLightAura({ config, active = false }) {
  const group = useRef(null)
  const plumes = useMemo(() => ([
    { position: [0.04, 0.78, -0.08], scale: [1.22, 0.7, 1], rotation: -0.08, phase: 0.04 },
    { position: [0.8, 0.06, -0.06], scale: [0.78, 1.26, 1], rotation: 0.18, phase: 0.29 },
    { position: [-0.02, -0.76, -0.1], scale: [1.18, 0.72, 1], rotation: 0.12, phase: 0.53 },
    { position: [-0.78, -0.04, -0.08], scale: [0.8, 1.24, 1], rotation: -0.2, phase: 0.76 },
  ]), [])

  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.elapsedTime
    group.current.rotation.y = t * 0.045
    group.current.rotation.x = Math.sin(t * 0.06) * 0.16
  })

  return (
    <group ref={group}>
      {plumes.map((plume) => (
        <FriendAuraPlume
          key={plume.phase}
          config={config}
          active={active}
          {...plume}
        />
      ))}
    </group>
  )
}

function FriendProjection({ geometry, config, coverScale = 1.0025, renderOrder = 3.2 }) {
  const material = useRef(null)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSlosh: { value: new THREE.Vector3() },
    uMatte: { value: 0.41 },
    uBlur: { value: 0.37 },
    uDiffusion: { value: 0.18 },
    uTransparency: { value: 0.42 },
    uSize: { value: 0.6 },
    uStretch: { value: 0.86 },
    uSpread: { value: 0.25 },
    uFlow: { value: 0.79 },
    uPower: { value: 4.1 },
    uCenterPower: { value: 0.56 },
    uCenterSize: { value: 1 },
    uPaintFlow: { value: 1.4 },
    uPulse: { value: 0.255 },
    uFlowDrift: { value: 0.5 },
    uRays: { value: 0 },
    uRibbon: { value: 0 },
    uColorSplit: { value: 0.6 },
    uColorMotion: { value: 0.5 },
    uColorBoost: { value: 0.5 },
    uWindSpeed: { value: 1 },
    uWindAmount: { value: 1 },
    uInnerShade: { value: 0.45 },
    uShadeColor: { value: new THREE.Color('#737373') },
    uLightMotion: { value: 0.5 },
    uSpotScale: { value: 1 },
    uVerticalBias: { value: 1 },
    uDensity: { value: 1 },
    uColorReach: { value: 1 },
    uWave: { value: 0 },
    uOrganic: { value: 0 },
    uSpecular: { value: 0.6 },
    uUnify: { value: 0 },
    uGlassOnly: { value: 0 },
    uContinuousColor: { value: 0 },
    uLegacyPainted: { value: 0 },
    // See the matching comment in FriendOrganicVolume: frozen snapshot of
    // '01' as it stood 2026-09-22. 0 for both live '01' and the frozen '02'
    // today; future '01'-only tweaks here must gate through it, the same
    // way uLegacyPainted already protects the older frozen '04'.
    uFrozenGen2: { value: 0 },
    // Independent from uFrozenGen2/uLegacyPainted on purpose: forcing '01'
    // back to frozenGen2=1 (full reset to '02') would otherwise silently
    // switch this fix off too, since it currently reads isFrozenSource. Its
    // own flag lets '01' be reset to '02' while keeping just this one fix.
    uCircleFix: { value: 0 },
    uLightColor: { value: new THREE.Color('#ffdf7d') },
    uColorCount: { value: 3 },
    uColor0: { value: new THREE.Color('#ff4a2d') },
    uColor1: { value: new THREE.Color('#ff9d12') },
    uColor2: { value: new THREE.Color('#ffe66d') },
    uColor3: { value: new THREE.Color('#ff3f88') },
    uColor4: { value: new THREE.Color('#7f4cff') },
  }), [])

  useFrame(({ clock }) => {
    if (!material.current) return
    const live = material.current.uniforms
    live.uTime.value = clock.elapsedTime
    live.uSlosh.value.set(crystalSlosh.x, crystalSlosh.y, crystalSlosh.energy)
    // v4: opening block three, the milky shell clears so the swelling
    // gem fills the frame with colour, not white.
    live.uMatte.value = THREE.MathUtils.lerp(config.friendMatte ?? 0.41, 0.02, Math.min(1, Math.max(0, crystalScreen.worldExpansion ?? 0)))
    // v4: opening block three, the liquid melts into a soft blur.
    const morph = Math.min(1, Math.max(0, crystalScreen.worldExpansion ?? 0))
    live.uBlur.value = THREE.MathUtils.lerp(config.friendGlassBlur ?? 0.37, 0.95, morph)
    live.uDiffusion.value = THREE.MathUtils.lerp(config.friendLightDiffusion ?? 0.18, 0.85, morph)
    live.uTransparency.value = config.friendTransparency ?? 0.42
    live.uSize.value = config.friendCoreSize ?? 0.6
    live.uStretch.value = config.friendCoreStretch ?? 0.86
    live.uSpread.value = config.friendLightSpread ?? 0.25
    live.uFlow.value = config.friendFlow ?? 0.79
    live.uPower.value = FRIEND_LIGHT_POWER
    live.uCenterPower.value = config.friendCenterPower ?? 0.56
    live.uCenterSize.value = config.friendCenterSize ?? 1
    live.uPaintFlow.value = config.friendPaintFlow ?? 1.4
    live.uPulse.value = config.friendPulse ?? 0.255
    live.uFlowDrift.value = config.friendFlowDrift ?? 0.5
    const variant = FRIEND_VARIANTS[config.friendVersion] ?? FRIEND_VARIANTS['milky-projection']
    live.uSpotScale.value = variant.spotScale
    live.uVerticalBias.value = variant.verticalBias
    live.uDensity.value = variant.density
    live.uColorReach.value = variant.colorReach
    live.uWave.value = variant.wave ?? 0
    live.uOrganic.value = variant.organic ?? 0
    live.uRays.value = variant.rays ?? 0
    live.uRibbon.value = variant.ribbon ?? 0
    live.uColorSplit.value = config.friendColorSplit ?? 0.6
    live.uColorMotion.value = config.friendColorMotion ?? 0.5
    live.uColorBoost.value = THREE.MathUtils.lerp(config.friendColorBoost ?? 0.5, 2.4, Math.min(1, Math.max(0, crystalScreen.worldExpansion ?? 0)))
    live.uWindSpeed.value = config.friendWindSpeed ?? 1
    live.uWindAmount.value = config.friendWindAmount ?? 1
    live.uInnerShade.value = config.friendInnerShade ?? 0.45
    live.uShadeColor.value.set(config.friendShadeColor ?? '#737373')
    live.uLightMotion.value = config.friendLightMotion ?? 0.5
    live.uSpecular.value = config.friendSpecular ?? 0.6
    live.uUnify.value = variant.unify ?? 0
    live.uGlassOnly.value = variant.organic ? 1 : 0
    live.uContinuousColor.value = variant.continuousColor ?? 0
    live.uLegacyPainted.value = variant.legacyPainted ?? 0
    live.uFrozenGen2.value = variant.frozenGen2 ?? 0
    live.uCircleFix.value = variant.circleFix ?? 0
    live.uLightColor.value.set(config.friendCenterColor ?? '#ffdf7d')
    live.uColorCount.value = Math.round(config.friendColorCount ?? 3)
    live.uColor0.value.set(config.friendFlowColor1 ?? '#ff4a2d')
    live.uColor1.value.set(config.friendFlowColor2 ?? '#ff9d12')
    live.uColor2.value.set(config.friendFlowColor3 ?? '#ffe66d')
    live.uColor3.value.set(config.friendFlowColor4 ?? '#ff3f88')
    live.uColor4.value.set(config.friendFlowColor5 ?? '#7f4cff')
  })

  return (
    <mesh geometry={geometry} scale={coverScale} renderOrder={renderOrder}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
        blending={THREE.NormalBlending}
        vertexShader={`
          varying vec3 vProjected;
          varying vec3 vLocal;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;
          void main() {
            // Локальные координаты поверхности поворачиваются ВМЕСТЕ с
            // мешем — по ним привязывается рисунок света к самому телу.
            vLocal = position;
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            // Этот слой — ПОВЕРХНОСТЬ, а не объём: все его фрагменты лежат
            // примерно на одном расстоянии от центра, поэтому расстояние в
            // трёх измерениях здесь почти константа и пятно вырождается.
            // На референсе пятно — силуэт лампы, спроецированный на грань,
            // то есть радиус считается в ПЛОСКОСТИ ЭКРАНА. Отсюда же и
            // нужное поведение при вращении: пятно всегда в центре.
            vec3 centerView = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            vProjected = (viewPosition.xyz - centerView)
                       / max(length(modelMatrix[0].xyz), 0.0001);
            vNormalView = normalize(normalMatrix * normal);
            vViewDirection = normalize(-viewPosition.xyz);
            gl_Position = projectionMatrix * viewPosition;
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uSlosh;
          uniform float uMatte;
          uniform float uBlur;
          uniform float uDiffusion;
          uniform float uTransparency;
          uniform float uSize;
          uniform float uStretch;
          uniform float uSpread;
          uniform float uFlow;
          uniform float uPower;
          uniform float uCenterPower;
          uniform float uCenterSize;
          uniform float uPaintFlow;
          uniform float uPulse;
          uniform float uFlowDrift;
          uniform float uRays;
          uniform float uRibbon;
          uniform float uColorSplit;
          uniform float uColorMotion;
          uniform float uColorBoost;
          uniform float uWindSpeed;
          uniform float uWindAmount;
          uniform float uInnerShade;
          uniform vec3 uShadeColor;
          uniform float uLightMotion;
          uniform float uSpotScale;
          uniform float uVerticalBias;
          uniform float uDensity;
          uniform float uColorReach;
          uniform float uWave;
          uniform float uOrganic;
          uniform float uSpecular;
          uniform float uUnify;
          uniform float uGlassOnly;
          uniform float uContinuousColor;
          uniform float uLegacyPainted;
          uniform float uFrozenGen2;
          uniform float uCircleFix;
          uniform vec3 uLightColor;
          uniform float uColorCount;
          uniform vec3 uColor0;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform vec3 uColor3;
          uniform vec3 uColor4;
          varying vec3 vProjected;
          varying vec3 vLocal;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;

          vec3 paletteAt(float index) {
            if (index < 0.5) return uColor0;
            if (index < 1.5) return uColor1;
            if (index < 2.5) return uColor2;
            if (index < 3.5) return uColor3;
            return uColor4;
          }

          /**
           * Позиция в палитре с разделением цветов.
           *
           * При 0 — как было: непрерывная растяжка, соседние цвета
           * перетекают друг в друга по всей ширине. Выше — каждый цвет
           * подтягивается к своей области, а переход между соседями
           * сжимается в узкую полосу. Ширина полосы и есть «мягкость»
           * границы, поэтому даже на единице это не жёсткий срез.
           */
          float splitRamp(float t) {
            float count = clamp(floor(uColorCount + 0.5), 2.0, 5.0);
            if (count < 1.5) return t;
            float seg = clamp(t, 0.0, 0.9999) * (count - 1.0);
            float segIndex = floor(seg);
            float segFrac = seg - segIndex;
            // 01 only: "color split" is hidden and locked at 0 (fully
            // smooth) for this tab, which leaves each hand-off — e.g. the
            // green-to-orange RGB midpoint, a yellow-green not in the
            // palette — spread across most of the segment instead of a
            // narrow seam. Raise the effective split for 01 specifically so
            // each identity colour holds its own hue over more of its
            // share; 02/03 keep reading the slider exactly as before.
            float colorSplitContinuous = mix(max(uColorSplit, 0.8), uColorSplit, uLegacyPainted);
            float effectiveColorSplit = mix(uColorSplit, colorSplitContinuous, uContinuousColor);
            float edge = mix(0.5, 0.09, clamp(effectiveColorSplit, 0.0, 1.0));
            float snapped = segIndex + smoothstep(0.5 - edge, 0.5 + edge, segFrac);
            return snapped / (count - 1.0);
          }

          vec3 palette(float t) {
            float count = clamp(floor(uColorCount + 0.5), 2.0, 5.0);
            float p = clamp(t, 0.0, 0.9999) * (count - 1.0);
            if (p < 1.0) return mix(uColor0, uColor1, p);
            if (p < 2.0) return mix(uColor1, uColor2, p - 1.0);
            if (p < 3.0) return mix(uColor2, uColor3, p - 2.0);
            return mix(uColor3, uColor4, p - 3.0);
          }

          // continuousColor (01 only): preserve the selected identity hues.
          // A normal RGB crossfade can create a saturated intermediate hue
          // that is not present in the palette.  Broadly desaturating only the
          // hand-off keeps it soft and atmospheric without inventing a loud
          // fifth colour.
          vec3 brandBlend(vec3 a, vec3 b, float t) {
            // Broad enough to stay hazy like 02, but not spread across the
            // entire region: each identity colour gets room to read clearly.
            // 01 only: 0.22-0.78 still let the invented hand-off colour (an
            // RGB midpoint that is not one of the four picked swatches, e.g.
            // the yellow-green between green and orange) sit at close to
            // full strength over more than half of each transition, wide
            // enough to read as its own patch rather than a seam. Narrowing
            // the window alone was not enough — the moving/warped coordinate
            // that drives t can still linger inside even a narrow window
            // over a large physical area as it sweeps past, so the seam
            // still reads as a solid band on some rotations. Whitening the
            // hand-off much more heavily (bridgeAmount) is what actually
            // fixes that: instead of settling on the RGB midpoint colour,
            // the seam brightens toward white, reading as light passing
            // between the two identity colours rather than a third hue.
            // 03's frozen 0.16-0.84 / 0.035 is untouched.
            float blendStartContinuous = mix(0.44, 0.16, uLegacyPainted);
            float blendEndContinuous = mix(0.56, 0.84, uLegacyPainted);
            float softT = smoothstep(blendStartContinuous, blendEndContinuous, t);
            vec3 direct = mix(a, b, softT);
            float bridge = 4.0 * softT * (1.0 - softT);
            float bridgeAmount = mix(0.16, 0.035, uLegacyPainted);
            return mix(direct, vec3(1.0), bridge * bridgeAmount);
          }

          // continuousColor (01 only): та же палитра, но ЗАМКНУТАЯ в кольцо
          // (последний цвет перетекает обратно в первый), чтобы позицию в
          // ней можно было гнать по кругу от uTime — цвета непрерывно
          // сменяют друг друга на месте, без рывка на шве.
          vec3 paletteCyclic(float t) {
            float count = clamp(floor(uColorCount + 0.5), 2.0, 5.0);
            float p = fract(t) * count;
            float idx = floor(p);
            float frac = p - idx;
            vec3 a = paletteAt(mod(idx, count));
            vec3 b = paletteAt(mod(idx + 1.0, count));
            return brandBlend(a, b, frac);
          }

          void main() {
            // Скорость потока сама меняется во времени. Фазу при этом
            // НЕЛЬЗЯ получать умножением uTime на текущую скорость: когда
            // множитель растёт, всё уже прошедшее время пересчитывается
            // задним числом и движение прыгает. Берём честный интеграл
            // скорости rate(u) = base + swing * sin(w*u) — фаза растёт
            // монотонно, как бы ни менялась скорость.
            float flowBase = 0.13 + uFlow * 0.06;
            float flowSwing = uFlow * 0.06 * 0.6 * uFlowDrift;
            // Период около 33 с: медленнее уже не читается как дыхание,
            // на минуте изменение просто незаметно.
            float flowW = 0.19;
            float t = flowBase * uTime - (flowSwing / flowW) * cos(flowW * uTime);

            // paint flow — это амплитуда завитков, а не скорость, поэтому
            // его можно качать напрямую, без интеграла. Период другой,
            // чтобы два потока не дышали в такт.
            float paintLive = uPaintFlow
                            * (1.0 + sin(uTime * 0.13 + 1.9) * 0.55 * uFlowDrift);
            float size = max(uSize, 0.15);
            vec3 axis = vec3(1.0, 1.0 / (max(uStretch, 0.55) * max(uVerticalBias, 0.2)), 1.0);

            // Референс MILKY — матовый стеклянный куб: внутри ОДНО крупное
            // пятно с плоской яркой серединой и заметным, хоть и мягким,
            // обрывом. Три разнесённых пятна давали общий бежевый налёт
            // вместо одного читаемого источника.
            vec2 spot = vec2(
              sin(t * 0.47) * 0.03,
              0.02 + cos(t * 0.41) * 0.028
            );
            // Дыхание: пятно и особенно его сердцевина медленно ходят в
            // размере. Две несовпадающие частоты, чтобы не читалось
            // механическим тиканьем — вдох и выдох разной длины.
            float breath = sin(uTime * 0.46) * 0.7 + sin(uTime * 0.29 + 1.1) * 0.3;
            float spotRadius = (0.44 + size * 0.52) * mix(0.85, 1.35, uSpread)
                             * (1.0 + breath * uPulse * 0.22) * max(uSpotScale, 0.1);
            // continuousColor (01 only): пятно покрывало только середину
            // тела — боковые грани оставались чистым молоком без единого
            // намёка на градиент. Раздуваем пятно так, чтобы оно доставало
            // до силуэта на любой грани, а не только в её центре. Слайдеры
            // «light size»/«light spread» у 01 скрыты и закреплены на
            // минимуме — вместо доли от них берём собственную фиксированную
            // ширину (то же значение, что раньше давало полное покрытие
            // при повышенных size/spread), дыхание и spotScale сохраняются.
            float spotRadiusContinuous = 1.4 * (1.0 + breath * uPulse * 0.22) * max(uSpotScale, 0.1);
            spotRadius = mix(spotRadius, spotRadiusContinuous, uContinuousColor);
            // При unify сам центр пятна не гуляет: дрейф общего смещения
            // уводил всю массу в сторону, а она должна стоять в сердце
            // кристалла и жить только формой.
            vec2 base = (vProjected.xy - mix(spot, vec2(0.0), uUnify)) * axis.xy;
            // v4: hand-turned crystal. The mass is thrown off-centre and
            // swings back (uSlosh.xy); while agitated it bubbles: round
            // pockets rise through it and the contour churns (uSlosh.z).
            {
              vec2 shove = uSlosh.xy * 0.55;
              float hold = exp(-dot(base, base) * 0.6);
              base -= shove * (0.55 + 0.45 * hold);
              float e = uSlosh.z;
              vec2 bubbleA = vec2(sin(uTime * 2.3) * 0.18, fract(uTime * 0.9) * 1.4 - 0.7);
              vec2 bubbleB = vec2(cos(uTime * 1.9 + 2.0) * 0.22, fract(uTime * 0.75 + 0.5) * 1.4 - 0.7);
              vec2 dA = base - bubbleA;
              vec2 dB = base - bubbleB;
              base += dA * exp(-dot(dA, dA) * 28.0) * 0.35 * e;
              base += dB * exp(-dot(dB, dB) * 34.0) * 0.3 * e;
              base += vec2(
                sin(base.y * 11.0 + uTime * 9.0),
                cos(base.x * 10.0 - uTime * 8.0)
              ) * 0.035 * e;
            }

            // Идеально концентрические кольца — самый заметный признак
            // «нарисованного градиента»: настоящий свет в толще так не
            // ложится. Координаты заворачиваются перед подсчётом радиуса
            // (domain warp), и окружности ломаются в неровные доли.
            // Силу берёт уже существующий ползунок «paint flow».
            float mixAmount = (0.05 + paintLive * 0.06) * spotRadius;
            vec2 swirl = vec2(
              sin(base.y * 3.1 + t * 1.25) + 0.55 * sin(base.x * 5.2 - t * 0.85),
              cos(base.x * 2.8 - t * 1.05) + 0.55 * cos(base.y * 4.6 + t * 0.75)
            );
            vec2 drift = vec2(
              sin(base.x * 1.6 - t * 0.55),
              cos(base.y * 1.4 + t * 0.62)
            );

            // Форма пятна заворачивается слабо — контур перестаёт быть
            // циркульным, но пятно в целом остаётся одним читаемым телом.
            //
            // При unify по этому же полю идут и цвет, и ядро, поэтому оно
            // должно быть завёрнуто сильнее: слабого завитка хватало,
            // когда живость держал отдельный цветовой слой, а без него
            // общая масса выходила концентрической.
            float fieldWarp = mixAmount * mix(0.55, 1.6, uUnify);
            // Экранный завиток сдвигает поле целиком, вместе с сердцевиной.
            // При unify он гасится к центру: извивается оболочка массы, а
            // середина остаётся на месте.
            float plainDist = length(base) / max(spotRadius, 0.2);
            float centerHold = mix(1.0, smoothstep(0.0, 0.5, plainDist), uUnify);
            vec2 fieldOffset = (swirl * 0.35 + drift) * fieldWarp * centerHold;

            // ORGANIC (04): вместо жёсткого вращения — метабол-подобная
            // деформация всей массы. Четыре несоизмеримые медленные
            // частоты (ta..td) не дают комбинации читаться циклом за
            // разумное время просмотра. shapeBase заменяет base только в
            // расчёте формы (угол/радиус/dist) — цвет (colorWarped ниже)
            // продолжает жить на исходном base, поэтому градиент внутри
            // движется отдельно от геометрии, а не следом за ней.
            float ta = t * 0.037;
            float tb = t * 0.061 + 1.7;
            float tc = t * 0.089 + 3.1;
            float td = t * 0.123 + 0.6;
            vec2 shapeBase = base;
            if (uOrganic > 0.5) {
              // «Центр тяжести» массы медленно переезжает между двумя
              // точками — тело не просто дышит на месте, а перетекает
              // внутри кристалла, не покидая его.
              vec2 attractorA = vec2(sin(ta) * 0.22, cos(tb * 0.8) * 0.18);
              vec2 attractorB = vec2(cos(tc * 0.7) * 0.2, sin(td) * 0.24);
              float attractMix = sin(t * 0.021 + 2.4) * 0.5 + 0.5;
              vec2 center = mix(attractorA, attractorB, attractMix) * spotRadius;
              vec2 p = base - center;

              // Ось растяжения медленно и несинхронно поворачивается —
              // не единая скорость вращения, а сумма нескольких.
              float axisAngle = ta * 1.4 + sin(tb) * 0.6 + sin(tc * 0.5) * 0.4;
              float ac = cos(axisAngle);
              float as = sin(axisAngle);
              vec2 aligned = vec2(p.x * ac + p.y * as, -p.x * as + p.y * ac);

              // Растяжение качается между компактным овалом (≈1) и
              // вытянутой формой (до ≈2.3) — переход «шар ↔ капсула»
              // без резких скачков между состояниями.
              float stretch = 1.0 + (sin(td * 0.7) * 0.5 + 0.5) * 1.3;
              aligned.x /= stretch;
              aligned.y *= mix(1.0, 0.6, clamp(stretch - 1.0, 0.0, 1.0));

              // Изгиб (twist): поперечная координата сдвигается на
              // величину, зависящую от положения вдоль оси растяжения —
              // прямой овал прогибается в S/infinity-форму, а не просто
              // вытягивается в сигару. Включается только вместе с
              // растяжением, поэтому в компактной фазе тело остаётся
              // простым овалом.
              float twistAmount = (sin(tc) * 0.5 + 0.5) * 1.7 * clamp(stretch - 1.0, 0.0, 1.0);
              aligned.y += sin(aligned.x * 2.0 + tb) * twistAmount * 0.5;

              vec2 unaligned = vec2(aligned.x * ac - aligned.y * as, aligned.x * as + aligned.y * ac);
              // Центр возвращается назад с запасом (0.6), а не полностью —
              // масса смещается заметно, но не уходит из сердца кристалла.
              shapeBase = unaligned + center * 0.6;
            }

            // Экранных координат мало: поле, посчитанное только по ним,
            // не поворачивается вместе с кристаллом, и масса читается
            // наклейкой поверх силуэта, а не веществом внутри тела.
            // Эта добавка живёт в ЛОКАЛЬНЫХ координатах — она вращается
            // с мешем, поэтому рисунок света меняется при повороте.
            vec3 lp = vLocal;
            // «Ветер» — отдельная от общего flow ось: свой множитель
            // скорости (uWindSpeed) и амплитуды (uWindAmount) только для
            // извилистой деформации массы (bodyWarp/shapeLobe/boil/цвет),
            // не трогая дыхание ядра и прочие эффекты на общем t.
            float wt = t * uWindSpeed;
            // Более активная, извилистая волна по телу: ниже частота (шире
            // изгибы, читаются как змеиные волны, а не мелкая рябь), выше
            // скорость и амплитуда — масса заметно перетекает, а не слегка
            // подрагивает.
            float bodyWarp = sin(lp.x * 1.7 + wt * 0.68) * 0.55
                           + sin(lp.y * 2.0 - wt * 0.58) * 0.42
                           + sin(lp.z * 1.5 + wt * 0.51) * 0.46
                           + sin((lp.x + lp.z) * 2.4 - wt * 0.82) * 0.32;
            float bodyAmount = uUnify * (0.17 + paintLive * 0.09) * uWindAmount;

            // Неровность, которая НЕ сдвигает центр. Смещение координат
            // тащит за собой и середину — именно поэтому его пришлось
            // гасить к центру, и форма там осталась ровным овалом.
            // Модуляция радиуса по УГЛУ деформирует массу вокруг
            // неподвижной точки: круга не остаётся ни на каком радиусе,
            // а центр стоит. Сдвиг фазы по радиусу закручивает доли, и
            // контур перестаёт быть симметричной звездой.
            float shapeAngle = atan(shapeBase.y, shapeBase.x);
            float rNorm = length(shapeBase) / max(spotRadius, 0.2);
            // Гармоника 1-го порядка добавляет одну большую «змеиную»
            // волну поверх прежних мелких лепестков — контур не просто
            // подрагивает, а заметно извивается целиком. Фазы у всех
            // членов ускорены для более активного, живого движения.
            float shapeLobe = sin(shapeAngle + wt * 0.85 + rNorm * 1.6) * 0.60
                            + sin(shapeAngle * 2.0 + wt * 1.05 + rNorm * 1.9 + lp.y * 1.7) * 0.48
                            + sin(shapeAngle * 3.0 - wt * 0.90 - rNorm * 2.6 + lp.x * 2.1) * 0.34
                            + sin(shapeAngle * 5.0 + wt * 0.65 + lp.z * 2.4) * 0.20;
            float lobeAmount = uUnify * (0.30 + paintLive * 0.15) * uWindAmount;

            // Кипение: крупнее по масштабу (пониже частота — читается как
            // перекатывающиеся волны, а не мелкий шум) и быстрее по
            // времени — внутренность массы тоже заметно живёт.
            float boilScale = 1.0 / max(spotRadius, 0.2);
            float boil = sin(base.x * 6.2 * boilScale + wt * 2.4)
                       * sin(base.y * 5.6 * boilScale - wt * 2.0)
                       + 0.6 * sin((base.x + base.y) * 9.1 * boilScale + wt * 3.0);
            float boilAmount = uUnify * (0.17 + paintLive * 0.09) * uWindAmount;

            // continuousColor (01 only): a second, wider-scale energy field.
            // The existing boil above breaks the contour into moving waves;
            // this field travels THROUGH the mass and later drives shape,
            // palette position and emission together.  The three effects now
            // feel like one luminous substance rather than independent noise.
            vec2 livingP = base / max(spotRadius, 0.2);
            vec2 livingCenter = vec2(
              sin(wt * 0.41 + sin(wt * 0.17)) * 0.24,
              cos(wt * 0.34 + sin(wt * 0.23 + 1.2)) * 0.2
            );
            vec2 livingQ = livingP - livingCenter;
            float livingField = sin(livingQ.x * 3.7 + wt * 1.35
                                    + sin(livingQ.y * 2.4 - wt * 0.62) * 1.15) * 0.48
                              + cos(livingQ.y * 3.2 - wt * 1.08
                                    + sin(livingQ.x * 2.1 + wt * 0.47)) * 0.31
                              + sin(length(livingQ + vec2(0.17, -0.11)) * 7.2
                                    - wt * 1.52) * 0.21;
            livingField = clamp(livingField * 0.5 + 0.5, 0.0, 1.0);
            float livingBulge = (livingField - 0.5) * uWindAmount;

            float rawDist = length(shapeBase + fieldOffset) / max(spotRadius, 0.2);
            // Привязка к телу действует на ОБОЛОЧКУ массы, а не на её
            // середину: иначе весь сгусток уезжает в сторону вместе с
            // завитком и перестаёт быть в сердце кристалла. Ядро остаётся
            // на месте, а внешняя часть поворачивается вместе с мешем.
            float distRaw = (rawDist + bodyWarp * bodyAmount * smoothstep(0.0, 0.6, rawDist))
                          * (1.0 + shapeLobe * lobeAmount);
            // continuousColor (01 only): на более активном wind/paint сумма
            // этих warp'ов регулярно разносила dist за единицу — а именно
            // там spotField = pow(clamp(1 - dist*dist, 0, 1), ...) гаснет в
            // ноль, поэтому пятно мигало полностью невидимым между кадрами.
            // Зажимаем итоговую дистанцию чуть НИЖЕ единицы: истинный край
            // (rawDist ~ 1 без всплеска warp) всё ещё гаснет мягко, а
            // перехлёст от анимации больше не гасит массу целиком.
            float distContinuous = min(distRaw * (1.0 - livingBulge * 0.075), 0.95);
            float dist = mix(distRaw, distContinuous, uContinuousColor);
            // Цвет — сильно: именно он и должен читаться перемешанным.
            float colorWarped = length(base + (swirl + drift * 0.8) * mixAmount * 1.9)
                              / max(spotRadius * max(uColorReach, 0.2), 0.2);
            // …но при unify цвет берёт РОВНО то же поле, что и форма. Свой
            // завиток и свой масштаб делали из градиента отдельную сущность,
            // наложенную на пятно; общее поле превращает их в одну массу с
            // градиентом внутри.
            // continuousColor (01 only): spotRadius раздут в 1.7 раза, чтобы
            // пятно доставало до силуэта (см. выше), но dist от этого стал
            // МЕЛЬЧЕ на той же физической точке — colorDist = dist/colorReach
            // теперь еле трогался с места в пределах видимого тела, и вся
            // палитра, кроме самого первого цвета, сжималась в узкую полосу
            // у края. Сжимаем colorReach на тот же множитель, чтобы прогресс
            // по палитре растягивался на всё видимое тело, как и раньше.
            // 01 only: even after the /1.7 stretch above, the ramp was still
            // LINEAR in radius while screen area grows with radius squared —
            // so the outer ~65% of the visible area (roughly two thirds of
            // the surface) fell into the last one or two palette entries
            // (blue → purple), reading as one dominant cool colour, while
            // green was squeezed into the small central disc and then
            // further washed out by the hot core. Two changes, together:
            // ease the /1.7 compression back (01 no longer needs the ramp to
            // finish so early) and warp the radius with a mild power curve
            // so equal palette segments get closer to equal screen AREA
            // instead of equal radius. 03's frozen /1.7, linear ramp is
            // untouched.
            float colorReachDivisorContinuous = mix(1.15, 1.7, uLegacyPainted);
            float colorReachEff = mix(uColorReach, uColorReach / colorReachDivisorContinuous, uContinuousColor);
            float areaBalancedDist = mix(pow(clamp(dist, 0.0, 1.0), 1.6), dist, uLegacyPainted);
            float radialDistForColor = mix(dist, areaBalancedDist, uContinuousColor);
            float colorDist = mix(colorWarped, radialDistForColor / max(colorReachEff, 0.2), uUnify);
            colorDist = mix(colorDist,
                            colorDist + livingBulge * 0.105 * uColorMotion,
                            uContinuousColor);

            // Плато + быстрое плечо и КОНЕЧНЫЙ край на dist = 1. Чистый
            // гаусс спадает бесконечно мягко и читается прозрачным овалом;
            // у пятна на референсе плоская середина и различимая граница.
            float spotField = pow(clamp(1.0 - dist * dist, 0.0, 1.0), 0.55);
            spotField = clamp(spotField * (1.0 + boil * boilAmount), 0.0, 1.0);
            float livingDensity = clamp(0.9 + livingField * 0.22, 0.0, 1.12);
            spotField = mix(spotField,
                            clamp(spotField * livingDensity, 0.0, 1.0),
                            uContinuousColor);
            // Ядро НЕ подхватывает общий завиток цвета — самая яркая
            // точка должна оставаться около центра при любом вращении.
            // Но и идеальным кругом, меняющимся только в размере, оно
            // быть не должно: у него своя, более мелкая неравномерность.
            // Свет — подвижный сгусток энергии, а не закреплённая точка.
            // Две несоизмеримые частоты на каждую ось: путь не замыкается
            // в круг и не повторяется, сгусток всё время в новом месте.
            vec2 lightDrift = vec2(
              sin(t * 0.63) * 0.55 + sin(t * 0.41 + 1.7) * 0.45,
              cos(t * 0.52 + 0.6) * 0.55 + cos(t * 0.37 + 2.4) * 0.45
            ) * uLightMotion * 0.4;
            vec2 coreN = base / max(spotRadius, 0.2) - lightDrift;

            // Гибкость: ядро медленно тянется вдоль оси, которая сама
            // поворачивается. Оно проминается и вытягивается, а не просто
            // дышит в размере.
            // На 04 сама ось вращается несинхронной суммой частот вместо
            // одной равномерной скорости — тоже часть «замены жёсткого
            // вращения органической деформацией».
            float coreAngle = mix(t * 0.37, ta * 2.2 + sin(tb * 1.3) * 0.7 + sin(tc * 0.6) * 0.5, uOrganic);
            vec2 stretchAxis = vec2(cos(coreAngle), sin(coreAngle));
            float squash = clamp(0.1 + uPulse * 0.5, 0.0, 0.4);
            float along = dot(coreN, stretchAxis);
            vec2 across = coreN - stretchAxis * along;
            coreN = stretchAxis * along * (1.0 - squash) + across * (1.0 + squash);

            // Собственный завиток — мельче и быстрее того, что ведёт цвет,
            // поэтому край ядра живёт своей жизнью, а не повторяет ореол.
            vec2 coreSwirl = vec2(
              sin(coreN.y * 5.2 + t * 1.6) + 0.5 * sin(coreN.x * 8.1 - t * 1.1),
              cos(coreN.x * 4.8 - t * 1.4) + 0.5 * cos(coreN.y * 7.3 + t * 0.95)
            );
            coreN += coreSwirl * (0.05 + paintLive * 0.045);
            // При unify ядро перестаёт быть самостоятельным телом со своей
            // осью растяжения и своим завитком: оно садится в ту же
            // деформированную систему координат, что форма и цвет, и
            // становится просто самой горячей частью общей массы.
            vec2 coreUnified = (base + fieldOffset) / max(spotRadius, 0.2);
            coreN = mix(coreN, coreUnified, uUnify);
            // Даже с завитком координат край ядра оставался ровным овалом:
            // завиток сдвигает форму целиком, а не деформирует её. Модуляция
            // радиуса по УГЛУ меняет саму форму вокруг её точки, а сдвиг
            // фазы по радиусу закручивает доли — край получается извилистым,
            // и овал не читается ни на каком размере.
            float coreR = length(coreN);
            float coreTheta = atan(coreN.y, coreN.x);
            float coreLobe = sin(coreTheta * 2.0 + t * 1.10 + coreR * 3.2) * 0.50
                           + sin(coreTheta * 3.0 - t * 0.85 - coreR * 4.1) * 0.33
                           + sin(coreTheta * 5.0 + t * 0.60) * 0.20;
            // В версиях с единой массой ядро уже деформируется общим
            // shapeLobe — второй раз его крутить не нужно.
            float coreLobeAmount = (1.0 - uUnify) * (0.18 + paintLive * 0.09);
            float coreDist = coreR
                           * (1.0 + shapeLobe * lobeAmount * 1.2)
                           * (1.0 + coreLobe * coreLobeAmount);
            // Ядро живёт на своей доле радиуса пятна, поэтому его можно
            // сжимать, не трогая градиенты: 0.476 — прежняя фиксированная
            // доля (1.0 / 2.1), теперь она умножается на «center size».
            // Сердцевина дышит сильнее пятна — так и выглядит живой
            // источник: ореол почти на месте, а сам огонёк подрагивает.
            float coreEdge = max(0.476 * uCenterSize * (1.0 + breath * uPulse * 0.5), 0.04);
            // 1.0 - d/edge обрывается ровно на радиусе, а показатель 0.8
            // делает подъём у самой границы крутым — отсюда видимый край
            // светового пятна. При unify берём экспоненциальный спад: у
            // него нет конечного радиуса вовсе, свет растворяется в цвете.
            // Профиль 1.0 - d/edge обрывается ровно на радиусе, и показатель
            // 0.8 делает подъём у границы крутым — отсюда очевидный контур
            // овала. Экспонента конечного радиуса не имеет вовсе: свет
            // растворяется, границы нет. Коэффициент шире в 01 (мягче) и
            // уже в версиях с единой массой, где цвету нужно место.
            float hotFall = mix(2.0, 3.4, uUnify);
            float hot = exp(-pow(coreDist / max(coreEdge, 0.04), 2.0) * hotFall);
            // Внутри ядро тоже не ровное: плотность слегка гуляет, поэтому
            // оно читается сгустком света, а не белым диском.
            // Чем подвижнее свет, тем сильнее он кипит внутри себя —
            // иначе он читается летающим шариком, а не сгустком энергии.
            hot *= 1.0 + sin(coreN.x * 6.0 + coreN.y * 4.4 + t * 1.2) * 0.16
                       + sin(coreN.y * 9.5 - t * 0.85) * 0.08
                       + sin(coreN.x * 11.0 - coreN.y * 8.0 + t * 3.1) * 0.14 * uLightMotion;
            hot = clamp(hot * (1.0 + boil * boilAmount * 0.85), 0.0, 1.0);

            // ------------------------------------------------------------
            // Версия 01: цвета идут ЛУЧАМИ. Каждый — узкая полоса под своим
            // углом, проходящая через ВЕСЬ кристалл: общего пятна нет,
            // поэтому нет и овала, в который всё сворачивалось раньше.
            // Углы медленно расходятся с разной скоростью, поэтому лучи
            // всё время пересекаются по-новому и рисунок не повторяется.
            float rayCount = clamp(floor(uColorCount + 0.5), 2.0, 5.0);
            vec2 rayP = base / max(spotRadius, 0.2);
            float rayField = 0.0;
            float rayTop = 0.0;
            float rayCore = 0.0;
            vec3 rayTopColor = uColor0;
            // Свет внутри луча — тёплый, но почти белый: чистый белый
            // читался бы засветом, а не светящимся концом полосы.
            vec3 rayLight = mix(uLightColor, vec3(1.0), 0.55);
            // Лучей ВДВОЕ больше, чем цветов: по паре на каждый, с разными
            // углами, скоростями и глубиной. Раньше их было ровно три, и при
            // вращении кристалл регулярно оказывался пустым — ни один луч не
            // попадал в кадр.
            float rayTotal = rayCount * 2.0;
            // Ветка по униформе: она одинакова для всех фрагментов, поэтому
            // ничего не стоит, а десять итераций тригонометрии на пиксель
            // при выключенных лучах — стоят. Раньше цикл крутился всегда.
            if (uRays > 0.5)
            for (int i = 0; i < 10; i++) {
              float fi = float(i);
              float on = step(fi, rayTotal - 0.5);
              float ci = mod(fi, rayCount);
              // Золотой угол разводит лучи по разным направлениям, а
              // разная скорость поворота не даёт им слипнуться в веер.
              float ph = fi * 2.399;
              float ang = ph + t * (0.13 + fi * 0.055);
              vec2 dir = vec2(cos(ang), sin(ang));
              vec2 nrm = vec2(-dir.y, dir.x);

              // Луч гуляет поперёк себя — проходит через кристалл насквозь.
              float sweep = sin(t * (0.29 + fi * 0.07) + ph * 1.3) * 0.5;
              float across = dot(rayP, nrm) - sweep;
              float width = (0.34 + fi * 0.055)
                          * (1.0 + sin(t * (0.21 + fi * 0.05) + ph) * 0.25)
                          * max(uSpotScale, 0.1);
              // Показатель 0.65 на гауссе расширяет плато и растягивает
              // спад: у луча нет читаемого края, он переходит в соседний
              // и вместе они заполняют кристалл, а не лежат полосами.
              float beam = pow(exp(-pow(across / max(width, 0.03), 2.0)), 0.65) * on;
              // Своя ось внутри луча: узкая светлая сердцевина, к краям —
              // насыщенный цвет. Без этого перепада полоса читается плоской
              // заливкой, а не светом, идущим сквозь толщу.
              float core = exp(-pow(across / max(width * 0.3, 0.015), 2.0)) * on;
              // Своя глубина: луч то ближе к передней стенке, то к задней,
              // и вместе с этим меняется в яркости. Разные глубины и дают
              // ощущение слоёв внутри, а не наклеенных полос.
              float rayDepth = sin(t * (0.33 + fi * 0.062) + ph * 1.4) * 0.5 + 0.5;
              beam *= 0.52 + 0.48 * rayDepth;
              core *= 0.52 + 0.48 * rayDepth;

              // Бегущая вдоль луча волна — именно она читается полётом, а
              // не просто наклонной лентой.
              float along = dot(rayP, dir);
              // Волна не должна гасить луч до нуля — иначе он мигает и
              // пропадает целыми кусками вместо того, чтобы бежать.
              beam *= 0.8 + 0.2 * sin(along * 2.8 - t * (1.5 + fi * 0.28) + ph);
              // К концам луч слегка тускнеет, чтобы не выглядеть обрезанным
              // по силуэту кристалла.
              beam *= 0.88 + 0.12 * exp(-pow(along * 0.45, 2.0));

              rayField += beam;
              // Цвет берёт САМЫЙ сильный луч в этой точке, а не среднее по
              // всем: усреднение сливало пересекающиеся лучи в один мутный
              // тон, и вместо лучей получались широкие разводы.
              // Луч не одноцветный: ВДОЛЬ него цвет переходит в свет.
              // Точка перехода сама медленно едет по лучу, поэтому
              // светящийся конец не закреплён и полоса всё время разная.
              // Переход узкий и ездит В ПРЕДЕЛАХ луча: на широком диапазоне
              // светлый конец занимал полосу целиком, и она пропадала в
              // молоке. Доля света ограничена — цвет остаётся основой.
              float lightRun = smoothstep(0.15, 0.95,
                along * 0.6 + sin(t * (0.37 + fi * 0.08) + ph * 1.1) * 0.55 + 0.35);
              vec3 beamColor = mix(paletteAt(ci), rayLight, lightRun * 0.7);

              rayCore = max(rayCore, core);
              if (beam > rayTop) {
                rayTop = beam;
                rayTopColor = beamColor;
              }
            }
            // Сердцевина луча светлее собственного цвета — но не белая:
            // чистый белый внутри полосы читался бы засветом, а не светом.
            // Поперечная сердцевина теперь слабее: основной перепад даёт
            // продольный градиент, и две подсветки подряд снова вымывали
            // цвет до белого.
            vec3 rayColor = mix(rayTopColor, mix(rayTopColor, vec3(1.0), 0.45),
                                clamp(rayCore * 0.9, 0.0, 1.0));
            rayField = clamp(rayField, 0.0, 1.0);

            spotField = mix(spotField, rayField, uRays);

            // ------------------------------------------------------------
            // ЛЕНТА. Всё остальное здесь считается от расстояния до ТОЧКИ —
            // отсюда и радиальность. У ленты есть ось, поэтому поле строится
            // от расстояния до КРИВОЙ: идём выборкой вдоль S-образной линии
            // и берём минимум. Ветка по униформе — при выключенной ленте
            // цикл не выполняется вовсе.
            float ribbon = 0.0;
            vec3 ribbonColor = uColor0;
            if (uRibbon > 0.5) {
              vec2 rp = vProjected.xy / max(0.62 + size * 0.5, 0.2);
              // Медленный поворот всей ленты плюс снос — S каждый раз
              // перерисовывается иначе, а не ходит по кругу.
              float spin = t * 0.17;
              float cs = cos(spin);
              float sn = sin(spin);

              float best = 1e6;
              float bestU = 0.0;
              // Параметр уходит за пределы кристалла (|u| > 1): иначе у ленты
              // видны круглые торцы, и она читается шнуром с концами, а не
              // проходящей насквозь пластиной.
              for (int k = 0; k < 14; k++) {
                float u = float(k) / 13.0 * 2.8 - 1.4;
                // Две несоизмеримые гармоники вдоль параметра дают именно S,
                // а не симметричную волну.
                vec2 c = vec2(
                  u * 0.52,
                  sin(u * 2.9 + t * 0.52) * 0.48 + sin(u * 1.1 - t * 0.36) * 0.14
                );
                c = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
                float d = length(rp - c);
                if (d < best) { best = d; bestU = u; }
              }

              // ПЛАСТИНКА, а не шнур. У шнура сечение круглое и одинаковое
              // по всей длине — отсюда «червяк». Пластина широкая и плоская:
              // мы видим её то плашмя, то с ребра, поэтому её видимая ширина
              // МЕНЯЕТСЯ вдоль оси. Кручение вдоль параметра и задаёт, где
              // она развёрнута к нам, а где повёрнута ребром.
              float twist = bestU * 2.3 + t * 0.45;
              float faceOn = abs(cos(twist));
              // Набухание: лента перетекает между собранной и раздутой,
              // заполняющей почти весь объём.
              float swell = sin(t * 0.58) * 0.5 + 0.5;
              float thick = mix(0.07, 0.62, faceOn) * mix(0.55, 1.15, swell);
              ribbon = exp(-pow(best / max(thick, 0.03), 2.0) * 1.5);

              // Цвет идёт вдоль оси, а ядро ТЕМНЕЕТ к середине толщины:
              // на референсе сердцевина почти чёрно-синяя, а к краям лента
              // светлеет и уходит в другой конец палитры.
              vec3 hue = palette(clamp(bestU * 0.5 + 0.5, 0.0, 1.0));
              ribbonColor = mix(hue, hue * 0.18, pow(ribbon, 1.3) * 0.95);
            }

            spotField = mix(spotField, ribbon, uRibbon);
            // У ленты нет раскалённого белого ядра — она сама и есть тело.
            hot = mix(hot, 0.0, uRibbon);

            // ------------------------------------------------------------
            // ВОЛНА. Ни радиальное пятно, ни узкая лента — плотная толстая
            // масса, разделяющая сферу мягкой диагональной кривой на две
            // half. Граница — это ОДНА синусоида (плюс её тихая вторая
            // гармоника, чтобы не читалась идеальной волной), а не поиск
            // ближайшей точки на кривой, поэтому нет ни «бусин», ни утончений
            // вдоль длины — толщина не в счёт, есть только сторона границы.
            float wave = 0.0;
            vec3 waveColor = uColor0;
            if (uWave > 0.5) {
              // Плоскость волны крутится вокруг оси взгляда — это и есть
              // «вращение вокруг своей оси» без вращения самого кристалла.
              float spin = t * 0.16;
              float cs = cos(spin);
              float sn = sin(spin);
              vec2 wp = vec2(base.x * cs - base.y * sn, base.x * sn + base.y * cs);

              // Амплитуда и частота дышат по отдельным медленным периодам —
              // волна плавно перегибается по-новому, а не едет статичным
              // узором.
              float freq = 1.7 + sin(t * 0.07) * 0.5;
              float amp = 0.5 + sin(t * 0.11 + 1.4) * 0.22;
              float boundary = (wp.y
                + sin(wp.x * freq + t * 0.16) * amp
                + sin(wp.x * freq * 0.47 - t * 0.12) * amp * 0.4) / max(spotRadius, 0.2);

              // ПЕРЕВОРОТ: масса дышит между тонким скрученным жгутом и
              // почти полным заполнением сферы — на видео-референсе именно
              // так, а не просто вращение одной и той же ширины. Период
              // независим от spin/freq/amp, поэтому раздутие и вращение не
              // синхронны и рисунок каждый раз новый.
              float swell = sin(t * 0.5) * 0.5 + 0.5;
              float halfWidth = mix(0.32, 1.05, swell);
              float fade = mix(0.4, 0.6, swell);
              wave = 1.0 - smoothstep(halfWidth, halfWidth + fade, abs(boundary));

              // Внутри полосы — непрерывный градиент через всю палитру по
              // её ширине, а не жёсткий щелчок между двумя цветами.
              vec3 gradient = palette(clamp(boundary / (halfWidth * 2.0) + 0.5, 0.0, 1.0));

              // ПСЕВДООБЪЁМ: поперёк полосы (cx от -1 до 1) массу лепим как
              // скруглённый резиновый валик, а не плоскую наклейку. Профиль
              // круга (crossHeight) даёт тёмный край, светлый хребет и узкий
              // глянцевый блик точно по центру — именно это читается как
              // плотное упругое тело, а не как цвет на поверхности.
              float cx = clamp(boundary / halfWidth, -1.0, 1.0);
              float crossHeight = sqrt(max(1.0 - cx * cx, 0.0));
              // Только затемнение (потолок 1.0) — множитель ВЫШЕ единицы
              // клипал каналы и разворачивал оранжевый в жёлтый, поэтому
              // палитра читалась радугой из лишних оттенков вместо своих
              // цветов со светотенью.
              float rubberShade = mix(0.4, 1.0, pow(crossHeight, 0.85));
              // Тонкая тень у самой кромки, где валик подворачивается и
              // уходит в молоко — читается как скруглённый край, а не как
              // просто угасающий цвет.
              float edgeShadow = smoothstep(0.68, 1.0, abs(cx)) * 0.45;
              // Блик — не белый, а высветленная версия ТОГО ЖЕ цвета: так
              // хребет светлее, но не меняет оттенок на соседний из палитры.
              vec3 sheenTint = mix(gradient, vec3(1.0), 0.45);
              float sheen = pow(crossHeight, 16.0) * 0.4;

              waveColor = mix(gradient * rubberShade * (1.0 - edgeShadow), sheenTint, sheen);
            }

            spotField = mix(spotField, wave, uWave);
            // У волны тоже нет отдельного горячего ядра — половины сферы
            // сами себе служат светом и тенью.
            hot = mix(hot, 0.0, uWave);

            // Грани различаются по яркости: пятно видно сквозь ту панель,
            // на которую смотришь фронтально, а боковые остаются матово-
            // белыми. Без этого объект читается шаром, а не коробкой из
            // матовых панелей.
            float facing = abs(dot(normalize(vNormalView), normalize(vViewDirection)));
            // Сильнее зажимаем скользящие грани: свет должен собираться в
            // середине видимого тела — там, где толща максимальна, — а не
            // размазываться до самого силуэта. Это и есть «в сердце».
            // continuousColor (01 only): порог 0.92 пропускал градиент
            // только на грани, смотрящей почти точно в камеру — соседние
            // грани оставались голым молоком. Понижаем порог, чтобы
            // градиент читался на всех гранях сразу, а не на одной.
            float panelThreshold = mix(mix(0.7, 0.92, uUnify), 0.42, uContinuousColor);
            float panel = smoothstep(0.1, panelThreshold, facing);
            float visible = spotField * mix(0.22, 0.06, uUnify)
                          + spotField * panel * mix(0.88, 1.08, uUnify);
            // continuousColor (01 only): panel заранее задуман РЕЗКИМ —
            // «эта грань светится, соседняя матовая» — и у плоских граней
            // нормаль скачет прямо на стыке, поэтому там, где раньше стыка
            // просто не было видно (соседняя грань стояла белой), теперь
            // это читается жёсткой цветной линией. Смешиваем в куда более
            // пологое отношение: наименее развёрнутая грань всё равно
            // получает большую часть яркости, поэтому стык почти не скачет.
            visible = mix(visible, spotField * mix(0.62, 1.0, panel), uContinuousColor);

            // Глубина: дальняя стенка кристалла даёт более тусклый вклад,
            // ближняя — полный. Свет читается СКВОЗЬ толщу, а при повороте
            // передняя и задняя стороны меняются местами, и масса живёт
            // вместе с вращением.
            float depth = clamp(vProjected.z * 1.1, -1.0, 1.0);
            float depthFade = mix(1.0, 0.78 + 0.22 * smoothstep(-1.0, 1.0, depth), uUnify);
            visible *= depthFade;

            // Насыщенность живёт в плече: середина пятна выбелена, цвет
            // набирается к его краю — так свет проходит сквозь толщу.
            // Цвет набирает полную силу заметно ближе к сердцевине и
            // почти не гаснет к краю: раньше ближний конец палитры тонул
            // под белым ядром, а дальний срезался кромочным затуханием на
            // 80% — из-за этого разные цвета одного набора выглядели
            // по-разному насыщенными.
            // continuousColor (01 only): цвет набирал полную силу только к
            // colorDist ~0.42 и снова гас после ~0.7 — узкая полоса между
            // «ещё бело» и «уже гаснет», а не широкая масса. Раздвигаем
            // это плечо, чтобы цвет держался почти по всей ширине тела,
            // а не тонкой лентой на полпути к краю.
            float satRampEnd = mix(0.42, 0.8, uContinuousColor);
            float satEdgeStart = mix(0.7, 0.92, uContinuousColor);
            float saturation = visible
                             * smoothstep(0.03, satRampEnd, colorDist)
                             * (1.0 - hot * mix(0.9, 0.22, uUnify))
                             * (1.0 - smoothstep(satEdgeStart, 1.0, colorDist) * 0.35);
            // continuousColor (01 only): the old radial shoulder is what
            // created the obvious white centre -> coloured ring -> outer
            // colour sequence.  Keep the exact old mask for 02, but let 01
            // carry colour throughout the living field with only the small
            // hot core locally pushing it toward white.
            float classicSaturation = saturation;
            float travellingStream = clamp(
              livingField * 0.72
              + (sin(livingP.x * 2.35 - wt * 0.86
                   + sin(livingP.y * 1.7 + wt * 0.39)) * 0.5 + 0.5) * 0.28,
              0.0, 1.0
            );
            float internalStream = smoothstep(0.22, 0.8, travellingStream);
            float fluidSaturation = clamp(visible
                                  * (0.3 + internalStream * 0.62)
                                  * (1.0 - hot * 0.26), 0.0, 1.0);
            // Live 01 uses only the travelling saturation field. Even the
            // previous 18% borrow from the classic radial shoulder could
            // re-form a closed blue oval at particular rotations. Frozen
            // tabs keep that shoulder because uCircleFix is zero for them.
            float classicBorrow = 0.18 * (1.0 - uCircleFix);
            float tab1Saturation = mix(fluidSaturation,
                                       classicSaturation,
                                       classicBorrow);
            saturation = mix(classicSaturation, tab1Saturation, uContinuousColor);
            // У сгустков насыщенность идёт от них самих, а не от радиуса
            // общего пятна: каждый плотный внутри и гаснет по своему краю.
            // Цвет у лучей идёт от них самих и плотнее, чем у радиального
            // градиента: узкая полоса иначе тонет в молоке.
            saturation = mix(saturation, clamp(visible * 1.8, 0.0, 1.0) * (1.0 - hot * 0.5), uRays);
            saturation = mix(saturation, clamp(visible * 1.35, 0.0, 1.0), uRibbon);
            saturation = mix(saturation, clamp(visible * 1.4, 0.0, 1.0), uWave);
            // Угловая составляющая: без неё цвет остаётся функцией одного
            // радиуса и всё равно читается кольцами, пусть и кривыми. С ней
            // цвета копятся долями по разным сторонам пятна.
            float angle = atan(base.y, base.x);
            float lobe = sin(angle + wt * 0.95) * 0.55
                       + sin(angle * 2.0 + wt * 0.9) * 0.5
                       + sin(angle * 3.0 - wt * 0.7) * 0.3;
            // Подвижность самих цветов: позиция в палитре сдвигается
            // многочастотным полем, поэтому границы между цветами плавают
            // внутри пятна, а не стоят на фиксированных радиусах. Это
            // отдельная ось от «soft flow» и «paint flow» — те двигают
            // форму массы, а этот двигает цвет по ней. На том же «ветре»,
            // что и форма — цвет перетекает так же активно и той же силой.
            float colorScale = 1.0 / max(spotRadius, 0.2);
            float colorDrift = sin(base.x * 3.1 * colorScale + wt * 2.0)
                             * sin(base.y * 2.7 * colorScale - wt * 1.6)
                             + 0.6 * sin((base.x - base.y) * 4.6 * colorScale + wt * 1.3)
                             + 0.4 * sin(angle * 2.0 - wt * 2.2);
            // continuousColor (01 only): цвета и так шли по одной непрерывной
            // растяжке (splitRamp мягкий по умолчанию), но угловой lobe и
            // colorDrift раскачивали позицию в палитре настолько сильно, что
            // она переставала быть монотонной по радиусу — один и тот же
            // цвет всплывал в нескольких местах пятна отдельными жилами, а
            // между ними проглядывало молоко. Здесь эти две добавки — уже
            // не основной двигатель цвета, а лёгкое дрожание поверх
            // радиального перехода, так что вся масса читается одним телом
            // с непрерывным градиентом, а не пучком раскрашенных прожилок.
            // 01 only: the radial ramp alone paints perfect concentric rings
            // around the centre — visible as sharp rainbow bands. 03's tiny
            // jitter (0.012/0.035) is kept exactly as frozen; 01 gets a
            // stronger wobble so the ring boundaries bend and break instead
            // of reading as a bullseye.
            float lobeWeightContinuous = mix(0.05 + paintLive * 0.05, 0.012 + paintLive * 0.014, uLegacyPainted);
            float driftWeightContinuous = mix(0.14, 0.035, uLegacyPainted);
            float lobeWeight = mix(0.07 + paintLive * 0.11, lobeWeightContinuous, uContinuousColor);
            float driftWeight = mix(0.24, driftWeightContinuous, uContinuousColor);
            float ramp = clamp(smoothstep(0.1, 0.95, colorDist)
                             + lobe * lobeWeight * uWindAmount
                             + colorDrift * uColorMotion * driftWeight * uWindAmount, 0.0, 1.0);
            // The moving energy does not sit on top of the gradient: it
            // pushes the palette itself, so warm/cool areas swell and recede
            // together with the luminous convection underneath them.
            float livingRamp = clamp(ramp + livingBulge * 0.12 * uColorMotion, 0.0, 1.0);
            ramp = mix(ramp, livingRamp, uContinuousColor);
            vec3 spotColorStill = mix(palette(splitRamp(ramp)), rayColor, uRays);
            // continuousColor (01 only): bend a 2D mesh gradient, then rotate
            // it as one viscous field.  Local coordinates contribute a small
            // parallax term, so rotation of the crystal reveals a different
            // part of the colour body instead of a screen-fixed overlay.
            float fluidTime = uTime * (0.18 + uColorMotion * 0.24)
                            * (0.65 + uWindSpeed * 0.35);
            float fluidSpin = fluidTime * 0.52
                            + sin(fluidTime * 0.31) * 0.28;
            // Radius-dependent rotation turns the broad mesh into a slow
            // spiral: the centre leads and the outer colour mass follows.
            // This bends transitions instead of rotating a rigid texture.
            float radialTwist = dot(livingP, livingP)
                              * (0.78 + sin(fluidTime * 0.43) * 0.3)
                              * (0.65 + uColorMotion * 0.7);
            float fluidAngle = fluidSpin + radialTwist;
            float fluidCs = cos(fluidAngle);
            float fluidSn = sin(fluidAngle);
            vec2 fluidP = vec2(
              livingP.x * fluidCs - livingP.y * fluidSn,
              livingP.x * fluidSn + livingP.y * fluidCs
            );
            float bendStrength = (0.18 + paintLive * 0.05)
                               * (0.55 + uWindAmount * 0.45);
            fluidP += vec2(
              sin(fluidP.y * 2.35 + fluidTime * 1.65 + livingField * 1.8)
                + 0.45 * sin(fluidP.x * 3.1 - fluidTime * 1.17),
              cos(fluidP.x * 2.15 - fluidTime * 1.48 - livingField * 1.5)
                + 0.45 * cos(fluidP.y * 2.8 + fluidTime * 1.24)
            ) * bendStrength;
            // A second cross-current folds the first deformation back into
            // itself.  Different frequencies keep it from settling into a
            // repeating sine-wave motion.
            vec2 foldP = fluidP;
            fluidP += vec2(
              sin((foldP.x + foldP.y) * 3.05 - fluidTime * 1.31),
              cos((foldP.x - foldP.y) * 2.75 + fluidTime * 1.09)
            ) * bendStrength * (0.28 + uColorMotion * 0.22);
            // Two slowly travelling, counter-rotating vortices create real
            // curl in the coordinate field.  Their influence is broad and
            // bounded, so colours roll around one another without breaking
            // into small noisy cells.
            vec2 vortexCenterA = vec2(
              sin(fluidTime * 0.58 + 0.3),
              cos(fluidTime * 0.47 + 1.1)
            ) * 0.31;
            vec2 vortexA = fluidP - vortexCenterA;
            float vortexInfluenceA = 1.0 / (0.24 + dot(vortexA, vortexA));
            fluidP += vec2(-vortexA.y, vortexA.x)
                    * vortexInfluenceA * (0.026 + uColorMotion * 0.026);

            vec2 vortexCenterB = vec2(
              cos(fluidTime * 0.43 + 2.0),
              sin(fluidTime * 0.54 + 2.7)
            ) * 0.36;
            vec2 vortexB = fluidP - vortexCenterB;
            float vortexInfluenceB = 1.0 / (0.27 + dot(vortexB, vortexB));
            fluidP -= vec2(-vortexB.y, vortexB.x)
                    * vortexInfluenceB * (0.021 + uColorMotion * 0.022);

            // Local z makes the colour current sit in the crystal volume:
            // front and back facets sample slightly different phases, so
            // orbiting the camera reveals motion through depth.
            fluidP += vec2(
              sin(lp.z * 3.1 + fluidTime * 1.36),
              cos(lp.z * 2.7 - fluidTime * 1.18)
            ) * (0.035 + uColorMotion * 0.045);
            fluidP += vec2(
              sin(fluidTime * 0.67 + 0.4),
              cos(fluidTime * 0.53 + 1.2)
            ) * (0.08 + uColorMotion * 0.1);
            fluidP += vec2(lp.x + lp.z * 0.42, lp.y - lp.z * 0.34) * 0.055;

            // Cheap four-corner mesh gradient: no loops and no per-colour
            // exponentials.  The already warped/rotated coordinates make the
            // four broad colour areas curl through one another, while the
            // two different horizontal ramps prevent a simple checkerboard.
            vec2 meshUv = fluidP * 0.62 + 0.5;
            float topDrift = sin(fluidTime * 0.91 + 0.4) * 0.16
                           + sin(fluidTime * 0.37 + 2.1) * 0.07;
            float bottomDrift = cos(fluidTime * 0.79 + 1.3) * 0.17
                              + sin(fluidTime * 0.41) * 0.06;
            float middleDrift = sin(fluidTime * 0.73 + 2.4) * 0.16;
            float topX = smoothstep(-0.12, 1.12,
              meshUv.x + topDrift * uColorMotion
                       + sin(meshUv.y * 3.6 + fluidTime * 1.28) * 0.14);
            float bottomX = smoothstep(-0.12, 1.12,
              meshUv.x + bottomDrift * uColorMotion
                       - sin(meshUv.y * 3.15 - fluidTime * 1.12) * 0.15);
            float meshY = smoothstep(-0.16, 1.16,
              meshUv.y + middleDrift * uColorMotion
                       + sin(meshUv.x * 3.35 - fluidTime * 1.19) * 0.17
                       + livingBulge * 0.08);
            // The deformed coordinates already move and rotate the colour
            // regions. Keep the four identity anchors stable: cycling every
            // anchor through its neutral transition at once periodically
            // averaged the whole crystal to grey.
            float paletteTravel = fluidTime * (0.05 + uColorMotion * 0.055);
            float liveColorCount = clamp(floor(uColorCount + 0.5), 2.0, 5.0);
            vec3 movingColor0 = paletteAt(0.0);
            vec3 movingColor1 = paletteAt(min(1.0, liveColorCount - 1.0));
            vec3 movingColor2 = paletteAt(min(2.0, liveColorCount - 1.0));
            vec3 movingColor3 = paletteAt(min(3.0, liveColorCount - 1.0));
            // Four-colour layout: cross the lower pair so orange blends
            // vertically into blue rather than violet. The latter RGB path
            // passes through red; the former stays inside a cool neutral
            // haze like the soft blending in tab 02.
            //
            // 01 only, tried and reverted: swapping this so every edge mixed
            // a warm colour with a cool one (green-blue / orange-purple)
            // fixed the "whole crystal reads purple" complaint, but a direct
            // RGB blend between orange and purple lands on a dusty pink that
            // is not in the palette at all — traded one off-brand read for
            // another. Both colours here are adjacent in the brand order
            // (green→orange→blue→purple), so this pairing never invents a
            // hue outside that sequence; the "one hemisphere reads cool"
            // problem is instead handled by the lower mesh weight, the
            // area-balanced radial ramp and the extra angular jitter above,
            // none of which can produce an off-palette colour. 03 unchanged.
            if (liveColorCount > 3.5 && liveColorCount < 4.5) {
              movingColor2 = uColor3;
              movingColor3 = uColor2;
            }
            // With five colours only the fourth anchor breathes between the
            // last two. The other three remain saturated, so adding a fifth
            // colour cannot reintroduce an all-neutral frame.
            if (liveColorCount > 4.5) {
              movingColor3 = brandBlend(uColor3, uColor4,
                sin(paletteTravel * 6.2831853) * 0.5 + 0.5);
            }
            vec3 meshTop = brandBlend(movingColor0, movingColor1, topX);
            vec3 meshBottom = brandBlend(movingColor2, movingColor3, bottomX);
            vec3 spotColorFluidOld = brandBlend(meshBottom, meshTop, meshY);

            // 01 only, alternate take: instead of a quadrant mesh (which
            // always forces two of the picked colours to sit in an RGB
            // crossfade with each other, however they are arranged), give
            // each identity colour its OWN soft light — bright/white at its
            // centre, fading through its pure hue, exactly like a single
            // colour's own gradient-into-light. A handful of these drift
            // independently through the same warped fluidP space the mesh
            // used; where two overlap, the nearer one's field dominates and
            // the blend passes through their shared white core rather than
            // averaging two raw hues. None of them ever fades to black —
            // outside a blob's reach it settles back to its own pure hue
            // (near) or to white/no contribution at all (far), matching the
            // transparent-glass requirement that nothing here goes dark.
            //
            // First pass mixed toward white too early (pow 0.55 on the
            // field), so the actual saturated hue only ever showed in a
            // thin ring — most of each blob's area still read pale. Split
            // into two separate fields: a WIDE one that decides which pure
            // identity hue owns this point (blended between territories,
            // never pre-whitened), and a much TIGHTER one that only paints
            // the small hot white core on top, the way the reference clip
            // has a large saturated body with just one bright point.
            vec3 blobHueAccum = vec3(0.0);
            float blobHueWeight = 0.0;
            float blobHot = 0.0;
            for (int bi = 0; bi < 5; bi++) {
              float fbi = float(bi);
              // Uniform branch (liveColorCount is the same for every pixel
              // in this draw call): skips the unused blobs for free.
              if (fbi > liveColorCount - 0.5) break;
              float blobPhase = fbi * 2.399
                               + fluidTime * (0.15 + fbi * 0.02)
                               + sin(fluidTime * 0.09 + fbi * 1.7) * 0.6;
              float blobOrbit = 0.4 + 0.24 * sin(fluidTime * 0.12 + fbi * 2.3);
              vec2 blobCenter = vec2(cos(blobPhase), sin(blobPhase)) * blobOrbit;
              vec2 blobDelta = fluidP - blobCenter;
              float blobDistSq = dot(blobDelta, blobDelta);
              float roundTerritoryField = exp(-blobDistSq * 0.55);

              // Live 01 must never expose a recognisable coloured disc.
              // Replace the orbiting radial Gaussian with a broad, open
              // current: distance is measured only across a slowly bending
              // centre-line, not toward a point.  Because the field remains
              // open along its length, its iso-colour contours cannot close
              // into a circle or a self-contained blob.  Frozen tabs retain
              // the original radial territory byte-for-byte through
              // uCircleFix = 0.
              float flowAngle = fbi * 1.37
                              + sin(fluidTime * 0.075 + fbi * 2.1) * 0.38;
              vec2 flowDir = vec2(cos(flowAngle), sin(flowAngle));
              vec2 flowAcross = vec2(-flowDir.y, flowDir.x);
              float alongFlow = dot(fluidP, flowDir);
              float acrossFlow = dot(fluidP, flowAcross);
              float flowCentre = sin(alongFlow * 1.18
                                   + fluidTime * (0.12 + fbi * 0.013)
                                   + fbi * 1.91) * 0.48;
              flowCentre += sin(alongFlow * 2.43
                              - fluidTime * (0.07 + fbi * 0.009)
                              + fbi * 0.73) * 0.19;
              float flowDistance = acrossFlow - flowCentre;
              float openFlowField = exp(-flowDistance * flowDistance * 0.72);
              openFlowField *= 0.78
                             + 0.22 * sin(alongFlow * 0.86
                                        - fluidTime * 0.11 + fbi * 2.47);
              float territoryField = mix(roundTerritoryField,
                                         max(openFlowField, 0.035),
                                         uCircleFix);
              vec3 blobHue = paletteAt(fbi);
              blobHueAccum += territoryField * blobHue;
              blobHueWeight += territoryField;
              float roundBlobHot = exp(-blobDistSq * 5.5);
              blobHot = max(blobHot,
                            mix(roundBlobHot, 0.0, uCircleFix));
            }
            // Falls back to the first identity colour (never white, never
            // black) on the rare pixel no blob's territory reaches at all.
            vec3 blobTerritoryColor = blobHueWeight > 0.0008
              ? blobHueAccum / blobHueWeight
              : paletteAt(0.0);
            // 01 only: each blob used to light its OWN hot white core, so
            // the crystal read as several small glowing spots scattered
            // wherever the blobs happened to orbit to, instead of one
            // glow living in the middle. Requested change: keep the colour
            // territories (still nicely distributed/blended), but drop
            // every LOCAL hot core here — the single already-centred glow
            // further down the shader (innerSource/hotTarget, which stays
            // near the crystal's physical centre) is now the only source
            // of white light. '02' keeps today's frozen look (blob hot
            // cores included) via uFrozenGen2.
            vec3 spotColorBlobsWithLocalGlow = mix(blobTerritoryColor, vec3(1.0), pow(blobHot, 2.4) * 0.92);
            vec3 spotColorBlobs = mix(blobTerritoryColor, spotColorBlobsWithLocalGlow, uFrozenGen2);
            vec3 spotColorFluid = mix(spotColorBlobs, spotColorFluidOld, uLegacyPainted);
            // Preserve 01's identity-safe four-colour mesh, but let the broad
            // travelling stream from 02 steer it.  The outer mix keeps 02 on
            // its original shader path byte-for-byte.
            // 01 only: the OLD quadrant mesh's far corner always met two
            // colours on its diagonal in a direct RGB blend (a dusty pink
            // not in our palette), which is why this was pushed down to
            // 22% weight. spotColorFluid is now the blob-light model above
            // instead — each blob only ever blends toward WHITE at its own
            // centre, never directly toward another blob's raw hue, so it
            // can't invent that off-palette colour. Free to give it a real,
            // even share against the radial ramp again. 03's frozen 0.3
            // weight (and its untouched quadrant mesh) is unaffected.
            // The blob-light model is now the punchier, reference-matching
            // source (it never pre-whitens the way the old mesh did), so
            // give it the majority share instead of splitting evenly.
            // Live 01 no longer borrows the old radial colour ramp. Its
            // blue segment was the remaining large closed oval visible at
            // certain rotations. Frozen tabs keep their original share.
            float meshWeightContinuous = mix(0.28, 0.3, uLegacyPainted)
                                       * (1.0 - uCircleFix);
            vec3 tab1FlowColor = mix(spotColorFluid, spotColorStill, meshWeightContinuous);
            vec3 spotColor = mix(spotColorStill, tab1FlowColor, uContinuousColor);
            spotColor = mix(spotColor, ribbonColor, uRibbon);
            spotColor = mix(spotColor, waveColor, uWave);
            // Насыщенность поднимается разведением от собственной яркости
            // цвета, а не умножением: умножение просто пересветило бы всё,
            // а так светлота остаётся прежней и меняется только чистота.
            float spotLum = dot(spotColor, vec3(0.2126, 0.7152, 0.0722));
            vec3 spotColorOld = clamp(spotLum + (spotColor - spotLum) * (1.0 + uColorBoost * 1.9),
                                      0.0, 1.0);
            // 01 keeps the selected colour itself. Re-saturating it in RGB
            // clipped orange's green channel first and shifted the hue red.
            // Scale the selected RGB ratio toward its strongest channel
            // instead: this raises chroma while preserving orange as orange.
            float spotPeak = max(max(spotColor.r, spotColor.g), spotColor.b);
            vec3 spotColorPure = spotColor / max(spotPeak, 0.001);
            // 01 only: 0.38 kept every hue noticeably pastel next to 02's
            // fully-boosted spotColorOld. Push further toward the
            // channel-normalised colour for visibly richer brand colours,
            // without the RGB-multiply approach that clipped/shifted hue.
            // 0.8 went too far: wherever spotColor was already lightened
            // toward white (near a hand-off, or near the hot core), peak
            // normalisation inflates the non-dominant channels far more
            // than a pure brand colour would — an orange lightened toward
            // white renormalises into a pale YELLOW, not a brighter orange.
            // That was the actual source of the reported stray yellow/pink,
            // not just the hand-off width. 0.5 keeps a real saturation gain
            // without amplifying that distortion. 03's frozen 0.38 untouched.
            float identityBlendContinuous = mix(0.65, 0.38, uLegacyPainted);
            vec3 spotColorIdentity = mix(spotColor, spotColorPure, identityBlendContinuous);
            spotColor = mix(spotColorOld, spotColorIdentity, uContinuousColor);

            // Version 04 uses the same milky shell, inner shade and facet
            // highlights as 01, but its light comes from FriendOrganicVolume.
            // Suppress only the old projected entity; retain every part of
            // the glass material below.
            float projectedEntity = 1.0 - step(0.5, uGlassOnly);
            visible *= projectedEntity;
            saturation *= projectedEntity;
            hot *= projectedEntity;

            // Молоко почти белое — и любая грань без луча сливалась с белым
            // фоном страницы в сплошной засвет. Ниже единицы она читается
            // стеклом, а свет получает запас, чтобы быть светлее неё.
            vec3 milk = mix(vec3(1.0, 0.978, 0.955), vec3(0.94, 0.928, 0.914), uRays);
            // Самая горячая середина почти белая: цвет лампы проявляется
            // вокруг неё, а не в ней.
            vec3 hotWhite = mix(uLightColor, vec3(1.0), mix(0.55, 0.38, uRays));

            // Цвет только там, где есть свет. Прежняя базовая подмешка
            // (0.68 палитры по всей поверхности) и давала общий бежевый
            // налёт при слабой локальной насыщенности.
            // При unify цвет заметно плотнее и с более высоким потолком:
            // свет здесь лежит поверх той же массы и без этого перебивал
            // градиент, оставляя от него только светлую кайму.
            // У ленты подмешивание молока почти снимается: именно оно
            // держало её в пастели и не давало ядру уйти в глубокий тон.
            // На референсе сердцевина почти чёрно-синяя — это возможно
            // только когда цвет вытесняет молоко почти полностью.
            float colorMix = clamp(saturation * (0.5 + uPower * 0.045) * mix(1.0, 1.25, uUnify),
                                   0.0, mix(0.92, 0.97, uUnify));
            // continuousColor (01 only): let the fluid regions displace more
            // of the milky base instead of merely tinting it.  This increases
            // colour density without raising overall luminance.
            // 01 only: raised further so colour reads as saturated substance
            // rather than a tint over milk. 03's frozen 1.22/0.08 untouched.
            float fluidSatMulContinuous = mix(1.85, 1.22, uLegacyPainted);
            float fluidVisMulContinuous = mix(0.12, 0.08, uLegacyPainted);
            float fluidColorMix = clamp(saturation * fluidSatMulContinuous + visible * fluidVisMulContinuous,
                                        0.0, 0.995);
            // continuousColor (01 only): keep a quiet colour floor in the
            // glass, then let the moving internal current carry the dense
            // colour. A constant high floor made the shell look painted.
            // 01 only: nudged up from 03's frozen floor — with the hot core
            // pulled back above, the body needs a touch more baseline colour
            // density so the streams stay legible instead of thinning back
            // toward milk between the emissive currents. Raised again,
            // substantially: every saturation/vividness pass upstream was
            // still bottlenecked by THIS floor deciding the minimum amount
            // of milk actually displaced — a highly saturated spotColor
            // mixed at 20-30% strength still composites as pale next to
            // white. Guaranteeing a much higher baseline everywhere (not
            // just where the internal stream happens to be active) is what
            // actually fixes "everything still reads pale". 03's floor is
            // untouched.
            float fluidFloorContinuous = mix(
              0.6 + uColorBoost * 0.1 + internalStream * 0.4,
              0.14 + uColorBoost * 0.05 + internalStream * 0.38,
              uLegacyPainted
            );
            fluidColorMix = mix(fluidColorMix,
                                max(fluidColorMix, fluidFloorContinuous),
                                uContinuousColor);
            colorMix = mix(colorMix, fluidColorMix, uContinuousColor);
            colorMix = mix(colorMix, clamp(ribbon * 1.25, 0.0, 0.985), uRibbon);
            colorMix = mix(colorMix, clamp(wave * 1.25, 0.0, 0.97), uWave);
            vec3 color = mix(milk, spotColor, colorMix);
            // Множители выше 1 быстро выводили подмешку на плато чистого
            // белого — получалось белое пятно с краем, лежащее ПОВЕРХ
            // цвета. При unify подмешка растёт плавно (pow > 1, без
            // плато), а целью служит не чистый белый, а осветлённый
            // ТЕКУЩИЙ цвет: переход от света к цвету тогда не имеет края,
            // это одна масса, у которой середина просто горячее.
            // continuousColor (01 only): середина массы раньше оставалась
            // в основном ТЕМ ЖЕ цветом, чуть разбавленным белым (0.38) —
            // читалась горячим пятном цвета, а не источником света внутри
            // градиента. Поднимаем долю белого заметно выше, чтобы в
            // центре загорался именно свет, а цвет расступался к краям.
            // 01 only: 0.54 turned out too wide — the warm core washed out
            // three of the four brand colours over most rotations. Pull it
            // back down toward the point where the source still reads as
            // light, not as a pale disc. Pulled further still (0.43→0.3):
            // colours were still reading bleached/overlit even after the
            // saturation passes elsewhere, because this is the step that
            // decides how much of the core turns to plain white in the
            // first place. 03 keeps the frozen 0.54.
            float hotWhiteMixContinuous = mix(0.3, 0.54, uLegacyPainted);
            float hotWhiteMix = mix(0.38, hotWhiteMixContinuous, uContinuousColor);
            vec3 hotTarget = mix(hotWhite, mix(spotColor, vec3(1.0), hotWhiteMix), uUnify);
            float hotMixHard = hot * (0.55 + uCenterPower * 0.6) * (0.3 + panel * 0.7)
                             * (1.0 + breath * uPulse * 0.35);
            float hotMixSoft = pow(clamp(hot, 0.0, 1.0), 1.35)
                             * clamp(0.22 + uCenterPower * 0.09, 0.0, 0.62)
                             * mix(0.45 + panel * 0.55, mix(0.78, 1.0, panel), uContinuousColor);
            // 01 has its own compact emissive source below. Reduce this old
            // broad whitening so the surrounding gradient remains as visible
            // as in 02 instead of turning the middle into a pale wash.
            // 01 only: cut it back a little further than 03's frozen 0.48 —
            // the wide core was still the single biggest reason colour read
            // as faint. Cut further again (0.4→0.3) for the same reason.
            // 03 keeps its exact previous factor.
            float hotMixSoftFactorContinuous = mix(0.3, 0.48, uLegacyPainted);
            hotMixSoft = mix(hotMixSoft, hotMixSoft * hotMixSoftFactorContinuous, uContinuousColor);
            // Потолок ниже единицы: иначе сердцевина выходит в чистый цвет
            // подсветки и читается дырой, а не светом внутри стекла.
            color = mix(color, hotTarget,
                        clamp(mix(hotMixHard, hotMixSoft, uUnify), 0.0, mix(1.0, 0.76, uRays)));

            // continuousColor (01 only): broad pockets of emissive colour
            // rise through the body.  They borrow the palette colour at the
            // same point, then heat it toward the centre-light colour; this
            // is why the boil changes the gradient instead of looking like a
            // white texture composited over it.
            float livingEmissionThreshold = mix(0.52, 0.42, uCircleFix);
            float livingEmissionCeiling = mix(0.92, 0.86, uCircleFix);
            float livingEmission = smoothstep(livingEmissionThreshold,
                                               livingEmissionCeiling,
                                               livingField)
                                 * visible * (1.0 - hot * 0.34);
            vec3 livingLight = mix(spotColor, vec3(1.0), 0.18 + livingField * 0.08);
            float livingMix = mix(0.3, 0.4, uCircleFix);
            float livingAdd = mix(0.07, 0.12, uCircleFix);
            vec3 livingColor = mix(color, livingLight, livingEmission * livingMix);
            livingColor += livingLight * livingEmission * livingAdd;
            color = mix(color, livingColor, uContinuousColor);

            // continuousColor (01 only): an actual source of light inside the
            // colour body.  It is evaluated in the same bent and rotating
            // coordinates as the mesh gradient, so its outline is never a
            // clean circle and it pulls the neighbouring colours with it.
            //
            // Requested change for live '01': pin it to the true centre at
            // all times and make it read as one soft warm glow rather than
            // a small bright dot that wanders and grows a second offset
            // lobe. isFrozen picks out '02' (today's snapshot) and '04'
            // (the old archive), which both keep their exact previous
            // drift/wobble/secondary-lobe amounts; only live '01' collapses
            // them toward zero.
            float isFrozenSource = max(uLegacyPainted, uFrozenGen2);
            float driftAmount = mix(0.0, 0.03 + uLightMotion * 0.07, isFrozenSource);
            vec2 sourceDrift = vec2(
              sin(fluidTime * 0.73 + 0.8),
              cos(fluidTime * 0.61 + 1.7)
            ) * driftAmount;
            // The colour field rotates around the source, but the source
            // itself stays near the physical centre of the crystal.
            vec2 sourceP = livingP - sourceDrift;
            float wobbleAmountFrozen = 0.035 + uPulse * 0.055;
            float wobbleAmount = mix(0.0, wobbleAmountFrozen, isFrozenSource);
            sourceP += vec2(
              sin(sourceP.y * 3.2 + fluidTime * 1.15),
              cos(sourceP.x * 2.8 - fluidTime * 0.94)
            ) * wobbleAmount;
            // Live '01' divides by a larger number, so sourceP is smaller
            // for the same physical distance — the glow's footprint reads
            // visibly bigger and softer, not just a narrower falloff curve
            // on the same small dot. Frozen states keep the old denominator.
            float sizeDenomFrozen = 0.62 + uCenterSize * 0.55;
            float sizeDenom = mix(sizeDenomFrozen * 1.7, sizeDenomFrozen, isFrozenSource);
            sourceP /= sizeDenom;
            float axisWobble = mix(0.0, 0.08, isFrozenSource);
            sourceP.x *= 0.78 + sin(fluidTime * 0.37) * axisWobble;
            sourceP.y *= 1.08 + cos(fluidTime * 0.29) * axisWobble;

            // Softer falloff for live '01' (lower exponent = wider glow,
            // less of a hard hot dot). Frozen states keep the old 5.1.
            // Pushed further (2.6->1.5): the first pass was too close to
            // the frozen '02' snapshot to read as a real difference.
            float sourceSharpness = mix(1.5, 5.1, isFrozenSource);
            // Live '01' only: pinning the source to the true centre and
            // zeroing drift/wobble (above) left an ISOTROPIC gaussian sitting
            // still — exactly what reads as "a circle stuck inside", worse
            // than the old drifting dot because it does not even move.
            //
            // A first attempt scaled the radius fed into the gaussian by an
            // angular lobe — but scaling dot(sourceP,sourceP) can go BELOW 1
            // in some directions, which lets a physically far point read as
            // artificially close and outshine nearer ones: the falloff order
            // inverts and the glow reads as a rosette/ring instead of a
            // circle, not an improvement. Warping the POSITION instead (same
            // technique as swirl/drift on the main colour field earlier in
            // this shader) cannot invert distance order — it only bends
            // which point sits at the centre — so the gaussian stays a
            // single soft blob, just an organically bent one instead of a
            // perfect disc. Frozen states get zero warp — exact old
            // circle-ish falloff untouched.
            vec2 sourceWarp = vec2(
              sin(sourceP.y * 2.6 + fluidTime * 0.58) * 0.5
                + sin(sourceP.y * 4.1 - fluidTime * 0.37) * 0.3,
              cos(sourceP.x * 2.3 - fluidTime * 0.44) * 0.5
                + cos(sourceP.x * 3.7 + fluidTime * 0.31) * 0.3
            ) * (0.3 * uCircleFix);
            vec2 sourcePWarped = sourceP + sourceWarp;
            // Live '01' only, per request: make this glow's silhouette read
            // as the crystal's OWN faceted shape rather than a smooth blob
            // or a circle. Standard n-gon distance trick: project the
            // radius onto the nearest of N evenly-spaced vertex directions,
            // so iso-brightness contours trace straight edges between
            // vertices instead of an arc — the same shape language as the
            // icosahedron's own silhouette. A slow independent rotation
            // keeps it from ever locking into a static, obviously-drawn
            // hexagon. Mixed only partway with the circular version (not a
            // hard cutout) so it still reads as glass-soft light, just
            // faceted rather than round. Frozen states: zero mix, exact old
            // circular falloff untouched.
            float facetSides = 6.0;
            float facetSector = 6.2831853 / facetSides;
            float facetAngle = atan(sourcePWarped.x, sourcePWarped.y) + fluidTime * 0.06;
            float facetDist = cos(floor(0.5 + facetAngle / facetSector) * facetSector - facetAngle)
                            * length(sourcePWarped);
            float sourceRadius2 = mix(dot(sourcePWarped, sourcePWarped),
                                      facetDist * facetDist, 0.55 * uCircleFix);
            float sourceA = exp(-sourceRadius2 * sourceSharpness);
            vec2 sourceP2 = sourceP + vec2(
              0.2 + sin(fluidTime * 0.43) * 0.07,
              -0.13 + cos(fluidTime * 0.35) * 0.06
            );
            // The second, offset lobe pulled the perceived centre away from
            // the true middle — dropped to 0 for live '01' so only the one
            // centred glow remains. Frozen states keep their old 0.42.
            float sourceBWeight = mix(0.0, 0.42, isFrozenSource);
            float sourceB = exp(-dot(sourceP2, sourceP2) * 8.4) * sourceBWeight;
            // continuousColor (01 only): the source is screen-centred by
            // vProjected, so do not let a grazing facet extinguish it via
            // the visible mask. It stays present through every rotation while 02
            // retains the exact old facet-dependent behaviour.
            float sourceVisibility = mix(visible, max(visible, 0.58), uContinuousColor);
            float innerSource = clamp((sourceA + sourceB)
                                    * (0.76 + livingField * 0.34)
                                    * sourceVisibility, 0.0, 1.0);
            innerSource *= 0.9 + breath * uPulse * 0.14;
            innerSource *= 0.91
                         + sin(fluidTime * 1.63 + livingField * 2.2) * 0.09;

            vec3 sourceHue = uLightColor;
            // 01 only: 0.7 toward pure white made the light source itself
            // read as a plain white/overlit disc rather than a warm-tinted
            // source with colour visible right up to it. 03's frozen 0.7
            // untouched.
            // Live '01' pulled down further still (0.5->0.28): "soft warm
            // light" means the glow should read as a deeper tint of the
            // actual centre-light colour, not fade to near-white at its
            // core. '02' keeps today's frozen 0.5, '04' its old 0.7.
            float sourceWhiteMixFrozen = mix(0.5, 0.7, uLegacyPainted);
            float sourceWhiteMixContinuous = mix(0.05, sourceWhiteMixFrozen, isFrozenSource);
            vec3 sourceWhite = mix(sourceHue, vec3(1.0), sourceWhiteMixContinuous);
            float whiteCore = pow(innerSource, 1.55);
            // Live '01': push the warm target further over the underlying
            // colour (0.5->0.78) — at 0.5 the glow was still reading mostly
            // as whatever colour the blobs already put there, so the warm
            // tone barely showed up next to them. Frozen states unchanged.
            float coreMixWeight = mix(0.78, 0.5, isFrozenSource);
            vec3 illuminated = mix(color, sourceWhite, whiteCore * coreMixWeight);
            // Values above one are intentional: the Bloom pass turns this
            // excess into a soft optical glow instead of another white fill.
            // Live '01': stronger additive warm glow on top (0.3->0.55),
            // so it reads clearly even next to the bright specular sparkle
            // on the facets (a separate, unrelated highlight untouched by
            // any of this). Frozen states unchanged.
            float glowAddBase = mix(0.55, mix(0.3, 0.23, uLegacyPainted), isFrozenSource);
            float glowAddCenter = mix(0.11, mix(0.06, 0.055, uLegacyPainted), isFrozenSource);
            illuminated += sourceHue * innerSource
                         * (glowAddBase + uCenterPower * glowAddCenter);
            color = mix(color, illuminated, uContinuousColor);

            // continuousColor (01 only): two broad translucent currents at
            // different apparent depths. They do not draw a recognisable
            // object; they slowly thicken, clear and cross one another, so
            // the eye reads an active substance inside the glass.
            float mysteryA = sin(fluidP.x * 1.62 + fluidTime * 1.17
                               + sin(fluidP.y * 1.94 - fluidTime * 0.61) * 1.32
                               + lp.z * 1.7);
            float mysteryB = cos(fluidP.y * 1.38 - fluidTime * 0.93
                               + sin((fluidP.x + fluidP.y) * 1.46
                               + fluidTime * 0.48) * 1.14
                               - lp.z * 1.35);
            float mysteryFlow = clamp(0.5 + mysteryA * 0.27 + mysteryB * 0.23,
                                      0.0, 1.0);
            float lifeMask = uContinuousColor * (1.0 - whiteCore * 0.84);

            float mysteryShade = smoothstep(0.24, 0.82, mysteryFlow)
                               * (0.62 + visible * 0.38) * lifeMask;
            vec3 denseCurrent = mix(color, spotColor, 0.48)
                              * (0.72 + livingField * 0.11);
            color = mix(color, denseCurrent, mysteryShade * 0.7);

            // A counter-current catches coloured light rather than turning
            // white. Its phase and depth differ from the shadow current, so
            // the two never resolve into a single obvious blob or stripe.
            float counterFlow = sin((fluidP.x - fluidP.y) * 1.72
                                  - fluidTime * 1.09 + lp.z * 2.05
                                  + sin(fluidP.x * 1.24 + fluidTime * 0.41))
                              * 0.5 + 0.5;
            float mysteryLift = smoothstep(0.32, 0.86, counterFlow)
                              * (1.0 - mysteryShade * 0.55) * lifeMask;
            vec3 refractedCurrent = mix(color, spotColor, 0.72)
                                  + spotColor * 0.055;
            float movingLift = mix(0.42, 0.54, uCircleFix);
            color = mix(color, refractedCurrent, mysteryLift * movingLift);
            color += mix(spotColor, sourceWhite, 0.22)
                   * mysteryLift * 0.045 * uCircleFix;

            // A broad folded caustic appears only where the two currents
            // overlap. The wide falloff keeps it unknowable and vaporous,
            // while its independent pulse makes the interior visibly alive.
            float foldedField = abs(mysteryA * 0.58 + mysteryB * 0.42);
            float foldedVeil = 1.0 - smoothstep(0.12, 0.78, foldedField);
            foldedVeil *= 0.78
                        + sin(fluidTime * 1.37 + lp.z * 1.8) * 0.22;
            vec3 causticColor = mix(spotColor, sourceWhite, 0.3);
            float causticStrength = mix(0.28, 0.38, uCircleFix);
            color = mix(color, causticColor,
                        foldedVeil * lifeMask * causticStrength);

            // Preserve the white hot core, but recover chroma everywhere
            // around it after all light mixing.  Luminance stays fixed, so
            // this cannot turn into another exposure/bloom increase.
            float finalLum = dot(color, vec3(0.2126, 0.7152, 0.0722));
            vec3 vividColorOld = clamp(finalLum + (color - finalLum) * 1.28,
                                       0.0, 1.5);
            // 01 only: this pass previously did nothing for 01 at all
            // (vividColorIdentity was a pass-through) — every earlier
            // saturation lever fed into hazy/whitened milk mixing upstream,
            // so the result still read pale. This is the same
            // luminance-preserving contrast trick as 02's line above: it
            // scales each pixel's distance from ITS OWN luminance, so unlike
            // the peak-channel normalisation tried earlier it cannot shift
            // hue (no risk of the earlier yellow/pink regression) — it only
            // deepens whatever colour is already there. 03's frozen
            // pass-through (no boost at all) is untouched.
            vec3 vividColorTab1 = clamp(finalLum + (color - finalLum) * 1.8,
                                        0.0, 1.5);
            vec3 vividColorIdentity = mix(vividColorTab1, color, uLegacyPainted);
            vec3 vividColor = mix(vividColorOld, vividColorIdentity, uContinuousColor);
            float vividMask = uContinuousColor * (1.0 - whiteCore * 0.78);
            color = mix(color, vividColor, vividMask);
            // Give only the travelling substance extra optical density.
            // The shell stays milky/transparent, while the current keeps
            // the selected brand colour after compositing over white.
            float streamChroma = internalStream * uContinuousColor
                               * (1.0 - whiteCore * 0.72);
            float streamColorWeight = mix(0.08, 0.13, uCircleFix);
            color = mix(color, spotColor * 0.9,
                        streamChroma * streamColorWeight);

            // Блики на гранях. Матовая заливка этого слоя лежит ПОВЕРХ
            // стекла и ровно закрашивает рёбра — кристалл из-за этого
            // читается плоским силуэтом. Свет здесь фиксирован в
            // пространстве камеры: грани вспыхивают по очереди по мере
            // вращения, а не таскают блик за собой.
            vec3 nrm = normalize(vNormalView);
            vec3 viewDir = normalize(vViewDirection);
            vec3 keyDir = normalize(vec3(-0.45, 0.72, 0.52));
            vec3 fillDir = normalize(vec3(0.62, 0.22, 0.75));
            // Узкий блик даёт саму искру, широкий — мягкий подхват вдоль
            // грани; вместе они читаются как настоящая фаска, а не как
            // белое пятно.
            float keySpec = pow(max(dot(normalize(keyDir + viewDir), nrm), 0.0), 42.0);
            float fillSpec = pow(max(dot(normalize(fillDir + viewDir), nrm), 0.0), 12.0);
            float sheen = keySpec * 0.85 + fillSpec * 0.3;
            // Грани различаются по общей светлоте — без этого объём
            // держится на одних бликах и пропадает, как только блик уходит.
            float facetShade = 0.5 + 0.5 * dot(nrm, keyDir);

            float edge = pow(1.0 - facing, 1.6);
            // Кромка светлее панелей — на референсе рёбра самые белые
            // и самые чёткие, это и читается как стекло.
            // Внутренняя тень идёт под кромкой: сначала цвет темнеет к
            // силуэту, и только у самого края лежит светлая полоса.
            float rimDist = length(vProjected.xy);
            float innerShade = smoothstep(0.42, 0.95, rimDist);
            color *= mix(vec3(1.0), uShadeColor, clamp(innerShade * uInnerShade, 0.0, 1.0));
            color += vec3(1.0) * edge * 0.06;
            // Без потолка блик при highlights выше единицы выбивал целые
            // грани в чистый белый — это и читалось засветами.
            color += vec3(1.0) * min(sheen * uSpecular, 0.26);
            color *= 1.0 + (facetShade - 0.5) * 0.14 * min(uSpecular, 1.0);

            // Молочная заливка у лучей, наоборот, ПЛОТНЕЕ. Я сначала снизил
            // её, чтобы лучи пробивались, и получил обратное: сквозь редкое
            // молоко стало видно белый фон страницы, и пустые грани читались
            // засветом. Лучам хватает собственной плотности ниже.
            float milkAlpha = (0.17 + uMatte * 0.2 + uBlur * 0.12) * (1.0 + uRays * 0.3);
            float alpha = milkAlpha
                        + (visible * (0.24 + uDiffusion * 0.16) + saturation * 0.22)
                          * max(uDensity, 0.1)
                        + visible * uRays * 0.44
                        + edge * 0.12
                        + innerShade * uInnerShade * 0.14
                        + sheen * uSpecular * 0.45;
            alpha += streamChroma * (0.05 + uColorBoost * 0.025);
            // Keep the soft living projection in the centre, but let the
            // real glass layers own the silhouette. This avoids colouring
            // the whole crystal while preserving the continuous light and
            // gradient field that belongs to 01.
            float projectionBody = 1.0 - smoothstep(0.52, 0.98, rimDist);
            // Rebalancing "volume vs. projection": this surface layer draws
            // ON TOP of FriendOrganicVolume (see its boosted alpha above),
            // and at close to full opacity across most of the centre it
            // simply painted over the real volume underneath — raising the
            // volume's own alpha alone barely changed what was visible. A
            // steeper (pow > 1) falloff keeps the small hot core near the
            // centre crisp, but drops opacity much faster moving outward, so
            // the broader gradient/"body" area is dominated by the actual
            // 3D volume showing through rather than by this flat projection.
            //
            // That cut alpha (not just colour) far more than intended in the
            // whole mid zone — this layer carries most of the saturated
            // colour, so at ~0.15-0.25 alpha there it composited mostly with
            // the white page/glass behind it regardless of how saturated
            // its RGB was, which is why colour still read pale everywhere
            // outside the very centre. Gentler exponent and a much higher
            // floor/scale: still tapers toward the volume being the
            // dominant read further out, but no longer crashes alpha low
            // enough to wash the whole body back toward white.
            float clearShellOpacity = 0.16 + pow(projectionBody, 1.25) * 0.74;
            float paintedEdge = smoothstep(0.54, 0.98, rimDist);
            float paintedShellOpacity = mix(1.0, 0.62, paintedEdge);
            float tab1ProjectionOpacity = mix(clearShellOpacity,
                                              paintedShellOpacity,
                                              uLegacyPainted);
            float projectionOpacity = mix(1.0,
                                          tab1ProjectionOpacity,
                                          uContinuousColor);
            alpha *= projectionOpacity;
            alpha *= mix(1.16, 0.88, uTransparency);
            // 04 needs the texture and edge definition of 01, but a full
            // second milky layer washed its volumetric colour into pastel.
            // Keep a little more than half of that shell: visually halfway
            // between the previous saturated volume and the full 01 glass.
            alpha *= mix(1.0, 0.58, uGlassOnly);
            // Потолок поднят с 0.42 до 0.72: матовый куб на референсе
            // заметно укрывистее, а на 0.42 любой цвет на белом фоне
            // неизбежно выходил пастелью.
            // 01 only: even a strongly saturated colour still reads pale
            // once it is composited at low alpha over the white page — the
            // chroma work above raised the colour itself, but this ceiling
            // is what actually decides how much white keeps showing through
            // underneath it. 0.82 was still letting a lot of page bleed
            // through everywhere except the densest spots. 03's frozen 0.82
            // is untouched.
            float alphaCeilingContinuous = mix(0.94, 0.82, uLegacyPainted);
            float alphaCeiling = mix(0.72, alphaCeilingContinuous, uContinuousColor);
            gl_FragColor = vec4(color,
              clamp(alpha, 0.1, alphaCeiling));
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  )
}

/**
 * Один набор настроек материала на все куски, чтобы разлёт выглядел
 * как одно расколотое тело, а не двадцать разных объектов.
 */
/**
 * Два материала: «фигура» — MeshTransmissionMaterial, смотрит внутрь и
 * преломляет ColorCore.jsx; «photo» — то же преломление, гнущее
 * фотографию или видео за кристаллом (PhotoBackdrop.jsx) вместо фигуры.
 */
/**
 * The page crystal lives on a transparent canvas, so the transmission
 * pass would otherwise sample empty pixels (black) and paint a dark rim
 * as soon as the mesh grows large enough for those grazing rays to read.
 * A white background is used only inside that extra pass.
 */
const TRANSMISSION_BACKGROUND = new THREE.Color('#f7f7f6')

function Material({ config, shared }) {
  // Drives the optional "animate thickness" toggle in Photo — see the
  // `photoThickness*` fields in Panel.jsx. Called unconditionally (not
  // just inside the `материал === 'photo'` branch below) because hooks
  // can't be conditional: this same component instance is reused across
  // material-tab switches, so every render must call the same hooks in
  // the same order regardless of which `if` branch actually returns.
  //
  // MeshTransmissionMaterial can't just be handed a value to mutate on a
  // ref and left alone: its own internal per-frame loop re-derives the
  // `thickness` uniform from ITS `thickness` prop every single frame (that
  // multi-pass backside trick needs to flip between `thickness` and
  // `backsideThickness` twice a frame), so any outside mutation of the
  // uniform gets clobbered the very next frame. The only way to actually
  // animate it is to feed it a genuinely new `thickness` prop value over
  // time — hence state updated from useFrame, not a ref.
  const photoThicknessAnimate = config.материал === 'photo' && !!config.photoThicknessAnimate
  const thicknessPhase = useRef(0)
  const thicknessMin = Math.min(config.photoThicknessMin ?? 0.4, config.photoThicknessMax ?? 1.8)
  const thicknessMax = Math.max(config.photoThicknessMin ?? 0.4, config.photoThicknessMax ?? 1.8)
  const [animatedThickness, setAnimatedThickness] = useState(thicknessMin)
  useFrame((_, delta) => {
    if (!photoThicknessAnimate) return
    thicknessPhase.current += delta * (config.photoThicknessSpeed ?? 0.6)
    // (sin+1)/2 rather than a sawtooth/ping-pong lerp: the rate of change
    // eases to a stop at both the min and max ends instead of reversing
    // direction abruptly, so it reads as a slow breathing, not a tick-tock.
    const t = (Math.sin(thicknessPhase.current) + 1) / 2
    setAnimatedThickness(THREE.MathUtils.lerp(thicknessMin, thicknessMax, t))
  })

  if (config.материал === 'фигура') {
    // Та же механика, что дала понравившийся кадр с фото: тонкое чистое
    // стекло без искажения, только преломление и хроматика — они и дают
    // «играющие со светом» цветные грани. Разница с «фото» — источник
    // цвета внутри не случайная фотография под удачным углом, а всегда
    // присутствующая фигура (ColorCore), поэтому эффект не зависит от
    // ракурса вообще.
    return (
      <MeshTransmissionMaterial
        transmissionSampler={shared}
        background={TRANSMISSION_BACKGROUND}
        samples={config.samples}
        resolution={config.resolution}
        transmission={1}
        thickness={config.figureThickness}
        ior={config.figureIor}
        roughness={config.figureRoughness}
        chromaticAberration={config.figureChromaticAberration}
        // Больше смаза, чем в «Фото», и теперь регулируемо — резкое
        // преломление собирает свет из очень узкого конуса направлений:
        // в любой момент видна только маленькая точка на фигуре, а не
        // её широкий кусок, и с фиксированными настройками цвета фигура
        // вращается независимо от оболочки — та же точка обзора попадает
        // то на большую однотонную зону одного цвета, то на границу
        // между зонами, и общий вид скачет от «почти весь один цвет» до
        // «почти белый» при одних и тех же ползунках. Более широкий
        // конус усредняет сразу несколько зон цветового колеса — вид
        // меньше зависит от точного угла поворота.
        anisotropicBlur={config.figureAnisotropicBlur ?? 0.28}
        distortion={0}
        distortionScale={0}
        temporalDistortion={0}
        attenuationColor="#ffffff"
        attenuationDistance={3}
        color="#ffffff"
        clearcoat={1}
        clearcoatRoughness={0.02}
        iridescence={0}
        backside
        backsideThickness={config.figureThickness * 0.5}
      />
    )
  }

  if (config.материал === 'friend') {
    const matte = config.friendMatte ?? 0.41
    const transparency = config.friendTransparency ?? 0.42
    const frost = config.friendFrost ?? 0
    const glassBlur = config.friendGlassBlur ?? 0.37
    // Версия с diffuser=1 идёт по другому пути: на всех трёх референсах
    // стекло НЕПРОЗРАЧНОЕ — сквозь матовую колбу, панель куба и стенку
    // короба не видно ничего, свет заперт внутри. Прозрачное стекло
    // пропускало белый фон страницы, и мы всё время закрашивали его
    // слоем вместо того, чтобы не пропускать.
    const diffuser = FRIEND_VARIANTS[config.friendVersion]?.diffuser ?? 0
    const lerp = THREE.MathUtils.lerp
    return (
      <MeshTransmissionMaterial
        transmissionSampler={shared}
        background={TRANSMISSION_BACKGROUND}
        samples={config.samples}
        resolution={config.resolution}
        color="#fffdf9"
        // Ниже ~0.2 материал перестаёт быть стеклом и ведёт себя как
        // плотное молочное тело, освещённое студией.
        transmission={lerp(lerp(0.78, 0.97, transparency), 0.16, diffuser)}
        thickness={lerp(lerp(0.62, 1.02, frost), 0.3, diffuser)}
        ior={lerp(1.08, 1.04, diffuser)}
        roughness={lerp(lerp(0.38, 0.68, matte), 0.92, diffuser)}
        anisotropicBlur={lerp(Math.min(0.58, glassBlur + 0.08), 0.05, diffuser)}
        distortion={0}
        distortionScale={0}
        temporalDistortion={0}
        chromaticAberration={0}
        clearcoat={lerp(0.12, 0.05, diffuser)}
        clearcoatRoughness={lerp(0.38, 0.72, diffuser)}
        // Колбе нужен свет, чтобы читалась форма, но выше этого студия
        // снова выбивает грани в белое.
        envMapIntensity={lerp(0.22, 0.34, diffuser)}
        attenuationColor="#fff0dc"
        attenuationDistance={10}
        backside={false}
      />
    )
  }

  if (config.материал === 'photo') {
    // Настоящее гнутое стекло: фото позади (см. PhotoBackdrop.jsx —
    // небольшая плоскость близко за кристаллом, не на весь кадр) гнётся
    // естественным преломлением плюс собственный шейдер искажения
    // (distortion/distortionScale) — эффект «фото сквозь линзу» с
    // референса (openinghours.studio) — и заметные отражения
    // (envMapIntensity) от софтбоксов Studio.jsx, а не только просвет.
    //
    // Поверх этого — необязательный лёгкий цветной оттенок, свой у
    // кристалла, не идущий от самого фото (photoTintStrength = 0 держит
    // стекло полностью бесцветным, как раньше). Два разных механизма
    // material, каждый красит своё:
    //  `color` красит стекло целиком и ровно — тут этот вклад нарочно
    //  зажат вчетверо (см. `* 0.35`), иначе даже небольшой ползунок
    //  перекрашивал бы фото, а не слегка подсвечивал кристалл;
    //  `attenuationColor`/`attenuationDistance` — поглощение по Бир-
    //  Ламберту: красит только там, где луч идёт долго сквозь стекло —
    //  то есть как раз самые толстые, сильно искривлённые места картинки
    //  у силуэта, а не всю поверхность разом. Дистанция поглощения
    //  сокращается вместе с силой оттенка, иначе цвет тонет за
    //  дефолтными 3 единицами почти незаметно.
    const tintStrength = config.photoTintStrength ?? 0
    const crystalTint = new THREE.Color('#ffffff').lerp(
      new THREE.Color(config.photoCrystalTint ?? '#ffffff'), tintStrength * 0.35
    )
    const distortionTint = new THREE.Color('#ffffff').lerp(
      new THREE.Color(config.photoDistortionTint ?? '#ffffff'), tintStrength
    )
    const thicknessValue = photoThicknessAnimate ? animatedThickness : config.photoThickness
    return (
      <MeshTransmissionMaterial
        transmissionSampler={shared}
        background={TRANSMISSION_BACKGROUND}
        samples={config.samples}
        resolution={config.resolution}
        transmission={1}
        thickness={thicknessValue}
        ior={config.photoIor}
        roughness={config.photoRoughness}
        chromaticAberration={config.photoChromaticAberration}
        anisotropicBlur={config.photoAnisotropicBlur ?? 0.15}
        distortion={config.photoDistortion ?? 0.5}
        distortionScale={config.photoDistortionScale ?? 0.5}
        // A living wobble in the glass's own bending, not just the
        // static refraction of a fixed viewing angle — small on purpose
        // (temporalDistortion warps rather aggressively per unit).
        temporalDistortion={config.photoLiquid ?? 0.15}
        attenuationColor={distortionTint}
        attenuationDistance={THREE.MathUtils.lerp(6, 1.5, tintStrength)}
        color={crystalTint}
        clearcoat={1}
        clearcoatRoughness={0.02}
        iridescence={0}
        envMapIntensity={config.photoReflection ?? 1.5}
        backside
        backsideThickness={thicknessValue * 0.5}
      />
    )
  }

  // Материал всегда один из трёх выше; пустой фолбэк только на случай
  // испорченного состояния (например, старой закладки с материалом,
  // которого в этой версии больше нет).
  return null
}

// Only the outer triangular face, used to visually erase the corresponding
// face from the intact shell after a pane detaches. It has no extruded sides,
// so it cannot produce the grey bars/outline seen behind the crystal.
function buildFacetOpening(shard, offset = 0.004, insetFraction = 0) {
  const source = shard.geometry.attributes.position
  const direction = new THREE.Vector3(...shard.direction).multiplyScalar(offset)
  const center = new THREE.Vector3()
  for (let index = 0; index < 3; index += 1) {
    center.add(new THREE.Vector3().fromBufferAttribute(source, index))
  }
  center.divideScalar(3)
  const vertices = []
  for (let index = 0; index < 3; index += 1) {
    const point = new THREE.Vector3()
      .fromBufferAttribute(source, index)
      .lerp(center, insetFraction)
      .add(direction)
    vertices.push(point.x, point.y, point.z)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('aBarycentric', new THREE.Float32BufferAttribute([
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
  ], 3))
  geometry.computeVertexNormals()
  return geometry
}

// Figma's detached pieces are perspective-shaped crops rather than perfect
// equilateral faces. Apply a small in-plane affine transform while retaining
// the original face normal and barycentric coordinates for the light shader.
function buildFacetSurface(shard, offset, shape) {
  const geometry = buildFacetOpening(shard, offset)
  const position = geometry.attributes.position
  const a = new THREE.Vector3().fromBufferAttribute(position, 0)
  const b = new THREE.Vector3().fromBufferAttribute(position, 1)
  const c = new THREE.Vector3().fromBufferAttribute(position, 2)
  const center = a.clone().add(b).add(c).divideScalar(3)
  const normal = new THREE.Vector3(...shard.direction).normalize()
  const axisX = b.clone().sub(a).normalize()
  const axisY = normal.clone().cross(axisX).normalize()
  const point = new THREE.Vector3()
  const delta = new THREE.Vector3()
  const transformed = new THREE.Vector3()
  for (let index = 0; index < 3; index += 1) {
    point.fromBufferAttribute(position, index)
    delta.copy(point).sub(center)
    const x = delta.dot(axisX)
    const y = delta.dot(axisY)
    transformed
      .copy(center)
      .addScaledVector(axisX, x * shape.shapeX + y * shape.skew)
      .addScaledVector(axisY, y * shape.shapeY)
    position.setXYZ(index, transformed.x, transformed.y, transformed.z)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

// A detached pane with some body: the stylised face plus a back face and
// three side walls, so it reads as a thick piece of glass, not a sheet.
// The walls carry the barycentrics of their two edge corners, so the light
// shader draws them as lit edges.
function buildFacetPrism(shard, offset, shape, thickness) {
  const top = buildFacetSurface(shard, offset, shape)
  const p = top.attributes.position
  const normal = new THREE.Vector3(...shard.direction).normalize()
  const t = [0, 1, 2].map(i => new THREE.Vector3().fromBufferAttribute(p, i))
  const b = t.map(v => v.clone().addScaledVector(normal, -thickness))
  const bary = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  const pos = []
  const bc = []
  const push = (v, w) => { pos.push(v.x, v.y, v.z); bc.push(...w) }
  ;[0, 1, 2].forEach(i => push(t[i], bary[i]))
  ;[0, 2, 1].forEach(i => push(b[i], bary[i]))
  for (let i = 0; i < 3; i += 1) {
    const j = (i + 1) % 3
    push(t[i], bary[i]); push(t[j], bary[j]); push(b[j], bary[j])
    push(t[i], bary[i]); push(b[j], bary[j]); push(b[i], bary[i])
  }
  top.dispose()
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geometry.setAttribute('aBarycentric', new THREE.Float32BufferAttribute(bc, 3))
  geometry.computeVertexNormals()
  return geometry
}

// Screen-plane compositions measured from the five supplied Figma frames:
// entry (450:4491), then the four 1440×800 reading states. Coordinates are
// local world offsets from the crystal centre; positive Y is screen-up.
const PHYSICS_FACET_LAYOUTS = [
  [
    { x: 1.42, y: 0.72, z: 0.18, scale: 0.72, roll: -0.16 },
    { x: 1.42, y: 0.72, z: 0.18, scale: 0.72, roll: -0.16 },
    { x: 1.96, y: 0.56, z: 0.12, scale: 0.64, roll: 0.24 },
    { x: 0.48, y: 1.62, z: 0.08, scale: 0.58, roll: 0.88 },
    { x: -1.58, y: 0.62, z: 0.02, scale: 0.52, roll: 1.42 },
  ],
  [
    { x: 1.42, y: 0.72, z: 0.18, scale: 0.74, roll: -0.12 },
    { x: 1.42, y: 0.72, z: 0.18, scale: 0.74, roll: -0.12 },
    { x: 1.42, y: 0.72, z: 0.18, scale: 0.74, roll: -0.12 },
    { x: 1.98, y: 0.52, z: 0.10, scale: 0.64, roll: 0.38 },
    { x: 0.42, y: 1.60, z: 0.04, scale: 0.56, roll: 0.96 },
  ],
  [
    { x: 1.42, y: 0.72, z: 0.18, scale: 0.72, roll: -0.10 },
    { x: 1.42, y: 0.72, z: 0.18, scale: 0.72, roll: -0.10 },
    { x: 1.42, y: 0.72, z: 0.18, scale: 0.72, roll: -0.10 },
    { x: 1.42, y: 0.72, z: 0.18, scale: 0.72, roll: -0.10 },
    { x: 1.98, y: 0.50, z: 0.08, scale: 0.62, roll: 0.44 },
  ],
  [
    { x: 1.42, y: 0.72, z: 0.18, scale: 0.70, roll: -0.08 },
    { x: 1.42, y: 0.72, z: 0.18, scale: 0.70, roll: -0.08 },
    { x: 1.42, y: 0.72, z: 0.18, scale: 0.70, roll: -0.08 },
    { x: 1.42, y: 0.72, z: 0.18, scale: 0.70, roll: -0.08 },
    { x: 1.42, y: 0.72, z: 0.18, scale: 0.70, roll: -0.08 },
  ],
]

// Light from the gem into a detached facet, drawn like the hero's hover
// beam: zoom-blurred streaks in the crystal's flow colours with a soft
// haze. The crystal canvas is straight-alpha, so it is drawn in two
// passes: premultiplied over what is already there (the glass), then the
// straight colour into the still-empty canvas.
function createFacetBeamMaterials() {
  const uniforms = {
    uOpacity: { value: 0 },
    uTime: { value: 0 },
    uC0: { value: new THREE.Color('#76dcf2') },
    uC1: { value: new THREE.Color('#08df68') },
    uC2: { value: new THREE.Color('#55a9eb') },
    uC3: { value: new THREE.Color('#e5f2ad') },
    uPass: { value: 0 },
  }
  const base = {
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uPass;
      uniform vec3 uC0;
      uniform vec3 uC1;
      uniform vec3 uC2;
      uniform vec3 uC3;
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      vec3 palette(float t) {
        t = fract(t) * 4.0;
        vec3 a = mix(uC0, uC1, smoothstep(0.0, 1.0, t));
        a = mix(a, uC2, smoothstep(1.0, 2.0, t));
        a = mix(a, uC3, smoothstep(2.0, 3.0, t));
        return mix(a, uC0, smoothstep(3.0, 4.0, t));
      }
      void main() {
        float x = vUv.x;
        float y = vUv.y - 0.5;
        // A fan opening from the gem toward the facet.
        float width = mix(0.12, 0.34, smoothstep(0.0, 1.0, x));
        float t = y / width;
        float ang = atan(y, max(x, 0.02) + 0.18);
        float cone = exp(-t * t * 1.4);
        float core = exp(-t * t * 7.0);
        float along = smoothstep(0.0, 0.08, x) * (1.0 - smoothstep(0.86, 1.0, x));
        // Zoom-blur streaks: noise on the angle, drifting outward.
        float flow = uTime * 0.35 - x * 1.6;
        float s1 = noise(vec2(ang * 34.0, flow));
        float s2 = noise(vec2(ang * 95.0 + 7.3, flow * 1.7));
        float s3 = noise(vec2(ang * 12.0 - 2.1, flow * 0.6));
        // Soft, broad streaks only: the fine high-frequency noise read as
        // white spatter around the beam.
        float streak = 0.55 + 0.3 * s1 + 0.25 * s3;
        // Haze stretched along the beam, mixed into the rays.
        float hazeN = noise(vec2(x * 1.2 - uTime * 0.14, y * 4.0 + uTime * 0.03)) * 0.65
                    + noise(vec2(x * 2.6 + 3.1 - uTime * 0.2, y * 8.0 + 7.0)) * 0.45;
        float haze = exp(-t * t * 0.4) * smoothstep(0.25, 0.95, hazeN) * (1.0 - smoothstep(0.32, 0.5, abs(y)));
        // Colour runs along the rays.
        vec3 colour = palette(noise(vec2(ang * 3.2 + 1.3, x * 0.6 - uTime * 0.1)) * 1.25 + uTime * 0.02);
        // No white core: the beam keeps the crystal colours throughout.
        // A soft pool of light where it reaches the facet.
        float contact = exp(-pow((x - 0.88) * 4.0, 2.0)) * cone;
        vec3 light = colour * (cone * streak * 1.15) * along * uOpacity;
        float peak = max(max(light.r, light.g), light.b);
        float alpha = clamp(peak, 0.0, 1.0);
        if (alpha < 0.004) discard;
        vec3 straight = min(light / alpha, vec3(1.0));
        gl_FragColor = uPass > 0.5 ? vec4(straight * alpha, alpha) : vec4(straight, alpha);
      }
    `,
  }
  // Pass 1, over the glass: premultiplied colour weighted by dst alpha.
  const over = new THREE.ShaderMaterial({
    ...base,
    uniforms: { ...uniforms, uPass: { value: 1 } },
    blendSrc: THREE.DstAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  })
  // Pass 2, the empty canvas: straight colour where nothing is drawn yet.
  const fill = new THREE.ShaderMaterial({
    ...base,
    uniforms: { ...uniforms, uPass: { value: 0 } },
    blendSrc: THREE.OneMinusDstAlphaFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  })
  const materials = [over, fill]
  materials.uniforms = uniforms
  return materials
}

const beamFrom = new THREE.Vector3()
const beamTo = new THREE.Vector3()
const beamMid = new THREE.Vector3()
const beamAxisX = new THREE.Vector3()
const beamAxisY = new THREE.Vector3()
const beamAxisZ = new THREE.Vector3()
const beamBasis = new THREE.Matrix4()
const beamParentQuaternion = new THREE.Quaternion()
const beamParentScale = new THREE.Vector3()

const PHYSICS_PARENT_QUATERNIONS = [
  [-0.14, 0, -0.34],
  [0.12, -0.48, -0.05],
  [0.12, -1.12, -0.04],
  [0.12, -1.76, -0.03],
  [0.12, -2.40, -0.02],
].map(([x, y, z]) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ')))

// Each detached pane crosses the virtual camera on its own beat. Values are
// deterministic functions of the reversible portal playhead, so reverse
// scroll reconstructs the exact four-fragment composition without springs
// retaining stale velocity.
const PHYSICS_FACET_PORTAL = [
  { delay: 0.02, span: 0.28, scale: 1.45, driftX: -0.18, driftY: 0.12, depth: -0.08, offsetY: -0.28, tiltX: -0.3, tiltY: 0.2, firstTwist: -0.08, twist: -0.72, shapeX: 1.06, shapeY: 0.67, skew: -0.38 },
  { delay: 0.18, span: 0.28, scale: 2.10, driftX: 0.16, driftY: -0.18, depth: -0.12, offsetY: 0, tiltX: 0.2, tiltY: -0.36, firstTwist: 0, twist: 1.62, shapeX: 0.9, shapeY: 1.04, skew: -0.08 },
  { delay: 0.34, span: 0.28, scale: 2.55, driftX: 0.08, driftY: 0.22, depth: 0.3, offsetY: 0, tiltX: -0.27, tiltY: 0.33, firstTwist: 0, twist: -1.88, shapeX: 0.84, shapeY: 1.08, skew: 0.1 },
  { delay: 0.50, span: 0.26, scale: 1.72, driftX: -0.12, driftY: -0.14, depth: -0.24, offsetY: 0.18, tiltX: 0.34, tiltY: 0.13, firstTwist: 0, twist: 2.4, shapeX: 0.88, shapeY: 1.02, skew: -0.12 },
]

/**
 * Same brand palette as the living crystal, painted on the detached chip
 * through the same projection field — so the piece reads as glass, not a
 * shadowed sticker.
 */
function RemainingFragments({ shards, selected, motionRef }) {
  const root = useRef(null)
  const remaining = useMemo(() => shards.filter(item => !selected.includes(item)), [shards, selected])
  useFrame(() => {
    if (!root.current) return
    const portal = motionRef?.current?.fourth?.portal ?? 0
    root.current.visible = portal > .08 && portal < .96
    const flight = smootherstep(Math.min(1, Math.max(0, (portal - .08) / .78)))
    root.current.children.forEach((mesh, index) => {
      const shard = remaining[index]
      mesh.position.set(...shard.position)
      mesh.position.x += shard.direction[0] * flight * 11
      mesh.position.y += shard.direction[1] * flight * 11
      mesh.position.z += shard.direction[2] * flight * 11
      mesh.rotation.set(flight * (index % 3), flight * (index % 5), flight * .7)
      // Light glass shards that thin out as they fly past.
      mesh.material.opacity = .7 * (1 - smootherstep(Math.min(1, Math.max(0, (flight - .35) / .45))))
    })
  })
  return <group ref={root} visible={false}>{remaining.map((shard, index) => (
    <mesh key={index} geometry={shard.geometry} position={shard.position}>
      <meshBasicMaterial color={index % 2 ? '#d8fbf2' : '#d6ecfc'} transparent opacity={.7} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  ))}</group>
}

function FeaturedFacet({ shard, state, config, motionRef }) {
  const groupRef = useRef(null)
  const cutoutRef = useRef(null)
  const openingRef = useRef(null)
  const rimRef = useRef(null)
  const beamRef = useRef(null)
  const beamMaterials = useMemo(createFacetBeamMaterials, [])
  useEffect(() => () => beamMaterials.forEach(m => m.dispose()), [beamMaterials])
  const facetPaintRef = useRef(null)
  const progressRef = useRef(0)
  const basePosition = useMemo(() => new THREE.Vector3(...shard.position), [shard])
  const direction = useMemo(() => new THREE.Vector3(...shard.direction), [shard])
  const faceWorld = useMemo(() => new THREE.Vector3(), [])
  const layout = PHYSICS_FACET_LAYOUTS[state - 1]
  const profile = PHYSICS_FACET_PORTAL[state - 1]
  // The outer mask removes the complete source facet from both the glass and
  // its colour projection. A second plane with that exact full-face outline
  // sits deeper in the body and supplies a translucent inner surface. The
  // detached pane may be stylised in perspective, but the opening must still
  // consume the entire selected crystal face without leaving a coloured tip.
  const cutoutGeometry = useMemo(
    () => buildFacetOpening(shard, 0.038),
    [shard],
  )
  const openingGeometry = useMemo(
    // A compact surface lives well inside the body: the shell opening and
    // its bevel remain visibly three-dimensional, while the moving colour
    // reads as something deeper in the crystal rather than a replacement
    // pane pasted into the missing face.
    () => buildFacetOpening(
      shard,
      state === 1 ? -0.34 : -0.40,
      state === 1 ? 0.46 : 0.50,
    ),
    [shard, state],
  )
  const rimGeometry = useMemo(
    () => buildFacetOpening(shard, 0.012, state === 1 ? 0.015 : 0.06),
    [shard, state],
  )
  const chipSurfaceGeometry = useMemo(
    () => buildFacetPrism(shard, 0.061, profile, 0.073),
    [profile, shard],
  )
  const facetPaintUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uOpacity: { value: 1 },
    uPhase: { value: state * 1.37 },
    uCyan: { value: new THREE.Color(config.friendFlowColor1 ?? '#76dcf2') },
    uGreen: { value: new THREE.Color(config.friendFlowColor2 ?? '#08df68') },
    uBlue: { value: new THREE.Color(config.friendFlowColor3 ?? '#55a9eb') },
    uYellow: { value: new THREE.Color(config.friendFlowColor4 ?? '#e5f2ad') },
  }), [config, state])
  useEffect(() => () => {
    cutoutGeometry.dispose()
    openingGeometry.dispose()
    rimGeometry.dispose()
    chipSurfaceGeometry.dispose()
  }, [cutoutGeometry, openingGeometry, rimGeometry, chipSurfaceGeometry])
  const restQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const targetPosition = useMemo(() => new THREE.Vector3(), [])
  const parentQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const inverseParentQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const targetQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const tiltQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const tiltEuler = useMemo(() => new THREE.Euler(), [])
  const desiredNormal = useMemo(() => new THREE.Vector3(), [])
  const rollQuaternion = useMemo(() => new THREE.Quaternion(), [])

  useFrame(({ clock, camera, size }, delta) => {
    const group = groupRef.current
    if (!group) return
    if (facetPaintRef.current) {
      const uniforms = facetPaintRef.current.uniforms
      uniforms.uTime.value = clock.elapsedTime
      uniforms.uCyan.value.set(config.friendFlowColor1 ?? '#76dcf2')
      uniforms.uGreen.value.set(config.friendFlowColor2 ?? '#08df68')
      uniforms.uBlue.value.set(config.friendFlowColor3 ?? '#55a9eb')
      uniforms.uYellow.value.set(config.friendFlowColor4 ?? '#e5f2ad')
    }
    const fourth = motionRef?.current?.fourth
    const stateOne = Math.min(Math.max(fourth?.stateOne ?? 0, 0), 1)
    const stateTwo = Math.min(Math.max(fourth?.stateTwo ?? 0, 0), 1)
    const stateThree = Math.min(Math.max(fourth?.stateThree ?? 0, 0), 1)
    const stateFour = Math.min(Math.max(fourth?.stateFour ?? 0, 0), 1)
    const portal = Math.min(Math.max(fourth?.portal ?? 0, 0), 1)
    const states = [stateOne, stateTwo, stateThree, stateFour]
    // The introductory frame stays whole. Detachment starts only when the
    // first centred reading state begins; later states add panes cumulatively.
    // Spread over the whole state transition and chased gently, so the
    // pane visibly glides out of the gem instead of snapping late.
    // Second half of the step only: the gem has finished turning (first
    // half, PageCrystal), so the pane always leaves the face now in front.
    const target = smootherstep(Math.min(1, Math.max(0, ((states[state - 1] ?? 0) - FACET_DETACH_START) / (1 - FACET_DETACH_START))))
    const follow = 1 - Math.exp(-5 * Math.min(delta, 0.05))
    progressRef.current += (target - progressRef.current) * follow
    const progress = progressRef.current
    group.visible = progress > 0.012
    // All four reading states now use genuine missing faces in the shell.
    // The old depth masks stay mounted only to avoid churn during HMR.
    if (cutoutRef.current) cutoutRef.current.visible = false
    if (rimRef.current) {
      // The bevel retained by the genuinely open shell is the only edge.
      // Extra line loops read as a second pane once the crystal rotates.
      rimRef.current.visible = false
      rimRef.current.material.opacity = 0
    }

    let x = layout[0].x
    let y = layout[0].y
    let z = layout[0].z
    let facetScale = layout[0].scale
    let roll = layout[0].roll
    // The first Figma frame is a deliberately composed hero crop, not part
    // of the later random spatial fan. Keep its single pane almost frontal
    // and introduce the stronger 3D orientation only as state two arrives.
    const spatialRandomness = state === 1 ? stateTwo : 1
    for (let phase = 1; phase < layout.length; phase += 1) {
      const phaseProgress = states[phase - 1]
      x += (layout[phase].x - x) * phaseProgress
      y += (layout[phase].y - y) * phaseProgress
      z += (layout[phase].z - z) * phaseProgress
      facetScale += (layout[phase].scale - facetScale) * phaseProgress
      roll += (layout[phase].roll - roll) * phaseProgress
    }
    // Figma uses four very different in-plane angles rather than a regular
    // radial fan. The perspective tilt is handled independently below.
    roll += profile.firstTwist * (1 - spatialRandomness)
      + profile.twist * spatialRandomness
    if (state === 2) roll += 0.07 * (1 - stateThree)

    // Read the actual body pose, so detached glass and its source opening
    // stay registered even while the parent's spring settles.
    group.parent.getWorldQuaternion(parentQuaternion)
    // The pane flies straight out of its own face: the direction is that
    // face's normal as the gem is turned right now, flattened onto the
    // screen. So the white opening is always right next to its pane, and
    // panes already out travel round with the gem as it keeps turning.
    faceWorld.copy(direction).applyQuaternion(parentQuaternion)
    const screenLength = Math.hypot(faceWorld.x, faceWorld.y)
    const reach = 1 / Math.max(screenLength, .35)
    x = 1.65 * faceWorld.x * reach
    y = 1.45 * faceWorld.y * reach
    z = .24 + Math.max(0, faceWorld.z) * .3
    facetScale = .74
    inverseParentQuaternion.copy(parentQuaternion).invert()
    targetPosition
      .set(
        x,
        y + profile.offsetY * spatialRandomness,
        z + profile.depth * spatialRandomness,
      )
      .applyQuaternion(inverseParentQuaternion)
    group.position.copy(basePosition).lerp(targetPosition, progress)
    const firstTiltX = state === 1 ? -0.06 : profile.tiltX
    const firstTiltY = state === 1 ? 0.08 : profile.tiltY
    tiltEuler.set(
      firstTiltX + (profile.tiltX - firstTiltX) * spatialRandomness,
      firstTiltY + (profile.tiltY - firstTiltY) * spatialRandomness,
      0,
      'XYZ',
    )
    tiltQuaternion.setFromEuler(tiltEuler)
    desiredNormal
      .set(0, 0, 1)
      .applyQuaternion(tiltQuaternion)
      .applyQuaternion(inverseParentQuaternion)
      .normalize()
    targetQuaternion.setFromUnitVectors(direction, desiredNormal)
    rollQuaternion.setFromAxisAngle(desiredNormal, roll)
    targetQuaternion.premultiply(rollQuaternion)
    // The pane leaves an upper-right face, which sits steeply in the
    // shell; it turns most of the way toward the camera as it travels out
    // so it reads as a pane, not an edge.
    group.quaternion.slerpQuaternions(restQuaternion, targetQuaternion, progress * 0.65)
    const portalFlight = smootherstep(Math.min(Math.max(
      (portal - profile.delay) / profile.span,
      0,
    ), 1))
    // The apparent depth comes from unequal enlargement plus a slight
    // outward drift. Avoid a literal Z push: the whole crystal is already
    // scaling toward the camera, and adding local Z at that scale would hit
    // the near plane and create the large rectangular/triangular glitches.
    group.position.addScaledVector(targetPosition.clone().normalize(), portalFlight * 7)
    const readingScale = 1 + (facetScale - 1) * progress
    group.scale.setScalar(readingScale * (1 + profile.scale * portalFlight))
    if (facetPaintRef.current) {
      // Each pane completes its own camera pass, then disappears behind the
      // rectangular aperture before the parent crystal starts moving. This
      // prevents the already-flown panes from inheriting the body's zoom.
      const paneExit = smootherstep(Math.min(Math.max(
        (portalFlight - 0.62) / 0.38,
        0,
      ), 1))
      facetPaintRef.current.uniforms.uOpacity.value = progress * (1 - paneExit)
    }
    if (openingRef.current) {
      const openingUniforms = openingRef.current.material.uniforms
      openingRef.current.visible = progress > 0.012
      openingUniforms.uOpacity.value = progress * (state === 1 ? 0.42 : 0.38)
      openingUniforms.uTime.value = clock.elapsedTime
      openingUniforms.uCyan.value.set(config.friendFlowColor1 ?? '#76dcf2')
      openingUniforms.uGreen.value.set(config.friendFlowColor2 ?? '#08df68')
      openingUniforms.uBlue.value.set(config.friendFlowColor3 ?? '#55a9eb')
    }
    if (beamRef.current) {
      const distance = group.position.distanceTo(basePosition)
      const beamUniforms = beamMaterials.uniforms
      // Light pours out of the gem into the leaving facet (the hero beam's
      // look): only while the pane is in flight, before the portal.
      // The light itself is drawn by FacetLightLayer (own canvas); this
      // in-canvas beam composited as white rectangles.
      beamRef.current.visible = false
      const facetScreen = beamTo.copy(group.position)
      if (group.parent) facetScreen.applyMatrix4(group.parent.matrixWorld)
      facetScreen.project(camera)
      facetBeamState.facets[state] = {
        x: (facetScreen.x * 0.5 + 0.5) * size.width,
        y: (-facetScreen.y * 0.5 + 0.5) * size.height,
        progress: distance > 0.04 && portalFlight < 0.72
          ? progress * (1 - smootherstep(Math.min(portalFlight / 0.72, 1)))
          : 0,
      }
      beamUniforms.uC0.value.set(config.friendFlowColor1 ?? '#76dcf2')
      beamUniforms.uC1.value.set(config.friendFlowColor2 ?? '#08df68')
      beamUniforms.uC2.value.set(config.friendFlowColor3 ?? '#55a9eb')
      beamUniforms.uC3.value.set(config.friendFlowColor4 ?? '#e5f2ad')
      // The facet mostly leaves along the parent's depth axis, so a beam
      // laid in the parent's XY plane was seen edge-on as a thin line.
      // Build it in world space instead: from the gem to the facet, its
      // flat side turned toward the camera.
      const beam = beamRef.current
      const parent = beam.parent
      if (parent) {
        parent.updateWorldMatrix(true, false)
        const from = beamFrom.copy(basePosition).applyMatrix4(parent.matrixWorld)
        const to = beamTo.copy(group.position).applyMatrix4(parent.matrixWorld)
        const along = beamAxisX.subVectors(to, from)
        const worldLength = along.length()
        if (worldLength > 1e-5) along.divideScalar(worldLength)
        const mid = beamMid.addVectors(from, to).multiplyScalar(0.5)
        const facing = beamAxisZ.subVectors(camera.position, mid)
        facing.addScaledVector(along, -facing.dot(along)).normalize()
        const side = beamAxisY.crossVectors(facing, along).normalize()
        beamBasis.makeBasis(along, side, facing)
        parent.getWorldQuaternion(beamParentQuaternion).invert()
        beam.quaternion.setFromRotationMatrix(beamBasis).premultiply(beamParentQuaternion)
        parent.getWorldScale(beamParentScale)
        const parentScale = Math.max(beamParentScale.x, 1e-5)
        beam.position.copy(parent.worldToLocal(mid))
        beam.scale.set(
          (worldLength / parentScale) * 1.08,
          1.75 + 0.4 * progress,
          1,
        )
      }
      beamUniforms.uOpacity.value = progress * (1 - smootherstep(Math.min(portalFlight / 0.72, 1))) * 0.88
      beamUniforms.uTime.value = clock.elapsedTime
    }
  })

  return (
    <>
      <mesh
        ref={cutoutRef}
        geometry={cutoutGeometry}
        position={shard.position}
        visible={false}
        renderOrder={-20 + state * 0.01}
        frustumCulled={false}
      >
        <meshBasicMaterial
          colorWrite={false}
          depthWrite
          depthTest
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh
        ref={openingRef}
        geometry={openingGeometry}
        position={shard.position}
        visible={false}
        renderOrder={5.1}
        frustumCulled={false}
      >
        <shaderMaterial
          transparent
          depthTest
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.NormalBlending}
          toneMapped={false}
          uniforms={{
            uOpacity: { value: 0 },
            uTime: { value: 0 },
            uFirstOpening: { value: state === 1 ? 1 : 0 },
            uCyan: { value: new THREE.Color(config.friendFlowColor1 ?? '#76dcf2') },
            uGreen: { value: new THREE.Color(config.friendFlowColor2 ?? '#08df68') },
            uBlue: { value: new THREE.Color(config.friendFlowColor3 ?? '#55a9eb') },
          }}
          vertexShader={`
            attribute vec3 aBarycentric;
            varying vec3 vBarycentric;
            varying vec3 vLocalPosition;
            void main() {
              vBarycentric = aBarycentric;
              vLocalPosition = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uOpacity;
            uniform float uTime;
            uniform float uFirstOpening;
            uniform vec3 uCyan;
            uniform vec3 uGreen;
            uniform vec3 uBlue;
            varying vec3 vBarycentric;
            varying vec3 vLocalPosition;
            void main() {
              float edgeDistance = min(vBarycentric.x, min(vBarycentric.y, vBarycentric.z));
              vec2 uv = vec2(vBarycentric.y, vBarycentric.z);
              float wave = sin(uv.x * 7.0 - uv.y * 4.5 + uTime * 0.7) * 0.5 + 0.5;
              float blueFlow = sin((uv.x + uv.y) * 8.0 - uTime * 0.45) * 0.5 + 0.5;
              vec3 colour = mix(uCyan, uGreen, wave * 0.7);
              colour = mix(colour, uBlue, blueFlow * 0.34);
              colour = mix(vec3(0.26, 0.77, 0.77), colour, 0.78);
              float cavity = smoothstep(0.03, 0.28, edgeDistance);
              vec3 firstDepth = mix(vec3(0.16, 0.72, 0.74), uGreen, wave * 0.38);
              colour = mix(colour, firstDepth, uFirstOpening * cavity * 0.42);
              // The physical bevel around the removed face supplies the
              // highlight. Keeping this inner plane free of another white
              // rim avoids the layered pane effect at every rotation.
              // Fade the projected colour before the physical bevel. The
              // animated field remains visible in the cavity, but its own
              // triangular perimeter can no longer read as a grey pane.
              float depthFade = smoothstep(0.08, 0.30, edgeDistance);
              float alpha = uOpacity * depthFade;
              gl_FragColor = vec4(colour, alpha);
            }
          `}
        />
      </mesh>
      <lineLoop
        ref={rimRef}
        geometry={rimGeometry}
        position={shard.position}
        visible={false}
        renderOrder={5.08}
        frustumCulled={false}
      >
        <lineBasicMaterial
          color="#effff6"
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </lineLoop>
      <group ref={beamRef} visible={false}>
        <mesh material={beamMaterials[0]} renderOrder={6.2} frustumCulled={false}>
          <planeGeometry args={[1, 1, 1, 1]} />
        </mesh>
        <mesh material={beamMaterials[1]} renderOrder={6.21} frustumCulled={false}>
          <planeGeometry args={[1, 1, 1, 1]} />
        </mesh>
      </group>
      <group
        ref={groupRef}
        position={shard.position}
        visible={false}
      >
        <mesh geometry={chipSurfaceGeometry} renderOrder={4.7} castShadow={false}>
          <shaderMaterial
            ref={facetPaintRef}
            uniforms={facetPaintUniforms}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
            vertexShader={`
              attribute vec3 aBarycentric;
              varying vec3 vBarycentric;
              void main() {
                vBarycentric = aBarycentric;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              uniform float uTime;
              uniform float uOpacity;
              uniform float uPhase;
              uniform vec3 uCyan;
              uniform vec3 uGreen;
              uniform vec3 uBlue;
              uniform vec3 uYellow;
              varying vec3 vBarycentric;

              void main() {
                vec2 uv = vec2(vBarycentric.y, vBarycentric.z);
                vec2 p = (uv - vec2(0.34, 0.31)) * 2.25;
                float t = uTime * 0.16 + uPhase;
                float warp = sin(p.y * 2.35 + t * 0.83) * 0.28
                           + sin((p.x - p.y) * 3.1 - t * 0.57) * 0.16;
                float current = sin(p.x * 2.0 + p.y * 1.15 + warp + t * 0.72);

                float cyanField = exp(-pow((p.y + warp * 0.36) * 1.22, 2.0));
                float blueField = exp(-pow((p.x - p.y * 0.42 + warp * 0.22) * 1.42, 2.0));
                vec2 greenPoint = p - vec2(-0.08 + sin(t * 0.31) * 0.13, -0.22);
                float greenField = exp(-dot(greenPoint * vec2(1.32, 1.58), greenPoint * vec2(1.32, 1.58)));
                greenField *= smoothstep(-0.62, 0.76, current);
                vec2 yellowPoint = p - vec2(0.28, 0.18);
                float yellowField = exp(-dot(yellowPoint * 1.85, yellowPoint * 1.85));

                vec3 milk = vec3(0.91, 0.985, 0.965);
                vec3 colour = mix(milk, uCyan, cyanField * 0.96);
                colour = mix(colour, uBlue, blueField * 0.88);
                colour = mix(colour, uGreen, greenField * 0.8);
                colour = mix(colour, uYellow, yellowField * 0.42);

                float whiteFacet = smoothstep(0.42, 0.86, vBarycentric.x)
                                 * smoothstep(0.08, 0.48, vBarycentric.z);
                colour = mix(colour, vec3(0.99, 1.0, 0.985), whiteFacet * 0.3);
                float innerLight = cyanField * 0.08
                                 + greenField * 0.07
                                 + yellowField * 0.12;
                colour += uCyan * cyanField * 0.1
                        + uBlue * blueField * 0.1
                        + uGreen * greenField * 0.12;
                colour = mix(colour * 1.14, vec3(1.0, 0.995, 0.96), innerLight * 0.35);
                float luminance = dot(colour, vec3(0.2126, 0.7152, 0.0722));
                colour = clamp(mix(vec3(luminance), colour, 1.48) * 1.12, 0.0, 1.25);
                float alpha = 0.86
                            + cyanField * 0.07
                            + blueField * 0.05
                            + greenField * 0.06;
                gl_FragColor = vec4(colour, min(alpha, 0.98) * uOpacity);
              }
            `}
          />
        </mesh>
      </group>
    </>
  )
}

const Glass = forwardRef(function Glass({
  config,
  siteMode,
  siteRotationPaused,
  rotationLocked = false,
  rotationLockRef,
  spinBlendRef,
}, forwardedRef) {
  const group = useRef()
  const closedShellRef = useRef(null)
  const singleOpenShellRef = useRef(null)
  const doubleOpenShellRef = useRef(null)
  const tripleOpenShellRef = useRef(null)
  const quadOpenShellRef = useRef(null)
  // Exposes the crystal's own group to whoever holds the forwarded ref
  // (CursorLight in App.jsx, to raycast against the actual geometry — see
  // the comment there) — group.current is the same live THREE.Object3D
  // for the component's whole lifetime, so this only needs to run once.
  useImperativeHandle(forwardedRef, () => group.current, [])
  const photoBackdropRef = useRef(null)
  const shards = useMemo(() => buildShards(1), [])
  const selectedShards = useMemo(() => {
    const used = new Set()
    return [1, 2, 3, 4].map(step => {
      // The gem's real pose once this step has turned (PageCrystal).
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(FACET_STEP_TILT_X[step - 1], -step * Math.PI / 2, -.04))
      let best = -Infinity
      let selected = 0
      shards.forEach((shard, index) => {
        if (used.has(index)) return
        const n = new THREE.Vector3(...shard.direction).applyQuaternion(q)
        // The pane flies out to the upper right, so its opening has to face
        // the upper right of the turned gem too (it used to pick a face
        // that ended low on the right, away from the pane).
        // Steps one, three and four take an upper-right face; step two, with
        // the gem tipped forward, takes one from its lower right.
        const up = step === 2 ? -.7 : .6
        const score = n.x * .55 + n.y * up + n.z * .55
        if (score > best) { best = score; selected = index }
      })
      used.add(selected)
      return shards[selected]
    })
  }, [shards])

  const bevel = config.bevel ?? 0
  // parseMediaList(...) always returns a fresh array — memoized here so
  // PhotoBackdrop's loader effect (keyed on this array, see
  // PhotoBackdrop.jsx) only re-runs when the underlying JSON string
  // actually changes, not on every unrelated re-render. Each item is
  // {url, kind} — kind decides image (THREE.Texture) vs video
  // (THREE.VideoTexture) loading inside PhotoBackdrop.
  const photoItems = useMemo(() => {
    if (config.photoMode === 'multiple') return parseMediaList(config.photoImages)
    const fallback = parseMediaList(config.photoImages)[0]
    const url = config.photoSingleImage || fallback?.url
    return url ? [{ url, kind: 'image' }] : []
  }, [config.photoMode, config.photoSingleImage, config.photoImages])

  const { solid, maxRadius } = useMemo(() => {
    const base = buildShellGeometry()

    // Ползунок 0..1 отображается на долю стяжки грани 0..0.4 — на полном
    // ползунке грани стягиваются меньше чем наполовину, чтобы не схлопнуться
    // в точку и остаться узнаваемой гранёной (а не полностью сферической)
    // формой. Сама фаска — общая для всех материалов правка геометрии, не
    // форма-специфичный шейдер, поэтому работает одинаково на любой вкладке.
    // fillet=0 (по умолчанию) — ровно один плоский срез, как раньше.
    // При fillet>0 суммарная доля среза заодно НЕМНОГО подрастает сверх
    // bevel*0.4 (а не только делится на более мелкие шаги той же общей
    // ширины) — иначе при типичном тонком bevel (по умолчанию 0.04) сама
    // фаска настолько узкая, что её сглаживание на несколько шагов не
    // читается на глаз вообще, независимо от числа сегментов: у настоящего
    // скругления (fillet) и так шире видимая «полка», чем у плоского среза
    // той же глубины, поэтому рост здесь физически оправдан, а не произволен.
    // Скругление формы заменяет фаску целиком: на почти сферическом теле
    // резать рёбра нечего, а проход фаски по подразбитой сетке стоил бы
    // дорого и ничего не дал.
    const roundness = config.roundness ?? 0
    if (roundness > 0.001) {
      const rounded = buildRoundedShell(Math.min(roundness, 1))
      return { solid: rounded, maxRadius: computeInsphereRadius(base) * SAFE_MARGIN }
    }

    const filletSegments = Math.round(config.filletSegments ?? 0)
    const baseFraction = bevel * 0.4
    const filletFraction = filletSegments > 0 ? Math.min(0.4, baseFraction + filletSegments * 0.05) : baseFraction
    const geo = applyFillet(base, filletFraction, filletSegments)
    // Стяжка грани к её ЖЕ центру не меняет расстояние ГРАНИ (плоскости)
    // до центра фигуры — сердцевины граней остаются на тех же плоскостях,
    // что и раньше, поэтому инсфера от фаски не зависит (справедливо и для
    // нескольких шагов подряд — каждый тоже стягивает грань к её же центру).
    return { solid: geo, maxRadius: computeInsphereRadius(base) * SAFE_MARGIN }
  }, [bevel, config.filletSegments, config.roundness])

  const exploded = config.explode > 0.001
  const singleOpenSolid = useMemo(
    () => buildShellWithOpenFaces(solid, [selectedShards[0].direction]),
    [shards, solid],
  )
  const doubleOpenSolid = useMemo(
    () => buildShellWithOpenFaces(solid, [selectedShards[0].direction, selectedShards[1].direction]),
    [shards, solid],
  )
  const tripleOpenSolid = useMemo(
    () => buildShellWithOpenFaces(solid, [
      selectedShards[0].direction,
      selectedShards[1].direction,
      // Third pane comes from the exposed left-side face, so its opening
      // reads beside the detached shard instead of underneath pane two.
      selectedShards[2].direction,
    ]),
    [shards, solid],
  )
  const quadOpenSolid = useMemo(
    () => buildShellWithOpenFaces(solid, [
      selectedShards[0].direction,
      selectedShards[1].direction,
      selectedShards[2].direction,
      selectedShards[3].direction,
    ]),
    [shards, solid],
  )
  useEffect(() => () => singleOpenSolid.dispose(), [singleOpenSolid])
  useEffect(() => () => doubleOpenSolid.dispose(), [doubleOpenSolid])
  useEffect(() => () => tripleOpenSolid.dispose(), [tripleOpenSolid])
  useEffect(() => () => quadOpenSolid.dispose(), [quadOpenSolid])

  useFrame((state, delta) => {
    photoBackdropRef.current?.update(Math.min(delta, 0.05))
    if (!group.current) return
    const t = state.clock.elapsedTime
    const fourthFrameLocked = Boolean(
      rotationLockRef?.current?.fourth?.reveal > 0.004,
    )
    const firstHoleOpen = Boolean(
      rotationLockRef?.current?.fourth?.stateOne > FACET_DETACH_START,
    )
    const secondHoleOpen = Boolean(
      rotationLockRef?.current?.fourth?.stateTwo > FACET_DETACH_START,
    )
    const thirdHoleOpen = Boolean(
      rotationLockRef?.current?.fourth?.stateThree > FACET_DETACH_START,
    )
    const fourthHoleOpen = Boolean(
      rotationLockRef?.current?.fourth?.stateFour > FACET_DETACH_START,
    )
    if (closedShellRef.current) closedShellRef.current.visible = !firstHoleOpen
    if (singleOpenShellRef.current) {
      singleOpenShellRef.current.visible = firstHoleOpen && !secondHoleOpen
    }
    if (doubleOpenShellRef.current) {
      doubleOpenShellRef.current.visible = secondHoleOpen && !thirdHoleOpen
    }
    if (tripleOpenShellRef.current) {
      tripleOpenShellRef.current.visible = thirdHoleOpen && !fourthHoleOpen
    }
    if (quadOpenShellRef.current) quadOpenShellRef.current.visible = fourthHoleOpen && (rotationLockRef?.current?.fourth?.portal ?? 0) < .12
    if (rotationLocked || fourthFrameLocked) {
      // Block four uses one deterministic, front-lit authored angle. Reset
      // the accumulated child rotation every frame so neither a previous
      // hero spin nor a late frame can expose a nearly black back facet.
      group.current.rotation.set(0, 0, 0)
      group.current.position.set(0, 0, 0)
    } else if (siteMode) {
      // Сам кристалл всегда крутится по двум осям сразу (не камера,
      // не OrbitControls — только сама геометрия), той же формулой и с
      // той же скоростью, что и в Редакторе (см. ветку else ниже) — в
      // «Сайте» нет панели с тумблером autoRotate, поэтому здесь свой
      // отдельный флаг, siteRotationPaused (кнопка «Stop rotation» в
      // App.jsx), а не config.autoRotate. Обычный drag через
      // OrbitControls (App.jsx) при этом никуда не делся — это отдельное,
      // независимое вращение КАМЕРЫ вокруг объекта, а не самого объекта,
      // они не конфликтуют между собой и продолжают работать даже пока
      // вращение самого кристалла на паузе.
      if (!siteRotationPaused) {
        group.current.rotation.y += delta * config.rotateSpeed
        group.current.rotation.x += delta * config.rotateSpeed * 0.35
      }
      group.current.position.set(0, 0.15 + Math.sin(t * 0.6) * 0.08, 0)
    } else {
      if (config.autoRotate) {
        const heroSpin = spinBlendRef?.current?.value ?? 1
        group.current.rotation.y += delta * config.rotateSpeed * heroSpin
        group.current.rotation.x += delta * config.rotateSpeed * 0.35 * heroSpin
      }
      // Едва заметное дыхание — объект не выглядит замороженным
      group.current.position.y = Math.sin(t * 0.5) * 0.04
    }
  })

  return (
    <group ref={group} scale={siteMode ? SITE_MODE_SCALE : 1}>
      {config.материал === 'photo' && photoItems.length > 0 && (
        // Same rotating group as the shell mesh below — see PhotoBackdrop.jsx
        // for why it has to rotate rigidly together with the crystal.
        <PhotoBackdrop
          ref={photoBackdropRef}
          items={photoItems}
          motion={config.photoMotion}
          cycleTime={config.photoCycleTime}
        />
      )}

      {config.материал === 'фигура' && (
        <ColorCore
          shape={config.figureShape}
          scale={config.figureCoreScale}
          speed={config.figureCoreSpeed}
          segments={config.figureSegments}
          colorA={config.figureColorA}
          colorB={config.figureColorB}
          colorC={config.figureColorC}
          colorD={config.figureColorD}
          weightA={config.figureColorAWeight}
          weightB={config.figureColorBWeight}
          weightC={config.figureColorCWeight}
          weightD={config.figureColorDWeight}
          maxRadius={maxRadius}
        />
      )}

      <BeamPullGroup>
      {config.материал === 'friend'
        && (FRIEND_VARIANTS[config.friendVersion]?.organic
          || FRIEND_VARIANTS[config.friendVersion]?.continuousColor)
        && <FriendOrganicVolume
          config={config}
          maxRadius={maxRadius}
          continuousColor={FRIEND_VARIANTS[config.friendVersion]?.continuousColor ?? 0}
          legacyPainted={FRIEND_VARIANTS[config.friendVersion]?.legacyPainted ?? 0}
          frozenGen2={FRIEND_VARIANTS[config.friendVersion]?.frozenGen2 ?? 0}
          livingVolume={FRIEND_VARIANTS[config.friendVersion]?.livingVolume ?? 0}
        />}

      {/* Отдельное светящееся тело внутри кристалла. В версии с unify его
          нет: там вся масса света рисуется одним слоем проекции, а этот
          объём читался бы ещё одной, четвёртой сущностью поверх неё —
          при unify=1 она рисуется всегда сверху (depthTest выключен у
          isLight) и с текущими коэффициентами почти полностью забивала
          проекцию под собой. Свечение для continuousColor добавлено
          самим слоем проекции ниже (hotTarget), без лишней сущности. */}
      {config.материал === 'friend'
        && !(FRIEND_VARIANTS[config.friendVersion]?.unify)
        && <FriendLightCore config={config} />}
      </BeamPullGroup>

      {!exploded && (
        <>
          <group ref={closedShellRef}>
            <mesh geometry={solid} castShadow={config.материал !== 'friend'}>
              <Material config={config} shared={false} />
            </mesh>
            {config.материал === 'friend' && (
              <FriendProjection geometry={solid} config={config} />
            )}
          </group>
          <group ref={singleOpenShellRef} visible={false}>
            <mesh geometry={singleOpenSolid} castShadow={config.материал !== 'friend'}>
              <Material config={config} shared={false} />
            </mesh>
            {config.материал === 'friend' && (
              <FriendProjection geometry={singleOpenSolid} config={config} />
            )}
          </group>
          <group ref={doubleOpenShellRef} visible={false}>
            <mesh geometry={doubleOpenSolid} castShadow={config.материал !== 'friend'}>
              <Material config={config} shared={false} />
            </mesh>
            {config.материал === 'friend' && (
              <FriendProjection geometry={doubleOpenSolid} config={config} />
            )}
          </group>
          <group ref={tripleOpenShellRef} visible={false}>
            <mesh geometry={tripleOpenSolid} castShadow={config.материал !== 'friend'}>
              <Material config={config} shared={false} />
            </mesh>
            {config.материал === 'friend' && (
              <FriendProjection geometry={tripleOpenSolid} config={config} />
            )}
          </group>
          <group ref={quadOpenShellRef} visible={false}>
            <mesh geometry={quadOpenSolid} castShadow={config.материал !== 'friend'}>
              <Material config={config} shared={false} />
            </mesh>
            {config.материал === 'friend' && (
              <FriendProjection geometry={quadOpenSolid} config={config} />
            )}
          </group>
        </>
      )}

      {!exploded && rotationLockRef && (
        <>
          <RemainingFragments shards={shards} selected={selectedShards} motionRef={rotationLockRef} />
          <FeaturedFacet
            shard={selectedShards[0]}
            state={1}
            config={config}
            motionRef={rotationLockRef}
          />
          <FeaturedFacet
            shard={selectedShards[1]}
            state={2}
            config={config}
            motionRef={rotationLockRef}
          />
          <FeaturedFacet
            shard={selectedShards[2]}
            state={3}
            config={config}
            motionRef={rotationLockRef}
          />
          <FeaturedFacet
            shard={selectedShards[3]}
            state={4}
            config={config}
            motionRef={rotationLockRef}
          />
        </>
      )}

      {exploded &&
        shards.map((shard, i) => {
          const offset = config.explode * config.explodeDistance
          const position = [
            shard.position[0] + shard.direction[0] * offset,
            shard.position[1] + shard.direction[1] * offset,
            shard.position[2] + shard.direction[2] * offset,
          ]
          const quaternion = new THREE.Quaternion().setFromAxisAngle(
            shard.rotationAxis,
            config.explode * config.explodeTwist * (i % 2 === 0 ? 1 : -1)
          )
          return (
            <mesh
              key={i}
              geometry={shard.geometry}
              position={position}
              quaternion={quaternion}
            >
              {/* В режиме осколков материалы делят один буфер: 20 отдельных
                  проходов рендера положили бы кадровую частоту. */}
              <Material config={config} shared />
            </mesh>
          )
        })}
    </group>
  )
})

export default Glass
