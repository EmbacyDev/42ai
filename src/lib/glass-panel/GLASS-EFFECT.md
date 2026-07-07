# Glass effect

Стеклянный эффект с рефракцией по краю, перенесён из проекта Redgevity.

Два варианта:

| Вариант | Файлы | Когда использовать |
|---------|-------|-------------------|
| **DOM-панели** | `glass-panel.js` + `glass-panel.css` | Обычные HTML/React-блоки поверх фона |
| **Canvas** | `glass-canvas.js` | Рисование стекла на `<canvas>` |

---

## Быстрый старт (React / Vite)

### 1. Подключить CSS один раз

В `src/main.tsx`:

```ts
import './lib/glass-panel/glass-panel.css'
```

### 2. Разметка панели

```tsx
<div
  data-glass-panel
  data-glass-blur="2px"
  data-glass-distortion="55"
  data-glass-bezel="0.19"
  data-glass-saturation="1.3"
  style={{ width: 120, height: 120, borderRadius: 36 }}
>
  Контент
</div>
```

### 3. Инициализация после монтирования

React рендерит DOM позже загрузки скрипта, поэтому нужен явный вызов.

**Вариант A — хук `useGlassPanel`:**

```tsx
import { useGlassPanel } from './lib/glass-panel/useGlassPanel'

function Card() {
  const glassRef = useGlassPanel<HTMLDivElement>()

  return (
    <div
      ref={glassRef}
      data-glass-panel
      data-glass-distortion="55"
      style={{ width: 120, height: 120, borderRadius: 36 }}
    />
  )
}
```

**Вариант B — `useEffect` вручную:**

```tsx
import { useEffect, useRef } from 'react'
import { GlassPanel } from './lib/glass-panel/glass-panel.js'

function Card() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    GlassPanel.initPanel(ref.current)
    GlassPanel.refreshPanel(ref.current)
  }, [])

  return <div ref={ref} data-glass-panel data-glass-distortion="55" />
}
```

**Вариант C — инициализировать все панели на странице:**

```ts
import { GlassPanel } from './lib/glass-panel/glass-panel.js'

// после рендера React
GlassPanel.init()
```

---

## Параметры (`data-*` атрибуты)

| Атрибут | По умолчанию | Описание |
|---------|--------------|----------|
| `data-glass-blur` | `2px` | Размытие фона за панелью |
| `data-glass-distortion` | `55` | Сила рефракции по краю |
| `data-glass-bezel` | `0.19` | Ширина «линзы» (доля от меньшей стороны) |
| `data-glass-saturation` | `1.3` | Насыщенность бэкдропа |
| `data-glass-burn` | `0` | Затемнение теней (0 = выкл.) |
| `data-glass-specular` | `0` | Интенсивность блика |
| `data-glass-warmth` | `0` | Тёплый оттенок |
| `data-glass-fill-top` | `0` | Белая заливка сверху (0–1) |
| `data-glass-fill-bottom` | `0` | Белая заливка снизу (0–1) |
| `data-glass-edge` | `0` | Подсветка верхнего края |
| `data-glass-shadow` | `0` | Внешняя тень |
| `data-glass-map-size` | `320` | Макс. размер карты рефракции (px) |

`border-radius` берётся из CSS элемента.

---

## API (`GlassPanel`)

```ts
import { GlassPanel } from './lib/glass-panel/glass-panel.js'

// Найти и инициализировать все [data-glass-panel] внутри root
GlassPanel.init(document)

// Одна панель
GlassPanel.initPanel(element)
GlassPanel.refreshPanel(element)

// После resize или смены data-* параметров
GlassPanel.refreshAll()

// Отладка: data URL PNG-карты рефракции
GlassPanel.inspectPanelMap(element)
```

Глобально также доступно как `window.GlassPanel`.

---

## Важные условия

1. **За панелью должен быть видимый фон** — эффект работает через `backdrop-filter`.
2. **Браузер:** Chrome / Safari с поддержкой `backdrop-filter: url(#filter)`. Если нет — ставится `data-glass-fallback="true"` (упрощённый стеклянный вид без рефракции).
3. **Порядок фильтров в CSS важен:** сначала SVG-рефракция, потом `saturate`, потом `blur`. Не менять порядок в `glass-panel.css`.
4. **Resize:** скрипт сам слушает `resize` и пересчитывает карты. Для динамического изменения размеров в React вызывай `GlassPanel.refreshPanel(el)` после layout.

---

## Canvas-вариант

Для сцен на `<canvas>`, где `backdrop-filter` недоступен.

```ts
import './lib/glass-panel/glass-canvas.js'

const canvas = document.querySelector('#scene') as HTMLCanvasElement
const renderer = window.GlassCanvas!.createRenderer(canvas, {
  background(ctx, width, height) {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, width, height)
  },
  panels: [
    {
      shape: window.GlassCanvas!.roundedRect(100, 100, 120, 120, 36),
      blur: 24,
      distortion: 20,
    },
  ],
})

renderer.resize(920, 920).render()
```

Полный пример — в оригинальном `glass-canvas-demo.html` (Redgevity Master).

---

## Структура файлов

```
src/lib/glass-panel/
├── glass-panel.js      # основной скрипт (DOM)
├── glass-panel.css     # стили .glass-panel
├── glass-panel.d.ts    # типы для TypeScript
├── useGlassPanel.ts    # React-хук
├── glass-canvas.js     # canvas-рендерер (опционально)
└── GLASS-EFFECT.md     # эта документация
```

---

## Рекомендуемые стартовые значения (как в Redgevity)

Минимальная рефракция без лишних бликов:

```html
data-glass-blur="2px"
data-glass-distortion="55"
data-glass-bezel="0.19"
data-glass-saturation="1.3"
data-glass-burn="0"
data-glass-specular="0"
data-glass-warmth="0"
data-glass-fill-top="0"
data-glass-fill-bottom="0"
data-glass-edge="0"
data-glass-shadow="0"
```

Для более «живого» стекла попробуй поднять `data-glass-specular`, `data-glass-warmth`, `data-glass-fill-top`.

---

## TODO (для продолжения в 42ai)

- [ ] Подключить `glass-panel.css` в `main.tsx`
- [ ] Выбрать секции/компоненты, где нужно стекло
- [ ] Подобрать цвета теней/бликов под палитру 42AI (сейчас — тёплые оттенки Redgevity)
- [ ] При необходимости обернуть в `<GlassPanel>` React-компонент
