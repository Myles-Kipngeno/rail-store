/**
 * Browser-only photo helpers for the admin. Turns a phone photo of a garment into a framed,
 * transparent image that hangs from the rack rod exactly like the drawn SVG garments.
 */

/** Output canvas: same 200:260 aspect as the garment SVG viewBox. */
const OUT_W = 1000;
const OUT_H = 1300;
/** The garment (hanger hook included) is scaled to fit inside this box. */
const FIT_W = 920;
const FIT_H = 1240;
/**
 * Where the top of the garment (the hanger hook) sits, so it meets the rod. The drawn garments'
 * hook tops out at y=10 in their 200x260 viewBox (see Garment.tsx); on this 1000x1300 canvas that is y=50.
 */
const TOP_Y = (10 / 260) * OUT_H;
const ALPHA_MIN = 10;
const QUALITY = 0.85;

export type RemovalProgress = { key: string; current: number; total: number };

/**
 * Removes the background with @imgly/background-removal and returns a transparent PNG.
 * The library (and its ~40 MB model, fetched on first use and cached by the browser) is loaded
 * on demand, so it never ships with any page's first-load JS.
 */
export async function removeBackground(file: File, onProgress?: (p: RemovalProgress) => void): Promise<Blob> {
  const { removeBackground: run } = await import("@imgly/background-removal");
  return run(file, {
    output: { format: "image/png" },
    progress: (key, current, total) => onProgress?.({ key, current, total }),
  });
}

/** Bounding box of pixels with alpha > ALPHA_MIN, or null when the image is fully opaque/empty. */
function opaqueBounds(data: Uint8ClampedArray, w: number, h: number) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  let transparent = false;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      const a = data[row + x * 4 + 3];
      if (a > ALPHA_MIN) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      if (a < 255) transparent = true;
    }
  }
  if (!transparent || maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas isn't available in this browser.");
  return { c, ctx };
}

/**
 * Crops to the garment (when the image has transparency) and places it on a transparent
 * 1000x1300 canvas: scaled to fit 920x1240, centred horizontally, top edge at y=10. WebP 0.85.
 */
export async function frameGarment(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const src = canvas(bmp.width, bmp.height);
    src.ctx.drawImage(bmp, 0, 0);
    const box =
      opaqueBounds(src.ctx.getImageData(0, 0, bmp.width, bmp.height).data, bmp.width, bmp.height) ??
      { x: 0, y: 0, w: bmp.width, h: bmp.height };

    const scale = Math.min(FIT_W / box.w, FIT_H / box.h);
    const dw = Math.round(box.w * scale);
    const dh = Math.round(box.h * scale);
    const out = canvas(OUT_W, OUT_H);
    out.ctx.imageSmoothingQuality = "high";
    out.ctx.drawImage(src.c, box.x, box.y, box.w, box.h, Math.round((OUT_W - dw) / 2), TOP_Y, dw, dh);

    return await new Promise<Blob>((resolve, reject) =>
      out.c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the photo."))), "image/webp", QUALITY),
    );
  } finally {
    bmp.close();
  }
}
