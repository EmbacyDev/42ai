const mix = (a,b,t) => a+(b-a)*t

// Reuse one output tuple; the original path allocated map() and projection
// arrays for every sampled point (40,000 samples/frame in the tunnel).
export function projectTunnelPoint(point, fill, cy0, sy0, ct, stt, depth,
  figureSize, vanishingX, vanishingY, worldX, worldY, tunnelUnit, output) {
  const radial = Math.cbrt(Math.max(.0001,point[3]))
  const factor = mix(1,radial,fill)
  const px = point[0]*factor, py = point[1]*factor, pz = point[2]*factor
  const x1 = px*cy0+pz*sy0
  const z1 = -px*sy0+pz*cy0
  const y2 = py*ct-z1*stt
  const z2 = py*stt+z1*ct
  const pointDepth = depth+z2*.75*figureSize
  if(pointDepth<.2){output[0]=-10000;output[1]=-10000;output[2]=0;return output}
  const perspective = 5.8/pointDepth
  output[0]=vanishingX+(worldX+x1*.75*figureSize)*tunnelUnit*perspective
  output[1]=vanishingY+(worldY+y2*.75*figureSize)*tunnelUnit*perspective
  output[2]=Math.max(.2,depth)/pointDepth
  return output
}
