import { createNetworkRenderer } from '../src/components/PhysicsBehaviorSection/BehaviorNetworkTransition.jsx'
import { createNetworkLightRenderer } from '../src/components/PhysicsBehaviorSection/NetworkLightShader.jsx'
import { settingsAtRest } from '../src/components/PhysicsBehaviorSection/toolSceneSettings.js'

const output = document.getElementById('result')
const display = document.getElementById('field')
const pause = () => new Promise(resolve => setTimeout(resolve, 0))
const median = values => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]
const frames = [
  ...Array(40).fill(1),
  ...Array.from({length:16},(_,i)=>1+(i+1)*1.5/16),
  ...Array(60).fill(2.5),
  ...Array.from({length:16},(_,i)=>2.5+(i+1)*1.5/16),
  ...Array(40).fill(4),
  ...Array.from({length:16},(_,i)=>4-(i+1)*3/16),
  ...Array(12).fill(1),
  ...Array(24).fill(2.5),
]
const checkpoints = new Set([0,20,39,47,55,70,100,115,123,131,150,171,179,187,199,203,209,213,219,223])

async function sample(kind, optimized, benchmark = false) {
  const canvas = document.createElement('canvas')
  display.parentElement.append(canvas)
  const motion = {current:{visible:true,stage:1,network:.25,labelsActive:true,linesActive:false}}
  const settings = {current:settingsAtRest(5)}
  const factory = kind === 'particles' ? createNetworkRenderer : createNetworkLightRenderer
  const renderer = factory(canvas, motion, settings, optimized, {automatic:false})
  if (!renderer) throw new Error(`${kind}: renderer unavailable`)
  const gl = renderer.gl
  const context = gl || canvas.getContext('2d')
  const counts = {}
  const target = gl || CanvasRenderingContext2D.prototype
  const methods = benchmark ? [] : gl ? ['drawArrays'] : ['clearRect','fill','stroke','drawImage','fillText','moveTo','lineTo']
  const saved = {}
  for (const name of methods) {
    saved[name] = target[name]
    target[name] = function(...args) {counts[name]=(counts[name]||0)+1; return saved[name].apply(this,args)}
  }
  const snapshots = new Map(), durations = {first:[],second:[],tunnel:[]}
  try {
    // Let ResizeObserver initialize before the deterministic clock starts.
    await new Promise(resolve=>requestAnimationFrame(resolve))
    for(let i=0;i<frames.length;i++) {
      const stage=frames[i]
      motion.current.stage=stage;motion.current.network=stage/4
      motion.current.labelsActive=stage===1;motion.current.linesActive=stage===2.5
      settings.current=settingsAtRest(stage===1?5:stage===2.5?6:stage===4?7:5+(stage-1)/1.5)
      if (i >= 208) motion.current.pointer = {x:.6,y:-.25}
      if (i >= 212) settings.current.backgroundMint = '#a1e4f7'
      if (i >= 216) {
        canvas.style.width = '800px'
        if(i===216)renderer.resize?.()
      }
      const start=performance.now()
      renderer.render(i*40)
      const duration=performance.now()-start
      const bucket=stage===1?'first':stage===2.5?'second':stage===4?'tunnel':null
      if(bucket && (!benchmark || (i>=16 && i<40) || (i>=72 && i<116) || (i>=148 && i<172)))durations[bucket].push(duration)
      if(!benchmark && checkpoints.has(i)) {
        const pixels=gl?new Uint8Array(canvas.width*canvas.height*4):context.getImageData(0,0,canvas.width,canvas.height).data
        if(gl)gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels)
        snapshots.set(i,pixels)
      }
      if(benchmark)await new Promise(resolve=>requestAnimationFrame(resolve))
      else if(i%4===0)await pause()
    }
    const measuredCounts = {...counts}
    if(kind==='particles'&&optimized) {
      display.width=canvas.width;display.height=canvas.height
      display.getContext('2d').drawImage(canvas,0,0)
    }
    return {snapshots, counts: measuredCounts, cpuMedianMs:Object.fromEntries(Object.entries(durations).map(([k,v])=>[k,+median(v).toFixed(3)]))}
  } finally {
    for (const [name,original] of Object.entries(saved))target[name]=original
    renderer.dispose();canvas.remove()
  }
}

document.getElementById('run').onclick=async()=>{
  const button=document.getElementById('run'), benchmark=document.getElementById('benchmark')
  button.disabled=benchmark.disabled=true
  try {
    const checks=[]
    for(const kind of ['particles','background']) {
      output.textContent=`Running ${kind} baseline…`
      const baseline=await sample(kind,false)
      output.textContent=`Running ${kind} 5o…`
      const optimized=await sample(kind,true)
      const differences=[]
      for(const [frame,a]of baseline.snapshots) {
        const b=optimized.snapshots.get(frame)
        if(a.length!==b.length)throw new Error(`${kind} backing-buffer size differs at frame ${frame}`)
        let changed=0,maxDelta=0
        for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);if(delta){changed++;maxDelta=Math.max(maxDelta,delta)}}
        differences.push({frame,stage:frames[frame],changedChannels:changed,maxDelta})
      }
      checks.push({kind,frames:frames.length,baseline:baseline.counts,optimized:optimized.counts,
        cpuMedianMs:{baseline:baseline.cpuMedianMs,optimized:optimized.cpuMedianMs},differences})
    }
    const pass=checks.every(c=>c.differences.every(d=>d.changedChannels===0))
    output.textContent=JSON.stringify({pass,viewport:[960,540],dpr:devicePixelRatio,checks},null,2)
    document.title=`${pass?'PASS':'FAIL'} — 5o particle regression`
  }catch(error){output.textContent=error.stack;document.title='FAIL — 5o particle regression'}
  finally{button.disabled=benchmark.disabled=false}
}

// Submission-time benchmark: no per-operation wrappers or pixel reads. ABBA
// order reduces one-sided warm-up bias. This is not hardware GPU elapsed time.
document.getElementById('benchmark').onclick=async()=>{
  const button=document.getElementById('benchmark'), run=document.getElementById('run')
  button.disabled=run.disabled=true
  const timing=document.getElementById('timing')
  try {
    const rounds=[]
    for(const optimized of [false,true,true,false]) {
      timing.textContent=`Benchmark round ${rounds.length+1}/4 (${optimized?'5o':'baseline'})…`
      const {cpuMedianMs}=await sample('particles',optimized,true)
      rounds.push({optimized,cpuMedianMs})
    }
    timing.textContent=JSON.stringify({method:'ABBA, no readbacks/counters; warmed frame submission time, not GPU time',rounds},null,2)
  }catch(error){timing.textContent=error.stack}
  finally{button.disabled=run.disabled=false}
}
