import { useMemo } from 'react'
import { wrapEffect } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { ActiveBloomEffect } from './ActiveBloomEffect.js'

const Bloom = wrapEffect(ActiveBloomEffect, { blendFunction: BlendFunction.ADD })

export default function ActiveBloom({ intensity, luminanceThreshold, luminanceSmoothing }) {
  const args = useMemo(() => [{
    mipmapBlur: true,
    luminanceThreshold,
    luminanceSmoothing,
  }], [luminanceThreshold, luminanceSmoothing])

  return <Bloom args={args} intensity={intensity} />
}
