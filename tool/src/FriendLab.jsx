import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useControls, Leva } from 'leva'
import * as THREE from 'three'
import Glass, { FRIEND_VARIANTS } from './Glass.jsx'
import Studio from './Studio.jsx'
import ControlPanel, { FIELD_GROUPS, buildLevaSchema } from './Panel.jsx'

const FRIEND_VERSIONS = [
  { id: 'milky-projection', label: '01' },
  { id: 'blob-light-projection', label: '02' },
  { id: 'organic-metaball', label: '03' },
  { id: 'painted-continuous', label: '04' },
]

/**
 * Стартовые значения, отличающиеся от общих дефолтов, — по версиям.
 *
 * Схема leva одна на все три, поэтому «своё значение по умолчанию» для
 * конкретной версии живёт здесь. Версия, активная при загрузке (01),
 * берёт значения прямо из схемы, остальным они подменяются при первом
 * переключении.
 *
 * Стартовое значение любого параметра для конкретной версии задаётся
 * здесь одной строкой; всё, что не перечислено, берётся из общей схемы.
 */
// Версия 02 (organic-metaball) — это ДУБЛЬ версии 01: обе стартуют с
// одних и тех же значений, чтобы дальше дорабатывалась только 01, а 02
// оставалась её зафиксированной копией.
const MILKY_PROJECTION_DEFAULTS = {
  envIntensity: 0,
  friendTransparency: 1,
  friendMatte: 0.2,
  friendFrost: 0.07,
  friendGlassBlur: 0.17,
  friendSpecular: 1.18,
  friendInnerShade: 0.74,
  friendShadeColor: '#a1e9fc',
  friendEdgeClarity: 0.9,
  friendLightDiffusion: 0.2,
  rotateSpeed: 0.5,
  // Ползунки «light size» и «light spread» у 01 скрыты (см. VISIBLE-фильтр
  // ниже) и закреплены на минимуме схемы — покрытие тела градиентом теперь
  // держит фиксированная ширина пятна в Glass.jsx (spotRadiusContinuous),
  // а не эти два поля.
  friendCoreSize: 0.15,
  // Подобрано вручную в панели поверх версии со «страховочным» набором
  // ниже; safety-clamp у dist в Glass.jsx (continuousColor) продолжает
  // защищать от провала пятна в невидимое, поэтому wind/paint можно было
  // без риска увести дальше исходных «безопасных» значений.
  friendCoreStretch: 1.8,
  friendCenterPower: 1.69,
  friendCenterSize: 0.26,
  friendPulse: 0.095,
  friendLightMotion: 0.13,
  friendFlow: 1.5,
  friendPaintFlow: 2.2,
  friendFlowDrift: 0.3,
  friendLightSpread: 0.15,
  friendWindSpeed: 1.56,
  friendWindAmount: 2.5,
  friendCenterColor: '#fff4e8',
  friendColorCount: 4,
  friendColorSplit: 0,
  friendColorMotion: 1,
  friendColorBoost: 1,
  friendFlowColor1: '#756cff',
  friendFlowColor2: '#29ae57',
  friendFlowColor3: '#1d81ed',
  friendFlowColor4: '#f0ff1f',
  friendVolumeScale: 2.18,
  friendBackgroundMode: 'solid',
  friendBackgroundColor1: '#ffffff',
  friendBackgroundColor2: '#eef4ff',
  friendBackgroundUseThird: false,
  friendBackgroundColor3: '#fff1e8',
  friendBackgroundAngle: 135,
  friendBackgroundCenterX: 0.5,
  friendBackgroundCenterY: 0.5,
  friendBackgroundPosition: 0.5,
  friendBackgroundSoftness: 0.42,
  // Turned off outright: the mipmapBlur bloom kept spreading into a thick
  // halo around the whole silhouette rather than just glowing at the hot
  // core/source once the surface itself got brighter/more saturated.
  bloom: 0,
  bloomThreshold: 0.94,
}

// '02' (blob-light-projection): frozen snapshot of '01' taken 2026-09-22,
// right after the blob-light colour model and the saturation/bloom pass —
// literal, not {...MILKY_PROJECTION_DEFAULTS}, for the same reason as the
// other frozen snapshots below: any later default tweaked on live '01'
// must not silently leak in here.
const BLOB_LIGHT_PROJECTION_DEFAULTS = {
  envIntensity: 0,
  friendTransparency: 1,
  friendMatte: 0.57,
  friendFrost: 0.07,
  friendGlassBlur: 0.17,
  friendSpecular: 1.18,
  friendInnerShade: 0.74,
  friendShadeColor: '#a1e9fc',
  friendEdgeClarity: 0.9,
  friendLightDiffusion: 0,
  friendCoreSize: 0.15,
  friendCoreStretch: 1.8,
  friendCenterPower: 1.69,
  friendCenterSize: 0.26,
  friendPulse: 0.095,
  friendLightMotion: 0.13,
  friendFlow: 1.5,
  friendPaintFlow: 2.2,
  friendFlowDrift: 0.3,
  friendLightSpread: 0.15,
  friendWindSpeed: 1.56,
  friendWindAmount: 2.5,
  friendCenterColor: '#fff4e8',
  friendColorCount: 4,
  friendColorSplit: 0,
  friendColorMotion: 1,
  friendColorBoost: 1,
  friendFlowColor1: '#756cff',
  friendFlowColor2: '#29ae57',
  friendFlowColor3: '#1d81ed',
  friendFlowColor4: '#f0ff1f',
  friendVolumeScale: 2.18,
  friendBackgroundMode: 'solid',
  friendBackgroundColor1: '#ffffff',
  friendBackgroundColor2: '#eef4ff',
  friendBackgroundUseThird: false,
  friendBackgroundColor3: '#fff1e8',
  friendBackgroundAngle: 135,
  friendBackgroundCenterX: 0.5,
  friendBackgroundCenterY: 0.5,
  friendBackgroundPosition: 0.5,
  friendBackgroundSoftness: 0.42,
  bloom: 0,
  bloomThreshold: 0.94,
}

// Замороженный снимок 01 РОВНО в том виде, в каком её продублировали в 02:
// литерал, а не {...MILKY_PROJECTION_DEFAULTS} — иначе каждая следующая
// правка дефолтов 01 (например, усиление движения ниже) молча утекала бы
// и во «зафиксированный» дубль.
const ORGANIC_METABALL_DEFAULTS = {
  friendTransparency: 0.42,
  friendMatte: 0.7,
  friendFrost: 0,
  friendGlassBlur: 0.43,
  friendSpecular: 0.4,
  friendInnerShade: 0.16,
  friendShadeColor: '#a1e9fc',
  friendEdgeClarity: 0.65,
  friendLightDiffusion: 0.57,
  friendCoreSize: 0.32,
  friendCoreStretch: 1.38,
  friendCenterPower: 3,
  friendCenterSize: 1.14,
  friendPulse: 0.255,
  friendLightMotion: 0,
  friendFlow: 1.5,
  friendPaintFlow: 2.08,
  friendFlowDrift: 0.44,
  friendLightSpread: 1,
  friendWindSpeed: 1.94,
  friendWindAmount: 0.79,
  friendCenterColor: '#f7ca4e',
  friendColorCount: 3,
  friendColorSplit: 0,
  friendColorMotion: 0.5,
  friendColorBoost: 1,
  friendFlowColor1: '#ff4a2d',
  friendFlowColor2: '#ff9d12',
  friendFlowColor3: '#756cff',
}

// Frozen snapshot of tab 01 immediately before the next separation of the
// clear shell from the soft inner projection. This is intentionally a full
// literal: later work on 01 must not leak into the requested tab 03 archive.
const PAINTED_CONTINUOUS_DEFAULTS = {
  friendTransparency: 0.43,
  friendMatte: 0.22,
  friendFrost: 0.09,
  friendGlassBlur: 0.43,
  friendSpecular: 0.8,
  friendInnerShade: 0.62,
  friendShadeColor: '#a1e9fc',
  friendEdgeClarity: 0.65,
  friendLightDiffusion: 0.57,
  friendCoreSize: 0.15,
  friendVolumeScale: 1.65,
  friendCoreStretch: 0.67,
  friendCenterPower: 0.6,
  friendCenterSize: 0.2,
  friendPulse: 0.45,
  friendLightMotion: 0.06,
  friendFlow: 1.22,
  friendPaintFlow: 0.19,
  friendFlowDrift: 0.2,
  friendLightSpread: 0.15,
  friendWindSpeed: 0.53,
  friendWindAmount: 1.35,
  friendCenterColor: '#fff4e8',
  friendColorCount: 4,
  friendColorSplit: 0,
  friendColorMotion: 1,
  friendColorBoost: 1,
  friendFlowColor1: '#29ae57',
  friendFlowColor2: '#e69119',
  friendFlowColor3: '#1d81ed',
  friendFlowColor4: '#756cff',
  friendBackgroundMode: 'solid',
  friendBackgroundColor1: '#ffffff',
  friendBackgroundColor2: '#eef4ff',
  friendBackgroundUseThird: false,
  friendBackgroundColor3: '#fff1e8',
  friendBackgroundAngle: 135,
  friendBackgroundCenterX: 0.5,
  friendBackgroundCenterY: 0.5,
  friendBackgroundPosition: 0.5,
  friendBackgroundSoftness: 0.42,
  bloom: 0.28,
  bloomThreshold: 0.82,
}

const VERSION_DEFAULTS = {
  'milky-projection': MILKY_PROJECTION_DEFAULTS,
  'blob-light-projection': BLOB_LIGHT_PROJECTION_DEFAULTS,
  'organic-metaball': ORGANIC_METABALL_DEFAULTS,
  'painted-continuous': PAINTED_CONTINUOUS_DEFAULTS,
}

/** Группы, которые вообще показываются для материала friend. */
const FRIEND_GROUPS = FIELD_GROUPS.filter((g) => {
  if (!g.tab) return true
  return Array.isArray(g.tab) ? g.tab.includes('friend') : g.tab === 'friend'
})

/**
 * Выбор версии переехал из раздела «main» наверх, на место вкладок
 * материала, поэтому из самих полей его надо убрать — иначе он был бы в
 * панели дважды.
 */
const PANEL_GROUPS = FRIEND_GROUPS
  .map((g) => ({ ...g, fields: g.fields.filter((f) => f.key !== 'friendVersion') }))
  .filter((g) => g.fields.length > 0)

/**
 * У 01 «light size», «light spread» и «color split» больше нечего крутить:
 * значения закреплены на минимуме схемы, а покрытие/переход цвета держат
 * фиксированные величины в самом шейдере (см. continuousColor в
 * Glass.jsx). «light pulse» и «light motion» технически ещё что-то
 * двигают (дыхание пятна/ядра, дрейф светового сгустка), но на текущих
 * зафиксированных значениях (0.095 и 0.13) эффект на глаз не читается —
 * визуальную работу уже делают soft flow/paint flow/wind. Сами ключи из
 * PER_VERSION_KEYS/снапшотов НЕ убираем — только прячем их строки в
 * панели, иначе переключение вкладок перестало бы сохранять и
 * восстанавливать значения 02, где все пять полей живые.
 */
const HIDDEN_ON_MILKY_PROJECTION = new Set([
  'friendCoreSize',
  'friendLightSpread',
  'friendColorSplit',
  'friendPulse',
  'friendLightMotion',
])

function panelGroupsFor(version) {
  if (version === 'organic-metaball') {
    return PANEL_GROUPS
      .filter((g) => g.name !== 'Background')
      .map((g) => ({
        ...g,
        fields: g.fields.filter((f) => f.key !== 'friendVolumeScale'),
      }))
  }
  return PANEL_GROUPS
    .map((g) => ({
      ...g,
      fields: g.fields
        .filter((f) => !HIDDEN_ON_MILKY_PROJECTION.has(f.key) && f.key !== 'friendColorCount')
        .map((f) => f.reorder === 'friendFlow'
          ? { ...f, reorder: 'friendFlowDrag', visible: undefined }
          : f),
    }))
    .filter((g) => g.fields.length > 0)
}

/**
 * Все ключи, которые настраиваются ОТДЕЛЬНО для каждой версии — то есть
 * всё, что вообще показывает панель Friend, кроме самого выбора версии.
 */
const PER_VERSION_KEYS = PANEL_GROUPS.flatMap((g) => g.fields.map((f) => f.key))

/** Значения по умолчанию — из той же схемы, что и стор leva. */
const DEFAULTS = (() => {
  const schema = buildLevaSchema(FIELD_GROUPS)
  const out = {}
  for (const key of PER_VERSION_KEYS) out[key] = schema[key]?.value
  return out
})()

function pick(source, keys) {
  const out = {}
  for (const key of keys) out[key] = source[key]
  return out
}

/**
 * Эти ключи пересоздают дорогой GPU-ресурс, а не просто обновляют uniform:
 * samples/resolution — буфер MeshTransmissionMaterial, bevel/filletSegments/
 * roundness — геометрию кристалла (bevelGeometry). При обычном перетаскивании
 * слайдера leva шлёт значение на каждый пиксель движения мыши, и каждое из
 * них пересоздаёт буфер/геометрию заново — это и читалось как случайное
 * мигание чёрным (тот же класс проблемы, что раньше был у AdaptiveDpr, см.
 * комментарий у <Canvas> ниже). Держим эти пять значений отдельно и
 * прокидываем в сцену только через дебаунс, не на каждое промежуточное.
 */
const EXPENSIVE_KEYS = ['samples', 'resolution', 'bevel', 'filletSegments', 'roundness']

/**
 * Мягкое притемнение за кристаллом.
 *
 * Диффузор (непрозрачная молочная колба) сам по себе на белом фоне не
 * читается: белое тело на белом остаётся белым. На всех трёх референсах
 * объект снят в полутьме — именно поэтому свет там выглядит светом, а не
 * просто светлым пятном. Это плоскость ЗА объектом, а не фон страницы:
 * по краям кадра она уходит в белый, и страница остаётся белой.
 */
function SoftBackdrop() {
  return (
    <mesh position={[0, 0, -2.6]} renderOrder={-10}>
      <planeGeometry args={[14, 14]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
        uniforms={{ uTint: { value: new THREE.Color('#d9d5cd') } }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uTint;
          varying vec2 vUv;
          void main() {
            float r = length(vUv - 0.5) * 2.0;
            // Пятно шире самого кристалла и гаснет задолго до края кадра.
            float fade = 1.0 - smoothstep(0.08, 0.62, r);
            gl_FragColor = vec4(uTint, fade * 0.9);
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  )
}

/**
 * User-configurable scene background for tab 01. A CanvasTexture is used as
 * scene.background rather than a CSS background, so the transmission pass
 * sees and refracts the same solid/gradient that the user sees. Tab 02 is
 * explicitly restored to its original white background.
 */
function SceneBackground({ enabled, config }) {
  const { scene } = useThree()

  useEffect(() => {
    if (!enabled) {
      scene.background = new THREE.Color('#ffffff')
      return undefined
    }

    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    const mode = config.friendBackgroundMode ?? 'solid'
    const color1 = config.friendBackgroundColor1 ?? '#ffffff'
    const color2 = config.friendBackgroundColor2 ?? '#eef4ff'
    const color3 = config.friendBackgroundColor3 ?? '#fff1e8'

    if (mode === 'solid') {
      ctx.fillStyle = color1
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    } else {
      let gradient
      if (mode === 'radial') {
        const x = (config.friendBackgroundCenterX ?? 0.5) * canvas.width
        const y = (config.friendBackgroundCenterY ?? 0.5) * canvas.height
        gradient = ctx.createRadialGradient(x, y, 0, x, y, canvas.width * 0.78)
      } else {
        const angle = (config.friendBackgroundAngle ?? 135) * Math.PI / 180
        const dx = Math.cos(angle) * canvas.width * 0.72
        const dy = Math.sin(angle) * canvas.height * 0.72
        gradient = ctx.createLinearGradient(
          canvas.width * 0.5 - dx,
          canvas.height * 0.5 - dy,
          canvas.width * 0.5 + dx,
          canvas.height * 0.5 + dy,
        )
      }

      const position = THREE.MathUtils.clamp(config.friendBackgroundPosition ?? 0.5, 0.05, 0.95)
      const halfSoftness = THREE.MathUtils.clamp(config.friendBackgroundSoftness ?? 0.42, 0.02, 0.8) * 0.5
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
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    scene.background = texture

    return () => {
      if (scene.background === texture) scene.background = null
      texture.dispose()
    }
  }, [
    enabled,
    scene,
    config.friendBackgroundMode,
    config.friendBackgroundColor1,
    config.friendBackgroundColor2,
    config.friendBackgroundColor3,
    config.friendBackgroundUseThird,
    config.friendBackgroundAngle,
    config.friendBackgroundCenterX,
    config.friendBackgroundCenterY,
    config.friendBackgroundPosition,
    config.friendBackgroundSoftness,
  ])

  return null
}

function VersionTabs({ value, onChange }) {
  return (
    <div className="panel-tabs">
      {FRIEND_VERSIONS.map((v) => (
        <button
          key={v.id}
          type="button"
          className={`panel-tab ${v.id === value ? 'is-active' : ''}`}
          onClick={() => onChange(v.id)}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}

/**
 * FRIEND-lab — отдельная лёгкая сборка того же инструмента, в которой из
 * типов кристалла остался только FRIEND.
 *
 * Полный редактор (FINAL-diamond-glass) держит смонтированными ещё и
 * Banner, Motion и Graphics со своими канвасами и постпроцессингом, плюс
 * материалы «фигура» и «photo» с их собственными источниками картинки
 * (ColorCore, PhotoBackdrop). Всё это живёт рядом с кристаллом даже когда
 * открыт один Friend, и именно из-за этого тул ощутимо тормозил. Здесь
 * ничего этого не монтируется вовсе — один канвас, одна сцена.
 *
 * Код кристалла НЕ форкнут: Glass.jsx, Studio.jsx и Panel.jsx те же
 * самые файлы, что и в полной версии, просто вызванные с материалом
 * 'friend'.
 */
export default function FriendLab() {
  const [config, set] = useControls(() => buildLevaSchema(FIELD_GROUPS))
  const [version, setVersion] = useState(FRIEND_VERSIONS[0].id)

  /**
   * Три независимых набора настроек на один стор leva.
   *
   * Заводить три копии каждого поля в самой схеме не нужно: панель всё
   * равно показывает одну версию за раз. Значения уходящей версии
   * снимаются в память при переключении, значения входящей — заливаются
   * обратно. Стор при этом остаётся одним и тем же, и Glass.jsx получает
   * ровно ту же форму конфига, что и в полном редакторе.
   */
  const snapshots = useRef(
    Object.fromEntries(
      FRIEND_VERSIONS.map((v) => [v.id, { ...DEFAULTS, ...VERSION_DEFAULTS[v.id] }]),
    ),
  )

  // Снимок и заливку делаем ДО setVersion, а не внутри его апдейтера:
  // апдейтер вызывается во время рендера (и дважды в StrictMode), а set()
  // из leva — побочный эффект, который в этот момент просто теряется.
  // Из-за этого версии сначала делили одни и те же значения.
  // Стор leva инициализируется общей схемой, поэтому версия, открытая при
  // загрузке, НЕ получала своих персональных дефолтов — они применялись
  // только при переключении вкладок. Заливаем их один раз на монтировании.
  useEffect(() => {
    const initial = VERSION_DEFAULTS[FRIEND_VERSIONS[0].id]
    if (initial && Object.keys(initial).length > 0) set(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchVersion = useCallback((next) => {
    if (next === version) return
    snapshots.current[version] = pick(config, PER_VERSION_KEYS)
    // Заливаем только те ключи, значения которых реально отличаются.
    // Запись одинакового значения всё равно дёргает стор, а среди этих
    // ключей есть samples/resolution/bevel: первые два пересоздают
    // transmission-буфер, третий пересобирает геометрию — на переключении
    // вкладок это давало лишний чёрный кадр.
    const incoming = snapshots.current[next]
    const changes = {}
    for (const key of PER_VERSION_KEYS) {
      if (incoming[key] !== config[key]) changes[key] = incoming[key]
    }
    if (Object.keys(changes).length > 0) set(changes)
    setVersion(next)
  }, [version, config, set])

  // Дорогие ключи (см. EXPENSIVE_KEYS выше) идут в сцену не сразу, а через
  // паузу в 150 мс после последнего изменения — иначе перетаскивание их
  // слайдера пересоздаёт GPU-буфер/геометрию на каждый промежуточный шаг.
  // Ключ-строка вместо самого объекта — иначе pick() ниже создавал бы
  // новый объект на КАЖДЫЙ рендер (в том числе от соседних, «недорогих»
  // слайдеров) и таймер сбрасывался бы, не успевая сработать.
  const expensiveKey = EXPENSIVE_KEYS.map((k) => config[k]).join('|')
  const [debouncedExpensive, setDebouncedExpensive] = useState(() => pick(config, EXPENSIVE_KEYS))
  useEffect(() => {
    const id = setTimeout(() => setDebouncedExpensive(pick(config, EXPENSIVE_KEYS)), 150)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expensiveKey])

  // Glass ждёт материал внутри общего объекта конфигурации; версия
  // приходит не из полей, а из вкладок наверху.
  const sceneConfig = useMemo(
    () => ({ ...config, ...debouncedExpensive, материал: 'friend', friendVersion: version }),
    [config, debouncedExpensive, version],
  )

  const visiblePanelGroups = useMemo(() => panelGroupsFor(version), [version])

  // Sends the exact config the Canvas below is rendering right now — same
  // shape Glass expects (материал/friendVersion + every friend* field) —
  // to the hero prototype, so whatever tab/tuning is open here is what
  // shows up there. Passed via URL query rather than localStorage: the two
  // apps run on different dev ports, which are different origins, and
  // localStorage does not cross those.
  const handleOpenPrototype = useCallback(() => {
    const payload = encodeURIComponent(JSON.stringify(sceneConfig))
    window.open(`http://localhost:5181/hero-test?crystal=${payload}`, '_blank', 'noopener')
  }, [sceneConfig])

  return (
    <>
      <button
        type="button"
        onClick={handleOpenPrototype}
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 100,
          padding: '9px 16px',
          borderRadius: 999,
          border: '1px solid rgba(0,0,0,0.14)',
          background: '#fff',
          color: '#111',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        Prototype
      </button>
      <div className="stage">
        <Canvas
          // [1, 1.5] вместо [1, 2]: на Retina это ровно вдвое меньше
          // пикселей под каждый проход MeshTransmissionMaterial, а он
          // тут самый дорогой. На матовом молочном стекле разницы в
          // чёткости практически не видно — терять нечего.
          //
          // Значение ФИКСИРОВАННОЕ, и <AdaptiveDpr> здесь намеренно нет:
          // он менял pixel ratio на просадках кадра, а каждая такая смена
          // пересоздаёт render target'ы и у EffectComposer, и у
          // MeshTransmissionMaterial — на один кадр экран уходил в чёрное.
          // Именно это и читалось как случайное мигание.
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 5.2], fov: 32 }}
          gl={{ antialias: true }}
        >
          <SceneBackground
            enabled={version !== 'organic-metaball'}
            config={config}
          />

          <Suspense fallback={null}>
            {/* Притемнение нужно только версии с диффузором — у прозрачных
                версий оно просвечивало бы сквозь кристалл как серое пятно. */}
            {(FRIEND_VARIANTS[version]?.diffuser ?? 0) > 0 && <SoftBackdrop />}
            <Studio intensity={config.envIntensity} neutral />
            <Glass config={sceneConfig} />
          </Suspense>

          {/* EffectComposer смонтирован постоянно, а не по условию
              bloom > 0: пересоздание пайплайна на каждом пересечении нуля
              путало внутренний transmission render target и стекло на
              секунду рендерилось рваным. */}
          <EffectComposer enableNormalPass={false}>
            <Bloom
              mipmapBlur
              intensity={config.bloom}
              luminanceThreshold={config.bloomThreshold}
              luminanceSmoothing={0.3}
            />
          </EffectComposer>

          <OrbitControls
            makeDefault
            enablePan={false}
            minDistance={3}
            maxDistance={9}
            dampingFactor={0.08}
          />
        </Canvas>
      </div>

      {/* useControls без смонтированной <Leva/> сам вставляет свою
          панель в угол — прячем её, реальный интерфейс рисует
          ControlPanel ниже. */}
      <Leva hidden />

      <ControlPanel
        config={config}
        set={set}
        material="friend"
        onMaterialChange={() => {}}
        showMaterialTabs={false}
        topTabs={<VersionTabs value={version} onChange={switchVersion} />}
        groups={visiblePanelGroups}
      />
    </>
  )
}
