import { applyBlock24Layout } from '../Block24Section/block24Layout.js'
import { observeNativeScroll, range } from './progress.js'

export function createNativeCards({section,anchor,visibility,entrance,setVisible,setExiting,setReady}) {
  const track=section.parentElement
  let shown=null,leaving=null,ready=null
  const update=()=>{
    const h=Math.max(1,section.clientHeight)
    const rect=section.getBoundingClientRect()
    const top=track.getBoundingClientRect().top+window.scrollY
    const local=(window.scrollY-top)/h
    const enter=range(local,-.9,.12)
    const handoff=range(local,1.65,2.75)
    const exit=range(local,1.6,2.55)
    const layout=applyBlock24Layout(section)
    // The panel itself enters with the page. Avoid a second staggered reveal.
    entrance.current.value=1
    section.style.setProperty('--block24-enter-content',String(enter))
    section.style.setProperty('--block24-exit-content',String(exit))
    section.style.setProperty('--block24-exit-glass','0')
    section.style.setProperty('--block24-exit-scroll',String(exit * .16))
    const nextShown=rect.top<h&&rect.bottom>0&&enter>.01&&exit<.999
    const nextLeaving=exit>.01
    const nextReady=local>=0 && exit<.99
    if(shown!==nextShown){shown=nextShown;setVisible(shown);visibility.current?.(shown)}
    if(leaving!==nextLeaving){leaving=nextLeaving;setExiting(leaving)}
    if(ready!==nextReady){ready=nextReady;setReady(ready)}
    anchor.current?.(rect.left+layout.crystalX,rect.top+layout.crystalCenterY,{
      sectionTop:rect.top,sectionBottom:rect.bottom,progress:Math.max(0,Math.min(1,local/2)),handoff,fade:0,
    })
  }
  const stop=observeNativeScroll(update,[track,section])
  return ()=>{stop();visibility.current?.(false)}
}
