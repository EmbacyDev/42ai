import { useEffect, useRef, useState } from 'react'
import { CORE_SHAPES } from './ColorCore.jsx'
import defaultPhotoUrl from './assets/photos/default-photo.jpg'
import diamondPhoto02Url from './assets/memories/diamond-02.jpeg'
import diamondPhoto03Url from './assets/memories/diamond-03.jpeg'
import diamondPhoto04Url from './assets/memories/diamond-04.jpeg'
import diamondPhoto05Url from './assets/memories/diamond-05.jpeg'
import diamondPhoto06Url from './assets/memories/diamond-06.jpeg'

// Used by both the crystal's Memories tab (Panel.jsx) and the Banner
// Photo tab (Banner.jsx, via SingleMemoryPhotoField) — one shared list,
// feedback: "и там и там нужно еще добавить это фото". Source images —
// "diamond options" folder, order kept exactly as the numbers in their
// filenames (01 = default).
export const MEMORY_PHOTO_PRESETS = [
  { id: 'default', label: 'Default', url: defaultPhotoUrl },
  { id: 'diamond-02', label: '02', url: diamondPhoto02Url },
  { id: 'diamond-03', label: '03', url: diamondPhoto03Url },
  { id: 'diamond-04', label: '04', url: diamondPhoto04Url },
  { id: 'diamond-05', label: '05', url: diamondPhoto05Url },
  { id: 'diamond-06', label: '06', url: diamondPhoto06Url },
]

/**
 * Своя панель настроек вместо автопанели Leva.
 *
 * Раньше `<Leva/>` рисовала список сама по схеме `useControls`. Это было
 * неудобно тремя разными способами разом:
 *  1. Скролл иногда «застревал» — стандартный слайдер Leva перехватывает
 *     колесо мыши для точной подстройки значения, а не для прокрутки
 *     страницы. Стоило навести курсор на ползунок во время скролла —
 *     список замирал, а число под курсором менялось.
 *  2. Список был одной длинной лентой без сворачивания — даже
 *     второстепенные разделы (Свет, Разлом, Качество) всегда занимали
 *     место, и до нужного поля приходилось скролить.
 *  3. Внешний вид — тёмная панель разработчика, даже перекрашенная
 *     в светлую тему, всё равно читалась как debug-инструмент, а не
 *     часть интерфейса.
 *
 * Здесь: свои Slider/ColorField/SelectField/ToggleField без перехвата
 * колеса, разделы (Edges/Light/Shatter/...) переключаются вкладками —
 * а не раскрываются аккордеоном, поэтому высота панели не гуляет от того,
 * сколько всего развёрнуто — и внешний вид в стиле остального сайта.
 * Источник значений/диапазонов/лейблов один —
 * FIELD_GROUPS ниже; buildLevaSchema() из него же собирает схему для
 * useControls, так что при добавлении нового ползунка правится одно
 * место, а не два.
 */

// final: оставлены только два материала (Фигура/Photo) — Portal, Infinity/
// Сплав/Поток и переключатель формы кристалла убраны целиком, это
// самостоятельная урезанная копия, а не переключаемый режим внутри v2/v3.
export const FIELD_GROUPS = [
  {
    name: 'Main',
    tab: 'friend',
    fields: [
      { key: 'friendVersion', type: 'friend-version', value: 'milky-projection', label: 'glass version' },
      { key: 'friendCoreSize', type: 'slider', value: 0.64, min: 0.15, max: 1.4, step: 0.01, label: 'light size' },
      { key: 'friendVolumeScale', type: 'slider', value: 1.65, min: 0.8, max: 2.2, step: 0.01, label: 'inner volume size' },
      { key: 'friendCoreStretch', type: 'slider', value: 0.67, min: 0.55, max: 1.8, step: 0.01, label: 'light stretch' },
      { key: 'friendCenterPower', type: 'slider', value: 0.6, min: 0.2, max: 3, step: 0.01, label: 'center brightness' },
      // Размер ТОЛЬКО горячего ядра, отдельно от «light size», который
      // задаёт всё пятно вместе с градиентами. Сжимает бело-жёлтую
      // середину и отдаёт освободившееся место цвету, не трогая размер
      // самого пятна. Все три версии теперь на одной модели, поэтому
      // ползунок относится к каждой из них.
      { key: 'friendCenterSize', type: 'slider', value: 0.2, min: 0.2, max: 1.6, step: 0.01, label: 'center size' },
      { key: 'friendPulse', type: 'slider', value: 0.45, min: 0, max: 0.45, step: 0.005, label: 'light pulse' },
      // Подвижность самого света: сгусток ходит по своей траектории внутри
      // кристалла и сильнее кипит внутри себя. 0 — свет стоит в середине,
      // как в версиях с единой массой.
      { key: 'friendLightMotion', type: 'slider', value: 0.06, min: 0, max: 1, step: 0.01, label: 'light motion' },
      { key: 'friendFlow', type: 'slider', value: 1.22, min: 0, max: 1.5, step: 0.01, label: 'soft flow' },
      { key: 'friendPaintFlow', type: 'slider', value: 0.19, min: 0, max: 2.2, step: 0.01, label: 'paint flow' },
      // Медленное «дыхание» самих потоков: soft flow и paint flow не стоят
      // на месте, а плавно ходят вокруг выставленных значений на разных
      // периодах. 0 — потоки постоянные, как раньше.
      { key: 'friendFlowDrift', type: 'slider', value: 0.2, min: 0, max: 1, step: 0.01, label: 'flow drift' },
      { key: 'friendLightSpread', type: 'slider', value: 1, min: 0.15, max: 1, step: 0.01, label: 'light spread' },
      // Отдельная ось для извилистой деформации массы (shapeLobe/body
      // warp/кипение/цвет) — своя скорость и своя сила, не завязанные на
      // soft flow/paint flow, которые управляют дыханием пятна в целом.
      { key: 'friendWindSpeed', type: 'slider', value: 0.53, min: 0.2, max: 3, step: 0.01, label: 'wind speed' },
      { key: 'friendWindAmount', type: 'slider', value: 1.35, min: 0, max: 2.5, step: 0.01, label: 'wind amount' },
    ],
  },
  {
    name: 'Colors',
    tab: 'friend',
    fields: [
      { key: 'friendCenterColor', type: 'color', value: '#fff4e8', label: 'center light' },
      { key: 'friendColorCount', type: 'color-count', value: 4, min: 2, max: 5, step: 1, label: 'gradient colors' },
      // Разделение цветов. На нуле палитра растягивается непрерывно и
      // соседние цвета перетекают друг в друга; выше — каждый занимает
      // свою область, а между ними остаётся узкий переход.
      { key: 'friendColorSplit', type: 'slider', value: 0, min: 0, max: 1, step: 0.01, label: 'color split' },
      // Подвижность цветовых областей: границы между цветами плавают
      // внутри пятна, а не стоят на своих радиусах. Отдельно от «soft
      // flow» и «paint flow» — те двигают форму, этот двигает сам цвет.
      { key: 'friendColorMotion', type: 'slider', value: 1, min: 0, max: 1, step: 0.01, label: 'color motion' },
      // Насыщенность цвета внутри. 0 — ровно то, что было до появления
      // этого ползунка: он добавлен как надстройка сверху, а не как замена
      // прежнего поведения, поэтому нижний край диапазона ничего не меняет.
      { key: 'friendColorBoost', type: 'slider', value: 1, min: 0, max: 1, step: 0.01, label: 'color boost' },
      // reorder: цвета градиента идут по порядку от центра к краю, и этот
      // порядок влияет на картинку не меньше самих цветов. Стрелки рядом
      // со свотчем меняют соседей местами, не заставляя перебивать
      // значения вручную.
      { key: 'friendFlowColor1', type: 'color', reorder: 'friendFlow', value: '#29ae57', label: 'color 1' },
      { key: 'friendFlowColor2', type: 'color', reorder: 'friendFlow', value: '#e69119', label: 'color 2' },
      { key: 'friendFlowColor3', type: 'color', reorder: 'friendFlow', value: '#1d81ed', label: 'color 3' },
      { key: 'friendFlowColor4', type: 'color', reorder: 'friendFlow', value: '#756cff', label: 'color 4', visible: (cfg) => (cfg.friendColorCount ?? 4) >= 4 },
      { key: 'friendFlowColor5', type: 'color', reorder: 'friendFlow', value: '#7f4cff', label: 'color 5', visible: (cfg) => (cfg.friendColorCount ?? 3) >= 5 },
    ],
  },
  {
    name: 'Background',
    tab: 'friend',
    fields: [
      { key: 'friendBackgroundMode', type: 'select', value: 'solid', options: ['solid', 'linear', 'radial'], label: 'background type' },
      { key: 'friendBackgroundColor1', type: 'color', value: '#ffffff', label: 'color 1' },
      { key: 'friendBackgroundColor2', type: 'color', value: '#eef4ff', label: 'color 2', visible: (cfg) => cfg.friendBackgroundMode !== 'solid' },
      { key: 'friendBackgroundUseThird', type: 'toggle', value: false, label: 'third color', visible: (cfg) => cfg.friendBackgroundMode !== 'solid' },
      { key: 'friendBackgroundColor3', type: 'color', value: '#fff1e8', label: 'color 3', visible: (cfg) => cfg.friendBackgroundMode !== 'solid' && cfg.friendBackgroundUseThird },
      { key: 'friendBackgroundAngle', type: 'slider', value: 135, min: 0, max: 360, step: 1, label: 'angle', visible: (cfg) => cfg.friendBackgroundMode === 'linear' },
      { key: 'friendBackgroundCenterX', type: 'slider', value: 0.5, min: 0, max: 1, step: 0.01, label: 'center x', visible: (cfg) => cfg.friendBackgroundMode === 'radial' },
      { key: 'friendBackgroundCenterY', type: 'slider', value: 0.5, min: 0, max: 1, step: 0.01, label: 'center y', visible: (cfg) => cfg.friendBackgroundMode === 'radial' },
      { key: 'friendBackgroundPosition', type: 'slider', value: 0.5, min: 0.05, max: 0.95, step: 0.01, label: 'transition position', visible: (cfg) => cfg.friendBackgroundMode !== 'solid' },
      { key: 'friendBackgroundSoftness', type: 'slider', value: 0.42, min: 0.02, max: 0.8, step: 0.01, label: 'transition softness', visible: (cfg) => cfg.friendBackgroundMode !== 'solid' },
    ],
  },
  {
    name: 'Glass',
    tab: 'friend',
    fields: [
      { key: 'friendTransparency', type: 'slider', value: 0.43, min: 0.35, max: 1, step: 0.01, label: 'transparency' },
      { key: 'friendMatte', type: 'slider', value: 0.22, min: 0, max: 1, step: 0.01, label: 'matte' },
      { key: 'friendFrost', type: 'slider', value: 0.09, min: 0, max: 1, step: 0.01, label: 'frost' },
      { key: 'friendGlassBlur', type: 'slider', value: 0.43, min: 0, max: 0.7, step: 0.01, label: 'glass blur' },
      // Блики на гранях. Матовая заливка ложится поверх рёбер ровным слоем
      // и кристалл читается плоским силуэтом — этот параметр возвращает ему
      // объём, подсвечивая грани по их наклону к камере.
      { key: 'friendSpecular', type: 'slider', value: 0.8, min: 0, max: 2, step: 0.01, label: 'highlights' },
      // Мягкая внутренняя тень у края. Без неё тело читается плоской
      // заливкой: именно затемнение ПОД кромкой даёт объём и отделяет
      // объект от фона.
      { key: 'friendInnerShade', type: 'slider', value: 0.62, min: 0, max: 1, step: 0.01, label: 'inner shade' },
      // Оттенок тени. Тень работает как множитель цвета, поэтому значение
      // здесь — это то, во что превращается белый под полной тенью.
      // Нейтральный серый #737373 даёт ровное затемнение без сдвига тона;
      // цветной сдвигает тень в свою сторону, как подкрашенная толща.
      { key: 'friendShadeColor', type: 'color', value: '#a1e9fc', label: 'shade tint' },
      { key: 'friendEdgeClarity', type: 'slider', value: 0.65, min: 0, max: 1, step: 0.01, label: 'edge clarity' },
      { key: 'friendLightDiffusion', type: 'slider', value: 0.57, min: 0, max: 1, step: 0.01, label: 'light diffusion' },
    ],
  },
  {
    // Название первой вкладки — «Main», а не «Figure»/«Portal»/«Photo»:
    // так у всех материалов первая (основная) вкладка раздела называется
    // одинаково, а не по имени самого материала (та вкладка уже есть
    // выше, в MaterialTabs) — «Figure → Figure» дублировало название
    // дважды подряд, «Main» читается как «основные настройки», общее для
    // любого материала.
    //
    // Цвета — прямо здесь, не в отдельной вкладке «Colors»: у Figure это
    // тоже основные настройки (без них фигура внутри бесцветная), а не
    // второстепенный довесок вроде Edges/Shatter/Quality. Каждый цвет
    // сразу рядом со своей же долей (color, затем weight) — соседний
    // `type: 'color'` + `type: 'slider'` рендерится одной строкой,
    // квадратик слева, его ползунок-доля справа (см. renderFields в
    // Panel.jsx), а не отдельными строками одна под другой.
    name: 'Main',
    tab: 'фигура',
    fields: [
      { key: 'figureShape', type: 'select', value: 'icosahedron', options: CORE_SHAPES, label: 'shape' },
      { key: 'figureSegments', type: 'slider', value: 9, min: 3, max: 16, step: 1, label: 'sectors' },
      { key: 'figureCoreScale', type: 'slider', value: 0.6, min: 0.15, max: 0.9, step: 0.01, label: 'figure size' },
      { key: 'figureCoreSpeed', type: 'slider', value: 3.2, min: 0, max: 4, step: 0.05, label: 'figure speed' },
      { key: 'figureRoughness', type: 'slider', value: 0.19, min: 0, max: 1, step: 0.01, label: 'roughness' },
      { key: 'figureIor', type: 'slider', value: 2.38, min: 1, max: 2.4, step: 0.01, label: 'refraction' },
      { key: 'figureChromaticAberration', type: 'slider', value: 0.8, min: 0, max: 1.5, step: 0.01, label: 'iridescence' },
      { key: 'figureThickness', type: 'slider', value: 2.4, min: 0, max: 5, step: 0.05, label: 'thickness' },
      // На резком преломлении (низкое значение) видна только маленькая
      // точка фигуры за раз — она попадает то на большую зону одного
      // цвета, то на границу между зонами, и весь вид скачет при
      // вращении даже без единого изменения ползунков цвета. Выше —
      // сразу несколько зон колеса усредняются в одну точку, вид
      // устойчивее к повороту, но грани становятся чуть более смазанными.
      { key: 'figureAnisotropicBlur', type: 'slider', value: 0.28, min: 0, max: 1, step: 0.01, label: 'blur' },
      // Подобранный вручную вид: насыщенная бирюза, глубокий индиго,
      // тёплый крем и тёмный шоколадный — более контрастная и глубокая
      // палитра, чем прежняя приглушённая «масляная».
      { key: 'figureColorA', type: 'color', value: '#2fa9c1', label: 'color 1' },
      // Раньше все три цвета шли строго равными третями — нельзя было
      // выбрать «главный». Теперь у каждого цвета своя «доля»: по
      // умолчанию все три равны (1 = 1 = 1 даёт те же равные трети, что
      // и раньше), а сдвиг одного ползунка выше остальных отдаёт ему
      // бОльшую часть поверхности — см. computeWheelWeights в ColorCore.jsx.
      { key: 'figureColorAWeight', type: 'slider', value: 1, min: 0, max: 1, step: 0.01, label: 'color 1 share' },
      { key: 'figureColorB', type: 'color', value: '#6746c3', label: 'color 2' },
      { key: 'figureColorBWeight', type: 'slider', value: 1, min: 0, max: 1, step: 0.01, label: 'color 2 share' },
      { key: 'figureColorC', type: 'color', value: '#ebd9c2', label: 'color 3' },
      { key: 'figureColorCWeight', type: 'slider', value: 1, min: 0, max: 1, step: 0.01, label: 'color 3 share' },
      { key: 'figureColorD', type: 'color', value: '#5a3116', label: 'color 4' },
      { key: 'figureColorDWeight', type: 'slider', value: 1, min: 0, max: 1, step: 0.01, label: 'color 4 share' },
    ],
  },
  {
    // «Photo» — настоящая фотография (или видео) сразу за кристаллом (см.
    // PhotoBackdrop.jsx), небольшая и близкая к нему, а не заменяющая
    // собой весь фон целиком — так фото читается как нечто внутри
    // кристалла, согнутое им, а не как кристалл поверх той же картинки.
    // Само искажение — от IOR/distortion самого MeshTransmissionMaterial
    // (референс: openinghours.studio), не отдельный шейдер по граням.
    //
    // Раньше было ещё разбито на Main/Warp/Photos — по фидбоку именно у
    // Photo (в отличие от Figure/Portal) фото и «искажение» — это и есть
    // главное, что тут настраивают, а не второстепенный довесок. choose
    // photos и все поля бывшего Warp собраны прямо в Main (первая вкладка
    // раздела, см. ControlPanel в Panel.jsx). Вкладками остались только
    // Playback (по-настоящему второстепенное — скорость смены фото по
    // кругу и то, что за пределами «на что это похоже») и общие
    // Edges/Light/Shatter/Motion/Quality. Main здесь длиннее, чем у
    // других материалов, и может изредка требовать внутреннего скролла
    // панели — сознательный компромисс именно для этого материала.
    name: 'Main',
    tab: 'photo',
    fields: [
      { key: 'photoMode', type: 'memory-mode', value: 'single', label: 'photos' },
      { key: 'photoSingleImage', type: 'memory-photo', value: defaultPhotoUrl, label: 'photo', visible: (cfg) => cfg.photoMode !== 'multiple' },
      { key: 'photoImages', type: 'files', value: JSON.stringify([{ url: defaultPhotoUrl, kind: 'image' }]), label: 'photos', visible: (cfg) => cfg.photoMode === 'multiple' },
      { key: 'photoCycleTime', type: 'slider', value: 6, min: 2, max: 30, step: 0.5, label: 'switch every', visible: (cfg) => cfg.photoMode === 'multiple' },
      // Static thickness, as before — hidden once animation takes over
      // (below), since the two would otherwise fight over the same prop.
      { key: 'photoThickness', type: 'slider', value: 1.0, min: 0, max: 5, step: 0.05, label: 'thickness', visible: (cfg) => !cfg.photoThicknessAnimate },
      { key: 'photoThicknessAnimate', type: 'toggle', value: false, label: 'animate thickness' },
      { key: 'photoThicknessSpeed', type: 'slider', value: 0.6, min: 0.05, max: 3, step: 0.01, label: 'anim speed', visible: (cfg) => cfg.photoThicknessAnimate },
      { key: 'photoThicknessMin', type: 'slider', value: 0.4, min: 0, max: 5, step: 0.05, label: 'anim min', visible: (cfg) => cfg.photoThicknessAnimate },
      { key: 'photoThicknessMax', type: 'slider', value: 1.8, min: 0, max: 5, step: 0.05, label: 'anim max', visible: (cfg) => cfg.photoThicknessAnimate },
      { key: 'photoIor', type: 'slider', value: 2.08, min: 1, max: 2.4, step: 0.01, label: 'refraction' },
      { key: 'photoRoughness', type: 'slider', value: 0.10, min: 0, max: 1, step: 0.01, label: 'roughness' },
      { key: 'photoChromaticAberration', type: 'slider', value: 0.3, min: 0, max: 1.5, step: 0.01, label: 'iridescence' },
      { key: 'photoAnisotropicBlur', type: 'slider', value: 0.26, min: 0, max: 1, step: 0.01, label: 'blur' },
      { key: 'photoDistortion', type: 'slider', value: 0.5, min: 0, max: 1, step: 0.01, label: 'distortion' },
      { key: 'photoDistortionScale', type: 'slider', value: 0.5, min: 0, max: 1, step: 0.01, label: 'distortion scale' },
      // Wobbles the glass's own bending over time — life that isn't tied
      // to actually turning the crystal.
      { key: 'photoLiquid', type: 'slider', value: 0.09, min: 0, max: 0.6, step: 0.01, label: 'liquid wobble' },
      // A little color of the crystal's own, on top of whatever the photo
      // brings — see the two `photo*Tint` colors below. At 0 the glass
      // stays perfectly colorless (pure photo, as before); this only ever
      // ADDS a cast, never replaces the photo's own colors.
      { key: 'photoTintStrength', type: 'slider', value: 0.2, min: 0, max: 1, step: 0.01, label: 'tint strength' },
      // Tints the crystal itself fairly evenly (MeshTransmissionMaterial's
      // `color`, which multiplies everything) — capped well under full
      // strength in Glass.jsx so even at tintStrength=1 the shell only
      // ever picks up a light cast, never goes opaque-colored.
      { key: 'photoCrystalTint', type: 'color', value: '#ffd9a8', label: 'crystal tint', visible: (cfg) => (cfg.photoTintStrength ?? 0) > 0.001 },
      // Tints via `attenuationColor` instead — Beer-Lambert absorption
      // that only shows up where the ray travels far through glass, i.e.
      // exactly the thick, bent, heavily-refracted parts of the image
      // (edges, the deepest distortion) rather than the whole surface.
      { key: 'photoDistortionTint', type: 'color', value: '#9fd0ff', label: 'distortion tint', visible: (cfg) => (cfg.photoTintStrength ?? 0) > 0.001 },
    ],
  },
  {
    name: 'Playback',
    tab: 'photo',
    fields: [
      // The photo itself keeps drifting on its own axes, independent of
      // the shell's rotation (and of the Motion tab's rotation toggle) —
      // a second, separate source of motion inside the crystal.
      { key: 'photoMotion', type: 'slider', value: 0.28, min: 0, max: 1, step: 0.01, label: 'inner motion' },
      { key: 'photoReflection', type: 'slider', value: 2.45, min: 0, max: 3, step: 0.05, label: 'reflections' },
    ],
  },
  {
    // Без tab — правит нормали самой оболочки (см. applyBevel в
    // Glass.jsx), а не что-то специфичное для одного материала, поэтому
    // видна на любой вкладке, как «Свет»/«Движение».
    name: 'Edges',
    fields: [
      { key: 'bevel', type: 'slider', value: 0.15, min: 0, max: 1, step: 0.01, label: 'bevel' },
      // 0 — плоский срез (chamfer), как раньше; выше — тот же общий срез
      // грани, только за несколько мелких шагов подряд, что читается как
      // настоящее скругление (fillet), а не грань.
      { key: 'filletSegments', type: 'slider', value: 0, min: 0, max: 8, step: 1, label: 'fillet',
        visible: (cfg) => (cfg.roundness ?? 0) <= 0.001 },
      // Округление самой формы. Выше нуля заменяет фаску целиком: bevel и
      // fillet режут рёбра, но силуэт остаётся многогранником, а тут
      // меняется само тело — от гранёного кристалла к мягкому.
      { key: 'roundness', type: 'slider', value: 0, min: 0, max: 1, step: 0.01, label: 'roundness' },
    ],
  },
  {
    name: 'Light',
    fields: [
      { key: 'envIntensity', type: 'slider', value: 1, min: 0, max: 3, step: 0.05, label: 'studio' },
      { key: 'bloom', type: 'slider', value: 0, min: 0, max: 2, step: 0.01, label: 'bloom' },
      // Порог свечения ни на что не влияет, пока «свечение» выключено.
      { key: 'bloomThreshold', type: 'slider', value: 0.62, min: 0, max: 1, step: 0.01, label: 'bloom threshold', visible: (cfg) => cfg.bloom > 0 },
      { key: 'shadow', type: 'slider', value: 0.03, min: 0, max: 1, step: 0.01, label: 'shadow', visible: (_cfg, material) => material !== 'friend' },
    ],
  },
  {
    name: 'Shatter',
    fields: [
      { key: 'explode', type: 'slider', value: 0, min: 0, max: 1, step: 0.001, label: 'explode' },
      // Дистанция и доворот двигают осколки, которых нет, пока разлёт = 0.
      { key: 'explodeDistance', type: 'slider', value: 1.4, min: 0, max: 4, step: 0.05, label: 'distance', visible: (cfg) => cfg.explode > 0.001 },
      { key: 'explodeTwist', type: 'slider', value: 0.6, min: 0, max: 2, step: 0.01, label: 'twist', visible: (cfg) => cfg.explode > 0.001 },
    ],
  },
  {
    // «Rotation», не «Motion» — этот раздел только про то, крутится ли
    // сама оболочка кристалла и как быстро. Есть и другие источники
    // движения (Photo/Playback — смена фото по кругу) — им «Motion» было
    // бы легко спутать с содержимым, а не с вращением самого объекта.
    name: 'Rotation',
    fields: [
      { key: 'autoRotate', type: 'toggle', value: true, label: 'rotation' },
      // Скорость нечего крутить, пока вращение выключено.
      { key: 'rotateSpeed', type: 'slider', value: 0.25, min: 0, max: 2, step: 0.01, label: 'speed', visible: (cfg) => cfg.autoRotate },
    ],
  },
  {
    // Из материалов sample/resolution нужны только тем, что используют
    // MeshTransmissionMaterial с transmissionSampler — обоим оставшимся
    // материалам («Figure»/«Photo»), поэтому раздел виден на любой вкладке.
    name: 'Quality',
    tab: ['фигура', 'photo', 'friend'],
    fields: [
      { key: 'samples', type: 'slider', value: 10, min: 2, max: 32, step: 1, label: 'samples' },
      { key: 'resolution', type: 'slider', value: 512, min: 64, max: 2048, step: 64, label: 'resolution' },
    ],
  },
]

/** Собирает плоскую схему для useControls прямо из FIELD_GROUPS — один
 * источник данных на схему состояния и на этот рендер. Видимость (`tab`,
 * `visible`) сюда не идёт: это забота панели, а не стора значений. */
export function buildLevaSchema(groups) {
  const schema = {}
  for (const group of groups) {
    for (const field of group.fields) {
      const def = { value: field.value, label: field.label }
      if (field.min !== undefined) {
        def.min = field.min
        def.max = field.max
        def.step = field.step
      }
      if (field.options) def.options = field.options
      schema[field.key] = def
    }
  }
  return schema
}

const TABS = [
  { id: 'фигура', label: 'Prism' },
  { id: 'photo', label: 'Memories' },
  { id: 'friend', label: 'Friend' },
]

function MaterialTabs({ value, onChange }) {
  return (
    <div className="panel-tabs">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`panel-tab ${t.id === value ? 'is-active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Horizontal tab strip for the field groups within one material tab
 * (Figure/Edges/Light/Shatter, say) — replaces what used to be a stack of
 * collapsible accordion sections. Only the active group's fields render
 * below (see ControlPanel), so switching a secondary tab swaps content
 * instead of expanding/collapsing a growing list. */
function SectionTabs({ groups, value, onChange }) {
  return (
    <div className="section-tabs" role="tablist" aria-label="Settings section">
      {groups.map((g) => (
        <button
          key={g.name}
          type="button"
          role="tab"
          aria-selected={g.name === value}
          className={`section-tab ${g.name === value ? 'is-active' : ''}`}
          onClick={() => onChange(g.name)}
        >
          {g.name}
        </button>
      ))}
    </div>
  )
}

/** Saved-view strip — floats top-center on its own (see App.jsx), separate
 * from the settings panel on the right, so it reads as a shelf of views
 * rather than something buried inside the panel. Each bookmark shows as a
 * small square thumbnail (a snapshot of the canvas taken at save time —
 * see the `capture` ref in App.jsx) instead of a text pill: with several
 * saved views, a name alone doesn't tell them apart at a glance nearly as
 * well as what the crystal actually looked like does. Older bookmarks
 * saved before thumbnails existed just fall back to the first letter of
 * their name. */
export function Bookmarks({ bookmarks, onLoad, onSave, onDelete }) {
  return (
    <div className="bookmarks-bar">
      {bookmarks.map((b) => (
        <div key={b.id} className="bookmark-chip">
          <button type="button" className="bookmark-thumb" onClick={() => onLoad(b)} title={`Load "${b.name}"`}>
            {b.thumbnail
              ? <img src={b.thumbnail} alt={b.name} draggable={false} />
              : <span className="bookmark-thumb-fallback">{b.name.trim().charAt(0).toUpperCase() || '?'}</span>}
          </button>
          <button type="button" className="bookmark-delete" onClick={() => onDelete(b.id)} title={`Delete "${b.name}"`}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="bookmark-add" onClick={onSave} title="Save current view as bookmark">
        +
      </button>
    </div>
  )
}

function decimalsForStep(step) {
  const s = String(step)
  const i = s.indexOf('.')
  return i === -1 ? 0 : s.length - i - 1
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

/** Слайдер без перехвата колеса мыши — прежняя Leva-панель ловила wheel
 * на слайдере для точной подстройки значения, из-за чего скролл списка
 * «залипал» под курсором. Здесь никакого onWheel нет вообще: колесо
 * всегда прокручивает список, значение меняется только перетаскиванием
 * или вводом числа. */
export function Slider({ label, value, min, max, step, onChange }) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const decimals = decimalsForStep(step)
  const [text, setText] = useState(() => value.toFixed(decimals))

  // While dragging, the pill's fill/text track the pointer directly on
  // every pointermove — completely decoupled from `value` (the prop),
  // which only updates once `onChange` has round-tripped through Leva and
  // re-rendered the whole 3D scene. That round trip is the expensive
  // part, and calling it on every native pointermove (which can fire
  // faster than the screen repaints) backs the main thread up, making
  // drags feel like they lag behind the cursor. Coalescing it to at most
  // once per animation frame (see scheduleChange below) fixes that — but
  // without this separate liveValue, the pill itself would ALSO only
  // repaint on that same throttled cadence, i.e. it would inherit the lag
  // it exists to hide instead of tracking the pointer 1:1.
  const [liveValue, setLiveValue] = useState(value)
  const pendingRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!dragging) {
      setText(value.toFixed(decimals))
      setLiveValue(value)
    }
  }, [value, decimals, dragging])

  // Don't leave a scheduled frame trying to fire into an unmounted
  // component (e.g. its field's `visible` condition flips off mid-drag).
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

  const displayValue = dragging ? liveValue : value
  const pct = clamp(((displayValue - min) / (max - min)) * 100, 0, 100)

  function valueFromClientX(clientX) {
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
    const raw = min + ratio * (max - min)
    return clamp(Math.round(raw / step) * step, min, max)
  }

  function scheduleChange(next) {
    pendingRef.current = next
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const v = pendingRef.current
      pendingRef.current = null
      onChange(v)
    })
  }

  function applyDrag(clientX) {
    const next = valueFromClientX(clientX)
    setLiveValue(next)
    setText(next.toFixed(decimals))
    scheduleChange(next)
  }

  function handlePointerDown(e) {
    trackRef.current.setPointerCapture(e.pointerId)
    setDragging(true)
    applyDrag(e.clientX)
  }
  function handlePointerMove(e) {
    if (!dragging) return
    applyDrag(e.clientX)
  }
  function handlePointerUp() {
    setDragging(false)
    // Apply the final position right away rather than waiting for
    // whatever frame happened to be in flight — releasing the pointer
    // should feel immediate, not add up to a frame of extra latency.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (pendingRef.current !== null) {
      const v = pendingRef.current
      pendingRef.current = null
      onChange(v)
    }
  }

  function commitText() {
    const parsed = parseFloat(text.replace(',', '.'))
    if (Number.isFinite(parsed)) onChange(clamp(parsed, min, max))
    else setText(value.toFixed(decimals))
  }

  // One pill instead of label+track+value-box side by side: label and
  // value are overlaid text on top of the same draggable strip — the
  // filled/unfilled boundary itself marks the current position, no
  // separate thumb or line needed on top of it.
  return (
    <div
      ref={trackRef}
      className="slider-pill"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="slider-pill-fill" style={{ width: `${pct}%` }} />
      <span className="slider-pill-label">{label}</span>
      <input
        className="slider-pill-value"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setDragging(true)}
        onBlur={() => {
          setDragging(false)
          commitText()
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        // Otherwise a click meant to place the text caret is ALSO read by
        // the pill's own onPointerDown as "drag to this x" — the value
        // would jump to wherever inside the input was clicked before the
        // user gets to type anything.
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  )
}

export function ColorField({ label, value, onChange }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <ColorSwatch value={value} onChange={onChange} />
    </div>
  )
}

function ColorCountField({ label, value, min, max, onChange }) {
  const count = Math.round(value)
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <div className="color-count-control">
        <button
          type="button"
          className="color-count-button"
          disabled={count <= min}
          onClick={() => onChange(Math.max(min, count - 1))}
          aria-label="Remove gradient color"
        >
          −
        </button>
        <span className="color-count-value">{count}</span>
        <button
          type="button"
          className="color-count-button"
          disabled={count >= max}
          onClick={() => onChange(Math.min(max, count + 1))}
          aria-label="Add gradient color"
        >
          +
        </button>
      </div>
    </div>
  )
}

function FriendGradientEditor({ fields, config, set }) {
  const min = 2
  const max = fields.length
  const count = Math.min(max, Math.max(min, Math.round(config.friendColorCount ?? 4)))
  const activeFields = fields.slice(0, count)
  const [dragIndex, setDragIndex] = useState(null)
  const [dropIndex, setDropIndex] = useState(null)

  const reorder = (from, to) => {
    if (from === null || to === null || from === to) return
    const values = activeFields.map((field) => config[field.key])
    const [moved] = values.splice(from, 1)
    values.splice(to, 0, moved)
    set(Object.fromEntries(activeFields.map((field, index) => [field.key, values[index]])))
  }

  const remove = (index) => {
    if (count <= min) return
    const values = activeFields.map((field) => config[field.key])
    values.splice(index, 1)
    const changes = { friendColorCount: count - 1 }
    fields.slice(0, count - 1).forEach((field, valueIndex) => {
      changes[field.key] = values[valueIndex]
    })
    set(changes)
  }

  const add = () => {
    if (count >= max) return
    set({ friendColorCount: count + 1 })
  }

  return (
    <div className="gradient-color-editor">
      {activeFields.map((field, index) => (
        <div
          className={`gradient-color-row ${dragIndex === index ? 'is-dragging' : ''} ${dropIndex === index ? 'is-drop-target' : ''}`}
          key={field.key}
          draggable
          onDragStart={(event) => {
            setDragIndex(index)
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', String(index))
          }}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDropIndex(index)
          }}
          onDrop={(event) => {
            event.preventDefault()
            reorder(dragIndex, index)
            setDragIndex(null)
            setDropIndex(null)
          }}
          onDragEnd={() => {
            setDragIndex(null)
            setDropIndex(null)
          }}
        >
          <span className="color-drag-handle" aria-hidden="true">⠿</span>
          <span className="field-label">{field.label}</span>
          <ColorSwatch value={config[field.key]} onChange={(value) => set({ [field.key]: value })} />
          <button
            type="button"
            className="color-remove-button"
            disabled={count <= min}
            onClick={() => remove(index)}
            aria-label={`Удалить ${field.label}`}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="color-add-button"
        disabled={count >= max}
        onClick={add}
        aria-label="Добавить цвет"
      >
        <span aria-hidden="true">+</span>
        add color
      </button>
    </div>
  )
}

// Just the swatch, no field-row/label wrapper — for color-share-row (see
// renderFields), where the swatch sits directly next to its slider
// instead of paired with its own text label.
function ColorSwatch({ value, onChange, title }) {
  return (
    <label className="color-swatch" style={{ background: value }} title={title}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <select className="select-control" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}

function MemoryModeField({ label, value, onChange }) {
  return (
    <div className="memory-mode-field">
      <span className="field-label">{label}</span>
      <div className="memory-mode-picker" role="radiogroup" aria-label="Memory photo mode">
        {[
          { id: 'single', label: 'One photo' },
          { id: 'multiple', label: 'Multiple photos' },
        ].map((mode) => (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={value === mode.id}
            className={`memory-mode-button ${value === mode.id ? 'is-active' : ''}`}
            onClick={() => onChange(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function FriendVersionField({ label, value, onChange }) {
  const versions = [
    { id: 'milky-projection', short: '01', title: 'Версия 01' },
    { id: 'double-shell', short: '02', title: 'Версия 02' },
    { id: 'volumetric', short: '03', title: 'Версия 03' },
  ]
  return (
    <div className="memory-mode-field">
      <span className="field-label">{label}</span>
      <div className="memory-mode-picker" role="radiogroup" aria-label="Friend glass version">
        {versions.map((version) => (
          <button
            key={version.id}
            type="button"
            role="radio"
            aria-checked={value === version.id}
            className={`memory-mode-button ${value === version.id ? 'is-active' : ''}`}
            onClick={() => onChange(version.id)}
            title={version.title}
          >
            {version.short}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SingleMemoryPhotoField({ label, value, onChange }) {
  const inputRef = useRef(null)
  const customSelected = value?.startsWith('blob:')

  function choosePreset(url) {
    if (customSelected) URL.revokeObjectURL(value)
    onChange(url)
  }

  return (
    <div className="memory-photo-field">
      <span className="field-label">{label}</span>
      <div className="memory-photo-presets">
        {MEMORY_PHOTO_PRESETS.map((photo) => (
          <button
            key={photo.id}
            type="button"
            className={`memory-photo-preset ${value === photo.url ? 'is-active' : ''}`}
            onClick={() => choosePreset(photo.url)}
            aria-label={photo.label}
            aria-pressed={value === photo.url}
            title={photo.label}
          >
            <img src={photo.url} alt="" />
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`memory-photo-upload ${customSelected ? 'is-active' : ''}`}
        onClick={() => inputRef.current?.click()}
      >
        {customSelected ? 'Change own photo' : 'Upload own photo'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          if (customSelected) URL.revokeObjectURL(value)
          onChange(URL.createObjectURL(file))
          e.target.value = ''
        }}
      />
    </div>
  )
}

export function ToggleField({ label, value, onChange }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <button
        type="button"
        className={`toggle-switch ${value ? 'is-on' : ''}`}
        onClick={() => onChange(!value)}
        aria-pressed={value}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  )
}

// Загрузка своего файла с компьютера — value хранит blob-URL (см.
// URL.createObjectURL) выбранного изображения, а не сам файл: строка
// прекрасно живёт в обычном сторе конфигурации наравне с остальными полями.
// Старый blob-URL отзывается перед тем как завести новый — иначе за сессию
// с частой заменой фото накопился бы список никогда не освобождаемых
// объектов в памяти вкладки.
//
// chooseLabel/changeLabel настраиваемы (по умолчанию — «photo», как у
// Photo) — этот же компонент переиспользует и Banner.jsx для загрузки
// картинки под баннер, где уместнее «image», а не «photo».
export function FileField({ label, value, onChange, onRemove, chooseLabel = 'choose photo', changeLabel = 'change photo' }) {
  const inputRef = useRef(null)
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" className="select-control" onClick={() => inputRef.current?.click()}>
          {value ? changeLabel : chooseLabel}
        </button>
        {onRemove && value && (
          <button type="button" className="select-control" onClick={onRemove}>
            remove
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            if (value && value.startsWith('blob:')) URL.revokeObjectURL(value)
            onChange(URL.createObjectURL(file))
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

// Несколько своих файлов сразу (для смены фото/видео по кругу, см.
// Photo) — value хранит JSON-строку с массивом {url, kind}, а не сам
// массив: схема useControls() строится по ПЕРВОМУ переданному значению
// каждого поля (см. buildLevaSchema ниже) и по нему же определяет тип
// контрола — ни массив, ни массив объектов не входят в опознаваемые Leva
// формы, а обычная строка (как у одиночного FileField) уже проверена и
// работает. `kind` — 'image' или 'video', определяется по MIME-типу
// файла в момент выбора (см. kindFromFile ниже) и решает, как именно
// грузить и проигрывать этот слот дальше — см. useMediaTextureList в
// PhotoBackdrop.jsx: картинка становится обычной THREE.Texture, видео —
// THREE.VideoTexture поверх скрытого <video>, дальше оба участвуют в
// одном и том же цикле показа/перехода совершенно одинаково.
export function parseMediaList(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    // Обратная совместимость со старыми закладками (там список — просто
    // массив blob-URL строк без kind, все они были картинками).
    return parsed.map((item) => (typeof item === 'string' ? { url: item, kind: 'image' } : item))
  } catch {
    return []
  }
}

function kindFromFile(file) {
  return file.type.startsWith('video/') ? 'video' : 'image'
}

// Свой слот на каждый файл (а не один диалог с мульти-выбором, который
// закидывает всё скопом) — так добавление читается как «вот медиа 1, вот
// медиа 2, ...», и любое из них можно отдельно заменить или убрать, не
// трогая остальные. accept="image/*,video/*" — оба типа в одном и том же
// диалоге выбора файла, разные форматы каждого (jpg/png/webp/..., mp4/
// webm/mov/...) поддерживает сам браузер нативно, отдельного списка
// разрешённых расширений здесь нет.
function MediaSlotRow({ index, url, kind, onReplace, onRemove }) {
  const inputRef = useRef(null)
  return (
    <div className="field-row">
      <span className="field-label">{`photo ${index + 1}${kind === 'video' ? ' (video)' : ''}`}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" className="select-control" onClick={() => inputRef.current?.click()}>
          change
        </button>
        <button type="button" className="select-control" onClick={onRemove}>
          remove
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            if (url && url.startsWith('blob:')) URL.revokeObjectURL(url)
            onReplace({ url: URL.createObjectURL(file), kind: kindFromFile(file) })
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

function MediaListField({ label, value, onChange }) {
  const addRef = useRef(null)
  const list = parseMediaList(value)

  function setList(next) {
    onChange(JSON.stringify(next))
  }

  return (
    <div>
      <span className="field-label">{label}</span>
      {list.map((item, i) => (
        <MediaSlotRow
          key={i}
          index={i}
          url={item.url}
          kind={item.kind}
          onReplace={(next) => {
            const nextList = [...list]
            nextList[i] = next
            setList(nextList)
          }}
          onRemove={() => {
            if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url)
            setList(list.filter((_, j) => j !== i))
          }}
        />
      ))}
      <div className="field-row">
        <span className="field-label" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" className="select-control" onClick={() => addRef.current?.click()}>
            + add photo
          </button>
          <input
            ref={addRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setList([...list, { url: URL.createObjectURL(file), kind: kindFromFile(file) }])
              e.target.value = ''
            }}
          />
        </div>
      </div>
    </div>
  )
}

function renderField(field, config, set) {
  const value = config[field.key]
  const onChange = (next) => set({ [field.key]: next })
  if (field.type === 'slider') {
    return <Slider key={field.key} label={field.label} value={value} min={field.min} max={field.max} step={field.step} onChange={onChange} />
  }
  if (field.type === 'color') {
    return <ColorField key={field.key} label={field.label} value={value} onChange={onChange} />
  }
  if (field.type === 'color-count') {
    return <ColorCountField key={field.key} label={field.label} value={value} min={field.min} max={field.max} onChange={onChange} />
  }
  if (field.type === 'friend-version') {
    return <FriendVersionField key={field.key} label={field.label} value={value} onChange={onChange} />
  }
  if (field.type === 'select') {
    return <SelectField key={field.key} label={field.label} value={value} options={field.options} onChange={onChange} />
  }
  if (field.type === 'memory-mode') {
    return <MemoryModeField key={field.key} label={field.label} value={value} onChange={onChange} />
  }
  if (field.type === 'memory-photo') {
    return <SingleMemoryPhotoField key={field.key} label={field.label} value={value} onChange={onChange} />
  }
  if (field.type === 'file') {
    return <FileField key={field.key} label={field.label} value={value} onChange={onChange} />
  }
  if (field.type === 'files') {
    return <MediaListField key={field.key} label={field.label} value={value} onChange={onChange} />
  }
  if (field.type === 'toggle') {
    return <ToggleField key={field.key} label={field.label} value={value} onChange={onChange} />
  }
  return null
}

/** Renders a group's fields, but pairs up consecutive `type: 'color'`
 * fields two-to-a-row instead of stacking every swatch on its own line —
 * a color swatch is small and mostly whitespace at full pill width, so
 * four (or five, for Portal's Colors group) of them in a single column
 * wasted a lot of vertical space for no readability gain. Any other field
 * type still renders one-per-row as before; only runs of colors get the
 * side-by-side treatment. */
function renderFields(fields, config, set) {
  const nodes = []
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    // A run of `bareSwatch` colors (Portal's five, say — see FIELD_GROUPS)
    // renders together as one row of plain, unlabeled swatches: these are
    // colors nobody tunes one at a time by reading a label, they're
    // recognized by the swatch itself, so the label only survives as a
    // hover title rather than visible text taking up a whole extra row
    // each. Regular colors (Figure's colorN, Photo's tints) are NOT
    // bareSwatch and fall through to the cases below unaffected.
    // Группа цветов, порядок которых можно менять. Поля остаются
    // независимыми ключами конфига, «перестановка» — это обмен значениями
    // между соседними ключами: порядок сам по себе нигде не хранится, и
    // ни шейдеры, ни закладки об этой кнопке знать не должны.
    if (field.reorder) {
      const run = [field]
      while (fields[i + run.length]?.reorder === field.reorder) run.push(fields[i + run.length])
      if (field.reorder === 'friendFlowDrag') {
        nodes.push(
          <FriendGradientEditor
            key={run.map((f) => f.key).join('-')}
            fields={run}
            config={config}
            set={set}
          />,
        )
        i += run.length - 1
        continue
      }
      const swap = (a, b) => set({ [run[a].key]: config[run[b].key], [run[b].key]: config[run[a].key] })
      nodes.push(
        <div key={run.map((f) => f.key).join('-')}>
          {run.map((f, index) => (
            <div className="field-row" key={f.key}>
              <span className="field-label">{f.label}</span>
              <div className="color-order-control">
                <div className="color-count-control">
                  <button
                    type="button"
                    className="color-count-button"
                    disabled={index === 0}
                    onClick={() => swap(index, index - 1)}
                    aria-label="Переместить цвет выше"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="color-count-button"
                    disabled={index === run.length - 1}
                    onClick={() => swap(index, index + 1)}
                    aria-label="Переместить цвет ниже"
                  >
                    ↓
                  </button>
                </div>
                <ColorSwatch value={config[f.key]} onChange={(v) => set({ [f.key]: v })} />
              </div>
            </div>
          ))}
        </div>
      )
      i += run.length - 1
      continue
    }
    if (field.type === 'color' && field.bareSwatch) {
      const run = [field]
      while (fields[i + run.length]?.type === 'color' && fields[i + run.length]?.bareSwatch) {
        run.push(fields[i + run.length])
      }
      nodes.push(
        <div className="color-swatch-row" key={run.map((f) => f.key).join('-')}>
          {run.map((f) => (
            <ColorSwatch key={f.key} value={config[f.key]} title={f.label} onChange={(v) => set({ [f.key]: v })} />
          ))}
        </div>
      )
      i += run.length - 1
      continue
    }
    // A color immediately followed by its own share slider (Figure's
    // colorN/colorNWeight pairs) — a bare swatch on the left, its
    // slider filling the rest of the row on the right, one compact row
    // per color instead of two stacked ones.
    const next = fields[i + 1]
    if (field.type === 'color' && next?.type === 'slider') {
      nodes.push(
        <div className="color-share-row" key={`${field.key}-${next.key}`}>
          <ColorSwatch value={config[field.key]} onChange={(v) => set({ [field.key]: v })} />
          {renderField(next, config, set)}
        </div>
      )
      i += 1
      continue
    }
    // Everything else, including plain (non-bareSwatch) colors with no
    // paired slider — like Photo's crystal/distortion tint — one labeled
    // field-row each, stacked, same as any other field type.
    nodes.push(renderField(field, config, set))
  }
  return nodes
}

/** Панель настроек: вкладки материала и вкладки разделов внутри неё.
 * Закладки (Bookmarks) больше не её часть — та плавает отдельно, сверху
 * по центру экрана (см. App.jsx), у неё свой список сохранённых видов.
 * `config`/`set` — из useControls (только настраиваемые поля, без
 * «материала» — переключение вкладок живёт своим стейтом в App.jsx).
 *
 * Разделы (Main/Colors/Edges/Light/Shatter и т.п.) — горизонтальная
 * строка вкладок под вкладками материала, открыт всегда ровно один
 * раздел. «Main»
 * (основные настройки — форма, толщина, преломление и т.п.) — такая же
 * вкладка, как остальные, всегда первая; была пробована версия, где Main
 * рендерился всегда открытым БЕЗ вкладки — вернули как было: с ней высота
 * панели переставала быть предсказуемой (Main у некоторых материалов сам
 * по себе длинный), а вкладки все внизу под одной строкой — понятнее, чем
 * смесь «половина всегда видна, половина по клику». */
export default function ControlPanel({
  config,
  set,
  material,
  onMaterialChange,
  // Сборка, где тип кристалла всего один (FRIEND-lab), прячет переключатель
  // материалов: выбирать не из чего, а строка вкладок только занимает место
  // и обещает варианты, которых нет. По умолчанию включён — полный редактор
  // ведёт себя как раньше.
  showMaterialTabs = true,
  // Своя строка вкладок на месте материалов — FRIEND-lab ставит туда выбор
  // версии Friend, чтобы каждая версия настраивалась отдельно и её разделы
  // (main / colors / glass …) лежали ВНУТРИ неё.
  topTabs = null,
  // Набор групп полей можно сузить снаружи: тот же FRIEND-lab убирает из
  // него поле выбора версии, потому что оно переехало наверх.
  groups = FIELD_GROUPS,
}) {
  // Most field.visible checks only need the leva config (e.g. "only when
  // explode > 0"); a few — like which rotation-speed field to show —
  // depend on the active material tab too, which isn't itself a leva
  // field (see the doc comment above), so it's passed alongside as a
  // second argument instead of being folded into config. A group with
  // every field hidden this way is dropped from the tab strip entirely —
  // an empty tab that opens onto nothing would be a dead end.
  const visibleGroups = groups.filter((g) => {
    if (g.tab) {
      const tabOk = Array.isArray(g.tab) ? g.tab.includes(material) : g.tab === material
      if (!tabOk) return false
    }
    // Групповой visible — как у полей, но зависит не от вкладки
    // материала, а от прочих настроек (например, формы кристалла).
    if (g.visible && !g.visible(config)) return false
    return true
  }).map((g) => ({ ...g, fields: g.fields.filter((f) => !f.visible || f.visible(config, material)) }))
    .filter((g) => g.fields.length > 0)

  const [activeSection, setActiveSection] = useState(() => visibleGroups[0]?.name)

  const visibleNames = visibleGroups.map((g) => g.name).join('|')
  useEffect(() => {
    // The set of tabs changes under the user's feet whenever the material
    // swaps which groups apply — snap back to the first tab instead of
    // pointing at one that no longer exists, which would render an empty
    // body.
    if (!visibleGroups.some((g) => g.name === activeSection)) {
      setActiveSection(visibleGroups[0]?.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNames])

  const activeGroup = visibleGroups.find((g) => g.name === activeSection) ?? visibleGroups[0]

  return (
    <div className="control-panel">
      {showMaterialTabs && <MaterialTabs value={material} onChange={onMaterialChange} />}
      {topTabs}
      {visibleGroups.length > 1 && (
        <SectionTabs groups={visibleGroups} value={activeGroup?.name} onChange={setActiveSection} />
      )}
      <div className="control-panel-body">
        {activeGroup && (
          <div className="section-body">
            {renderFields(activeGroup.fields, config, set)}
          </div>
        )}
      </div>
    </div>
  )
}
