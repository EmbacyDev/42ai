const SVG_NS = 'http://www.w3.org/2000/svg'
const REF_RE = /(?:url\(#|href="#|xlink:href="#)([^)"']+)/g
const svgDocs = new Map()

function viewBoxSize(svg) {
  const box = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  return {
    w: box[2] || Number(svg.getAttribute('width')) || 1,
    h: box[3] || Number(svg.getAttribute('height')) || 1,
  }
}

function referencedIds(node) {
  const xml = new XMLSerializer().serializeToString(node)
  return [...xml.matchAll(REF_RE)].map((match) => match[1])
}

function collectDefs(svg, rootNode) {
  const defs = document.createElementNS(SVG_NS, 'defs')
  const added = new Set()
  const pending = referencedIds(rootNode)
  while (pending.length) {
    const id = pending.pop()
    if (!id || added.has(id)) continue
    added.add(id)
    const node = svg.querySelector(`[id="${id}"]`)
    if (!node || rootNode.contains(node)) continue
    const copy = node.cloneNode(true)
    defs.appendChild(copy)
    pending.push(...referencedIds(copy))
  }
  return defs
}

/**
 * Mipmaps average a transparent pixel as black. That paints a dark rim
 * around the masked photograph. Copy the edge colour a short way into the
 * transparent margin so the lower mip levels fade the photo out instead of
 * outlining it. Alpha stays 0, so the margin is still invisible.
 */
function bleedEdgeColor(canvas, radius = 16) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  straightenEdge(image.data)
  const data = image.data
  const w = canvas.width
  const h = canvas.height
  const count = w * h
  const filled = new Uint8Array(count)
  let queue = []
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      const i = row + x
      if (data[i * 4 + 3] === 0) continue
      filled[i] = 1
      const edge = (x > 0 && data[(i - 1) * 4 + 3] === 0)
        || (x + 1 < w && data[(i + 1) * 4 + 3] === 0)
        || (y > 0 && data[(i - w) * 4 + 3] === 0)
        || (y + 1 < h && data[(i + w) * 4 + 3] === 0)
      if (edge) queue.push(i)
    }
  }
  for (let pass = 0; pass < radius && queue.length; pass++) {
    const next = []
    for (const i of queue) {
      const x = i % w
      const y = (i / w) | 0
      const r = data[i * 4]
      const g = data[i * 4 + 1]
      const b = data[i * 4 + 2]
      const spread = (to) => {
        if (filled[to]) return
        filled[to] = 1
        data[to * 4] = r
        data[to * 4 + 1] = g
        data[to * 4 + 2] = b
        next.push(to)
      }
      if (x > 0) spread(i - 1)
      if (x + 1 < w) spread(i + 1)
      if (y > 0) spread(i - w)
      if (y + 1 < h) spread(i + w)
    }
    queue = next
  }
  ctx.putImageData(image, 0, 0)
}

function straightenEdge(data) {
  // SVG masks composite the photo against transparent black, so a
  // half-covered pixel is stored already multiplied by its alpha. Drawn
  // again with straight-alpha blending that pixel turns into a dark stroke.
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a === 0 || a === 255) continue
    const scale = 255 / a
    data[i] = Math.min(255, Math.round(data[i] * scale))
    data[i + 1] = Math.min(255, Math.round(data[i + 1] * scale))
    data[i + 2] = Math.min(255, Math.round(data[i + 2] * scale))
    // The leftover coverage is what reads as a hairline around the photo.
    data[i + 3] = a < 160 ? 0 : 255
  }
}
function nativeScale(svg, photoGroup) {
  let scale = 2
  for (const rect of photoGroup.querySelectorAll('rect')) {
    const id = (rect.getAttribute('fill') || '').match(/url\(#([^)]+)\)/)?.[1]
    if (!id) continue
    const use = svg.querySelector(`#${id} use`)
    const href = use?.getAttribute('href') || use?.getAttribute('xlink:href') || ''
    const image = href.startsWith('#') ? svg.querySelector(href) : null
    const imageW = Number(image?.getAttribute('width')) || 0
    const rectW = Number(rect.getAttribute('width')) || 0
    if (imageW > 0 && rectW > 0) scale = Math.max(scale, imageW / rectW)
  }
  return Math.min(scale, 6)
}

function shellWith(svg, ...nodes) {
  const shell = svg.cloneNode(false)
  for (const node of nodes) {
    if (node) shell.appendChild(node)
  }
  return shell
}

function loadSvgImage(svgEl, width, height) {
  svgEl.setAttribute('width', String(width))
  svgEl.setAttribute('height', String(height))
  const xml = new XMLSerializer().serializeToString(svgEl)
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Hero card SVG failed to rasterize'))
    }
    img.src = url
  })
}

function loadSvgDocument(src) {
  if (!svgDocs.has(src)) {
    svgDocs.set(src, fetch(src).then((response) => {
      if (!response.ok) throw new Error(`Failed to load hero card (${response.status})`)
      return response.text()
    }).then((text) => new DOMParser().parseFromString(text, 'image/svg+xml').documentElement))
  }
  return svgDocs.get(src)
}

function splitLayers(svg) {
  const groups = [...svg.children].filter((el) => el.localName === 'g')
  const uiGroup = groups.find((el) => el.hasAttribute('data-figma-bg-blur-radius'))
  const photoGroup = groups.find((el) => el !== uiGroup)
  const foreign = [...svg.children].find((el) => el.localName === 'foreignObject')
  return { uiGroup, photoGroup, foreign }
}

/**
 * The photograph only. The UI chip stays vector: baking it into this
 * canvas is what made the type soft.
 */
export async function rasterizeHeroCard(src) {
  const svg = await loadSvgDocument(src)
  const { photoGroup } = splitLayers(svg)
  if (!photoGroup) throw new Error('Hero card SVG is missing a photo layer')

  const sheet = viewBoxSize(svg)
  // The Figma filter is a drop shadow plus an inner shadow. Both read as a
  // dark stroke around the photograph, so the photo is drawn without it.
  const photoNode = photoGroup.cloneNode(true)
  photoNode.removeAttribute('filter')
  const scale = nativeScale(svg, photoNode)
  const width = Math.max(1, Math.round(sheet.w * scale))
  const height = Math.max(1, Math.round(sheet.h * scale))
  const photoSvg = shellWith(svg, photoNode, collectDefs(svg, photoNode))
  const photoImg = await loadSvgImage(photoSvg, width, height)

  const photo = document.createElement('canvas')
  photo.width = width
  photo.height = height
  const ctx = photo.getContext('2d', { alpha: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(photoImg, 0, 0, width, height)
  bleedEdgeColor(photo)
  return { photo }
}

/**
 * The chip's type, without the plate or the embedded photographs.
 * The frosted plate is a separate DOM element so its blur can see the photo.
 */
export async function heroUiElement(src) {
  const svg = await loadSvgDocument(src)
  const { uiGroup } = splitLayers(svg)
  if (!uiGroup) throw new Error('Hero card SVG is missing a UI layer')

  const ui = uiGroup.cloneNode(true)
  ui.removeAttribute('filter')
  const rect = ui.querySelector('rect')
  if (rect) rect.setAttribute('fill', 'none')
  const shell = shellWith(svg, ui, collectDefs(svg, uiGroup))
  shell.setAttribute('width', '100%')
  shell.setAttribute('height', '100%')
  shell.setAttribute('preserveAspectRatio', 'none')
  if (rect) shell._chipRect = rect
  return shell
}
