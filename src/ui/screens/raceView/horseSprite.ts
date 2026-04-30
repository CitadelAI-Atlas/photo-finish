// Pixel-art horse + jockey sprite pipeline for the rail-cam.
//
// Source PNGs ship with the silk painted in chroma magenta (#FF00FF)
// and the cap in chroma green (#00FF00). We downscale each frame once
// to a working size (well above the on-screen render size but small
// enough to fit in mobile Safari's canvas memory budget), then recolor
// per silk+cap pair on demand and cache the result. Per-frame draw is
// a single drawImage call from the cached tinted canvas.

import frame1Url from './sprites/1.png'
import frame2Url from './sprites/2.png'
import frame3Url from './sprites/3.png'

const FRAME_URLS = [frame1Url, frame2Url, frame3Url]

// Working width for tinted frames. Source PNGs are 960×640; we render
// at ~60-120 logical px wide on screen. 256 keeps crisp pixel-art look
// at retina with a tiny memory footprint (~170KB/canvas vs ~2.4MB at
// source size). Mobile Safari rejects allocations past ~288MB total
// canvas memory across the page, so this matters.
const WORK_WIDTH = 256

let baseFrames: HTMLCanvasElement[] | null = null
let loadStarted = false
const tintCache = new Map<string, HTMLCanvasElement>()

// Kick off image loads. Idempotent — safe to call from a draw loop.
// On decode, downscales each frame into a small working canvas so the
// tint cache stays in mobile-safe memory bounds.
export function ensureSpritesLoaded(): void {
  if (loadStarted) return
  loadStarted = true
  const slots: (HTMLCanvasElement | null)[] = FRAME_URLS.map(() => null)
  FRAME_URLS.forEach((url, i) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const ratio = img.naturalHeight / Math.max(1, img.naturalWidth)
        const c = document.createElement('canvas')
        c.width = WORK_WIDTH
        c.height = Math.round(WORK_WIDTH * ratio)
        const cx = c.getContext('2d')
        if (!cx) return
        cx.imageSmoothingEnabled = false
        cx.drawImage(img, 0, 0, c.width, c.height)
        slots[i] = c
        if (slots.every(s => s !== null)) {
          baseFrames = slots as HTMLCanvasElement[]
        }
      } catch { /* mobile canvas alloc could fail; fallback to vector */ }
    }
    img.src = url
  })
}

export function spritesReady(): boolean {
  return baseFrames !== null
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  const v = parseInt(m.length === 3
    ? m.split('').map(c => c + c).join('')
    : m, 16)
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]
}

// Recolor magenta → silk, green → cap. Wide tolerance picks up
// anti-aliased edge pixels without leaking into other regions.
function tintFrame(src: HTMLCanvasElement, silk: string, cap: string): HTMLCanvasElement | null {
  try {
    const c = document.createElement('canvas')
    c.width = src.width
    c.height = src.height
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(src, 0, 0)
    const img = ctx.getImageData(0, 0, c.width, c.height)
    const d = img.data
    const [sr, sg, sb] = hexToRgb(silk)
    const [cr, cg, cb] = hexToRgb(cap)
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!
      if (r > 180 && g < 90 && b > 180) {
        d[i] = sr; d[i + 1] = sg; d[i + 2] = sb
      } else if (g > 180 && r < 100 && b < 100) {
        d[i] = cr; d[i + 1] = cg; d[i + 2] = cb
      }
    }
    ctx.putImageData(img, 0, 0)
    return c
  } catch {
    return null
  }
}

// Returns the stride frames pre-tinted for a given silk+cap pair, or
// null if sprites haven't decoded or the platform refused to allocate.
// Caller falls back to the vector-drawn horse profile.
export function getTintedFrames(silk: string, cap: string): HTMLCanvasElement[] | null {
  if (!baseFrames) return null
  const out: HTMLCanvasElement[] = []
  for (let i = 0; i < baseFrames.length; i++) {
    const key = `${i}:${silk}:${cap}`
    let canvas = tintCache.get(key)
    if (!canvas) {
      const tinted = tintFrame(baseFrames[i]!, silk, cap)
      if (!tinted) return null
      canvas = tinted
      tintCache.set(key, canvas)
    }
    out.push(canvas)
  }
  return out
}

// Pick a stride frame (0..N-1) from the gallop-phase radians. Cycles
// once every 2π just like the vector horse's leg animation, so the
// sprite stride matches the existing speed-streak/dust phase exactly.
export function strideFrameIndex(gallop: number, frameCount: number): number {
  const norm = ((gallop / (Math.PI * 2)) % 1 + 1) % 1
  return Math.min(frameCount - 1, Math.floor(norm * frameCount))
}
