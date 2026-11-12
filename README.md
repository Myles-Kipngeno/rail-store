# RAIL store

A clothing store built around a clothes rail: hover pulls a piece off the rack, click flies it into view, swing tags change the colour, and a flip shows the back.

## Run it
```bash
npm install
cp .env.example .env.local   # set ADMIN_PASSWORD and your WhatsApp number
npm run dev                  # http://localhost:3000, admin at /admin
```

## Add your clothes
Open `/admin` → **New piece**. Set the name, price (KES), garment type and category. Add a colour for each colourway, with stock per size. Upload front and back photos (transparent PNG or WebP looks best), or leave them empty to use the drawn garment. Untick "Show on the rack" to keep a piece as a draft. Use ↑/↓ to set its place on the rack.

See `CLAUDE.md` for how it's built and `docs/PROMPTS.md` for the next phases (MySQL, M-Pesa, orders, deploy).
