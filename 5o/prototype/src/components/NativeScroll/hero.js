import { observeNativeScroll, clamp01 } from './progress.js'
import { nativeScrollState } from './state.js'

export function createNativeHeroTransition(heroEl,onProgress) {
  const progress={current:0}
  const track=heroEl.parentElement
  const update=()=>{
    nativeScrollState.heroRange=Math.max(1,heroEl.clientHeight)
    const top=track.getBoundingClientRect().top+window.scrollY
    progress.current=clamp01((window.scrollY-top)/nativeScrollState.heroRange)
    onProgress?.(progress.current)
  }
  update()
  const stop=observeNativeScroll(update,[heroEl,track])
  return {progress,dispose(){stop();nativeScrollState.heroRange=0}}
}
