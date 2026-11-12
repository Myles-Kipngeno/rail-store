# RAIL store

Clothing store where every product hangs on one clothes rail. Hover pulls a piece off the rack, click flies it into a focused item view with colour hang tags and a front/back flip. Kenyan market: prices in KES, ordering via WhatsApp now, M-Pesa later.

## Commands
- `npm run dev` — dev server (http://localhost:3000)
- `npm run build && npm start` — production
- `npm run typecheck` — run after every change; must pass
- Admin: `/admin` (HTTP Basic auth; needs `ADMIN_PASSWORD` in `.env.local`, see `.env.example`)

## Stack (pinned, do not upgrade without asking)
Next.js 15.5 App Router · React 19.1 · TypeScript 5.9 strict · `motion` 12 (import from `motion/react`) · plain CSS (`app/globals.css`, no Tailwind) · fonts self-hosted via `@fontsource` (Archivo variable with width axis, JetBrains Mono).

## Map
```
app/page.tsx                 rack page (static, revalidated on admin save)
app/p/[id]/page.tsx          full product page (SSG via generateStaticParams)
app/admin/page.tsx + actions.ts   admin UI + server actions (save, delete, reorder, upload)
app/uploads/[file]/route.ts  serves uploaded photos from UPLOAD_DIR
middleware.ts                Basic auth for /admin
components/Store.tsx         rack + item view + all transitions (the core)
components/Pieces.tsx        ColorLayers (wipe), Flipper, HangTags, SizePicker
components/Garment.tsx       SVG garment renderer, or the uploaded photo when present
components/BagProvider.tsx   cart context, persisted to localStorage
components/BagDrawer.tsx     cart drawer + WhatsApp order + toast
components/ProductDetail.tsx /p/[id] client view
components/AdminEditor.tsx   admin list, form, live preview
lib/db.ts                    ONLY place that reads/writes products (JSON file now, MySQL later)
lib/types.ts                 Product, Colorway, Print, Size; lib/format.ts helpers; lib/config.ts store name/ticker
data/products.json           product data (8 sample pieces)
```

## Data model (lib/types.ts)
Product → many Colorway. Stock is per colour per size (`S M L XL XXL`). Price is whole KES. A colourway may have `images.front/back` (real photos); if absent the SVG illustration is drawn using `type` + `print`. Rack order = array order in the data file (admin ↑/↓ changes it). `published: false` = draft, hidden from the store.

## The rack UI spec (source of truth, keep it exactly)
1. **Rack**: one rod; pieces edge-on at `rotateY(64deg)` in `--slot` wide slots, overlapping. Pieces after the hovered one turn the other way (`-64deg`).
2. **Hover / focus / first tap**: slot widens to `--open`, garment turns to `0deg` + `translateZ(18px)`, 0.62s `cubic-bezier(.2,.8,.2,1)`. Caption shows name, price, colour dots.
3. **Click / second tap → item view**: FLIP flight of the garment from its hanger to centre (760ms, WAAPI `fly()` in Store.tsx). Other slots blur and fade with a stagger (`--d` × 22ms). Ghosts and the info panel fade in after 420ms.
4. **Item view**: centre card sharp; neighbours at `scale .72, blur 5px, opacity .34`; far cards hidden. Arrows, ←/→ keys, swipe. Clicking a ghost navigates.
5. **Colour**: hang tags right of the shoulder. Selected tag drops 12px with a ring. Change = new layer revealed bottom→top with `clip-path` (0.75s); old layers removed after.
6. **Front/Back**: rotate to 90°, swap the side, rotate back from -90° (0.2s + 0.34s).
7. **Close** (Esc / Back to rack): reverse flight onto its hanger (680ms), rack fades back.
8. `?piece=<id>` deep-links into the item view. `/p/<id>?c=<colourId>` is the full page.
9. `prefers-reduced-motion` turns the flights, wipes and flips off.

## Rules
- All product reads/writes go through `lib/db.ts`. Never import `lib/db.ts` or `fs` into a `"use client"` file.
- After any server-side change to products, call `revalidatePath("/")` and `revalidatePath("/p/<id>")`.
- Flights use manual FLIP (`fly()`), not motion `layoutId`. This is deliberate because the rack stays mounted behind the item view. Don't switch it.
- Garments on the rack must be `pointer-events: none`. The slot button is the hit target.
- Rack hover is set on `pointerenter` (mouse only) and on `:focus-visible` focus. Do not set it on plain focus, or touch's first tap opens the piece.
- Number inputs: use `step="any"`. A `step` with `min` silently blocks form submit for "round" values.
- Uploaded files are served by `app/uploads/[file]/route.ts`, not `/public` (Next only serves `/public` files that existed at build time).
- Styling: add tokens to `:root` in globals.css, reuse `.btn`, `.chip`, `.seg`, `.size`. Keep the gallery-wall look (light wall `--wall`, ink, lime only for logo and ticker).
- Server actions validate everything (`clean()` in actions.ts). The client is never trusted for price or stock.
- Money: integers in KES; format only with `formatKES()`.
- Keep the first-load JS under ~170 kB (check the `next build` output). No new dependency without a reason.

## Done means
`npm run typecheck` passes, `npm run build` passes, and the flow works at 1440px and 390px: hover, open, colour, flip, next, close, add to bag, admin add.

## Roadmap
Next-phase prompts are in `docs/PROMPTS.md`. Do one phase per session.
