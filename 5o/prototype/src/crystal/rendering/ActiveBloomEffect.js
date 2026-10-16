import { BloomEffect } from 'postprocessing'

// Keep the existing HDR buffers and final composite, including its color and
// alpha handling. Only skip the luminance/blur work when it contributes zero.
// Retaining the effect also avoids allocating its buffers during a CTA pulse.
export class ActiveBloomEffect extends BloomEffect {
  update(renderer, inputBuffer, deltaTime) {
    if (this.intensity > 0) super.update(renderer, inputBuffer, deltaTime)
  }
}
