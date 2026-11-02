# Fresh-CAN reference images

Drop the real reference photos of the Fresh-CAN truck/container here before
uploading them (nothing in this folder is read directly at runtime — the
app only ever uses the public URLs pasted into
`src/server/pipeline/prompts/brand/fresh-can.ts`, since Flux Kontext needs a
URL it can fetch itself, not a local file).

The exterior references are four container-only photos (2026-11-03), uploaded to the
public `brand-assets` bucket and wired into `referenceImages.exterior` in
`src/server/pipeline/prompts/brand/fresh-can.ts`:
- `container_1.png` — front three-quarter, door end plus the wordmark side. The default
  anchor (character-ref source); its view is not one of the camera faces.
- `container_2.png` — opposite three-quarter (`cameraFace: 'door-end-3q'`).
- `container_3.png` — door end straight-on (`cameraFace: 'door-end-straight'`).
- `container_4.png` — long wordmark side straight-on (`cameraFace: 'long-side-straight'`).
They are design anchors only. Each exterior scene attaches ONE of them (rotated per
scene, stable on retry) next to the video's own generated view, and the scene's camera
(`core/containerCamera.ts`) never picks the face its source photo already shows, so no
scene reproduces a photo's angle, framing or background (each entry's `disregard`
names the buildings, trees and brighter red to ignore; the true colour is #6B1A1A).

The old truck photos (`truck_exterior_*.png`) are no longer referenced; they
stay in the folder only because `lib/watermark.test.ts` reads `truck_exterior_rear_clean_2.png`. Do not re-add a view-tagged photo set.

Interior photos: `freshcan_interior_1.png` to `_5.png` feed `referenceImages.interior`.
An interior scene attaches exactly two of them (picked per scene). 1 and 2 show the aisle
with glass-door fridges; 3 and 4 show shelving on both sides, and 5 is a shelf close-up.
Note `unit.interior` still describes fridges and a prep counter: update it if 3-5 are now the
canonical interior.

## Adding another reference photo later

1. Put the new image file in this folder.
2. From the repo root, run:
   ```bash
   npm run upload-brand-asset -- assets/fresh-can/<filename>
   ```
   This uploads it to the `brand-assets` bucket (created once already for
   this project) and prints back its public URL.
3. Add a new entry to `referenceImages.exterior` in
   `src/server/pipeline/prompts/brand/fresh-can.ts`, with a `framing` string
   that accurately describes what the new photo actually shows —
   mismatched framing/photo pairs confuse Flux Kontext's image-editing mode.

Re-running the upload command with an existing filename overwrites that
object at the same URL, but CDNs may serve the old bytes — upload a corrected
photo under a NEW filename and update its `url` in the brand file.
