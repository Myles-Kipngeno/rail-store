/**
 * Demo photos: replace the drawn look of the demo products with Pexels stock photos, pick-then-apply.
 * Demo products = everything in data/products.json (the 8 sample pieces + the 8 "demo-" pieces). No other
 * product is ever touched.
 *
 *   npm run demo:photos -- --fetch
 *     For each demo product + colour: one Pexels search (portrait, 8 results, 400ms between calls), the
 *     candidates (large2x) saved to tmp/demo-photos/<productId>/<colourId>/ with meta.json, and a review
 *     page tmp/demo-photos/index.html. Open it, pick one photo per colour (or none), "Save choices" →
 *     choices.json.
 *
 *   npm run demo:photos -- --review
 *     Rebuilds the review page from the meta.json files already downloaded (no API calls).
 *
 *   npm run demo:photos -- --apply path/to/choices.json [--dry-run] [--force]
 *     Each chosen photo goes through the admin upload pipeline (lib/image.ts prepareGarmentPhoto: remove.bg
 *     when REMOVE_BG_API_KEY is set → trim → 1000x1300 → WebP), is stored like admin uploads
 *     (lib/storage.ts), and becomes that colour's images.front with a Pexels credit, saved via lib/db.ts.
 *     A colour whose cutout fails is skipped with a log line. A colour that already has a non-Pexels
 *     photo (a real one from the admin) is skipped unless --force.
 *     --dry-run: process the photos and write the results to tmp/demo-photos/_out/ only (no upload, no DB).
 *
 * Env (.env.local, loaded by the npm script): PEXELS_API_KEY (fetch); Supabase keys + REMOVE_BG_API_KEY (apply).
 * Runs with the react-server condition so the server-only modules (lib/db.ts etc.) can be imported.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sample from "../data/products.json";
import { getProduct, upsertProduct } from "../lib/db";
import { ImageRejected, prepareGarmentPhoto } from "../lib/image";
import { storeProductImage } from "../lib/storage";
import type { Colorway, GarmentType, ImageCredit, Product } from "../lib/types";

const ROOT = path.join(process.cwd(), "tmp", "demo-photos");
const DEMO = sample as Product[];
const DEMO_IDS = new Set(DEMO.map((p) => p.id));
const PAUSE_MS = 400;

type Candidate = { id: number; file: string; url: string; photographer: string; photographer_url: string; alt: string };
type Meta = { productId: string; colorId: string; query: string; candidates: Candidate[] };
/** choices.json: "<productId>/<colourId>" → Pexels photo id (or null = keep the drawing). */
type Choices = Record<string, number | null>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(...a);

// ---------------------------------------------------------------- queries
const NOUN: Record<GarmentType, string> = {
  tee: "t-shirt",
  long: "long sleeve t-shirt",
  shirt: "button shirt",
  hoodie: "hoodie",
  tank: "tank top",
  jacket: "jacket",
  jersey: "football jersey",
  pants: "trousers",
  cargo: "cargo pants",
  joggers: "joggers sweatpants",
  shorts: "shorts",
  sneaker: "sneakers",
  runner: "running shoes",
  boot: "chelsea boots",
  slide: "slide sandals",
};

function query(p: Product, c: Colorway) {
  const colour = c.name.toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
  const noun = p.category === "jeans" ? "jeans" : NOUN[p.type] ?? p.type;
  const dept = p.department ?? "tops";
  const suffix = dept === "shoes" ? "side view white background" : dept === "bottoms" ? "white background" : "hanger white background";
  return `${colour} ${noun} ${suffix}`;
}

// ---------------------------------------------------------------- --fetch
async function fetchAll() {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) throw new Error("PEXELS_API_KEY is not set (.env.local). Get one at https://www.pexels.com/api/.");
  const metas: Meta[] = [];
  for (const p of DEMO) {
    for (const c of p.colors) {
      const q = query(p, c);
      const dir = path.join(ROOT, p.id, c.id);
      await mkdir(dir, { recursive: true });
      const url = `https://api.pexels.com/v1/search?${new URLSearchParams({ query: q, orientation: "portrait", per_page: "8" })}`;
      const res = await fetch(url, { headers: { Authorization: key } });
      await sleep(PAUSE_MS);
      if (!res.ok) {
        log(`✗ ${p.id}/${c.id}: Pexels ${res.status} for "${q}"`);
        if (res.status === 401 || res.status === 403) throw new Error("Pexels rejected the API key.");
        if (res.status === 429) throw new Error("Pexels rate limit reached; try again later.");
        continue;
      }
      const body = (await res.json()) as {
        photos: { id: number; url: string; photographer: string; photographer_url: string; alt?: string; src: { large2x: string } }[];
      };
      const candidates: Candidate[] = [];
      for (const ph of body.photos) {
        const file = `${ph.id}.jpg`;
        const target = path.join(dir, file);
        if (!existsSync(target)) {
          const img = await fetch(ph.src.large2x);
          if (!img.ok) {
            log(`  ! couldn't download photo ${ph.id} (${img.status})`);
            continue;
          }
          await writeFile(target, Buffer.from(await img.arrayBuffer()));
          await sleep(PAUSE_MS);
        }
        candidates.push({ id: ph.id, file, url: ph.url, photographer: ph.photographer, photographer_url: ph.photographer_url, alt: ph.alt ?? "" });
      }
      const meta: Meta = { productId: p.id, colorId: c.id, query: q, candidates };
      await writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));
      metas.push(meta);
      log(`✓ ${p.id}/${c.id}: ${candidates.length} candidates ("${q}")`);
    }
  }
  await writeFile(path.join(ROOT, "index.html"), reviewPage(metas));
  log(`\nReview page: ${path.join(ROOT, "index.html")}`);
  log("Pick one photo per colour (or leave \"Keep the drawing\"), click Save choices, then:");
  log("  npm run demo:photos -- --apply <path to choices.json>");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function reviewPage(metas: Meta[]) {
  const names = new Map(DEMO.map((p) => [p.id, p]));
  const groups = metas
    .map((m) => {
      const p = names.get(m.productId)!;
      const c = p.colors.find((x) => x.id === m.colorId)!;
      const key = `${m.productId}/${m.colorId}`;
      const cells = m.candidates
        .map(
          (k) => `<label class="cell"><img src="${esc(`${m.productId}/${m.colorId}/${k.file}`)}" alt="${esc(k.alt)}" loading="lazy">
<span><input type="radio" name="${esc(key)}" value="${k.id}"> #${k.id} · <a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.photographer)}</a></span></label>`,
        )
        .join("\n");
      return `<section><h2>${esc(p.name)} · <i style="background:${esc(c.hex)}"></i> ${esc(c.name)} <small>“${esc(m.query)}”</small></h2>
<label class="keep"><input type="radio" name="${esc(key)}" value="" checked> Keep the drawing</label>
<div class="grid">${cells || "<p>No results.</p>"}</div></section>`;
    })
    .join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Demo photos: pick</title>
<style>
body{margin:0;padding:24px;font:14px system-ui,sans-serif;background:#eef0ed;color:#121412}
h1{margin:0 0 4px}section{margin:28px 0}h2{font-size:15px;margin:0 0 8px}h2 i{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:middle;box-shadow:inset 0 0 0 1px #0003}
small{color:#6a7068;font-weight:400}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.cell{display:grid;gap:6px;background:#fff;padding:6px;border-radius:6px;cursor:pointer}.cell:has(input:checked){outline:3px solid #121412}
.cell img{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:4px}.cell span{font-size:12px}.keep{display:inline-block;margin-bottom:8px}
.bar{position:sticky;top:0;background:#eef0ed;padding:12px 0;display:flex;gap:12px;align-items:center;z-index:1}
button{font:inherit;padding:10px 18px;border:0;border-radius:6px;background:#121412;color:#fff;cursor:pointer}
</style></head><body>
<h1>Demo photos</h1><p>One photo per colour, or keep the drawing. Photos are from Pexels (free to use); the photographer is credited on the store.</p>
<div class="bar"><button id="save">Save choices</button><span id="count"></span></div>
${groups}
<script>
const count=()=>{const n=document.querySelectorAll('.cell input:checked').length;document.getElementById('count').textContent=n+' picked';};
document.addEventListener('change',count);count();
document.getElementById('save').onclick=()=>{const out={};for(const r of document.querySelectorAll('input[type=radio]:checked')){out[r.name]=r.value?Number(r.value):null;}
const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));a.download='choices.json';a.click();};
</script></body></html>`;
}

/** --review: rebuild index.html from the downloaded meta.json files, in demo product order. */
async function review() {
  const metas: Meta[] = [];
  for (const p of DEMO)
    for (const c of p.colors) {
      const f = path.join(ROOT, p.id, c.id, "meta.json");
      if (existsSync(f)) metas.push(JSON.parse(await readFile(f, "utf8")) as Meta);
    }
  if (!metas.length) throw new Error("Nothing downloaded yet: run --fetch first.");
  await writeFile(path.join(ROOT, "index.html"), reviewPage(metas));
  log(`Review page (${metas.length} colours): ${path.join(ROOT, "index.html")}`);
}

// ---------------------------------------------------------------- --apply
async function apply(choicesFile: string, dryRun: boolean, force: boolean) {
  const choices = JSON.parse(await readFile(choicesFile, "utf8")) as Choices;
  const removeBgKey = process.env.REMOVE_BG_API_KEY?.trim();
  if (!removeBgKey) log("! REMOVE_BG_API_KEY is not set: opaque stock photos will be rejected by the cutout step.\n");
  const outDir = path.join(ROOT, "_out");
  if (dryRun) await mkdir(outDir, { recursive: true });

  // Group by product so each product is saved once.
  const byProduct = new Map<string, { colorId: string; photoId: number }[]>();
  for (const [key, photoId] of Object.entries(choices)) {
    const [productId, colorId] = key.split("/");
    if (!photoId) continue;
    if (!DEMO_IDS.has(productId)) {
      log(`✗ ${key}: not a demo product, skipped`);
      continue;
    }
    byProduct.set(productId, [...(byProduct.get(productId) ?? []), { colorId, photoId: Number(photoId) }]);
  }

  let done = 0;
  for (const [productId, picks] of byProduct) {
    const product = dryRun ? DEMO.find((p) => p.id === productId) : await getProduct(productId, { includeDrafts: true });
    if (!product) {
      log(`✗ ${productId}: not in the database (apply the demo seed migration first), skipped`);
      continue;
    }
    let changed = false;
    for (const { colorId, photoId } of picks) {
      const key = `${productId}/${colorId}`;
      const color = product.colors.find((c) => c.id === colorId);
      if (!color) {
        log(`✗ ${key}: no such colour on the product, skipped`);
        continue;
      }
      if (color.images?.front && color.images.credit?.source !== "pexels" && !force) {
        log(`✗ ${key}: already has its own photo (not a Pexels demo photo), skipped (--force to replace)`);
        continue;
      }
      const dir = path.join(ROOT, productId, colorId);
      const meta = JSON.parse(await readFile(path.join(dir, "meta.json"), "utf8")) as Meta;
      const cand = meta.candidates.find((k) => k.id === photoId);
      if (!cand) {
        log(`✗ ${key}: photo ${photoId} isn't one of the fetched candidates, skipped`);
        continue;
      }
      let webp: Buffer;
      try {
        webp = await prepareGarmentPhoto(await readFile(path.join(dir, cand.file)), "image/jpeg", removeBgKey);
      } catch (e) {
        if (e instanceof ImageRejected) {
          log(`✗ ${key}: cutout failed (${e.message}), skipped`);
          continue;
        }
        throw e;
      }
      const credit: ImageCredit = { source: "pexels", photographer: cand.photographer.slice(0, 120), url: cand.url };
      if (dryRun) {
        await writeFile(path.join(outDir, `${productId}__${colorId}.webp`), webp);
        log(`✓ ${key}: processed (dry run) → _out/${productId}__${colorId}.webp`);
      } else {
        const front = await storeProductImage(webp);
        color.images = { ...color.images, front, credit };
        changed = true;
        log(`✓ ${key}: photo by ${credit.photographer} applied`);
      }
      done++;
    }
    if (changed) await upsertProduct(product);
  }

  log(`\n${done} colour${done === 1 ? "" : "s"} ${dryRun ? "processed (dry run, nothing saved)" : "updated"}.`);
  if (!dryRun && done) {
    log("Reminder: the store pages are cached. Save any piece in /admin (or redeploy) to refresh them.");
    log("Credits need migration 20261122000000_image_credits.sql; without it the photos apply but the credit isn't stored.");
  }
}

// ---------------------------------------------------------------- main
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--fetch")) return fetchAll();
  if (args.includes("--review")) return review();
  const i = args.indexOf("--apply");
  if (i >= 0 && args[i + 1]) return apply(path.resolve(args[i + 1]), args.includes("--dry-run"), args.includes("--force"));
  log("Usage:\n  npm run demo:photos -- --fetch\n  npm run demo:photos -- --review\n  npm run demo:photos -- --apply choices.json [--dry-run] [--force]");
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
