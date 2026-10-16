export const clamp01 = value => Math.max(0, Math.min(1, value))
export const smooth = value => { const t=clamp01(value); return t*t*t*(t*(t*6-15)+10) }
export const range = (value,start,end) => smooth((value-start)/(end-start))
export const CHAPTER_SCROLL_SPAN = 7.32 // Includes a reading interval for the final pose.

// A reading interval and a reversible transition for each authored pose.
// The browser keeps scrolling during a reading interval; no gesture is held.
export function chapterValue(distance, max=7) {
  const p=Math.max(0,Math.min(max,distance))
  const chapter=Math.floor(p)
  return Math.min(max,chapter+range(p-chapter,.32,1))
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
