"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  createImageUpload,
  removeLookbookItem,
  saveLookbookItem,
  saveLookbookOrder,
  uploadLookbookImage,
} from "@/app/admin/actions";
import type { LookbookItem, Product } from "@/lib/types";

/**
 * Admin "Lookbook" tab: the "Off the rack" photos on the home page. Upload (opaque lifestyle photos,
 * no cutout), caption, optional product link, publish toggle, ↑/↓ order, remove. New uploads start
 * as drafts at the end. All writes go through the lookbook server actions in app/admin/actions.ts.
 */
export default function LookbookAdmin({ items, products }: { items: LookbookItem[]; products: Product[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [productId, setProductId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return setMsg({ kind: "error", text: res.error });
      if (ok) setMsg({ kind: "ok", text: ok });
      router.refresh();
    });

  const upload = (file: File | undefined) => {
    if (!file) return;
    run(async () => {
      const res = await createImageUpload({ type: file.type, size: file.size });
      if (!res.ok) return res;
      const body = new FormData();
      body.append("cacheControl", "31536000");
      body.append("", file);
      const put = await fetch(res.uploadUrl, { method: "PUT", body, headers: { apikey: res.apiKey } }).catch(() => undefined);
      if (!put?.ok) return { ok: false as const, error: "Upload failed. Check your connection and try again." };
      const done = await uploadLookbookImage(res.path, { caption, productId: productId || null });
      if (done.ok) {
        setCaption("");
        setProductId("");
        if (fileRef.current) fileRef.current.value = "";
      }
      return done;
    }, "Photo added as a draft. Tick “Show” to publish it.");
  };

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const ids = items.map((x) => x.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => saveLookbookOrder(ids));
  };

  return (
    <div className="lb-admin">
      <section className="lb-upload" aria-labelledby="lb-up-h">
        <h1 className="admin-h" id="lb-up-h">
          Off the rack · lookbook
        </h1>
        <p className="muted">
          Lifestyle photos for the home page strip. They are kept as they are (no background removal), turned upright,
          scaled to 1400px tall and saved as WebP without metadata. Until one is published, the home page shows drawn
          placeholders.
        </p>
        <label className="field">
          <span className="field-label">Caption</span>
          <input value={caption} maxLength={140} onChange={(e) => setCaption(e.target.value)} placeholder="@someone in Nakuru" />
        </label>
        <label className="field">
          <span className="field-label">Shop the look (optional)</span>
          <ProductSelect products={products} value={productId} onChange={setProductId} />
        </label>
        <label className="btn btn--primary lb-file">
          {pending ? "Working…" : "Upload photo"}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="sr-only"
            disabled={pending}
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
        {msg && (
          <p className={`form-msg is-${msg.kind}`} role="status">
            {msg.text}
          </p>
        )}
      </section>

      <section aria-labelledby="lb-list-h">
        <p className="eyebrow" id="lb-list-h">
          Strip order · {items.length} {items.length === 1 ? "photo" : "photos"}
        </p>
        {!items.length && <p className="muted">No photos yet.</p>}
        <ul className="lb-list">
          {items.map((it, i) => (
            <LookRow key={it.id} item={it} i={i} n={items.length} products={products} pending={pending} run={run} move={move} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function LookRow({
  item,
  i,
  n,
  products,
  pending,
  run,
  move,
}: {
  item: LookbookItem;
  i: number;
  n: number;
  products: Product[];
  pending: boolean;
  run: (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, ok?: string) => void;
  move: (i: number, d: number) => void;
}) {
  const [caption, setCaption] = useState(item.caption);
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="lb-row">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.src} alt="" className="lb-thumb" loading="lazy" />
      <div className="lb-fields">
        <input
          aria-label="Caption"
          value={caption}
          maxLength={140}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== item.caption && run(() => saveLookbookItem(item.id, { caption }), "Caption saved.")}
        />
        <ProductSelect
          products={products}
          value={item.product_id ?? ""}
          onChange={(v) => run(() => saveLookbookItem(item.id, { productId: v || null }), "Link saved.")}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={item.published}
            disabled={pending}
            onChange={(e) => run(() => saveLookbookItem(item.id, { published: e.target.checked }))}
          />
          Show on the home page
        </label>
      </div>
      <span className="admin-move">
        <button onClick={() => move(i, -1)} disabled={pending || i === 0} aria-label="Move photo left in the strip">
          ↑
        </button>
        <button onClick={() => move(i, 1)} disabled={pending || i === n - 1} aria-label="Move photo right in the strip">
          ↓
        </button>
      </span>
      {confirm ? (
        <span className="confirm">
          <button className="btn btn--danger btn--sm" disabled={pending} onClick={() => run(() => removeLookbookItem(item.id))}>
            Yes, remove
          </button>
          <button className="link-btn" onClick={() => setConfirm(false)}>
            Keep
          </button>
        </span>
      ) : (
        <button className="link-btn" onClick={() => setConfirm(true)}>
          Remove
        </button>
      )}
    </li>
  );
}

function ProductSelect({ products, value, onChange }: { products: Product[]; value: string; onChange: (v: string) => void }) {
  return (
    <select aria-label="Linked product" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">No product link</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {p.published ? "" : " (draft)"}
        </option>
      ))}
    </select>
  );
}
