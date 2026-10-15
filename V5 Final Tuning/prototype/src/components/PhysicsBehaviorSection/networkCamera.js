// The projection centre is fixed; cursor movement translates the camera in world space.
const cameras = new WeakMap()
export function cameraCentre(ref, config, now) {
 let state=cameras.get(ref)
 if(!state){state={orbitX:0,orbitY:0,time:now};cameras.set(ref,state)}
 if(state.time!==now){
  const dt=Math.min(.05,Math.max(0,(now-state.time)/1000));state.time=now
  const pointer=ref.current.pointer||{x:0,y:0}
  const strength=config.cursor?config.cursorStrength:0
  const follow=1-Math.exp(-dt*config.cursorSmoothness)
  state.orbitX+=(pointer.x*strength-state.orbitX)*follow
  state.orbitY+=(pointer.y*strength-state.orbitY)*follow
 }
 if(!config.cursor){state.orbitX=0;state.orbitY=0}
 state.x=config.vanishingX;state.y=config.vanishingY
 return state
}
