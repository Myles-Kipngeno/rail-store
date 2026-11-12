"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, useTransition } from "react";
import { createImageUpload, removeProduct, saveOrder, saveProduct } from "@/app/admin/actions";
import { formatKES, shade, totalStock } from "@/lib/format";
import {
  GARMENT_LABELS,
  GARMENT_TYPES,
  PRINT_KINDS,
  PRINT_LABELS,
  SIZES,
  type Colorway,
  type Print,
  type Product,
  type Side,
} from "@/lib/types";
import { Garment } from "./Garment";
import { ColorLayers, Flipper, HangTags } from "./Pieces";
import PhotoCapture from "./PhotoCapture";

const blankColor = (): Colorway => ({
  id: "",
  name: "",
  hex: "#1b1b1c",
  stock: { S: 0, M: 0, L: 0, XL: 0, XXL: 0 },
});

const blankProduct = (): Product => ({
  id: "",
  name: "",
  type: "tee",
  category: "Tees",
  price: 2000,
  colors: [{ ...blankColor(), name: "Black" }],
  print: { front: [{ k: "text", t: "YOUR\nTEXT" }], back: [] },
  description: "",
  details: [],
  published: true,
  createdAt: "",
});

export default function AdminEditor({ products }: { products: Product[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Product>(() => structuredClone(products[0] ?? blankProduct()));
  const [isNew, setIsNew] = useState(products.length === 0);
  const [previewColor, setPreviewColor] = useState(0);
  const [previewSide, setPreviewSide] = useState<Side>("front");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [order, setOrder] = useState(products.map((p) => p.id));
  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);
  const byId = new Map(products.map((p) => [p.id, p]));

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setColor = (i: number, patch: Partial<Colorway>) =>
    setDraft((d) => ({ ...d, colors: d.colors.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const setPrints = (side: Side, list: Print[]) => setDraft((d) => ({ ...d, print: { ...d.print, [side]: list } }));

  const edit = (p: Product) => {
    setDraft(structuredClone(p));
    setIsNew(false);
    setPreviewColor(0);
    setConfirmDelete(false);
    setMsg(null);
  };

  const newPiece = () => {
    setDraft(blankProduct());
    setIsNew(true);
    setPreviewColor(0);
    setConfirmDelete(false);
    setMsg(null);
  };

  const save = () =>
    start(async () => {
      const res = await saveProduct(draft, isNew);
      if (!res.ok) return setMsg({ kind: "error", text: res.error });
      setMsg({ kind: "ok", text: isNew ? "Added to the rack." : "Saved." });
      if (isNew) setOrder((o) => [...o, res.id]);
      setDraft((d) => ({ ...d, id: res.id }));
      setIsNew(false);
      router.refresh();
    });

  const del = () =>
    start(async () => {
      await removeProduct(draft.id);
      setOrder((o) => o.filter((id) => id !== draft.id));
      setMsg({ kind: "ok", text: `Removed ${draft.name}.` });
      newPiece();
      router.refresh();
    });

  const move = (id: string, d: number) => {
    const i = order.indexOf(id);
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    start(async () => {
      await saveOrder(next);
      router.refresh();
    });
  };

  const upload = (ci: number, side: Side, file: File | undefined) => {
    if (!file) return;
    start(async () => {
      // The server checks type/size and signs a one-time URL; the photo goes straight to Supabase Storage.
      const res = await createImageUpload({ type: file.type, size: file.size });
      if (!res.ok) return setMsg({ kind: "error", text: res.error });
      const body = new FormData();
      body.append("cacheControl", "31536000");
      body.append("", file);
      const put = await fetch(res.uploadUrl, {
        method: "PUT",
        body,
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      }).catch(() => undefined);
      if (!put?.ok) return setMsg({ kind: "error", text: "Upload failed. Check your connection and try again." });
      setColor(ci, { images: { ...draft.colors[ci].images, [side]: res.publicUrl } });
      setPreviewColor(ci);
      setPreviewSide(side);
    });
  };

  const pc = Math.min(previewColor, draft.colors.length - 1);

  return (
    <div className="admin">
      <header className="admin-top">
        <Link href="/" className="logo">
          RAIL
        </Link>
        <span className="muted mono">Admin</span>
        <div className="admin-top-right">
          <Link href="/" className="nav-link" target="_blank">
            View store ↗
          </Link>
          <button className="btn btn--primary btn--sm" onClick={newPiece}>
            + New piece
          </button>
        </div>
      </header>

      <div className="admin-grid">
        {/* list */}
        <aside className="admin-list" aria-label="Pieces on the rack">
          <p className="eyebrow">Rack order · {order.length} pieces</p>
          <ul>
            {order.map((id, i) => {
              const p = byId.get(id);
              if (!p) return null;
              const stock = p.colors.reduce((n, c) => n + totalStock(c), 0);
              return (
                <li key={id} className={draft.id === id && !isNew ? "is-active" : ""}>
                  <button className="admin-item" onClick={() => edit(p)}>
                    <span className="admin-thumb">
                      <Garment product={p} color={p.colors[0]} />
                    </span>
                    <span className="admin-item-meta">
                      <strong>{p.name}</strong>
                      <span className="muted mono">
                        {formatKES(p.price)} · {stock} in stock{!p.published && " · draft"}
                      </span>
                    </span>
                  </button>
                  <span className="admin-move">
                    <button onClick={() => move(id, -1)} disabled={i === 0} aria-label={`Move ${p.name} left on the rack`}>
                      ↑
                    </button>
                    <button onClick={() => move(id, 1)} disabled={i === order.length - 1} aria-label={`Move ${p.name} right on the rack`}>
                      ↓
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* form */}
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <h1 className="admin-h">{isNew ? "New piece" : `Edit · ${draft.name || "Untitled"}`}</h1>

          <div className="grid-2">
            <label className="field">
              <span className="field-label">Name</span>
              <input id="f-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Crimson Memory LS Shirt" required />
            </label>
            <label className="field">
              <span className="field-label">Price (KES)</span>
              <input id="f-price" type="number" min={1} step="any" inputMode="numeric" value={draft.price} onChange={(e) => set("price", Number(e.target.value))} />
            </label>
            <label className="field">
              <span className="field-label">Garment</span>
              <select id="f-type" value={draft.type} onChange={(e) => set("type", e.target.value as Product["type"])}>
                {GARMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {GARMENT_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Category (filter chip)</span>
              <input id="f-cat" list="cats" value={draft.category} onChange={(e) => set("category", e.target.value)} />
              <datalist id="cats">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>

          <fieldset className="block">
            <legend>Colours and stock</legend>
            <p className="fine">
              Each colour becomes a hang tag. Upload photos (transparent PNG or WebP looks best on the rack), or leave them
              empty to use the drawn garment.
            </p>
            {draft.colors.map((c, i) => (
              <div key={i} className="color-row">
                <div className="color-row-top">
                  <input
                    type="color"
                    id={`f-hex-${i}`}
                    value={c.hex}
                    onChange={(e) => setColor(i, { hex: e.target.value })}
                    aria-label="Colour"
                  />
                  <input
                    id={`f-cname-${i}`}
                    value={c.name}
                    onChange={(e) => setColor(i, { name: e.target.value })}
                    placeholder="Colour name"
                    onFocus={() => setPreviewColor(i)}
                  />
                  <label className="mini">
                    Trim
                    <input type="color" value={c.trim ?? shade(c.hex, -0.12)} onChange={(e) => setColor(i, { trim: e.target.value })} />
                  </label>
                  {draft.type === "jacket" && (
                    <label className="mini">
                      Sleeves
                      <input type="color" value={c.sleeve ?? c.hex} onChange={(e) => setColor(i, { sleeve: e.target.value })} />
                    </label>
                  )}
                  <button
                    type="button"
                    className="link-btn"
                    disabled={draft.colors.length === 1}
                    onClick={() => setDraft((d) => ({ ...d, colors: d.colors.filter((_, j) => j !== i) }))}
                  >
                    Remove
                  </button>
                </div>
                <div className="stock-grid">
                  {SIZES.map((s) => (
                    <label key={s}>
                      <span>{s}</span>
                      <input
                        type="number"
                        min={0}
                        value={c.stock[s] ?? 0}
                        onChange={(e) => setColor(i, { stock: { ...c.stock, [s]: Math.max(0, Number(e.target.value)) } })}
                      />
                    </label>
                  ))}
                </div>
                <div className="photo-row">
                  {(["front", "back"] as const).map((side) => (
                    <div key={side} className="photo-slot">
                      <span className="field-label">{side === "front" ? "Front photo" : "Back photo"}</span>
                      {c.images?.[side] ? (
                        <span className="photo-set">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.images[side]} alt="" />
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => setColor(i, { images: { ...c.images, [side]: undefined } })}
                          >
                            Remove
                          </button>
                        </span>
                      ) : (
                        <PhotoCapture disabled={pending} onUse={(file) => upload(i, side, file)} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => {
                setDraft((d) => ({ ...d, colors: [...d.colors, { ...blankColor(), hex: "#f2a8bf" }] }));
                setPreviewColor(draft.colors.length);
              }}
            >
              + Add colour
            </button>
          </fieldset>

          <fieldset className="block">
            <legend>Graphics (drawn garment only)</legend>
            {(["front", "back"] as const).map((side) => (
              <div key={side} className="print-side">
                <span className="field-label">{side === "front" ? "Front" : "Back"}</span>
                {draft.print[side].map((p, i) => (
                  <div key={i} className="print-row">
                    <select
                      value={p.k}
                      onChange={(e) =>
                        setPrints(side, draft.print[side].map((x, j) => (j === i ? { ...x, k: e.target.value as Print["k"] } : x)))
                      }
                      onFocus={() => setPreviewSide(side)}
                    >
                      {PRINT_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {PRINT_LABELS[k]}
                        </option>
                      ))}
                    </select>
                    {["text", "logo", "letter", "number"].includes(p.k) &&
                      (p.k === "text" ? (
                        <textarea
                          rows={2}
                          value={p.t ?? ""}
                          placeholder="One line per row"
                          onFocus={() => setPreviewSide(side)}
                          onChange={(e) => setPrints(side, draft.print[side].map((x, j) => (j === i ? { ...x, t: e.target.value } : x)))}
                        />
                      ) : (
                        <input
                          value={p.t ?? ""}
                          placeholder={p.k === "number" ? "Name" : "Text"}
                          onFocus={() => setPreviewSide(side)}
                          onChange={(e) => setPrints(side, draft.print[side].map((x, j) => (j === i ? { ...x, t: e.target.value } : x)))}
                        />
                      ))}
                    {p.k === "number" && (
                      <input
                        className="w-num"
                        value={p.n ?? ""}
                        placeholder="10"
                        onChange={(e) => setPrints(side, draft.print[side].map((x, j) => (j === i ? { ...x, n: e.target.value } : x)))}
                      />
                    )}
                    <button type="button" className="link-btn" onClick={() => setPrints(side, draft.print[side].filter((_, j) => j !== i))}>
                      Remove
                    </button>
                  </div>
                ))}
                {draft.print[side].length < 4 && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setPrints(side, [...draft.print[side], { k: "logo", t: "RAIL" }]);
                      setPreviewSide(side);
                    }}
                  >
                    + Add graphic
                  </button>
                )}
              </div>
            ))}
          </fieldset>

          <label className="field">
            <span className="field-label">Description</span>
            <textarea id="f-desc" rows={3} value={draft.description} onChange={(e) => set("description", e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Details (one per line)</span>
            <textarea
              id="f-details"
              rows={4}
              value={draft.details.join("\n")}
              onChange={(e) => set("details", e.target.value.split("\n"))}
            />
          </label>
          <label className="check">
            <input id="f-pub" type="checkbox" checked={draft.published} onChange={(e) => set("published", e.target.checked)} />
            Show on the rack (untick to keep it as a draft)
          </label>

          <div className="admin-actions">
            <button className="btn btn--primary" type="submit" disabled={pending}>
              {pending ? "Saving…" : isNew ? "Add to rack" : "Save changes"}
            </button>
            {!isNew &&
              (confirmDelete ? (
                <span className="confirm">
                  Remove {draft.name}?
                  <button type="button" className="btn btn--danger btn--sm" onClick={del} disabled={pending}>
                    Yes, remove
                  </button>
                  <button type="button" className="link-btn" onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </button>
                </span>
              ) : (
                <button type="button" className="link-btn" onClick={() => setConfirmDelete(true)}>
                  Remove piece
                </button>
              ))}
            <AnimatePresence>
              {msg && (
                <motion.span
                  key={msg.text}
                  className={`form-msg is-${msg.kind}`}
                  role="status"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {msg.text}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </form>

        {/* live preview */}
        <aside className="admin-preview" aria-label="Preview">
          <p className="eyebrow">Live preview</p>
          <div className="preview-stage">
            <div className="preview-card">
              <Flipper side={previewSide}>
                {(shown) => <ColorLayers product={draft} colorIndex={pc} side={shown} />}
              </Flipper>
              {draft.colors.length > 1 && <HangTags colors={draft.colors} value={pc} onChange={setPreviewColor} />}
            </div>
          </div>
          <div className="seg" role="group" aria-label="Preview side">
            {(["front", "back"] as const).map((s) => (
              <button key={s} type="button" className={previewSide === s ? "is-on" : ""} aria-pressed={previewSide === s} onClick={() => setPreviewSide(s)}>
                {s === "front" ? "Front" : "Back"}
              </button>
            ))}
          </div>
          <p className="preview-name">{draft.name || "Untitled piece"}</p>
          <p className="mono muted">{formatKES(draft.price || 0)}</p>
        </aside>
      </div>
    </div>
  );
}
