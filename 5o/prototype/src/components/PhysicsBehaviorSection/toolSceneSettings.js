import saved from './toolBaseSettings.json'

export const toolScenes = saved.scenes
const mix=(a,b,t)=>a+(b-a)*t
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10)}

// The website retains its original playhead and transitions; these are render settings only.
export function settingsAtRest(value){
  const coordinate=Math.max(0,Math.min(2,value-5))
  const from=Math.min(1,Math.floor(coordinate)),to=from+1
  const t=smooth(coordinate-from)
  const a=toolScenes[from],b=toolScenes[to]
  const result={}
  for(const key of Object.keys(a)){
    if(t===0||t===1)result[key]=t===0?a[key]:b[key]
    else if(typeof a[key]==='number')result[key]=mix(a[key],b[key],t)
    else if(typeof a[key]==='string'&&/^#[0-9a-f]{6}$/i.test(a[key])){
      result[key]='#'+[1,3,5].map(i=>Math.round(mix(parseInt(a[key].slice(i,i+2),16),parseInt(b[key].slice(i,i+2),16),t)).toString(16).padStart(2,'0')).join('')
    }else result[key]=t<.5?a[key]:b[key]
  }
  // Use one background compositor for the website: foreground fog was
  // washing the tunnel blue towards grey as clouds crossed the viewport.
  result.frontFog = false
  result.secondFog = false
  result.frontFogAmount = 0
  result.secondFogAmount = 0
  // Website-specific refinements; the saved tool baseline stays intact.
  const second=1-Math.min(1,Math.abs(coordinate-1))
  result.volumeBlurAmount*=1-second
  if(coordinate===1)result.volumeBlur=false
  result.lineThickness*=.85
  // Freeze seeded tunnel geometry before it becomes visible: interpolation of
  // probability thresholds otherwise changes random lanes halfway through entry.
  if(value>6){
    for(const key of ['shapeCount','spheres','cubes','crystals','clouds','shapeSpreadX','shapeSpreadY','shapeEdgeBias','shapeSideSpawn','shapeCenterShare','figureSize','figureSizeSpread','shapeFill','fieldCount','focalLength','vanishingX','vanishingY'])result[key]=toolScenes[2][key]
  }
  result.chainMin = 4
  if(value > 6){
    result.cursor = false
    result.vanishingX = .5
    result.vanishingY = .5
    // Carry step two's complete background into the tunnel, not just its
    // palette. Particle, camera and depth settings remain specific to step three.
    for(const key of ['shader','backgroundBlue','backgroundMint','backgroundViolet',
      'greyColor','greyMix','shaderSpeed','noiseScale','warp','brightness',
      'saturation','shaderRays','fog','glow','grain']){
      if(key in toolScenes[1]) result[key] = toolScenes[1][key]
    }
  }
  result.tunnelShapeScale=toolScenes[2].shapeScale
  result.mainFieldCount=toolScenes[1].fieldCount
  result.mainFieldFill=toolScenes[1].fieldFill
  if(value <= 6){
    result.fieldStartCount = toolScenes[0].fieldCount
    result.fieldEndCount = toolScenes[1].fieldCount
    result.fieldBlend = smooth((value-5) / .7)
    result.fieldCount = Math.max(result.fieldStartCount,result.fieldEndCount)
  }
  result.fieldCount=Math.round(result.fieldCount)
  result.shapeCount=Math.round(result.shapeCount)
  return result
}

export const toolCopyStyle=config=>({
  color:config.textColor,
  fontSize:`clamp(18px, ${config.textSize/12.8}vw, ${config.textSize}px)`,
  fontWeight:config.textWeight,
  width:`min(${config.textWidth}px, 86%)`,
  bottom:`${config.textBottom}%`,
  display:config.text?undefined:'none',
})
