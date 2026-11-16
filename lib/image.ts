/**
 * Server-side framing of uploaded garment photos, so a photo hangs from the rack rod exactly like
 * the drawn SVG garments (Garment.tsx draws a 200x260 viewBox; a photo replaces the whole SVG,
 * object-fit: contain, top centre).
 */
import "server-only";
import sharp from "sharp";

/** Output canvas: same 200:260 aspect as the garment SVG viewBox. */
const OUT_W = 1000;
const OUT_H = 1300;
/** The trimmed garment (hanger hook included) is scaled to fit inside this box. */
const FIT_W = 860;
const FIT_H = 1220;
/**
 * Top edge of the garment = top of the hanger hook. The drawn hook tops out at y=10 of 260
 * (Garment.tsx), which is y=50 on this canvas, so photo hooks meet the rod where drawn ones do.
 */
const TOP_Y = Math.round((10 / 260) * OUT_H);
/** Smallest trimmed height we accept; below this the photo looks soft on the rack. */
const MIN_H = 800;
/** Pixels at or below this alpha count as background when trimming (matches lib/cutout.ts). */
const ALPHA_MIN = 10;

export class ImageRejected extends Error {}

/** True when the image has no transparent pixels at all (e.g. a JPG, or a PNG with the background left in). */
export async function isOpaque(input: Buffer): Promise<boolean> {
  try {
    const meta = await sharp(input).metadata();
    return !meta.hasAlpha || (await sharp(input).stats()).isOpaque;
  } catch {
    return false; // unreadable: let frameGarmentPhoto() reject it with its own message
  }
}

/**
 * Cuts the background out with remove.bg and returns a transparent PNG.
 * Throws ImageRejected with remove.bg's error title when the API refuses or fails.
 */
export async function removeBackground(input: Buffer, type: string, apiKey: string): Promise<Buffer> {
  const form = new FormData();
  form.append("image_file", new Blob([new Uint8Array(input)], { type: type || "application/octet-stream" }), "photo");
  form.append("size", "auto");
  form.append("format", "png");
  let res: Response;
  try {
    res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    throw new ImageRejected(
      timedOut ? "Background removal timed out (remove.bg). Try again." : "Couldn't reach remove.bg to remove the background. Try again.",
    );
  }
  if (!res.ok) {
    let title = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { errors?: { title?: string }[] };
      if (body.errors?.[0]?.title) title = body.errors[0].title;
    } catch {}
    throw new ImageRejected(`Background removal failed (remove.bg: ${title}).`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Bounding box of pixels with alpha > ALPHA_MIN, or null when there are none. */
function alphaBounds(alpha: Buffer, w: number, h: number) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (alpha[row + x] > ALPHA_MIN) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Auto-orients, rejects opaque or too-small photos, trims transparent edges, fits the garment
 * inside 860x1220 and places it on a transparent 1000x1300 canvas (centred, top at TOP_Y).
 * Returns WebP q85 with alpha and no metadata. Throws ImageRejected with a user-facing message.
 */
export async function frameGarmentPhoto(input: Buffer): Promise<Buffer> {
  try {
    await sharp(input).metadata();
  } catch {
    throw new ImageRejected("That file isn't a readable image.");
  }
  if (await isOpaque(input))
    throw new ImageRejected("Remove the background first (transparent PNG or WebP).");

  // Bake the EXIF orientation in (lossless PNG) so every later step works on upright pixels.
  const upright = await sharp(input).rotate().ensureAlpha().png().toBuffer({ resolveWithObject: true });
  const { width, height } = upright.info;
  const alpha = await sharp(upright.data).extractChannel("alpha").raw().toBuffer();
  const box = alphaBounds(alpha, width, height);
  if (!box) throw new ImageRejected("The photo is empty: nothing left after removing the background.");
  if (box.height < MIN_H) throw new ImageRejected("Photo too small — shoot closer or at higher resolution.");

  const garment = await sharp(upright.data)
    .extract(box)
    .resize(FIT_W, FIT_H, { fit: "inside" })
    .png()
    .toBuffer({ resolveWithObject: true });

  return sharp({ create: { width: OUT_W, height: OUT_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: garment.data, left: Math.round((OUT_W - garment.info.width) / 2), top: TOP_Y }])
    .webp({ quality: 85 }) // alpha is kept; sharp strips metadata unless withMetadata() is asked for
    .toBuffer();
}
