/**
 * AralMate Image Preprocessing Pipeline
 *
 * Runs client-side on a File object before it is stored in app state or sent
 * to the Kimi vision API. Uses the HTML Canvas API only — no external libraries.
 *
 * Pipeline order:
 *   Step 0  — Load image onto off-screen canvas
 *   Step 1  — Hard validation (file type, minimum resolution)
 *   Step 2  — Diagnostics (blur, brightness, uniformity, rotation, dark borders)
 *   Step 3  — Apply corrections (crop → rotate → brightness/contrast → adaptive contrast → sharpen)
 *   Step 4  — Resize to max 1200px long edge, export JPEG 85%
 *
 * @param {File} file - Raw File object from the input element
 * @param {string} studentName - Used for personalised Alon messages
 * @returns {Promise<PreprocessResult>}
 */

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_LONG_EDGE = 1200
const JPEG_QUALITY = 0.85

// ── File to base64 helper ───────────────────────────────────────────────
// Reads the original file as base64 without going through canvas.
// Used by resizeAndExport to pass the original through when no corrections needed.

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result.split(',')[1])
    reader.onerror = () => reject(new Error('Could not read file as base64'))
    reader.readAsDataURL(file)
  })
}

// ── Step 0: Load file onto canvas ─────────────────────────────────────────────

function loadImageToCanvas(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      resolve(canvas)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load image'))
    }
    img.src = url
  })
}

// ── Step 2A: Blur score (Laplacian variance on center 50% sample) ─────────────

function computeBlurScore(canvas) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height

  // Sample the center 50% to avoid dark border bias
  const x0 = Math.floor(w * 0.25)
  const y0 = Math.floor(h * 0.25)
  const sw = Math.floor(w * 0.5)
  const sh = Math.floor(h * 0.5)

  const data = ctx.getImageData(x0, y0, sw, sh).data

  // Convert to grayscale
  const gray = new Float32Array(sw * sh)
  for (let i = 0; i < sw * sh; i++) {
    const p = i * 4
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }

  // Apply Laplacian kernel [0,1,0, 1,-4,1, 0,1,0]
  const lap = new Float32Array(sw * sh)
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const i = y * sw + x
      lap[i] = (
        gray[i - sw] +       // top
        gray[i + sw] +       // bottom
        gray[i - 1] +        // left
        gray[i + 1] -        // right
        4 * gray[i]          // center
      )
    }
  }

  // Compute variance of Laplacian values
  let sum = 0
  let sumSq = 0
  const n = sw * sh
  for (let i = 0; i < n; i++) {
    sum += lap[i]
    sumSq += lap[i] * lap[i]
  }
  const mean = sum / n
  return sumSq / n - mean * mean
}

// ── Step 2B: Brightness score (average luminance) ────────────────────────────

function computeBrightnessScore(canvas) {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
  let sum = 0
  const pixels = canvas.width * canvas.height
  for (let i = 0; i < pixels; i++) {
    const p = i * 4
    sum += 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }
  return sum / pixels
}

// ── Step 2C: Lighting uniformity (4×4 grid SD) ───────────────────────────────

function computeUniformitySD(canvas) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  const zoneW = Math.floor(w / 4)
  const zoneH = Math.floor(h / 4)
  const zoneBrightness = []

  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      const zx = gx * zoneW
      const zy = gy * zoneH
      const data = ctx.getImageData(zx, zy, zoneW, zoneH).data
      const pixels = zoneW * zoneH
      let sum = 0
      for (let i = 0; i < pixels; i++) {
        const p = i * 4
        sum += 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
      }
      zoneBrightness.push(sum / pixels)
    }
  }

  const mean = zoneBrightness.reduce((a, b) => a + b, 0) / 16
  const variance = zoneBrightness.reduce((s, v) => s + (v - mean) ** 2, 0) / 16
  return Math.sqrt(variance)
}

// ── Step 2D: Rotation angle (Sobel + gradient bucketing) ─────────────────────

function computeRotation(canvas) {
  // Downscale to max 400px wide for speed
  const scale = Math.min(1, 400 / canvas.width)
  const sw = Math.floor(canvas.width * scale)
  const sh = Math.floor(canvas.height * scale)

  const small = document.createElement('canvas')
  small.width = sw
  small.height = sh
  small.getContext('2d').drawImage(canvas, 0, 0, sw, sh)

  const data = small.getContext('2d').getImageData(0, 0, sw, sh).data

  // Grayscale
  const gray = new Float32Array(sw * sh)
  for (let i = 0; i < sw * sh; i++) {
    const p = i * 4
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }

  // Sobel gradient angles — bucket into 5° bins (-90 to +90)
  const NUM_BINS = 36
  const bins = new Float32Array(NUM_BINS)
  let totalEdgeStrength = 0

  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const i = y * sw + x
      const gx = (
        -gray[i - sw - 1] + gray[i - sw + 1] +
        -2 * gray[i - 1] + 2 * gray[i + 1] +
        -gray[i + sw - 1] + gray[i + sw + 1]
      )
      const gy = (
        -gray[i - sw - 1] - 2 * gray[i - sw] - gray[i - sw + 1] +
         gray[i + sw - 1] + 2 * gray[i + sw] + gray[i + sw + 1]
      )
      const magnitude = Math.sqrt(gx * gx + gy * gy)
      if (magnitude < 20) continue // ignore weak edges

      // Angle in degrees (-90 to +90) — we care about line orientation, not direction
      let angle = Math.atan2(gy, gx) * (180 / Math.PI)
      if (angle < -90) angle += 180
      if (angle > 90) angle -= 180

      const bin = Math.floor((angle + 90) / (180 / NUM_BINS))
      const clampedBin = Math.max(0, Math.min(NUM_BINS - 1, bin))
      bins[clampedBin] += magnitude
      totalEdgeStrength += magnitude
    }
  }

  if (totalEdgeStrength === 0) return { angle: 0, confidence: 'low' }

  // Find dominant bin
  let maxBin = 0
  let maxVal = 0
  for (let b = 0; b < NUM_BINS; b++) {
    if (bins[b] > maxVal) { maxVal = bins[b]; maxBin = b }
  }

  // Check confidence: dominant bin must have > 25% of total edge strength
  // and neighbouring bins must be consistent (tight cluster)
  const dominantFraction = maxVal / totalEdgeStrength
  const prevBin = (maxBin - 1 + NUM_BINS) % NUM_BINS
  const nextBin = (maxBin + 1) % NUM_BINS
  const clusterFraction = (bins[prevBin] + maxVal + bins[nextBin]) / totalEdgeStrength

  const confidence = (dominantFraction > 0.25 && clusterFraction > 0.40) ? 'high' : 'low'

  // Convert bin back to angle
  const dominantAngle = (maxBin * (180 / NUM_BINS)) - 90

  // The document angle is perpendicular to the dominant gradient direction
  // Horizontal text → vertical gradients at ~90°, so document is straight
  // We want the angle deviation from horizontal (0°)
  let skewAngle = dominantAngle
  // Normalise to -90..+90 and find how far from 0 or 90 it is
  if (Math.abs(skewAngle) > 45) {
    skewAngle = skewAngle > 0 ? skewAngle - 90 : skewAngle + 90
  }

  return { angle: skewAngle, confidence }
}

// ── Step 2E: Dark border detection (outer 12% scan) ──────────────────────────

function detectDarkBorders(canvas) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  const DARK_THRESHOLD = 60
  const PADDING = 12

  function avgBrightnessRow(y) {
    const d = ctx.getImageData(0, y, w, 1).data
    let s = 0
    for (let x = 0; x < w; x++) { const p = x * 4; s += 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2] }
    return s / w
  }
  function avgBrightnessCol(x) {
    const d = ctx.getImageData(x, 0, 1, h).data
    let s = 0
    for (let y = 0; y < h; y++) { const p = y * 4; s += 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2] }
    return s / h
  }

  const borderZoneH = Math.floor(h * 0.12)
  const borderZoneW = Math.floor(w * 0.12)

  // Top
  let top = 0
  for (let y = 0; y < borderZoneH; y++) {
    if (avgBrightnessRow(y) < DARK_THRESHOLD) top = y + 1
    else if (top > 0) break
  }

  // Bottom
  let bottom = 0
  for (let y = h - 1; y > h - borderZoneH; y--) {
    if (avgBrightnessRow(y) < DARK_THRESHOLD) bottom = (h - 1 - y) + 1
    else if (bottom > 0) break
  }

  // Left
  let left = 0
  for (let x = 0; x < borderZoneW; x++) {
    if (avgBrightnessCol(x) < DARK_THRESHOLD) left = x + 1
    else if (left > 0) break
  }

  // Right
  let right = 0
  for (let x = w - 1; x > w - borderZoneW; x--) {
    if (avgBrightnessCol(x) < DARK_THRESHOLD) right = (w - 1 - x) + 1
    else if (right > 0) break
  }

  // Add padding inside inset
  return {
    top:    top    > 0 ? Math.min(top    + PADDING, Math.floor(h * 0.2)) : 0,
    bottom: bottom > 0 ? Math.min(bottom + PADDING, Math.floor(h * 0.2)) : 0,
    left:   left   > 0 ? Math.min(left   + PADDING, Math.floor(w * 0.2)) : 0,
    right:  right  > 0 ? Math.min(right  + PADDING, Math.floor(w * 0.2)) : 0,
  }
}

// ── Step 3A: Crop dark borders ────────────────────────────────────────────────

function cropCanvas(src, insets) {
  const { top, bottom, left, right } = insets
  if (top === 0 && bottom === 0 && left === 0 && right === 0) return src

  const w = src.width - left - right
  const h = src.height - top - bottom
  if (w <= 0 || h <= 0) return src

  const dst = document.createElement('canvas')
  dst.width = w
  dst.height = h
  dst.getContext('2d').drawImage(src, left, top, w, h, 0, 0, w, h)
  return dst
}

// ── Step 3B: Rotation correction ─────────────────────────────────────────────

function rotateCanvas(src, angleDeg) {
  const rad = angleDeg * Math.PI / 180
  const w = src.width
  const h = src.height

  const dst = document.createElement('canvas')
  dst.width = w
  dst.height = h

  const ctx = dst.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.translate(w / 2, h / 2)
  ctx.rotate(rad)
  ctx.drawImage(src, -w / 2, -h / 2)
  return dst
}

// ── Step 3C: Brightness / contrast normalization ──────────────────────────────

function applyBrightnessContrast(canvas, brightnessScore) {
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = imageData.data
  const n = canvas.width * canvas.height

  if (brightnessScore > 220) {
    // Overexposed — compress highlights
    for (let i = 0; i < n; i++) {
      const p = i * 4
      for (let c = 0; c < 3; c++) {
        const v = d[p + c]
        d[p + c] = v > 200 ? Math.round(200 + (v - 200) * 0.4) : v
      }
    }
  } else {
    // Dark — levels remap using percentile stretch with mild gamma
    // Sample luminance values
    const lums = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      const p = i * 4
      lums[i] = Math.round(0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2])
    }
    const sorted = lums.slice().sort((a, b) => a - b)
    const lo = sorted[Math.floor(n * 0.05)]  // 5th percentile
    const hi = sorted[Math.floor(n * 0.95)]  // 95th percentile
    const range = hi - lo || 1
    const gamma = brightnessScore < 80 ? 0.75 : 0.88  // stronger boost for very dark

    for (let i = 0; i < n; i++) {
      const p = i * 4
      for (let c = 0; c < 3; c++) {
        const stretched = Math.max(0, Math.min(255, ((d[p + c] - lo) / range) * 255))
        d[p + c] = Math.round(Math.pow(stretched / 255, gamma) * 255)
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

// ── Step 3D: Simplified adaptive local contrast ───────────────────────────────
// Simplified adaptive contrast — full CLAHE deferred to a future version.
// Each zone's brightness is nudged toward the global average at 50% blend.
// Cosine blend at zone edges prevents hard seams.

function applyAdaptiveContrast(canvas) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data

  const ZONES = 4
  const zoneW = w / ZONES
  const zoneH = h / ZONES

  // Compute zone averages
  const zoneAvg = new Float32Array(ZONES * ZONES)
  let globalSum = 0
  let globalCount = 0

  for (let gy = 0; gy < ZONES; gy++) {
    for (let gx = 0; gx < ZONES; gx++) {
      let sum = 0
      let count = 0
      const x0 = Math.floor(gx * zoneW)
      const x1 = Math.floor((gx + 1) * zoneW)
      const y0 = Math.floor(gy * zoneH)
      const y1 = Math.floor((gy + 1) * zoneH)
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = (y * w + x) * 4
          sum += 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]
          count++
        }
      }
      zoneAvg[gy * ZONES + gx] = count > 0 ? sum / count : 128
      globalSum += sum
      globalCount += count
    }
  }

  const globalAvg = globalCount > 0 ? globalSum / globalCount : 128

  // Apply per-pixel correction with cosine blend
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = Math.min(ZONES - 1, Math.floor(x / zoneW))
      const gy = Math.min(ZONES - 1, Math.floor(y / zoneH))

      // Cosine blend factor within zone (0 at edge → 1 at center)
      const fx = (x - gx * zoneW) / zoneW  // 0..1 within zone
      const fy = (y - gy * zoneH) / zoneH
      const blend = (1 - Math.cos(Math.PI * fx)) / 2 * (1 - Math.cos(Math.PI * fy)) / 2

      const localAvg = zoneAvg[gy * ZONES + gx]
      const offset = (globalAvg - localAvg) * 0.5 * blend

      const p = (y * w + x) * 4
      d[p]     = Math.max(0, Math.min(255, Math.round(d[p]     + offset)))
      d[p + 1] = Math.max(0, Math.min(255, Math.round(d[p + 1] + offset)))
      d[p + 2] = Math.max(0, Math.min(255, Math.round(d[p + 2] + offset)))
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

// ── Step 3E: Unsharp mask sharpening ─────────────────────────────────────────

function applyUnsharpMask(canvas) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data
  const AMOUNT = 0.6
  const RADIUS = 2

  // Box blur
  const blurred = new Uint8ClampedArray(d)
  const diam = RADIUS * 2 + 1

  // Horizontal pass
  const temp = new Uint8ClampedArray(d.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rSum = 0, gSum = 0, bSum = 0, count = 0
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const nx = Math.max(0, Math.min(w - 1, x + dx))
        const p = (y * w + nx) * 4
        rSum += d[p]; gSum += d[p + 1]; bSum += d[p + 2]; count++
      }
      const tp = (y * w + x) * 4
      temp[tp]     = rSum / count
      temp[tp + 1] = gSum / count
      temp[tp + 2] = bSum / count
      temp[tp + 3] = d[tp + 3]
    }
  }

  // Vertical pass into blurred
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rSum = 0, gSum = 0, bSum = 0, count = 0
      for (let dy = -RADIUS; dy <= RADIUS; dy++) {
        const ny = Math.max(0, Math.min(h - 1, y + dy))
        const p = (ny * w + x) * 4
        rSum += temp[p]; gSum += temp[p + 1]; bSum += temp[p + 2]; count++
      }
      const bp = (y * w + x) * 4
      blurred[bp]     = rSum / count
      blurred[bp + 1] = gSum / count
      blurred[bp + 2] = bSum / count
    }
  }

  // Unsharp mask: sharpened = original + AMOUNT * (original - blurred)
  for (let i = 0; i < w * h; i++) {
    const p = i * 4
    for (let c = 0; c < 3; c++) {
      d[p + c] = Math.max(0, Math.min(255,
        Math.round(d[p + c] + AMOUNT * (d[p + c] - blurred[p + c]))
      ))
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

// ── Step 4: Resize and compress ───────────────────────────────────────────────
// If no corrections were applied and the image is within the size limit,
// pass originalBase64 through unchanged to avoid lossy re-encoding.
// This preserves OCR quality for clean, well-lit documents.

function resizeAndExport(canvas, originalBase64, originalType, correctionsApplied) {
  const longEdge = Math.max(canvas.width, canvas.height)

  // No corrections + within size limit + original was already JPEG or PNG
  // → return original base64 untouched
  if (
    correctionsApplied.length === 0 &&
    longEdge <= MAX_LONG_EDGE &&
    (originalType === 'image/jpeg' || originalType === 'image/png')
  ) {
    console.log('[AralMate] Preprocess: no corrections needed, returning original base64 unchanged')
    return { base64: originalBase64, imageType: originalType }
  }

  // Corrections were applied or image needs resizing — re-encode as JPEG
  if (longEdge <= MAX_LONG_EDGE) {
    return { base64: canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1], imageType: 'image/jpeg' }
  }

  const scale = MAX_LONG_EDGE / longEdge
  const dw = Math.round(canvas.width * scale)
  const dh = Math.round(canvas.height * scale)

  const dst = document.createElement('canvas')
  dst.width = dw
  dst.height = dh
  dst.getContext('2d').drawImage(canvas, 0, 0, dw, dh)
  return { base64: dst.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1], imageType: 'image/jpeg' }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function preprocessImage(file, studentName) {
  const corrections = []
  let qualityNote = null

  // ── Step 0: Load ──────────────────────────────────────────────────────────
  let canvas
  try {
    canvas = await loadImageToCanvas(file)
  } catch {
    return {
      status: 'hard_block',
      base64: null,
      imageType: 'image/jpeg',
      corrections: [],
      diagnostics: {},
      qualityNote: {
        type: 'error',
        message: 'Hindi ko mabuksan ang larawan. Subukan ulit ng ibang file.'
      }
    }
  }

  // ── Step 1: Hard validation ───────────────────────────────────────────────
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return {
      status: 'hard_block', base64: null, imageType: 'image/jpeg',
      corrections: [], diagnostics: {},
      qualityNote: { type: 'error', message: 'Hindi suportado ang ganitong file. Kumuha ng larawan o pumili ng JPG/PNG.' }
    }
  }

  if (canvas.width < 400 && canvas.height < 400) {
    return {
      status: 'hard_block', base64: null, imageType: 'image/jpeg',
      corrections: [], diagnostics: {},
      qualityNote: { type: 'error', message: 'Masyadong maliit ang larawan. Subukan ulit nang mas malapit.' }
    }
  }

  // ── Step 2: Diagnostics ───────────────────────────────────────────────────
  // Blur thresholds below are starting values based on INS0002 spec.
  // Calibrate against real Android tablet photos before shipping:
  // log blurScore for 5-10 photos from sharp → blurry and adjust.
  // Document calibrated values here with a comment.
  const blurScore        = computeBlurScore(canvas)
  const brightnessScore  = computeBrightnessScore(canvas)
  const uniformitySD     = computeUniformitySD(canvas)
  const { angle: rotationAngle, confidence: rotationConfidence } = computeRotation(canvas)
  const cropInsets       = detectDarkBorders(canvas)

  const diagnostics = {
    blurScore:          Math.round(blurScore * 10) / 10,
    brightnessScore:    Math.round(brightnessScore * 10) / 10,
    uniformitySD:       Math.round(uniformitySD * 10) / 10,
    rotationAngle:      Math.round(rotationAngle * 10) / 10,
    rotationConfidence,
    cropInsets
  }

  // Blur hard block
  if (blurScore < 40) {
    console.log('[AralMate] Preprocess diagnostics:', diagnostics)
    console.log('[AralMate] Preprocess corrections applied: hard_block (severe blur)')
    return {
      status: 'hard_block', base64: null, imageType: 'image/jpeg',
      corrections: [], diagnostics,
      qualityNote: {
        type: 'error',
        message: `😕 Medyo malabo ang larawan, ${studentName}! Hindi ko mabasa nang maayos. Subukan ulit nang hindi gumagalaw ang kamay — o mas malapitan ang papel.`
      }
    }
  }

  // Rotation too steep — soft warning, do not block
  if (Math.abs(rotationAngle) > 15) {
    qualityNote = {
      type: 'warn',
      message: `📐 Subukan mo ulit nang mas tuwid ang papel, ${studentName}! Mas madali akong makakabasa.`
    }
  }

  // ── Step 3: Apply corrections ─────────────────────────────────────────────

  // 3A. Crop dark borders
  const hasCrop = Object.values(cropInsets).some(v => v > 0)
  if (hasCrop) {
    canvas = cropCanvas(canvas, cropInsets)
    corrections.push('crop')
  }

  // 3B. Rotation correction
  const correctable = Math.abs(rotationAngle) > 2 && Math.abs(rotationAngle) <= 15
  if (correctable && rotationConfidence === 'high') {
    canvas = rotateCanvas(canvas, -rotationAngle)
    corrections.push('rotation')
  }

  // 3C. Brightness / contrast normalization
  // Thresholds are intentionally conservative — a clean white document page
  // has high average luminance (220-240) and must NOT be treated as overexposed.
  // Only correct truly dark images (< 140) or severe glare (> 245).
  const needsBrightness = brightnessScore < 140 || brightnessScore > 245
  if (needsBrightness) {
    applyBrightnessContrast(canvas, brightnessScore)
    corrections.push(brightnessScore > 220 ? 'contrast' : 'brightness')
  }

  // 3D. Adaptive local contrast
  if (uniformitySD >= 30) {
    applyAdaptiveContrast(canvas)
    corrections.push('adaptive_contrast')
  }

  // 3E. Unsharp mask (mildly soft only — skip if blur was already hard blocked above)
  if (blurScore >= 40 && blurScore < 80) {
    applyUnsharpMask(canvas)
    corrections.push('sharpen')
  }

  // Show info note if any corrections were applied
  if (corrections.length > 0 && !qualityNote) {
    qualityNote = {
      type: 'info',
      message: '✨ Ginawa ko nang mas malinaw ang larawan para mas madaling basahin!'
    }
  }

  // ── Step 4: Resize and compress ───────────────────────────────────────────
  // Pass original base64 so resizeAndExport can skip re-encoding if unnecessary
  const originalBase64 = await fileToBase64(file)
  const { base64, imageType } = resizeAndExport(canvas, originalBase64, file.type, corrections)

  console.log('[AralMate] Preprocess diagnostics:', diagnostics)
  console.log('[AralMate] Preprocess corrections applied:', corrections.length > 0 ? corrections : 'none')
  console.log('[AralMate] Preprocess output imageType:', imageType)

  return {
    status: 'ok',
    base64,
    imageType,
    corrections,
    diagnostics,
    qualityNote
  }
}
