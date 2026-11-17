# RAIL store

Clothing store where every product hangs on one clothes rail. Hover pulls a piece off the rack, click flies it into a focused item view with colour hang tags and a front/back flip. Kenyan market: prices in KES, ordering via WhatsApp now, M-Pesa later.

## Commands
- `npm run dev` — dev server (http://localhost:3000)
- `npm run build && npm start` — production
- `npm run typecheck` — run after every change; must pass
- Admin: `/admin` (HTTP Basic auth; needs `ADMIN_PASSWORD` in `.env.local`, see `.env.example`)
- `npm run db:seed` — load `data/products.json` (+ local `uploads/`) into Supabase
- `npm run demo:photos -- --fetch | --review | --apply choices.json [--dry-run] [--force]` — Pexels stock photos for the demo products (scripts/demo-photos.ts; downloads in git-ignored `tmp/`)
- Schema: `supabase/migrations/*.sql` (`supabase db push`, or paste into the SQL editor)

## Stack (pinned, do not upgrade without asking)
Next.js 15.5 App Router · React 19.1 · TypeScript 5.9 strict · `motion` 12 (import from `motion/react`) · plain CSS (`app/globals.css`, no Tailwind) · fonts self-hosted via `@fontsource` (Archivo variable with width axis, JetBrains Mono) · Supabase (`@supabase/supabase-js`, server-only) for Postgres + Storage (project in eu-west-3 Paris) · deployed on Vercel, functions pinned to `cdg1` in `vercel.json` to sit next to the database.

## Map
```
app/page.tsx                 home: rack hero (tops only) + sections below (static, revalidated on admin save)
app/shop/[department]/page.tsx  department pages, SSG (generateStaticParams over DEPARTMENTS, dynamicParams=false),
                             revalidated on admin save. tops/formal = Store (the rack), bottoms = Store
                             rackStyle="folded", shoes = shelf (ShoeItem), accessories = grid (ProductCard).
                             Chips = CATEGORIES[dept] with pieces; ?category= deep-links (read client-side).
app/shop/page.tsx            /shop → /shop/tops
app/actions.ts               public server actions: newsletter `subscribe` (validates, then lib/db.ts addSubscriber)
components/home/             sections below the rack, in page order (index.ts); each hides itself when empty
  Showcase.tsx               pinned scroll showcase, one per STORE.showcase department (see "Home sections").
                             Loaded via ShowcaseLazy (next/dynamic) to keep useScroll off the first load.
  ShoeShelf.tsx              ShoeItem: a shoe on the floating shelf (/shop/shoes), CSS hover lift
  Row.tsx                    product rows (server: cards, ProductCard also used by the accessories grid)
  RowShell.tsx               rows' client half: reveal, mouse drag, ← → (RowArrows)
  Lookbook.tsx               "Off the rack" curved wall (rAF loop, drag/swipe, drift). Loaded via LookbookLazy
  SiteFooter.tsx (+ FooterNewsletter)  footer with the newsletter form; revealed from under .page-main on home
  shot.tsx                   product photo via next/image's getImgProps (plain <img>, lazy, srcset; see file:
                             importing "next/image" would ship its client component) or the drawn garment
app/p/[id]/page.tsx          full product page (SSG via generateStaticParams)
app/admin/page.tsx + actions.ts   admin UI + server actions (save, delete, reorder, upload; lookbook upload/
                             save/remove/reorder)
app/uploads/[file]/route.ts  redirects legacy /uploads/<file> links to the Storage bucket
middleware.ts                Basic auth for /admin
components/Store.tsx         rack + item view + all transitions (the core). Reused by home and department pages:
                             optional `categories` (labelled chips), `rackStyle`; URLs keep the current path
                             (?category=, ?piece=)
components/Chrome.tsx        Header (department nav; ≤980px a Menu button), Ticker, AddToBagButton
components/MenuSheet.tsx     phone menu: full-screen sheet, staggered links (loaded on demand via next/dynamic)
components/shop/CategoryFilter.tsx  chips + ?category= for the shelf and grid department pages
components/Pieces.tsx        ColorLayers (wipe), Flipper, HangTags, SizePicker
components/Garment.tsx       garment renderer: the uploaded photo when present, else the drawing. Delegates tops to
                             Top.tsx, bottoms to Trousers.tsx (same 200×260 box, clip hanger) and shoes to Shoe.tsx
                             (240×140, toe right; "back" = heel view). All three are next/dynamic (still SSR) so the
                             drawing code stays off the first load. Shared defs: GarmentDefs.tsx + garment/shapes*.ts
components/BagProvider.tsx   cart context, persisted to localStorage
components/BagDrawer.tsx     cart drawer + WhatsApp order + toast
components/ProductDetail.tsx /p/[id] client view
components/AdminEditor.tsx   admin list, form, live preview; Pieces / Lookbook tabs
components/LookbookAdmin.tsx admin Lookbook tab (upload, caption, product link, publish, ↑/↓, remove)
lib/db.ts                    ONLY place that reads/writes products, subscribers, orders and the lookbook
                             (Supabase; sample JSON fallback when unconfigured)
lib/supabase.ts              server-only Supabase clients (anon = RLS/published, service role = admin)
supabase/migrations/         schema, RLS, upsert_product/reorder_products functions, product-images bucket,
                             departments/sizes, subscribers (newsletter; service role only), orders,
                             lookbook (anon reads published rows; reorder_lookbook)
scripts/seed.mjs             seeds Supabase from data/products.json
scripts/demo-photos.ts       Pexels photos for the demo products (data/products.json ids only): fetch candidates +
                             review page, then apply the picks through the admin photo pipeline (tsx, react-server)
lib/image.ts, lib/storage.ts photo pipeline (prepareGarmentPhoto: remove.bg → trim → 1000x1300 WebP) and bucket upload,
                             shared by the admin actions and the script
lib/types.ts                 Product, Colorway, Print, Size; lib/format.ts helpers; lib/config.ts store name/ticker
data/products.json           seed data (8 sample pieces); also the read-only fallback before Supabase is set up
```

## Data model (lib/types.ts)
Product → many Colorway. Price is whole KES.

Every product has a `department` and a `category` from a fixed list (`DEPARTMENTS` / `CATEGORIES` in lib/types.ts; the DB enforces the same pairs):
- tops: tees, shirts, polos, hoodies, sweaters, jackets
- bottoms: jeans, sweatpants, cargo, shorts, trousers
- formal: suits, blazers, dress-shirts, dress-trousers
- shoes: sneakers, boots, formal-shoes, slides
- accessories: caps, bags, belts, socks

Stock is per colour per size, and the size system comes from department/category via `sizesFor(product)`. Stock, SizePicker, the admin stock grid and `clean()` all use it, so never hard-code a size list:
- tops, and formal suits/blazers/dress-shirts: `S M L XL XXL`
- bottoms and formal dress-trousers: waist `28 30 32 34 36 38 40`
- shoes: EU `38`–`46`
- accessories: `ONE`

A colourway may have `images.front/back` (real photos) and `images.credit` (`{ source: "pexels", photographer, url }` for the front photo; column `colorways.image_credit`). The server keeps a credit only while that photo stays the front, and never takes one from the client. While any published product uses a Pexels photo, the footer links "Demo photos via Pexels". Tops, bottoms and shoes have a drawn fallback: without a photo the SVG is drawn from `type` + `print`. `DRAWN_TYPES[department]` lists the shapes each may use (tops: tee…jersey; bottoms: pants, cargo, joggers, shorts; shoes: sneaker, runner, boot, slide); `drawnType()` falls back to the department's first shape. `trim` is the rib/collar on tops; on trousers it's the rib waist and cuffs on joggers, a side stripe on joggers and shorts when it differs from `hex`, and otherwise the thread colour (gold by default on denim, category `jeans`); on shoes it's the sole. `printKindsFor(type)`: trousers take text/logo/letter (small, left thigh), shoes none. Formal and accessories need a front photo on every colour before they can be published (`hasDrawnFallback()`, enforced in `clean()`); drafts can be saved without one. New `garment_type` values need a migration (Postgres enum). Rack order = `products.position` (admin ↑/↓ changes it). Reads come from the `product_documents` view, already shaped as `Product`. `published: false` = draft, hidden from the store.

## Home sections (app/page.tsx, components/home)
Order below the rack:
1. One pinned showcase per department in `STORE.showcase` (lib/config.ts, now bottoms then shoes) that has 2+ published pieces with a photo or a drawing, in rack order.
2. Rows: "New arrivals" (the 8 newest by `createdAt`), then one row per category with 3+ pieces, in rack order.
3. The "Off the rack" lookbook.
4. The footer (outside `.page-main`).

Showcase (Showcase.tsx), the rules:
- **Layout**: `.showcase-pin` is `100svh + n × --showcase-seg` tall (80vh, 60vh on phones); `.showcase-stage` is `sticky; top: 0; height: 100svh`, so it pins for n segments, then releases and scrolls away.
  - Left column at `--showcase-x` (8vw): eyebrow = department, "N pairs" (bottoms/shoes) or "N pieces", name (display font), `formatKES` price, "View product" → `/p/<id>?c=<colourId>`.
  - Centre: the current piece, `--showcase-h` (62svh) tall. Shoes use a narrower box, `--showcase-shoe-w`, so the ghost doesn't overlap them. The front photo of the first colour that has one, else the drawing. Clicking it opens the same link.
  - Right, +26vw: the next piece as a ghost at opacity .14 and scale .92.
  - Bottom-left: a "01 / 04" counter and a 2px progress bar.
- **Motion**: each piece holds still for the first 65% of its segment. In the last 35% (eased with `cubic-bezier(.2,.8,.2,1)`):
  - the current piece fades out and rises 24px;
  - the ghost moves to the centre (scale → 1, opacity → 1) and a new ghost fades in;
  - the text swaps with a masked slide (old up and out, new from below).

  `position()` / `look()` in the file hold the maths. Function transforms only: range transforms of `useScroll` get handed to a native ScrollTimeline, which throws for ranges outside 0..1 and crashes the page.
- **≤640px**: no ghost (the next piece fades in in place), text under the piece.
- **prefers-reduced-motion**: the pinned stage is hidden and `.showcase-list` (a plain vertical list) shows instead.
- **Ghost**: the next piece also gets `grayscale(.7)`, which eases to 0 as it reaches the centre.

Rows (Row.tsx + RowShell.tsx):
- **Header**: eyebrow + title on the left. On the right, "View all" (category → `/shop/<dept>?category=<cat>`, which selects that chip; New arrivals → `/shop`) and ← → buttons, which scroll by one card.
- **Track**: scroll-snap x mandatory, no scrollbar. Card width comes from `--row-n` cards visible (4.3; 2.6 at ≤980px; 1.6 at ≤640px). Touch swipes natively. Mouse drags with pointer events: snapping is off during the drag, it settles on the nearest card, and the click that ends a drag is swallowed.
- **Card** (ProductCard): `--tile` background, 4:5, the first colour with stock (photo preferred). Hover or focus darkens the tile 4%, scales the piece to 1.03 and crossfades front → back in 0.35s. There is a back only for a front + back photo pair, or a drawing; there's never a photo front with a drawn back. "Sold out" chip when no colour has stock.
- **Reveal**: at 20% in view, the header then the cards fade up 16px, `--i` × 60ms, once.
- **Reduced motion**: no reveal, no scale, instant swap.

Lookbook (Lookbook.tsx), data from `lookbook` via `getLookbook()`:
- **Placeholders**: with no published rows (or before the migration is applied), 7 drawn pieces on a tinted background with "@rail.ke · <name>" captions.
- **Cards**: portrait, 290px wide, heights alternating 420/360 (210px wide and 300/260 on phones), inside `perspective: 1400px`.
- **One rAF loop**, transforms only:
  - The track `translate3d`s.
  - Each card gets `rotateY = clamp(offset × -36deg, ±22deg)` and `translateZ = -|offset| × 60px`, where `offset = (card centre - viewport centre) / viewport width`.
  - Track velocity adds `skewX` (max 4deg) that settles back.
- **Motion**:
  - It drifts left at 40px/s, pausing on hover, focus and drag.
  - It loops seamlessly with N copies of the list; duplicates are `aria-hidden` with their links out of the tab order.
  - ← → nudge by one card (600ms ease-out). Drag or swipe (pointer events, `touch-action: pan-y`) flings, and a drag never clicks.
  - The loop stops off-screen (IntersectionObserver) and in a hidden tab.
- **Links**: a linked product shows a "Shop the look" pill → `/p/<id>`.
- **Reduced motion**: a plain scroll-snap row.
- **Admin**: Lookbook tab. Uploads reuse `createImageUpload`, then `uploadLookbookImage`: no cutout or framing; it auto-orients, scales to max 1400px tall and saves WebP q80 without metadata (`lookbookPhoto()` in lib/image.ts). New photos are drafts at the end.

Footer (SiteFooter.tsx):
- **Columns**: Visit (city + `STORE.hours`), Newsletter, Shop, Help. A giant lime RAIL wordmark sits across the bottom.
- **Reveal**: on the home page `.page-main` (z-index 1, `--wall` background) scrolls off the footer (`.page-main + .site-foot`: sticky, bottom 0, z-index 0). Elsewhere, and with reduced motion, it's a plain footer.
- **Newsletter**: the `subscribe` server action only. It validates, lowercases, ignores duplicates and has a honeypot. Success shows the shared toast (`useBag().notify`).

The item view hides `.home` and `.site-foot` while it's open (`html[data-item-open]`, set in Store.tsx). This locks page scroll to the rack without `overflow: hidden`, because on short screens the info panel needs to scroll.

## Drawn garments (Garment.tsx → Top.tsx / Trousers.tsx / Shoe.tsx, garment/shapes*.ts, GarmentDefs.tsx)
- **One sprite per page**: `<GarmentDefs/>` in app/layout.tsx holds every gradient (key light, roll-off, metal, sole), filter (soft blurs, fabric noise), pattern (twill, rib, mesh, perforation, emboss) and outline clipPath, with ids `gd-*` (`GD` in shapes.ts). Garments reference these and never define their own `<defs>`, so ids can't clash or mismatch on hydration. Blur filters use a fixed user-space region: a bounding-box region on a thin stroke clips the blur away.
- **`detail`**:
  - `"low"` (default) for the rack, rows, thumbnails, admin list and lookbook: shapes, gradients and folds, never the noise filter, to keep rack hover smooth.
  - `"high"` for the item view and product page (ColorLayers) and the showcase: adds fabric noise, twill or mesh, dashed stitching and the fine folds.
- **Tones** (`tone()`): highlights hex +12%, mid folds −8%, shadows −18%, deep −32%.
- **Trousers**: clip hanger (metal bar and spring clips; the waist sags between them).
  - Whiskers, knee bend and a stacked hem break.
  - Fly with J-stitch, slant pockets, and a coin pocket on denim.
  - Back: yoke, stitched back pockets and a waistband label.
  - Cargo: bellows pockets with snapped flaps. Joggers: rib waist, drawcord with aglets, rib cuffs. Shorts: turned-up hem with side splits.
- **Shoes** (profile, toe right, toe spring, arch lift, contact shadow): sneaker, runner (mesh, sculpted midsole, reflective heel), Chelsea boot and slide. "Heel" is the pair seen from behind.
- **Tops**: seams, sleeve and hem folds, rib collar and cuffs, shirt placket and buttons, hoodie hood depth and aglets, jacket zip. Prints sit under multiply fold shading.
- **No brand marks**: no stripe trios, swooshes or logos on the drawings.

## The rack UI spec (source of truth, keep it exactly)
0. **Hero = one screen**: `.store` is exactly `100svh`, a flex column of header / chips / stage / ticker (in flow, not fixed). The stage takes the rest. The rail + caption + button group is centred in it, nudged up `--hero-nudge` (3svh). Nothing scrolls at rest, and home sections start at the fold.
   - **Sizing is from the viewport, no breakpoints**: `--gw: clamp(118px, min(15vw, 31svh), 250px)`. The rack still shrinks it to fit all pieces across (`--rack-gw`), with `--slot`/`--open` = 0.62 / 1.15 × that.
   - The caption has a fixed height (`--caption-h`), so the button never shifts on hover.
   - Short screens (<720px tall) tighten the header and chips tokens first.
   - The item view fits the stage: centre card height `min(46svh, gw × 1.6)` (`--cw`). Below 800px tall it drops the keyboard hint and trims spacing. Below 620px tall only the item view scrolls.
1. **Rack**: one rod; pieces edge-on at `rotateY(64deg)` in `--slot` wide slots, overlapping. Pieces after the hovered one turn the other way (`-64deg`).
   Drawn trousers hang from a clip hanger (straight bar, two clips at the waistband corners) with the hook at the same y≈10, so they share the rod line with the tops.
2. **Hover / focus / first tap**: slot widens to `--open`, garment turns to `0deg` + `translateZ(18px)`, 0.62s `cubic-bezier(.2,.8,.2,1)`. Caption shows name, price, colour dots.
3. **Click / second tap → item view**: FLIP flight of the garment from its hanger to centre (760ms, WAAPI `fly()` in Store.tsx). Other slots blur and fade with a stagger (`--d` × 22ms). Ghosts and the info panel fade in after 420ms.
   - **Add to bag** (item view and `/p/<id>`, `AddToBagButton` in Chrome.tsx): no size → the size shake, nothing flies. Otherwise the button keeps its width and shows a 14px spinner + "Adding" (550ms); then a copy of the garment (`flyToBag()`, WAAPI, middle keyframe at offset .45 lifted above the line = the arc) flies from its rect to the header Bag button in 700ms, scaling to 0.12 and fading out. `bag.add()` fires when it lands: the count springs 1 → 1.35 → 1 and the Bag button gets a brief lime ring (`bag.pulse`). The button reads "Added to bag ✓" for 2.4s with a "View bag →" link sliding in under it (opens the drawer), then resets. "Buy it now" on `/p/<id>` adds instantly.
4. **Item view**: centre card sharp; neighbours at `scale .72, blur 5px, opacity .34`; far cards hidden. Arrows, ←/→ keys, swipe. Clicking a ghost navigates.
5. **Colour**: hang tags right of the shoulder. Selected tag drops 12px with a ring. Change = new layer revealed bottom→top with `clip-path` (0.75s); old layers removed after.
6. **Front/Back** (drawn shoes: "Side / Heel", `sideLabel()`): rotate to 90°, swap the side, rotate back from -90° (0.2s + 0.34s).
7. **Close** (round × top-right / Esc / ← Back to rack, all via `requestClose()`): first the item view scales 1 → 0.94 and the info panel fades (200ms); then the reverse flight onto its hanger (680ms). Rack slots come back with a 30ms stagger outward from the landed piece (`--d` × 30ms), and the landed piece does one small swing (1.5°).
8. `?piece=<id>` deep-links into the item view. `/p/<id>?c=<colourId>` is the full page.
9. `prefers-reduced-motion` turns the flights, wipes and flips off. Add to bag then adds at once and only the button state changes (no spinner, flight, bounce or ring); close skips the 200ms shrink and the swing.

## Rules
- All product reads/writes go through `lib/db.ts`. Never import `lib/db.ts` or `fs` into a `"use client"` file.
- After any server-side change to products, call `revalidatePath("/")` and `revalidatePath("/p/<id>")`.
- Flights use manual FLIP (`fly()`), not motion `layoutId`. This is deliberate because the rack stays mounted behind the item view. Don't switch it.
- Garments on the rack must be `pointer-events: none`. The slot button is the hit target.
- Rack hover is set on `pointerenter` (mouse only) and on `:focus-visible` focus. Do not set it on plain focus, or touch's first tap opens the piece.
- Number inputs: use `step="any"`. A `step` with `min` silently blocks form submit for "round" values.
- Photos live in the public Supabase Storage bucket `product-images`. The browser uploads them directly with a signed URL from `createImageUpload()` (Vercel caps function bodies at 4.5 MB). Never write to the local filesystem at runtime.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only: use it only via `lib/supabase.ts` (guarded by `server-only`). Never give it a `NEXT_PUBLIC_` prefix.
- Product writes go through the Postgres functions (`upsert_product`, `reorder_products`) so each save is one transaction. Schema changes = a new migration file, never edit an applied one.
- Styling: add tokens to `:root` in globals.css, reuse `.btn`, `.chip`, `.seg`, `.size`. Keep the gallery-wall look (light wall `--wall`, ink, lime only for logo and ticker).
- Server actions validate everything (`clean()` in actions.ts). The client is never trusted for price or stock.
- Money: integers in KES; format only with `formatKES()`.
- Keep the first-load JS under ~170 kB (check the `next build` output). No new dependency without a reason.

## Done means
`npm run typecheck` passes, `npm run build` passes, and the flow works at 1440px and 390px: hover, open, colour, flip, next, close, add to bag, admin add.

## Roadmap
Next-phase prompts are in `docs/PROMPTS.md`. Do one phase per session.
