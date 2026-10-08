# 42AI Website Prototype v2

Актуальная многоэкранная версия прототипа сайта. Снимок включает последние правки блоков 2 и 3 от 6 октября 2026 года.

## Запуск

Требуется Node.js 20 или новее.

```bash
npm install
npm run dev
```

Vite покажет локальный адрес. Приложение автоматически открывает полный прототип по маршруту `/hero-test`.

## Сборка

```bash
npm run build
npm run preview
```

## Структура страницы

- `src/components/HeroScene/` — первый экран.
- `src/components/Block24Section/` — блок 2.
- `src/components/WorldModelSection/` — блок 3.
- `src/components/PhysicsBehaviorSection/` — блок 4.
- `src/components/PageTail/` и соседние папки — остальные секции и футер.
- `src/crystal/` — версия FRIEND-кристалла, адаптированная для страницы.
- `assets/` — изображения, импортируемые исходным кодом.
- `public/` — шрифты и статические ассеты.

Первая версия прототипа сохранена отдельно в `../old/prototype/`.

