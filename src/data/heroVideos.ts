const HERO_VIDEO_DIR = '/assets/videos/hero'

const HERO_VIDEO_FILES = [
  '1-1.mp4',
  '1-2.mp4',
  '1-3.mp4',
  '2-1.mp4',
  '2-2.mp4',
  '2-3.mp4',
  '4-1.mp4',
  '4-2.mp4',
  '4-3.mp4',
] as const

export const HERO_VIDEOS = HERO_VIDEO_FILES.map((file) => `${HERO_VIDEO_DIR}/${file}`)
