import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HeroScene from '../components/HeroScene'
import SiteHeader from '../components/SiteHeader'
import Block24Section from '../components/Block24Section'
import GlassCardCarousel from '../carousel/GlassCardCarousel.jsx'
import WorldModelSection from '../components/WorldModelSection'
import PhysicsBehaviorSection from '../components/PhysicsBehaviorSection'
import PageTail from '../components/PageTail/PageTail.jsx'
import PageCrystal from '../crystal/PageCrystal.jsx'
import { DEFAULT_CRYSTAL_CONFIG } from '../crystal/defaultCrystalConfig.js'
import { resolveHeroBackgroundColor } from '../components/HeroScene/heroBackground.js'
import { MIN_LOADER_MS, markLogoIntroSeen } from '../components/HeroScene/loaderTiming.js'
import './figmaRefresh.css'

export default function HeroTestPage() {
  const [heroAssetsLoaded, setHeroAssetsReady] = useState(false)
  // v4: the loading screen stays up for one pass of the logo animation
  // (all three faces, see LogoMotionMark.jsx), even when the assets are
  // already in — then the site starts.
  const [minLoaderDone, setMinLoaderDone] = useState(MIN_LOADER_MS <= 0)
  useEffect(() => {
    if (MIN_LOADER_MS <= 0) return undefined
    const id = setTimeout(() => {
      setMinLoaderDone(true)
      markLogoIntroSeen()
    }, MIN_LOADER_MS)
    return () => clearTimeout(id)
  }, [])
  const heroAssetsReady = heroAssetsLoaded && minLoaderDone
  const [crystalReady, setCrystalReady] = useState(false)
  const [heroReady, setHeroReady] = useState(false)
  const [crystalPulseKey, setCrystalPulseKey] = useState(0)
  // Shared at frame rate without React renders: the vanilla Three hero
  // writes the currently hovered portrait and the page-level R3F crystal
  // reads it to turn and aim its light toward that card.
  const heroCardHoverRef = useRef({ active: false, x: 0, y: 0 })
  const handleHeroReady = useCallback(() => setHeroReady(true), [])
  const handleHeroAssetsReady = useCallback(() => setHeroAssetsReady(true), [])
  const handleCrystalReady = useCallback(() => setCrystalReady(true), [])
  const handleCrystalPulse = useCallback(() => {
    setCrystalPulseKey((current) => current + 1)
  }, [])

  // The hero and following section share the page's built-in crystal
  // settings, including its background. No editor or URL payload is read.
  const tunedCrystalConfig = DEFAULT_CRYSTAL_CONFIG
  const heroBackgroundColor = useMemo(
    () => resolveHeroBackgroundColor(tunedCrystalConfig),
    [tunedCrystalConfig],
  )

  // Where the carousel's active card wants the crystal to land, in
  // viewport pixels — written every carousel frame (GlassCardCarousel.jsx,
  // via Carousel.js's onLayout) and read every PageCrystal frame. A ref,
  // not React state: this updates far too often (~60fps, tied to scroll
  // and to the carousel's own idle motion) for that.
  const sectionAnchorsRef = useRef({ second: null, third: null, fourth: null })
  return (
    <>
      <SiteHeader ready={heroAssetsReady && crystalReady} />
      <HeroScene
        onAssetsReady={handleHeroAssetsReady}
        onReady={handleHeroReady}
        revealReady={crystalReady && minLoaderDone}
        tunedCrystalConfig={tunedCrystalConfig}
        cardHoverRef={heroCardHoverRef}
      />
      <Block24Section
        backgroundColor={heroBackgroundColor}
        // v4: block two's photos and rail textures start loading as soon as
        // the hero's own photos are in (the loading screen is up until then),
        // not after the hero's whole intro. On a first visit the reader could
        // reach block two before that, and the late textures re-rendered the
        // rail (a jolt) and then swapped the centre photo in (a blink).
        heroReady={heroReady || heroAssetsReady}
        onCrystalPulse={handleCrystalPulse}
        onCrystalAnchor={(x, y, meta) => {
          sectionAnchorsRef.current.second = { x, y, ...meta }
        }}
      />
      <WorldModelSection
        onCrystalAnchor={(x, y, meta) => {
          sectionAnchorsRef.current.third = { x, y, ...meta }
        }}
      />
      <PhysicsBehaviorSection
        onCrystalAnchor={(x, y, meta) => {
          sectionAnchorsRef.current.fourth = { x, y, ...meta }
        }}
      />
      <PageTail />
      {/* Hidden for now — still on the old placeholder card set (see
          src/carousel/cards.js), not yet updated to match the rest of the
          page. Re-enable once its cards are redone. */}
      {false && (
        <GlassCardCarousel
          backgroundColor={heroBackgroundColor}
          onCrystalAnchor={(x, y, meta) => {
            sectionAnchorsRef.current.fourth = { x, y, ...meta }
          }}
        />
      )}
      {/* The page's own crystal. Its look is the baked tab 01 material;
          nothing on the URL can swap it. */}
      <PageCrystal
        config={tunedCrystalConfig}
        introReady={heroAssetsReady && crystalReady}
        sectionAnchorsRef={sectionAnchorsRef}
        pulseKey={crystalPulseKey}
        cardHoverRef={heroCardHoverRef}
        onReady={handleCrystalReady}
      />
    </>
  )
}
