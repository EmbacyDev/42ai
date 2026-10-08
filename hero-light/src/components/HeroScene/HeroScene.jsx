import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import HeroContent from './HeroContent.jsx'
import HeroLabels from './HeroLabels.jsx'
import HeroLoadingOverlay from './HeroLoadingOverlay.jsx'
import { portraits as defaultPortraits } from './portraits.js'
import { labels as defaultLabels } from './labels.js'
import { mountHeroScene } from './mountHeroScene.js'
import { layoutHeroCopy } from './heroCopyLayout.js'
import { createHeroTransition } from './heroTransition.js'
import { fadeProgress, backgroundWashProgress } from './scrollShrink.js'
import { DEFAULT_CRYSTAL_CONFIG } from '../../crystal/defaultCrystalConfig.js'
import './heroScene.css'

export default function HeroScene({
  minHeight = '100vh',
  portraits = defaultPortraits,
  labels = defaultLabels,
  // Optional: lets a page that also renders page furniture outside this
  // section (SiteHeader, in HeroTestPage.jsx) sync that furniture's own
  // entrance to the same reveal, without HeroScene needing to know that
  // furniture exists. Defaults to a no-op so this stays a section you can
  // drop in on its own.
  onReady = () => {},
  onAssetsReady = () => {},
  revealReady = true,
  // The prototype's own crystal (tab 01, baked in defaultCrystalConfig).
  // Passed in when the page also needs the same object for the background.
  tunedCrystalConfig: tunedCrystalConfigProp,
  cardHoverRef,
}) {
  const rootRef = useRef(null)
  const canvasRef = useRef(null)

  const tunedCrystalConfig = tunedCrystalConfigProp ?? DEFAULT_CRYSTAL_CONFIG

  // Loading screen: only the crystal (always instant, see mountHeroScene's
  // onProgress/onReady comment) shows at first, with this progress bar
  // underneath it. `ready` flips once, the moment the photos have all
  // settled, and drives both this bar's own fade-out and — via the
  // `hero-scene--ready` class below — the CSS transition that slides in
  // the headline (opacity is handled separately, see updateContentOpacity
  // below — it has the scroll transition to combine with too). The
  // photos' own matching entrance (fade + drop-in) is driven straight off
  // the same signal inside mountHeroScene, not from React state, since
  // those are Three.js meshes.
  const [progress, setProgress] = useState(0)
  // Assets being ready and the whole hero being ready are deliberately
  // different moments. The loading sheet leaves first, revealing only the
  // crystal. The portrait spiral plays next, and copy/navigation are
  // released only after the last portrait has settled.
  const [assetsReady, setAssetsReady] = useState(false)
  const [ready, setReady] = useState(false)

  // A ref, not a dependency: the caller's onReady is commonly an inline
  // arrow (see HeroTestPage.jsx), a fresh function every render — putting
  // it in the effect's dependency array would remount the whole Three.js
  // scene on every parent re-render instead of once.
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const onAssetsReadyRef = useRef(onAssetsReady)
  onAssetsReadyRef.current = onAssetsReady
  const revealReadyRef = useRef(revealReady)
  revealReadyRef.current = revealReady

  // Drives the vanilla placeholder crystal's shrink (mountHeroScene.js) —
  // a stable function prop rather than the value itself, since the
  // render loop reads it fresh every frame. PageCrystal.jsx (the single,
  // page-level crystal used when a tuned config is active — see
  // HeroTestPage.jsx) reads scroll position directly instead; it has to,
  // since it moves beyond this section's own bounds and this pin's
  // progress is only ever meaningful within them.
  const transitionRef = useRef(null)
  const getTransitionProgress = useRef(() => transitionRef.current?.progress.current ?? 0).current

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const contentEl = root.querySelector('.hero-content')
    const apply = () => layoutHeroCopy(contentEl, root.clientWidth, root.clientHeight)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return undefined

    const contentEl = root.querySelector('.hero-content')
    // The title is deliberately visible during loading, so the wrapper is
    // controlled only by the scroll exit. The supporting copy and CTA still
    // use the CSS ready-state reveal below.
    function updateContentOpacity(transitionProgress) {
      root.style.setProperty('--hero-wash', backgroundWashProgress(transitionProgress).toFixed(4))
      if (!contentEl) return
      // fadeProgress, not raw transitionProgress: the headline/CTA fade
      // out in lockstep with the cards (scrollShrink.js), finishing well
      // before the crystal starts descending — not gradually across the
      // whole scroll.
      const fade = fadeProgress(transitionProgress)
      contentEl.style.opacity = String(1 - fade)
      const gone = transitionProgress >= 0.99
      root.style.opacity = gone ? '0' : '1'
      root.style.visibility = gone ? 'hidden' : 'visible'
      root.style.pointerEvents = gone ? 'none' : ''
      canvas.style.display = gone ? 'none' : ''
    }

    const transition = createHeroTransition({
      heroEl: root,
      onProgress: updateContentOpacity,
    })
    transitionRef.current = transition
    // Not guaranteed to fire before the first paint on its own (that
    // depends on ScrollTrigger's own setup timing), so seed it directly.
    updateContentOpacity(transition.progress.current)

    const stopScene = mountHeroScene({
      canvas,
      element: root,
      portraits,
      labels,
      skipCrystal: Boolean(tunedCrystalConfig),
      crystalConfig: tunedCrystalConfig,
      onProgress: setProgress,
      onAssetsReady: () => {
        setAssetsReady(true)
        onAssetsReadyRef.current()
      },
      onReady: () => {
        setReady(true)
        updateContentOpacity(transition.progress.current)
        onReadyRef.current()
      },
      canReveal: () => revealReadyRef.current,
      getTransitionProgress: () => transition.progress.current,
      cardHoverRef,
    })
    return () => {
      stopScene()
      transition.dispose()
      transitionRef.current = null
    }
  }, [portraits, labels, tunedCrystalConfig])

  return (
    <section
      ref={rootRef}
      className={`hero-scene${ready ? ' hero-scene--ready' : ''}`}
      style={{ minHeight }}
      aria-label="Hero"
    >
      <canvas ref={canvasRef} className="hero-scene__canvas" />
      {false && <HeroLabels labels={labels} />}
      <HeroContent />
      <HeroLoadingOverlay progress={progress} hidden={assetsReady && revealReady} />
    </section>
  )
}
