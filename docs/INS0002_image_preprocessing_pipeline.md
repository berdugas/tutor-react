# INS0002 — Image Preprocessing Pipeline

**Created by:** Product Lead  
**Date:** 2026-04-17  
**Type:** Instruction Document (not a ticket — dev team reads this before writing a plan)

---

## Purpose

This document instructs the dev team to implement a client-side image preprocessing pipeline for AralMate. The pipeline runs **after the user selects or captures a photo** and **before the image is sent to the Kimi K2.5 vision API**. Its goal is to maximize the quality of the image Kimi receives, and to catch images that are too degraded to produce a useful lesson — before spending an API call on them.

This is a new module that integrates into the existing `UploadZone` component and `useAnalysis` hook flow.

---

## Background and Motivation

Miguel is a 9-year-old taking photos of worksheets on an Android tablet. In real-world conditions:

- Room lighting may be dim, uneven, or creating glare
- His hands may be slightly unsteady, causing mild blur
- The paper may be rotated a few degrees
- Dark table edges, shadows, or fingertips may appear in the frame
- The photo may be much larger than needed, wasting API bandwidth

Currently, `handleFile()` in `UploadZone.jsx` reads the file and stores the raw base64 directly into app state. There is no preprocessing. Any quality issues are left for Kimi to deal with — or Pass 1A partially compensates via the `image_quality` field, but this is after the API call is already made.

The preprocessing pipeline intercepts the image **before state is set** and before any API call is made.

---

## Decisions Already Made (Do Not Revisit)

| Decision | Choice |
|---|---|
| Perspective correction | **Rotation correction only** — straighten tilted photos using canvas math. No OpenCV.js. Full trapezoid perspective correction is deferred. |
| Severe blur | **Hard block** — if blur is unrecoverable, the user must retake. No override allowed. |
| Library dependencies | **None** — all operations use the HTML Canvas API only. Do not add any image processing libraries. |
| Output format | Always resize to max 1200px long edge, output as JPEG quality 85 |

---

## Architecture: Where This Lives

The preprocessing pipeline is a **new standalone utility module**:

```
src/
  lib/
    imagePreprocess.js    ← NEW: all preprocessing logic lives here
  components/
    UploadZone/
      UploadZone.jsx      ← MODIFIED: calls preprocessImage() before setImageBase64()
```

`useAnalysis.js` and `AppContext.jsx` are **not modified**. The preprocessing happens entirely before image state is set. By the time `runPass1()` is called, `currentImageBase64` already contains the preprocessed image.

---

## The Pipeline: Step-by-Step

The pipeline runs in this exact order. Each step is conditional — it only applies if the diagnostic detects a problem. **Do not apply corrections that are not needed.**

### Step 0 — Load and Decode
Draw the raw image onto an off-screen `<canvas>` to get access to pixel data. All subsequent steps operate on this canvas.

### Step 1 — Hard Validation (reject before processing)
Run these checks first. If either fails, reject immediately with a hard error. Do not proceed to preprocessing.

**A. File type check**
- Accepted types: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`
- Rejection message: `"Hindi suportado ang ganitong file. Kumuha ng larawan o pumili ng JPG/PNG."`

**B. Minimum resolution check**
- Reject if both dimensions are below 400px (i.e., the image is smaller than 400×400)
- Rejection message: `"Masyadong maliit ang larawan. Subukan ulit nang mas malapit."`

### Step 2 — Diagnostics (detect what's wrong)
Run all diagnostic checks and collect a result object. This drives which corrections are applied.

**A. Blur Score**
Technique: Laplacian variance on a grayscale sample of the image.
- Sample the center 50% of the image (ignore borders which may be dark)
- Convert to grayscale: `gray = 0.299R + 0.587G + 0.114B`
- Apply a 3×3 Laplacian kernel to detect edges: `[0,1,0, 1,-4,1, 0,1,0]`
- Compute variance of the resulting values
- Output: a numeric score

Thresholds:
| Score | Classification | Action |
|---|---|---|
| ≥ 80 | Sharp — no action needed | Skip sharpening |
| 40–79 | Mildly soft | Apply unsharp mask sharpening |
| < 40 | Severely blurred | Hard block — user must retake |

For severe blur, display Alon's message (see UX section below) and return early. Do not preprocess. Do not proceed to Pass 1.

**B. Brightness Score**
- Compute average luminance of all pixels
- Output: 0–255

Thresholds:
| Score | Classification | Action |
|---|---|---|
| 160–220 | Good | No action |
| 80–159 | Too dark | Apply brightness lift |
| < 80 | Very dark | Apply stronger brightness lift |
| > 220 | Overexposed / glare | Apply contrast normalization |

**C. Lighting Uniformity Score**
- Divide the image into a 4×4 grid of 16 zones
- Compute average brightness per zone
- Compute the standard deviation of the 16 zone brightnesses
- Output: standard deviation value

Thresholds:
| SD | Classification | Action |
|---|---|---|
| < 30 | Uniform — no action | Skip adaptive contrast |
| ≥ 30 | Uneven lighting | Apply local adaptive contrast |

**D. Rotation Angle**
Technique: Detect dominant line angles using edge detection on a downscaled version of the image (max 400px wide for speed).
- Apply a Sobel edge filter to find edges
- Use a Hough-line approximation: bucket edge gradients by angle
- Find the dominant angle cluster
- Output: estimated rotation in degrees (negative = counter-clockwise, positive = clockwise)

Thresholds:
| Angle | Action |
|---|---|
| -2° to +2° | No rotation needed |
| -15° to -2° or +2° to +15° | Apply rotation correction |
| Outside ±15° | Do not correct — image is too steeply angled. Show soft warning: "Subukan mo ulit nang tuwid." but do not block. |

Note: Rotation detection from pixel data is an estimation. If the detection algorithm is not reliable within ±2°, it is better to skip rotation entirely than to apply incorrect rotation. Include a `rotationConfidence` flag — only apply rotation if confidence is high.

**E. Dark Border Detection**
- Scan each edge (top, bottom, left, right) inward, row by row or column by column
- For each row/column in the border region (outer 12% of image dimension), compute average brightness
- Flag an edge for cropping if its average brightness is below 60 (out of 255)
- Record the inset point for each flagged edge (the row/column where brightness rises above threshold)
- Output: `{ top: N, bottom: N, left: N, right: N }` where N is the pixel inset to crop, or 0 if no crop needed

Add a 12px padding margin inside the detected crop boundary so we don't clip the document edge.

### Step 3 — Apply Corrections (in this exact order)

**3A. Crop dark borders**
If any edge has a non-zero inset from Step 2E, apply crop. Draw the cropped region to a new canvas.

Apply this first — it removes irrelevant dark pixels that would skew subsequent brightness and contrast calculations.

**3B. Rotation correction**
If Step 2D returned a correctable angle with high confidence, rotate the canvas by the negative of that angle to straighten. Use a white fill for the areas revealed by rotation (the corners).

**3C. Brightness and contrast normalization**
If Step 2B flagged the image:
- For dark images: apply a levels adjustment — remap the pixel range so the darkest meaningful pixel becomes 0 and the lightest becomes 255, with a mid-tone boost
- For overexposed images: apply contrast stretch — compress the highlights

Implementation: iterate through `imageData.data` (the flat RGBA array) and apply the adjustment per channel. Do not use CSS filters — operate directly on pixel data.

**3D. Local adaptive contrast**
If Step 2C flagged uneven lighting (SD ≥ 30):
- Divide the image into a 4×4 grid
- For each zone, compute the local brightness offset from the global average
- Apply a per-zone brightness correction to pull each zone toward the global average
- Blend zones with a soft overlap (each zone correction fades toward edges) to avoid hard lines

This is the most complex operation. If a clean implementation proves difficult, it is acceptable to skip this for the first version and apply a simpler global contrast stretch instead. Document the decision in the code.

**3E. Unsharp mask sharpening**
If Step 2A classified the image as mildly soft (score 40–79):
- Create a blurred copy of the image (box blur, radius 2px)
- Subtract the blurred copy from the original (scaled), then add back to original
- Formula per pixel: `sharpened = original + amount × (original − blurred)`
- Use `amount = 0.6` as the sharpening strength

Apply sharpening last. Never sharpen before correcting brightness or contrast.

### Step 4 — Resize and Compress (always, regardless of corrections)
- Find the long edge of the final canvas
- If the long edge exceeds 1200px, scale down proportionally so the long edge is exactly 1200px
- Export using `canvas.toDataURL('image/jpeg', 0.85)`
- Extract the base64 string (strip the `data:image/jpeg;base64,` prefix)

This step always runs. Even a perfect image is resized and compressed before being stored in state.

---

## UX Requirements

### During Preprocessing
Show a brief inline status below the image preview while preprocessing runs. This should feel fast (under 2 seconds on a mid-range Android tablet for typical worksheet photos).

Alon says: `"Tinitingnan ang larawan…"` (Checking the image…)

Use an existing CSS animation (the `processingDot` or similar from the design system). Do not create a full-screen overlay — this is a lightweight inline indicator.

### Hard Block: Severe Blur
When blur score < 40, show Alon's message in the `imageQualityNote` area (which already exists in `UploadZone.jsx`):

```
type: 'error'
message: "😕 Medyo malabo ang larawan, {studentName}! Hindi ko mabasa nang maayos. Subukan ulit nang hindi gumagalaw ang kamay — o mas malapitan ang papel."
```

The analyze button must remain hidden. The "Change photo / ✕" button must remain visible so the user can immediately retake.

Do not show this as a system alert or browser dialog. Use the existing `qualityNote` styled div in `UploadZone.jsx`.

### Soft Warning: Rotation Too Steep (outside ±15°)
```
type: 'warn'
message: "📐 Subukan mo ulit nang mas tuwid ang papel, {studentName}! Mas madali akong makakabasa."
```

This is a warning only — the image is still preprocessed and the analyze button is still available.

### Success: After Preprocessing Completes
If corrections were applied, show a soft success note:

```
type: 'info'  (add this as a new note type with --sky border and --sky-lt background)
message: "✨ Ginawa ko nang mas malinaw ang larawan para mas madaling basahin!"
```

If no corrections were needed (the image was already clean), show nothing. Do not say "Your image is perfect" — that's unnecessary friction.

---

## API: `imagePreprocess.js`

Export a single async function:

```js
/**
 * Runs the full preprocessing pipeline on an image file.
 *
 * @param {File} file - The raw File object from the input element
 * @param {string} studentName - Used for personalized Alon messages
 * @returns {Promise<PreprocessResult>}
 */
export async function preprocessImage(file, studentName)
```

Return type `PreprocessResult`:

```js
{
  status: 'ok' | 'hard_block',   // 'hard_block' = severe blur or invalid file
  base64: string | null,          // preprocessed JPEG base64 (null if hard_block)
  imageType: 'image/jpeg',        // always JPEG after preprocessing
  corrections: string[],          // list of corrections applied e.g. ['crop', 'brightness', 'sharpen']
  diagnostics: {                  // raw diagnostic scores for debugging
    blurScore: number,
    brightnessScore: number,
    uniformitySD: number,
    rotationAngle: number | null,
    rotationConfidence: 'high' | 'low',
    cropInsets: { top, bottom, left, right }
  },
  qualityNote: {                  // null if no message needed
    type: 'error' | 'warn' | 'info',
    message: string
  } | null
}
```

---

## Integration: Changes to `UploadZone.jsx`

The `handleFile()` function currently does this:

```js
function handleFile(file) {
  if (!file) return
  setImageQualityNote(null)
  setTopicText('')
  const reader = new FileReader()
  reader.onload = (e) => {
    const base64 = e.target.result.split(',')[1]
    setImageBase64(base64)
    setImageType(file.type || 'image/jpeg')
  }
  reader.readAsDataURL(file)
}
```

Replace it with an async version that calls `preprocessImage()`:

```js
async function handleFile(file) {
  if (!file) return
  setImageQualityNote(null)
  setTopicText('')
  setPreprocessing(true)   // new local state — shows "Tinitingnan ang larawan…"

  const result = await preprocessImage(file, studentName)

  setPreprocessing(false)

  if (result.qualityNote) {
    setImageQualityNote(result.qualityNote)
  }

  if (result.status === 'hard_block') {
    // Do not set image state — user must retake
    return
  }

  setImageBase64(result.base64)
  setImageType(result.imageType)
}
```

Add `const [preprocessing, setPreprocessing] = useState(false)` as local state.

Show an inline "Tinitingnan ang larawan…" indicator while `preprocessing === true`. This replaces the current preview area content temporarily.

The `qualityNote` display area already exists in `UploadZone.jsx` — no structural changes needed there. Only add the `'info'` type styling to `UploadZone.module.css`.

---

## CSS: New `info` Quality Note Type

Add to `UploadZone.module.css`:

```css
.qualityInfo {
  background: color-mix(in srgb, var(--sky-lt) 15%, white);
  border: 2px solid var(--sky-lt);
  color: var(--sky-dk);
}
```

Use CSS variables only. No hardcoded hex.

In `UploadZone.jsx`, update the quality note className logic to handle three types:

```jsx
<div className={`${styles.qualityNote} ${
  imageQualityNote.type === 'error' ? styles.qualityError :
  imageQualityNote.type === 'warn'  ? styles.qualityWarn  :
  styles.qualityInfo
}`}>
```

---

## Console Logging

Add diagnostic logging for development visibility. Use the existing `[AralMate]` prefix pattern:

```js
console.log('[AralMate] Preprocess diagnostics:', result.diagnostics)
console.log('[AralMate] Preprocess corrections applied:', result.corrections)
```

Log at the end of `preprocessImage()` before returning, always — regardless of outcome.

---

## Files to Create

| File | Action |
|---|---|
| `src/lib/imagePreprocess.js` | CREATE — full preprocessing module |

## Files to Modify

| File | Changes |
|---|---|
| `src/components/UploadZone/UploadZone.jsx` | Replace `handleFile()` with async version, add `preprocessing` local state, add preprocessing indicator UI, update quality note className logic |
| `src/components/UploadZone/UploadZone.module.css` | Add `.qualityInfo` style |

---

## Acceptance Criteria

- [ ] A valid, sharp, well-lit photo passes through with no corrections applied and no quality note shown
- [ ] A dark photo is brightened — the preprocessed image visibly lighter than the original in the preview
- [ ] A mildly blurry photo (score 40–79) is sharpened and passes through with an info note
- [ ] A severely blurry photo (score < 40) shows Alon's hard block message; the analyze button does not appear
- [ ] A photo with dark table edges is cropped — the preview shows only the document area
- [ ] A slightly rotated photo (2°–15°) is straightened — the preview shows text aligned horizontally
- [ ] All preprocessed images are output as JPEG at max 1200px long edge, regardless of input format or size
- [ ] `[AralMate] Preprocess diagnostics:` log appears in browser console after every image selection
- [ ] No hardcoded hex values in any new or modified CSS — CSS variables only
- [ ] No new npm packages are installed — Canvas API only

---

## Out of Scope for This Instruction

- Full perspective / trapezoid correction (deferred to a future instruction)
- Real-time camera preview processing
- Any changes to Pass 1, Pass 2, or prompt files
- Any changes to `AppContext.jsx`, `useAnalysis.js`, or Supabase hooks

---

## Notes for the Dev Team

1. **Test on a real Android tablet if possible.** The preprocessing runs on the client device. Performance on a mid-range Android tablet is the real constraint — not a MacBook or a PC. Target under 2 seconds total pipeline time for a 3MP image.

2. **Rotation detection is an estimate — prefer to skip over applying wrong rotation.** If the confidence in the detected angle is low, skip rotation entirely. A slightly rotated image is better than a correctly-rotated-by-the-wrong-amount image.

3. **The blur check samples the center of the image, not the full image.** Dark borders and out-of-focus edges would unfairly lower the blur score for a sharp document. Only sample the inner 50% of image area for blur detection.

4. **Do not apply adaptive local contrast in the first version if the implementation is not clean.** A simpler global contrast stretch is acceptable for MVP. Note the decision in a code comment.

5. **The image preview in `UploadZone.jsx` should show the preprocessed image**, not the original. After `setImageBase64(result.base64)`, the preview will automatically update since it reads from state. No additional changes are needed for the preview.

6. **`imagePreprocess.js` should be a pure utility — no React hooks, no context access.** It takes a `File` and a `studentName` string and returns a `PreprocessResult`. This makes it testable in isolation.
