"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { formatKES, totalStock } from "@/lib/format";
import type { Product, Side, Size } from "@/lib/types";
import { useBag } from "./BagProvider";
import { Header } from "./Chrome";
import { Garment } from "./Garment";
import { ColorLayers, EASE, Flipper, SizePicker } from "./Pieces";

export default function ProductDetail({ product }: { product: Product }) {
  const bag = useBag();
  const [ci, setCi] = useState(0);
  // ?c=<colour id> preselects a colour (links from the rack keep the colour you picked there).
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    const i = product.colors.findIndex((x) => x.id === c);
    if (i > 0) setCi(i);
  }, [product]);
  const [side, setSide] = useState<Side>("front");
  const [size, setSize] = useState<Size | null>(null);
  const [qty, setQty] = useState(1);
  const [invalid, setInvalid] = useState(false);
  const color = product.colors[ci];
  const soldOut = totalStock(color) === 0;

  const add = (openBag: boolean) => {
    if (!size || (color.stock[size] ?? 0) === 0) return setInvalid(true);
    bag.add(
      {
        productId: product.id,
        colorId: color.id,
        size,
        name: product.name,
        colorName: color.name,
        hex: color.hex,
        price: product.price,
      },
      qty,
    );
    if (openBag) bag.setOpen(true);
  };

  return (
    <div className="pdp">
      <Header />
      <div className="pdp-grid">
        <motion.section
          className="pdp-media"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          aria-label="Photos"
        >
          <div className="pdp-figure">
            <Flipper side={side}>{(shown) => <ColorLayers product={product} colorIndex={ci} side={shown} />}</Flipper>
          </div>
          <div className="pdp-thumbs" role="group" aria-label="Side">
            {(["front", "back"] as const).map((s) => (
              <button
                key={s}
                className={`thumb ${side === s ? "is-on" : ""}`}
                aria-pressed={side === s}
                onClick={() => setSide(s)}
                aria-label={s === "front" ? "Front" : "Back"}
              >
                <Garment product={product} color={color} side={s} />
              </button>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="pdp-panel"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <Link href={`/?piece=${product.id}`} className="back-link back-link--static">
            ← Back to rack
          </Link>
          <p className="eyebrow">{product.category}</p>
          <h1 className="pdp-title">{product.name}</h1>
          <p className="pdp-price mono">{formatKES(product.price)}</p>

          <div className="field">
            <span className="field-label">
              Colour <b>{color.name}</b>
            </span>
            <div className="swatches" role="radiogroup" aria-label="Colour">
              {product.colors.map((c, i) => (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={i === ci}
                  className={`swatch ${i === ci ? "is-selected" : ""} ${totalStock(c) === 0 ? "is-soldout" : ""}`}
                  onClick={() => {
                    setCi(i);
                    setSize(null);
                    setInvalid(false);
                  }}
                >
                  <i style={{ background: c.hex }} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Size</span>
            <SizePicker
              color={color}
              value={size}
              onChange={(s) => {
                setSize(s);
                setInvalid(false);
              }}
              invalid={invalid}
            />
          </div>

          <div className="field field--row">
            <span className="field-label">Quantity</span>
            <div className="qty">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="One less">
                −
              </button>
              <span>{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(size ? color.stock[size] ?? 1 : 10, q + 1))}
                aria-label="One more"
              >
                +
              </button>
            </div>
          </div>

          <div className="ctas ctas--stack">
            <button className="btn btn--outline btn--block" onClick={() => add(false)} disabled={soldOut}>
              Add to bag
            </button>
            <button className="btn btn--primary btn--block" onClick={() => add(true)} disabled={soldOut}>
              Buy it now
            </button>
          </div>

          <div className="pdp-copy">
            <p>{product.description}</p>
            {product.details.length > 0 && (
              <ul>
                {product.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
