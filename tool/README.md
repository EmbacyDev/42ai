# 42AI FRIEND Tool

Последняя версия интерактивной тулы для настройки FRIEND-кристалла. Именно эта ветка использовалась при переносе кристалла в прототип сайта.

## Запуск

Требуется Node.js 20 или новее.

```bash
npm install
npm run dev
```

По умолчанию Vite запускается на `http://localhost:5174`.

## Сборка

```bash
npm run build
npm run preview
```

## Основные файлы

- `src/FriendLab.jsx` — сцена тулы и готовые варианты FRIEND-кристалла.
- `src/Glass.jsx` — геометрия и материалы кристалла.
- `src/Panel.jsx` — панель настроек.
- `src/ColorCore.jsx` — цветное ядро.
- `src/PhotoBackdrop.jsx` — фото и фон внутри материала.
- `src/Studio.jsx` — свет сцены.

