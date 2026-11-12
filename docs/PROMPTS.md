# Next-phase prompts for Claude Code

Paste one prompt per session, in order. Each assumes CLAUDE.md is loaded.

---

## Phase 2: MySQL with Prisma

```
Move product storage from data/products.json to MySQL using Prisma.
Scope: lib/db.ts, new prisma/schema.prisma, new prisma/seed.ts, package.json scripts, .env.example. Do not touch components or UI.
- Tables: Product, Colorway, Stock(colorwayId, size, qty), Print(productId, side, kind, text, num, position). Product.position for rack order.
- Keep every exported function signature in lib/db.ts identical, returning the same Product shape from lib/types.ts.
- Seed script imports data/products.json.
- DATABASE_URL in .env.example.
Done when: typecheck + build pass, `npx prisma migrate dev && npx prisma db seed` works, and the store and admin behave exactly as before.
```

## Phase 3: M-Pesa STK push checkout

```
Add M-Pesa checkout (Daraja STK Push) with an Order table.
Scope: new app/checkout/page.tsx, new app/api/mpesa/callback/route.ts, new lib/mpesa.ts, Order + OrderLine in Prisma, enable the "Pay with M-Pesa" button in components/BagDrawer.tsx. No other UI changes.
- Checkout form: name, phone (07XX/01XX → 2547XXXXXXXX), delivery town, note.
- Server re-prices every bag line from the database and checks stock. Never trust client prices.
- Create Order(status=PENDING), send STK push, page polls order status every 3s for up to 90s.
- Callback verifies the result, sets PAID or FAILED, stores MpesaReceiptNumber, and decrements stock in a transaction only on PAID.
- Env: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL, MPESA_ENV=sandbox|production.
Done when: typecheck + build pass and a sandbox payment marks the order PAID and reduces stock.
```

## Phase 4: Orders in the admin + proper login

```
Replace Basic auth with a login page and add an orders screen to the admin.
Scope: middleware.ts, new app/admin/login, new app/admin/orders, lib/auth.ts. Keep components/AdminEditor.tsx unchanged except a nav link.
- Single admin user from env (ADMIN_EMAIL, ADMIN_PASSWORD_HASH bcrypt). Signed httpOnly session cookie (jose), 7-day expiry.
- Every server action in app/admin/actions.ts checks the session first.
- Orders list: newest first, filter by status, show lines, total, phone, receipt. Mark as DELIVERED.
Done when: typecheck + build pass, /admin redirects to login when signed out, and actions reject calls without a session.
```

## Phase 5: Faster photos

```
Optimise uploaded product photos.
Scope: app/admin/actions.ts uploadImage only, plus next.config.ts if needed.
- Use sharp to resize to max 1200px tall, convert to WebP (quality 82), strip metadata, and also save a 400px version.
- Rack and thumbnails use the 400px file; item view and product page use the full one (add an optional `thumb` to Colorway.images).
Done when: typecheck + build pass and uploads under 6 MB come out under 250 KB.
```

## Phase 6: Deploy to the VPS

```
Prepare production deploy on an Ubuntu VPS (Nginx + PM2).
Scope: new deploy/ folder only (ecosystem.config.js, nginx.conf, DEPLOY.md). No app code changes.
- Next runs on port 3000 behind Nginx with HTTPS (certbot), gzip, long caching for /_next/static and /uploads.
- DATA_FILE/UPLOAD_DIR (or DATABASE_URL) point outside the app folder so redeploys keep data.
- DEPLOY.md: exact commands for the first deploy and for updates (git pull, npm ci, build, pm2 reload).
Done when: the files exist and DEPLOY.md works when followed line by line on a fresh server.
```
