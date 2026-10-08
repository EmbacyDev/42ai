import { Environment, Lightformer } from '@react-three/drei'

/**
 * Всё цветное свечение на стекле приходит отсюда, а не из материала.
 * Это виртуальная студия: цветные софтбоксы, расставленные вокруг объекта.
 * Они попадают только в отражения — фон страницы остаётся белым.
 *
 * Ключевой принцип предметной съёмки: форму рисует не свет, а ЧЕРЕДОВАНИЕ
 * света и тьмы. Тёмные карты (чёрные прямоугольники) обязательны — без них
 * объект получается плоским молочным пятном без рёбер.
 */
/**
 * Цветные софтбоксы спроектированы для перламутровых «стекла» и «плёнки» —
 * тёплый/холодный/розовый/лиловый оттенки дают тот самый перелив. Для
 * «фото» это лишний цветной шум, который спорит с самим портретом и
 * читается как радужная плёнка поверх него. В нейтральном режиме те же
 * софтбоксы (тот же свет/тень, та же форма) перекрашены в градации
 * серого — рисунок светотени остаётся, цветной наводки не остаётся.
 */
function tint(neutral, color, gray) {
  return neutral ? gray : color
}

export default function Studio({ intensity = 1, neutral = false, children }) {
  return (
    <Environment resolution={512}>
      {/* White, not mid-grey: the page crystal samples this room in its
          fresnel, and a grey room drew a grey stroke around the silhouette. */}
      <color attach="background" args={['#ffffff']} />

      {/* ТЁМНЫЕ КАРТЫ. Рисуют глубокие грани и контраст между фасками.
          Именно их не хватало: без тьмы в окружении стекло не имеет формы. */}
      <Lightformer
        form="rect"
        intensity={0}
        color="#000000"
        position={[-4.5, 0, 1]}
        scale={[5, 14, 1]}
        target={[0, 0, 0]}
      />
      <Lightformer
        form="rect"
        intensity={0}
        color="#000000"
        position={[4.5, 0, 1]}
        scale={[5, 14, 1]}
        target={[0, 0, 0]}
      />
      <Lightformer
        form="rect"
        intensity={0}
        color="#000000"
        position={[0, -2.5, 4.5]}
        scale={[10, 4, 1]}
        target={[0, 0, 0]}
      />
      <Lightformer
        form="rect"
        intensity={0}
        color="#000000"
        position={[0, 3.5, 4.5]}
        scale={[10, 3, 1]}
        target={[0, 0, 0]}
      />

      {/* КЛЮЧЕВОЙ свет: узкая яркая полоса сверху-слева.
          Узкая, а не широкая — широкая заливает всё и убивает контраст. */}
      <Lightformer
        form="rect"
        intensity={7 * intensity}
        color={tint(neutral, "#fff6ec", "#ffffff")}
        position={[-2.5, 5, 2]}
        scale={[2.2, 8, 1]}
        target={[0, 0, 0]}
      />

      {/* ТЁПЛАЯ доминанта: янтарь справа-снизу. Сильнее холодной —
          нейтральный баланс тепла и холода даёт серую кашу. */}
      <Lightformer
        form="rect"
        intensity={5.5 * intensity}
        color={tint(neutral, "#ffb066", "#e6e6e6")}
        position={[4.5, -2, 2.5]}
        scale={[2.5, 6, 1]}
        target={[0, 0, 0]}
      />
      <Lightformer
        form="circle"
        intensity={4 * intensity}
        color={tint(neutral, "#ff7ea8", "#dcdcdc")}
        position={[3.2, 2.8, -2.5]}
        scale={[2.2, 2.2, 1]}
        target={[0, 0, 0]}
      />

      {/* ХОЛОДНЫЙ акцент: один, узкий, контровой слева-сзади.
          Даёт спектральную кромку по рёбрам на тёплом фоне. */}
      <Lightformer
        form="rect"
        intensity={6 * intensity}
        color={tint(neutral, "#5cc8ff", "#d4d4d4")}
        position={[-4.5, 0.5, -3]}
        scale={[1.6, 7, 1]}
        target={[0, 0, 0]}
      />
      <Lightformer
        form="circle"
        intensity={3.5 * intensity}
        color={tint(neutral, "#9b7dff", "#cccccc")}
        position={[-2.5, -3.5, -2]}
        scale={[2, 2, 1]}
        target={[0, 0, 0]}
      />

      {/* Контровой сзади — светлая кромка по силуэту */}
      <Lightformer
        form="rect"
        intensity={5 * intensity}
        color="#ffffff"
        position={[0, 0.5, -7]}
        scale={[4, 4, 1]}
        target={[0, 0, 0]}
      />

      {/* Мягкое отражение снизу, имитирует светлый стол */}
      <Lightformer
        form="rect"
        intensity={1.6 * intensity}
        color={tint(neutral, "#e8ecff", "#e2e2e2")}
        position={[0, -5.5, 0]}
        scale={[9, 9, 1]}
        target={[0, 0, 0]}
      />

      {children}
    </Environment>
  )
}
