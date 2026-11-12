"use client";

import { motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { totalStock } from "@/lib/format";
import { SIZES, type Colorway, type Product, type Side, type Size } from "@/lib/types";
import { Garment } from "./Garment";

export const EASE = [0.2, 0.8, 0.2, 1] as const;

/**
 * Colour change: the new colourway is stacked on top and revealed bottom-to-top
 * (like the reference video's wipe). Older layers are removed once covered.
 */
export function ColorLayers({ product, colorIndex, side }: { product: Product; colorIndex: number; side: Side }) {
  const counter = useRef(0);
  const [layers, setLayers] = useState([{ key: 0, ci: colorIndex }]);
  const reduce = useReducedMotion();

  useEffect(() => {
    setLayers((ls) => (ls[ls.length - 1].ci === colorIndex ? ls : [...ls, { key: ++counter.current, ci: colorIndex }]));
  }, [colorIndex]);

  return (
    <div className="layers">
      {layers.map((l, i) => {
        const color = product.colors[l.ci] ?? product.colors[0];
        return (
          <motion.div
            key={l.key}
            className="layer"
            initial={i === 0 ? false : { clipPath: "inset(100% 0% 0% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
            transition={{ duration: reduce ? 0 : 0.75, ease: [0.65, 0, 0.35, 1] }}
            onAnimationComplete={() => {
              if (i > 0) setLayers((ls) => ls.slice(ls.findIndex((x) => x.key === l.key)));
            }}
          >
            <Garment product={product} color={color} side={side} />
          </motion.div>
        );
      })}
    </div>
  );
}

/** Front/back: turns to 90°, swaps the side, turns back. */
export function Flipper({ side, children }: { side: Side; children: (shown: Side) => ReactNode }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [shown, setShown] = useState<Side>(side);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (side === shown) return;
    if (reduce) {
      setShown(side);
      return;
    }
    (async () => {
      await animate(scope.current, { rotateY: 90 }, { duration: 0.2, ease: "easeIn" });
      setShown(side);
      await animate(scope.current, { rotateY: [-90, 0] }, { duration: 0.34, ease: EASE });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  return (
    <motion.div ref={scope} className="flipper" style={{ transformPerspective: 1100 }}>
      {children(shown)}
    </motion.div>
  );
}

/** Colour picker drawn as swing tags hanging next to the garment. */
export function HangTags({
  colors,
  value,
  onChange,
}: {
  colors: Colorway[];
  value: number;
  onChange: (i: number) => void;
}) {
  return (
    <div className="tags" role="radiogroup" aria-label="Colour">
      {colors.map((c, i) => {
        const selected = i === value;
        const soldOut = totalStock(c) === 0;
        return (
          <motion.button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${c.name}${soldOut ? " (sold out)" : ""}`}
            title={c.name}
            className={`tag ${selected ? "is-selected" : ""} ${soldOut ? "is-soldout" : ""}`}
            style={{ "--tag": c.hex } as CSSProperties}
            onClick={() => onChange(i)}
            initial={{ y: -14, opacity: 0 }}
            animate={{ y: selected ? 12 : 0, opacity: 1 }}
            whileHover={{ rotate: [0, 8, -6, 3, 0], transition: { duration: 0.7 } }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 * i }}
          >
            <span className="tag-string" />
            <span className="tag-body" />
          </motion.button>
        );
      })}
    </div>
  );
}

export function SizePicker({
  color,
  value,
  onChange,
  invalid,
}: {
  color: Colorway;
  value: Size | null;
  onChange: (s: Size) => void;
  invalid?: boolean;
}) {
  const left = value ? color.stock[value] ?? 0 : null;
  return (
    <div className="sizes-wrap">
      <motion.div
        className="sizes"
        role="radiogroup"
        aria-label="Size"
        animate={invalid ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
      >
        {SIZES.map((s) => {
          const n = color.stock[s] ?? 0;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={value === s}
              disabled={n === 0}
              className={`size ${value === s ? "is-selected" : ""}`}
              onClick={() => onChange(s)}
            >
              {s}
            </button>
          );
        })}
      </motion.div>
      <p className={`stock-note ${invalid ? "is-error" : ""}`} aria-live="polite">
        {invalid
          ? "Pick a size first."
          : totalStock(color) === 0
            ? "Sold out in this colour."
            : left !== null && left <= 2
              ? `Only ${left} left in ${value}.`
              : " "}
      </p>
    </div>
  );
}
