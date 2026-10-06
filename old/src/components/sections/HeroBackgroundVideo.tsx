import { useCallback, useEffect, useRef, useState } from 'react'
import { HERO_VIDEOS } from '../../data/heroVideos'
import styles from './HeroBackgroundVideo.module.css'

type VideoSlot = 'primary' | 'secondary'

function nextIndex(index: number) {
  return (index + 1) % HERO_VIDEOS.length
}

function waitForCanPlay(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    video.addEventListener('canplay', () => resolve(), { once: true })
  })
}

function waitForPlaying(video: HTMLVideoElement) {
  if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    video.addEventListener('playing', () => resolve(), { once: true })
  })
}

export function HeroBackgroundVideo() {
  const primaryRef = useRef<HTMLVideoElement>(null)
  const secondaryRef = useRef<HTMLVideoElement>(null)
  const currentIndexRef = useRef(0)
  const [activeSlot, setActiveSlot] = useState<VideoSlot>('primary')
  const [hasStarted, setHasStarted] = useState(false)

  const preload = useCallback((video: HTMLVideoElement, index: number) => {
    const src = HERO_VIDEOS[index]
    if (video.getAttribute('src') !== src) {
      video.src = src
      video.load()
    }
  }, [])

  const playFromStart = useCallback(async (video: HTMLVideoElement) => {
    await waitForCanPlay(video)
    video.currentTime = 0
    await video.play()
    await waitForPlaying(video)
    setHasStarted(true)
  }, [])

  const swapToStandby = useCallback(
    async (endedSlot: VideoSlot) => {
      const standbySlot: VideoSlot = endedSlot === 'primary' ? 'secondary' : 'primary'
      const standbyVideo =
        standbySlot === 'primary' ? primaryRef.current : secondaryRef.current
      const preloadVideo =
        endedSlot === 'primary' ? primaryRef.current : secondaryRef.current

      if (!standbyVideo || !preloadVideo) {
        return
      }

      currentIndexRef.current = nextIndex(currentIndexRef.current)
      const upcomingIndex = nextIndex(currentIndexRef.current)

      try {
        await playFromStart(standbyVideo)
        setActiveSlot(standbySlot)
        preload(preloadVideo, upcomingIndex)
      } catch {
        preload(standbyVideo, nextIndex(currentIndexRef.current))
      }
    },
    [playFromStart, preload],
  )

  useEffect(() => {
    const primary = primaryRef.current
    const secondary = secondaryRef.current

    if (!primary || !secondary) {
      return
    }

    let cancelled = false

    const start = async () => {
      preload(secondary, nextIndex(0))

      try {
        primary.src = HERO_VIDEOS[0]
        primary.load()
        if (!cancelled) {
          await playFromStart(primary)
          setActiveSlot('primary')
        }
      } catch {
        if (!cancelled) {
          preload(primary, nextIndex(0))
        }
      }
    }

    void start()

    return () => {
      cancelled = true
    }
  }, [playFromStart, preload])

  const videoClassName = (slot: VideoSlot) => {
    if (!hasStarted) {
      return styles.videoHidden
    }

    return slot === activeSlot ? styles.video : styles.videoHidden
  }

  return (
    <>
      <video
        ref={primaryRef}
        className={videoClassName('primary')}
        muted
        playsInline
        autoPlay
        preload="auto"
        aria-hidden="true"
        onEnded={() => void swapToStandby('primary')}
      />
      <video
        ref={secondaryRef}
        className={videoClassName('secondary')}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        onEnded={() => void swapToStandby('secondary')}
      />
    </>
  )
}
