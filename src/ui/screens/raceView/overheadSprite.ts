// Single shared overhead animation used for all horses during overhead testing.
// Frames pulled from the master overhead object (e98fd429) animation.
const BUCKET = 'b62575af-0963-4cf2-9f51-95e6b504d883'
const OBJECT_ID = 'e98fd429-f464-480a-afea-33ac64ee55ec'
const ANIMATION_ID = '9a129ed1-7e2f-43e9-8ae4-e4674099289f'
const FRAME_COUNT = 6

const frameUrls = Array.from({ length: FRAME_COUNT }, (_, i) =>
  `https://backblaze.pixellab.ai/file/pixellab-characters/objects/${BUCKET}/${OBJECT_ID}/animations/${ANIMATION_ID}/unknown/${i}.png`
)

let frames: HTMLImageElement[] = []
let loadStarted = false

export function ensureOverheadLoaded(): void {
  if (loadStarted) return
  loadStarted = true
  frameUrls.forEach((url, i) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { frames[i] = img }
    img.src = url
  })
}

export function overheadReady(): boolean {
  return frames.filter(Boolean).length === FRAME_COUNT
}

export function getOverheadFrame(gallop: number): HTMLImageElement | null {
  if (!overheadReady()) return null
  const idx = Math.floor((gallop / (Math.PI * 2)) * FRAME_COUNT) % FRAME_COUNT
  return frames[Math.abs(idx)] ?? null
}
