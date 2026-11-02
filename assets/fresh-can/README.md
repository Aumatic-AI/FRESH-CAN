# Fresh-CAN reference images

Drop the real reference photos of the Fresh-CAN truck/container here before
uploading them (nothing in this folder is read directly at runtime — the
app only ever uses the public URLs pasted into
`src/server/pipeline/prompts/brand/fresh-can.ts`, since Flux Kontext needs a
URL it can fetch itself, not a local file).

The exterior reference is ONE container-only photo (2026-11-02), uploaded to the
public `brand-assets` bucket and wired into `referenceImages.exterior` in
`src/server/pipeline/prompts/brand/fresh-can.ts`:
- `container.png` — standalone maroon shipping container (no truck, cab or
  wheels), door end with QR panel plus the long side with the wordmark. It is a
  design anchor only: scenes frame the container from any angle (no fixed
  views), and `unit.full` states which face carries what.

The old truck photos (`truck_exterior_*.png`) are no longer referenced; they
stay in the folder only because `lib/watermark.test.ts` reads `truck_exterior_rear_clean_2.png`. Do not re-add a view-tagged photo set.

`freshcan_interior_1.png` / `freshcan_interior_2.png` aren't used — no
current prompt builds an interior scene, so there's nothing for them to
guide. Keep them here for when an interior-scene prompt template exists.

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
