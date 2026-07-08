import { useEffect, useRef, useState } from 'react'
import { HERO_VIDEOS } from '../../data/heroVideos'
import styles from './HeroBackgroundVideo.module.css'

export function HeroBackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [index, setIndex] = useState(0)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    video.load()

    const play = () => {
      video.play().catch(() => {
        setIsReady(false)
      })
    }

    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      play()
    } else {
      video.addEventListener('canplay', play, { once: true })
    }

    return () => {
      video.removeEventListener('canplay', play)
    }
  }, [index])

  return (
    <video
      ref={videoRef}
      className={isReady ? styles.video : styles.videoHidden}
      src={HERO_VIDEOS[index]}
      muted
      playsInline
      autoPlay
      preload="auto"
      aria-hidden="true"
      onPlaying={() => setIsReady(true)}
      onEnded={() => setIndex((current) => (current + 1) % HERO_VIDEOS.length)}
      onError={() => setIndex((current) => (current + 1) % HERO_VIDEOS.length)}
    />
  )
}
