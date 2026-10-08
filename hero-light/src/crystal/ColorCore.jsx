import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Маленькая цветная «фигура» внутри кристалла. Референс — фото сквозь
 * грани икосаэдра под удачным углом на вершину: несколько граней
 * сходятся в одной точке, и каждая по-своему гнёт и красит то, что
 * за ней. Здесь то же самое, но НАДЁЖНО: вместо случайной фотографии
 * под случайным углом — маленькое цветное тело, которое всегда сидит
 * в центре и всегда попадает в преломление, под каким углом ни повернись.
 *
 * Раскраска — не текстура, а угол вокруг вертикальной оси: секторный
 * «цветовой volчок», сшитый по кругу через три цвета. Спокойно
 * вращается сам по себе (отдельно от вращения всего кристалла), поэтому
 * секторы медленно проезжают под каждой гранью — «играет со светом»,
 * а не стоит неподвижной картинкой.
 */

const vertexShader = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vPos = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Четвёртый цвет — необязательный: у «Сплава» его нет и не будет (там
// вызов ColorCore не передаёт colorD вообще), поэтому шейдер собирается
// под конкретный набор цветов ОДИН РАЗ при монтировании (см. hasFourthColor
// в компоненте), а не проверяет это на каждый пиксель. Не-4-цветная ветка
// побайтово совпадает с прежним шейдером — поведение «Сплава» не меняется.
function buildFragmentShader(useFourthColor) {
  return /* glsl */ `
  precision highp float;
  varying vec3 vPos;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  uniform float uSegments;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform vec3  uColorC;
  ${useFourthColor ? 'uniform vec3 uColorD;' : ''}
  // Три добавки для «Сплава» — там фигуре нужны отражение, матовость и
  // зернистость, как у стеклянной оболочки в «Фигуре»; по умолчанию (0)
  // они ничего не меняют, так что сама «Фигура» выглядит как раньше.
  uniform float uReflect;
  uniform float uRoughness;
  uniform float uGrain;
  uniform float uTime;
  // Доля колеса, которую занимает КАЖДЫЙ цвет своей собственной, хорошо
  // читаемой зоной (не просто узкая грань перехода между соседями, как
  // было раньше) — посчитано на JS-стороне из ползунков «доля цвета N»
  // (см. computeWheelWeights3/4), в сумме всегда даёт 1.
  uniform float uZoneA;
  uniform float uZoneB;
  uniform float uZoneC;
  ${useFourthColor ? 'uniform float uZoneD;' : ''}

  // Внутри своей зоны цвет входит через смешивание из зоны ПРЕДЫДУЩЕГО
  // цвета (первые ZONE_BLEND её ширины), а дальше держится чистым до
  // самого конца зоны — вместо прежней схемы, где чистый цвет был лишь
  // мгновением на стыке двух дуг, а «доля» реально влияла только на то,
  // как быстро гаснет соседний цвет. Так «доля цвета N» = какую часть
  // поверхности видно ИМЕННО этим цветом, впрямую и предсказуемо.
  const float ZONE_BLEND = 0.45;

  vec3 wheel(float t) {
    float x = fract(t);
    float bA = uZoneA;
    float bB = bA + uZoneB;
    ${
      useFourthColor
        ? `float bC = bB + uZoneC;
    if (x < bA) return mix(uColorD, uColorA, smoothstep(0.0, ZONE_BLEND, x / uZoneA));
    if (x < bB) return mix(uColorA, uColorB, smoothstep(0.0, ZONE_BLEND, (x - bA) / uZoneB));
    if (x < bC) return mix(uColorB, uColorC, smoothstep(0.0, ZONE_BLEND, (x - bB) / uZoneC));
    return mix(uColorC, uColorD, smoothstep(0.0, ZONE_BLEND, (x - bC) / uZoneD));`
        : `if (x < bA) return mix(uColorC, uColorA, smoothstep(0.0, ZONE_BLEND, x / uZoneA));
    if (x < bB) return mix(uColorA, uColorB, smoothstep(0.0, ZONE_BLEND, (x - bA) / uZoneB));
    return mix(uColorB, uColorC, smoothstep(0.0, ZONE_BLEND, (x - bB) / uZoneC));`
    }
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec3 n = normalize(vPos);
    // Раньше секторы шли только по долготе (вокруг одной оси) — целая
    // полоса от полюса до полюса красилась ОДНИМ цветом. С любого «бока»
    // фигуры был виден один-два таких клина целиком, и при вращении
    // общий цвет кристалла резко скакал от «в основном оранжевый» к «в
    // основном синий». Добавляем вторую координату — широту — и сдвигаем
    // фазу цвета через ряд, как в кирпичной кладке: с любой стороны
    // видно сразу несколько цветов вперемешку, общий баланс не скачет,
    // а «игра» узора при вращении никуда не делась.
    float lon = atan(n.y, n.x) / (2.0 * 3.14159265) + 0.5;
    float lat = acos(clamp(n.z, -1.0, 1.0)) / 3.14159265;
    float rows = max(2.0, floor(uSegments * 0.5));
    float rowIndex = floor(lat * rows);
    float rowOffset = mod(rowIndex, 2.0) * (0.5 / uSegments);
    float phase = fract(lon + rowOffset + rowIndex * 0.31);

    // Матовость: 0 — чёткие грани цветового волчка (как сейчас в
    // «Фигуре»), 1 — секторы размываются в непрерывный градиент.
    vec3 colSharp = wheel(floor(phase * uSegments) / uSegments);
    vec3 colSmooth = wheel(phase);
    vec3 col = mix(colSharp, colSmooth, uRoughness);

    // Мягкая светотень по высоте — полюса чуть темнее экватора,
    // чтобы фигура читалась объёмной, а не плоским диском.
    col *= 0.62 + 0.38 * (1.0 - abs(n.z));

    // Отражение: фейковый Френель-блик по краю силуэта — своей среды
    // у фигуры нет, поэтому вместо реального envMap имитируем блик белым.
    // Степень 1.4 вместо 2.0 — блик шире, читается не только на самом
    // краю силуэта, а множитель 1.0 вместо 0.8 — иначе на шумной,
    // радужной поверхности «Сплава» блик почти терялся на глаз.
    float fresnel = pow(1.0 - max(dot(normalize(vNormalW), normalize(vViewDir)), 0.0), 1.4);
    col = mix(col, vec3(1.0), fresnel * uReflect);

    // Зернистость: лёгкий мерцающий шум поверх цвета.
    float grain = (hash(gl_FragCoord.xy + uTime * 60.0) - 0.5) * uGrain;
    col += grain;

    gl_FragColor = vec4(col, 1.0);
  }
  `
}

// Геометрии строятся через конструкторы three, а не JSX-теги: тор и узел
// нуждаются в разных аргументах, проще выбрать одним switch, чем городить
// пять условных JSX-веток.
const GEOMETRY_BUILDERS = {
  icosahedron: () => new THREE.IcosahedronGeometry(1, 3),
  sphere: () => new THREE.SphereGeometry(1, 32, 32),
  octahedron: () => new THREE.OctahedronGeometry(1, 2),
  tetrahedron: () => new THREE.TetrahedronGeometry(1, 3),
  dodecahedron: () => new THREE.DodecahedronGeometry(1, 1),
  torus: () => new THREE.TorusGeometry(0.7, 0.32, 24, 48),
  knot: () => new THREE.TorusKnotGeometry(0.55, 0.2, 128, 16),
}

export const CORE_SHAPES = Object.keys(GEOMETRY_BUILDERS)

// Инсфера икосаэдра-оболочки (радиус описанной сферы 1) — около 0.795:
// это расстояние от центра до САМОЙ БЛИЖНЕЙ точки стекла (середины
// грани), а не до вершины. Фигура вращается независимо от оболочки, так
// что рано или поздно любая её точка окажется под серединой какой-то
// грани — значит, весь силуэт фигуры должен помещаться внутри именно
// этого, самого тесного радиуса, а не описанной сферы, иначе она
// периодически «вылезает» сквозь стекло. Дефолт — на случай если
// оболочка не передала свою настоящую инсферу (см. maxRadius).
const DEFAULT_SAFE_RADIUS = 0.72

// Зона цвета на колесе — доля его собственного веса от суммы весов всех
// цветов, напрямую (не произведение с соседями, как было раньше, где
// «доля» на самом деле управляла только резкостью соседних переходов, а
// не тем, сколько поверхности видно этим цветом). Минимум 0.02 на каждый
// вес не даёт делению уйти в 0/0, если пользователь поставит долю на 0 —
// цвет тогда сжимается почти до точки, но не ломает шейдер.
function computeWheelWeights3(weightA, weightB, weightC) {
  const a = Math.max(0.02, weightA)
  const b = Math.max(0.02, weightB)
  const c = Math.max(0.02, weightC)
  const total = a + b + c
  return { zoneA: a / total, zoneB: b / total, zoneC: c / total }
}

// То же самое для четырёх цветов.
function computeWheelWeights4(weightA, weightB, weightC, weightD) {
  const a = Math.max(0.02, weightA)
  const b = Math.max(0.02, weightB)
  const c = Math.max(0.02, weightC)
  const d = Math.max(0.02, weightD)
  const total = a + b + c + d
  return { zoneA: a / total, zoneB: b / total, zoneC: c / total, zoneD: d / total }
}

export default function ColorCore({
  shape = 'icosahedron',
  scale = 0.45,
  speed = 1,
  segments = 6,
  colorA = '#ff5040',
  colorB = '#3fa0ff',
  colorC = '#ffd23f',
  // Четвёртый цвет необязателен — «Сплав» его вообще не передаёт и
  // остаётся на прежнем 3-цветном колесе. Наличие именно этого пропса (а
  // не отдельного флага) решает, какой вариант шейдера собрать один раз
  // при монтировании — см. hasFourthColor ниже.
  colorD,
  reflect = 0,
  roughness = 0,
  grain = 0,
  // Доля каждого цвета на колесе (см. computeWheelWeights3/4) — по
  // умолчанию все цвета равны, что даёт РОВНО прежнее поведение (равные
  // трети / равные четверти).
  weightA = 1,
  weightB = 1,
  weightC = 1,
  weightD = 1,
  // Безопасный радиус конкретной оболочки, в которой сидит эта фигура —
  // у разных форм кристалла (икосаэдр/октаэдр/куб/…) инсфера совсем
  // разная, поэтому оболочка сама её считает и передаёт сюда.
  maxRadius = DEFAULT_SAFE_RADIUS,
}) {
  const hasFourthColor = colorD !== undefined
  const ref = useRef()
  const fragmentShader = useMemo(() => buildFragmentShader(hasFourthColor), [hasFourthColor])

  const uniforms = useMemo(() => {
    const base = {
      uSegments: { value: segments },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uColorC: { value: new THREE.Color(colorC) },
      uReflect: { value: reflect },
      uRoughness: { value: roughness },
      uGrain: { value: grain },
      uTime: { value: 0 },
    }
    if (hasFourthColor) {
      const { zoneA, zoneB, zoneC, zoneD } = computeWheelWeights4(weightA, weightB, weightC, weightD)
      base.uColorD = { value: new THREE.Color(colorD) }
      base.uZoneA = { value: zoneA }
      base.uZoneB = { value: zoneB }
      base.uZoneC = { value: zoneC }
      base.uZoneD = { value: zoneD }
    } else {
      const { zoneA, zoneB, zoneC } = computeWheelWeights3(weightA, weightB, weightC)
      base.uZoneA = { value: zoneA }
      base.uZoneB = { value: zoneB }
      base.uZoneC = { value: zoneC }
    }
    return base
  }, [])

  // Тор и узел торов «шире» на единицу масштаба, чем икосаэдр или сфера —
  // без учёта этого одно и то же значение scale держит одни фигуры
  // глубоко внутри, а другие уже наполовину снаружи. computeBoundingSphere
  // даёт настоящий радиус КОНКРЕТНОЙ геометрии, а не предположение.
  const { geometry, boundingRadius } = useMemo(() => {
    const build = GEOMETRY_BUILDERS[shape] ?? GEOMETRY_BUILDERS.icosahedron
    const geo = build()
    geo.computeBoundingSphere()
    return { geometry: geo, boundingRadius: geo.boundingSphere.radius }
  }, [shape])

  const safeScale = Math.min(scale, maxRadius / boundingRadius)

  useFrame((state, delta) => {
    uniforms.uSegments.value = segments
    uniforms.uColorA.value.set(colorA)
    uniforms.uColorB.value.set(colorB)
    uniforms.uColorC.value.set(colorC)
    uniforms.uReflect.value = reflect
    uniforms.uRoughness.value = roughness
    uniforms.uGrain.value = grain
    if (hasFourthColor) {
      uniforms.uColorD.value.set(colorD)
      const { zoneA, zoneB, zoneC, zoneD } = computeWheelWeights4(weightA, weightB, weightC, weightD)
      uniforms.uZoneA.value = zoneA
      uniforms.uZoneB.value = zoneB
      uniforms.uZoneC.value = zoneC
      uniforms.uZoneD.value = zoneD
    } else {
      const { zoneA, zoneB, zoneC } = computeWheelWeights3(weightA, weightB, weightC)
      uniforms.uZoneA.value = zoneA
      uniforms.uZoneB.value = zoneB
      uniforms.uZoneC.value = zoneC
    }
    uniforms.uTime.value = state.clock.elapsedTime
    if (ref.current) {
      ref.current.rotation.y += delta * 0.2 * speed
      ref.current.rotation.x += delta * 0.09 * speed
    }
  })

  return (
    <mesh ref={ref} scale={safeScale} geometry={geometry}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        toneMapped={false}
      />
    </mesh>
  )
}
