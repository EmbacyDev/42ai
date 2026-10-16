# Block 6

Шестой экран прототипа `V5 Final Tuning`: «Universal solution for human and agentic behaviour».

Это материалы для вставки в основной лендинг, не отдельный проект. Секции выше и ниже этого блока сюда не входят. Исходные файлы в `V5 Final Tuning` не изменялись.

## Содержимое

- `components/SolutionsSection/` — секция, вкладки, список, кнопка Show more, сцена иконок и их стили.
- `icons/` — шесть PNG: Banks, Hedge Funds, Brokers, Physical AI, Foundational AI, Treasury. Размеры, оптический центр, контактная тень и сила света заданы в `SOLUTIONS` внутри `SolutionsSection.jsx`.
- `components/AnimatedHeading.jsx`, `appearText.js` — появление заголовка и строк.
- `components/RequestDemoButton/`, `components/Scramble/` — форма кнопки Show more, морф при наведении и побуквенный hover. Тот же морф используется индикатором активной вкладки.
- `styles/fonts.css`, `fonts/` — Public Sans, 42dot Sans и Geist Mono.
- `styles/landing-context.css` — правила страницы, которые в прототипе лежат вне секции и меняют её вид: `border-box`, масштаб вкладок `--site-type-scale`, кнопка Show more (Public Sans 15px, scale 1.05) и `line-height: 1.1` у заголовка на десктопе.

`SolutionsSection.jsx` в этой папке совпадает с прототипом и дополнительно подключает `fonts.css` и `landing-context.css`, чтобы порядок стилей остался тем же.

## Интеграция

Нужны React и `gsap` (в прототипе `gsap` ^3.12.7). Плагины GSAP не используются. Сборщик должен понимать импорт CSS и PNG из JSX, включая суффикс `?v=20261016` у иконок — это cache-bust Vite. Если сборщик его не принимает, суффикс можно убрать: файлы те же.

Сохраните взаимное расположение `components/` и `icons/`. Секция импортирует иконки как `../../icons/...`.

```jsx
import SolutionsSection from './Block 6/components/SolutionsSection/SolutionsSection.jsx'

<SolutionsSection />
```

Секция сама показывает заголовок, вкладки, иконку и список при обычной прокрутке вниз. Повторный вход сверху запускает появление заново. Прокрутка вверх уже видимый текст не сбрасывает.

Кинематографический прилёт из пятого экрана делает предыдущая секция, не этот блок. Она добавляет классы `solutions-section--approaching` и `solutions-section--copy-waiting`, выставляет `--approach-scale`, `--approach-opacity` и `--approach-radius`, затем шлёт событие `42ai-solutions-forward-entry`. Стили этого состояния уже в `solutionsSection.css`.
