import {useEffect,useRef} from 'react'
import {cameraCentre} from './networkCamera.js'

// A low-resolution foreground pass sits above the flying figures and below the copy.
export default function ForegroundAtmosphere({motionRef,settingsRef,layer=1}){
 const ref=useRef(null)
 const prefix=layer===2?'secondFog':'frontFog'
 useEffect(()=>{
  const canvas=ref.current,ctx=canvas.getContext('2d')
  const sprite=document.createElement('canvas');sprite.width=sprite.height=128
  const brush=sprite.getContext('2d')
  let color='',previous=null,time=0,frame=0,visible=true,oldBlur=-1,lastPaint=-Infinity,painted=false
  const draw=now=>{
   frame=visible?requestAnimationFrame(draw):0;if(!visible)return
   const config=settingsRef.current
   if(motionRef.current.visible===false||!config[prefix]||config[prefix+'Amount']<=0){
    if(painted){ctx.clearRect(0,0,canvas.width,canvas.height);painted=false}
    previous=now;return
   }
   if(now-lastPaint<1000/30-1)return
   lastPaint=now;painted=true
   const rect=canvas.getBoundingClientRect()
   const scale=Math.min(.5,640/Math.max(1,rect.width,rect.height))
   const w=Math.max(1,Math.round(rect.width*scale)),h=Math.max(1,Math.round(rect.height*scale))
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
   const dt=previous===null?0:Math.min(.05,(now-previous)/1000);previous=now
   if(!config.paused)time+=dt*config.speed*config[prefix+'Speed']
   ctx.clearRect(0,0,w,h)
   if(motionRef.current.visible===false)return
   if(!config[prefix+'']||config[prefix+'Amount']<=0)return
   if(config[prefix+'Blur']!==oldBlur){canvas.style.filter=`blur(${config[prefix+'Blur']}px)`;oldBlur=config[prefix+'Blur']}
   if(color!==config[prefix+'Color']){
    color=config[prefix+'Color'];brush.clearRect(0,0,128,128)
    const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(',')
    const gradient=brush.createRadialGradient(64,64,0,64,64,64)
    gradient.addColorStop(0,`rgba(${rgb},.8)`);gradient.addColorStop(.3,`rgba(${rgb},.45)`);gradient.addColorStop(1,`rgba(${rgb},0)`)
    brush.fillStyle=gradient;brush.fillRect(0,0,128,128)
   }
   const camera=cameraCentre(motionRef,config,now)
   const focal=Math.min(w,h)*config[prefix+'Depth']
   // Independent cloud ribbons drift across layered planes. Their positions
   // never project from the tunnel centre; only the camera parallax is shared.
   const seed=n=>{const v=Math.sin((n+(layer-1)*83.7)*127.1+311.7)*43758.5453;return v-Math.floor(v)}
   for(let i=0;i<10;i++){
    const phase=seed(i+1)*Math.PI*2
    const z=Math.max(.35,2.65+(seed(i+31)-.5)*3.1*config[prefix+'DepthSpread'])
    const drift=time*(.045+seed(i+17)*.025)
    const x=w*(seed(i+7)*1.35-.175+Math.sin(drift+phase)*.17)-camera.orbitX*1.1*focal/z
    const y=h*(seed(i+43)*1.35-.175+Math.cos(drift*.73+phase)*.13)-camera.orbitY*.9*focal/z
    const angle=(seed(i+67)-.5)*1.4+Math.sin(drift*.4+phase)*.14*config[prefix+'Curve']
    const envelope=.55+.45*Math.sin(drift*.65+phase)**2
    const length=focal*(.65+seed(i+79)*1.4)/z
    const spread=focal*(.18+seed(i+97)*.3)/z
    ctx.save();ctx.translate(x,y);ctx.rotate(angle)
    ctx.globalAlpha=Math.min(.8,config[prefix+'Amount']*config[prefix+'Brightness']*envelope*.5)
    for(let knot=0;knot<3;knot++){
     const offset=(knot-1)*length*.68
     const bend=Math.sin(knot*1.6+phase+drift*.35)*spread*.65*config[prefix+'Curve']
     const breadth=spread*(.75+.25*Math.cos(knot+phase))
     ctx.drawImage(sprite,offset-length,bend-breadth,length*2,breadth*2)
    }
    ctx.restore()
   }
  }
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible&&!frame){previous=null;frame=requestAnimationFrame(draw)}})
  observer.observe(canvas)
  return()=>{observer.disconnect();cancelAnimationFrame(frame)}
 },[motionRef,settingsRef,layer,prefix])
 return <canvas ref={ref} className="foreground-atmosphere" data-fog-layer={layer} aria-hidden="true"/>
}
