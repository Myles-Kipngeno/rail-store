# RAIL store

Clothing store where every product hangs on one clothes rail. Hover pulls a piece off the rack, click flies it into a focused item view with colour hang tags and a front/back flip. Kenyan market: prices in KES, ordering via WhatsApp now, M-Pesa later.

## Commands
- `npm run dev` — dev server (http://localhost:3000)
- `npm run build && npm start` — production
- `npm run typecheck` — run after every change; must pass
- Admin: `/admin` (HTTP Basic auth; needs `ADMIN_PASSWORD` in `.env.local`, see `.env.example`)
- `npm run db:seed` — load `data/products.json` (+ local `uploads/`) into Supabase
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
  Bottoms.tsx                pinned scroll (100vh sticky, pairs × 80vh), scroll-linked crossfade; swipe carousel ≤640px.
                             Loaded via BottomsLazy (next/dynamic) to keep useScroll off the first load.
                             Uses function transforms only: range transforms get handed to a native
                             ScrollTimeline, which throws for ranges outside 0..1 and crashes the page.
  ShoeShelf.tsx              shoes on a floating shelf, CSS hover lift
  Row.tsx (+ RowArrows)      New arrivals / Formal / Accessories scroll-snap card rows ("View all" → /shop/<dept>)
  OffTheRack.tsx             tilted customer photos from public/off-the-rack/*.jpg (redeploy after adding)
  Newsletter.tsx, Footer.tsx, Reveal.tsx (fade + 16px rise on first view)
  shot.tsx                   product photo via next/image's getImgProps (plain <img>, lazy, srcset; see file:
                             importing "next/image" would ship its client component) or the drawn garment
app/p/[id]/page.tsx          full product page (SSG via generateStaticParams)
app/admin/page.tsx + actions.ts   admin UI + server actions (save, delete, reorder, upload)
app/uploads/[file]/route.ts  redirects legacy /uploads/<file> links to the Storage bucket
middleware.ts                Basic auth for /admin
components/Store.tsx         rack + item view + all transitions (the core). Reused by home and department pages:
                             optional `categories` (labelled chips), `rackStyle`; URLs keep the current path
                             (?category=, ?piece=)
components/Chrome.tsx        Header (department nav; ≤980px a Menu button), Ticker, AddToBagButton
components/MenuSheet.tsx     phone menu: full-screen sheet, staggered links (loaded on demand via next/dynamic)
components/shop/CategoryFilter.tsx  chips + ?category= for the shelf and grid department pages
components/Pieces.tsx        ColorLayers (wipe), Flipper, HangTags, SizePicker
components/Garment.tsx       SVG garment renderer, or the uploaded photo when present
components/BagProvider.tsx   cart context, persisted to localStorage
components/BagDrawer.tsx     cart drawer + WhatsApp order + toast
components/ProductDetail.tsx /p/[id] client view
components/AdminEditor.tsx   admin list, form, live preview
lib/db.ts                    ONLY place that reads/writes products (Supabase; sample JSON fallback when unconfigured)
lib/supabase.ts              server-only Supabase clients (anon = RLS/published, service role = admin)
supabase/migrations/         schema, RLS, upsert_product/reorder_products functions, product-images bucket,
                             departments/sizes, subscribers (newsletter; service role only)
scripts/seed.mjs             seeds Supabase from data/products.json
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

A colourway may have `images.front/back` (real photos). Only tops have the drawn fallback: without a photo the SVG illustration is drawn from `type` + `print` (`type`, `print`, trim and sleeves mean nothing for other departments). Every other department needs a front photo on every colour before it can be published (`hasDrawnFallback()`, enforced in `clean()`); drafts can be saved without one. Rack order = `products.position` (admin ↑/↓ changes it). Reads come from the `product_documents` view, already shaped as `Product`. `published: false` = draft, hidden from the store.

## The rack UI spec (source of truth, keep it exactly)
1. **Rack**: one rod; pieces edge-on at `rotateY(64deg)` in `--slot` wide slots, overlapping. Pieces after the hovered one turn the other way (`-64deg`).
2. **Hover / focus / first tap**: slot widens to `--open`, garment turns to `0deg` + `translateZ(18px)`, 0.62s `cubic-bezier(.2,.8,.2,1)`. Caption shows name, price, colour dots.
3. **Click / second tap → item view**: FLIP flight of the garment from its hanger to centre (760ms, WAAPI `fly()` in Store.tsx). Other slots blur and fade with a stagger (`--d` × 22ms). Ghosts and the info panel fade in after 420ms.
   - **Add to bag** (item view and `/p/<id>`, `AddToBagButton` in Chrome.tsx): no size → the size shake, nothing flies. Otherwise the button keeps its width and shows a 14px spinner + "Adding" (550ms); then a copy of the garment (`flyToBag()`, WAAPI, middle keyframe at offset .45 lifted above the line = the arc) flies from its rect to the header Bag button in 700ms, scaling to 0.12 and fading out. `bag.add()` fires when it lands: the count springs 1 → 1.35 → 1 and the Bag button gets a brief lime ring (`bag.pulse`). The button reads "Added to bag ✓" for 2.4s with a "View bag →" link sliding in under it (opens the drawer), then resets. "Buy it now" on `/p/<id>` adds instantly.
4. **Item view**: centre card sharp; neighbours at `scale .72, blur 5px, opacity .34`; far cards hidden. Arrows, ←/→ keys, swipe. Clicking a ghost navigates.
5. **Colour**: hang tags right of the shoulder. Selected tag drops 12px with a ring. Change = new layer revealed bottom→top with `clip-path` (0.75s); old layers removed after.
6. **Front/Back**: rotate to 90°, swap the side, rotate back from -90° (0.2s + 0.34s).
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
