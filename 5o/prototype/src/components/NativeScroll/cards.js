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
    const enter=range(local,-.35,0)
    const handoff=range(local,1.1,1.95)
    const exit=range(local,1.05,1.5)
    const layout=applyBlock24Layout(section)
    entrance.current.value=enter
    section.style.setProperty('--block24-enter-content',String(enter))
    section.style.setProperty('--block24-exit-content',String(exit))
    section.style.setProperty('--block24-exit-glass','0')
    section.style.setProperty('--block24-exit-scroll','0')
    const nextShown=rect.top<h&&rect.bottom>0&&enter>.01
    const nextLeaving=exit>.01
    const nextReady=enter>=.99
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
