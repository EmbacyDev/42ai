export const clamp01 = value => Math.max(0, Math.min(1, value))
export const smooth = value => { const t=clamp01(value); return t*t*t*(t*(t*6-15)+10) }
export const range = (value,start,end) => smooth((value-start)/(end-start))
// More distance for the glass-to-particle handoff; all poses stay reversible.
export const CHAPTER_STOPS = [0, 1, 2, 3, 4, 5.65, 6.65, 7.65]
export const CHAPTER_SCROLL_SPAN = CHAPTER_STOPS.at(-1) + .4
export const chapterPosition = step => CHAPTER_STOPS[Math.max(0, Math.min(7, step))]

export function chapterValue(distance) {
  if (distance <= 0) return 0
  for (let chapter = 0; chapter < 7; chapter++) {
    const start = CHAPTER_STOPS[chapter], end = CHAPTER_STOPS[chapter + 1]
    if (distance < end) return chapter + range((distance - start) / (end - start), .32, 1)
  }
  return 7
}

// One passive page listener, one scheduled update for a burst of scroll events.
// No synthetic inertia, cancellation of input, scroll writes or perpetual ticker.
const subscribers = new Set()
let frame=0
const flush=()=>{frame=0;for(const callback of subscribers)callback()}
const schedule=()=>{if(!frame)frame=requestAnimationFrame(flush)}
export function observeNativeScroll(callback, elements=[]) {
  if(!subscribers.size) {
    window.addEventListener('scroll',schedule,{passive:true})
    window.addEventListener('resize',schedule,{passive:true})
    window.addEventListener('pageshow',schedule,{passive:true})
  }
  subscribers.add(callback)
  const resize=new ResizeObserver(schedule)
  elements.filter(Boolean).forEach(element=>resize.observe(element))
  document.fonts?.ready.then(()=>{if(subscribers.has(callback))schedule()})
  schedule()
  return ()=>{
    subscribers.delete(callback);resize.disconnect()
    if(!subscribers.size) {
      window.removeEventListener('scroll',schedule)
      window.removeEventListener('resize',schedule)
      window.removeEventListener('pageshow',schedule)
      cancelAnimationFrame(frame);frame=0
    }
  }
}
