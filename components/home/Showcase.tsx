"use client";

import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { formatKES } from "@/lib/format";
import type { Product } from "@/lib/types";
import { Garment } from "../Garment";
import type { ImgProps } from "./shot";

/**
 * One showcase piece. `img`: next/image props computed on the server (imgProps in ./shot), so no
 * next/image code ships here. `drawn`: no photo, drawn by Garment (Trousers.tsx / Shoe.tsx).
 */
export type ShowItem = { id: string; name: string; price: number; colorId: string } & (
  | { img: ImgProps; drawn?: never }
  | { drawn: Product; img?: never }
);

type Props = {
  /** Section id, also the CSS modifier (showcase--bottoms, showcase--shoes). */
  id: string;
  title: string;
  /** "pairs" or "pieces", for the count line. */
  unit: string;
  items: ShowItem[];
};

const EASE = [0.2, 0.8, 0.2, 1] as const;
/** Each item holds still for this share of its scroll segment, then hands over to the next. */
const HOLD = 0.65;

const href = (it: ShowItem) => `/p/${it.id}?c=${encodeURIComponent(it.colorId)}`;
const pad = (n: number) => String(n).padStart(2, "0");

function Shot({ item, prefix, alt }: { item: ShowItem; prefix: string; alt?: string }) {
  if (item.drawn) {
    const color = item.drawn.colors.find((c) => c.id === item.colorId) ?? item.drawn.colors[0];
    return <Garment product={item.drawn} color={color} idPrefix={prefix} className="showcase-drawn" />;
  }
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...item.img} {...(alt !== undefined ? { alt } : {})} className="shot-img" />;
}

/**
 * A pinned scroll showcase (home page, one per department in STORE.showcase).
 * The stage is sticky for n segments of scroll (--seg: 80vh, 60vh on phones). In each segment the
 * current item holds still for the first 65%; in the last 35% it fades out rising 24px, the ghost on
 * the right slides to the centre (scale .92 → 1, opacity .14 → 1), a new ghost fades in, and the text
 * swaps with a masked slide. The last item just holds, then the section scrolls away.
 * Phones: no ghost, text under the item. prefers-reduced-motion: no pinning, a plain list (CSS).
 */
export default function Showcase({ id, title, unit, items }: Props) {
  const pinRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: pinRef, offset: ["start start", "end end"] });
  const n = items.length;
  // Continuous position: 2.4 = item 2 on its way out, item 3 on its way in.
  const pos = useTransform(scrollYProgress, (v) => position(v, n));
  const [cur, setCur] = useState(0);
  useMotionValueEvent(pos, "change", (p) => {
    const i = Math.round(p);
    setCur((c) => (c === i ? c : i));
  });
  const narrow = useNarrow();
  const it = items[cur];
  const hId = `${id}-h`;

  return (
    <section className={`home-section showcase showcase--${id}`} aria-labelledby={hId} data-title={title}>
      <h2 className="sr-only" id={hId}>
        {title}
      </h2>

      <div ref={pinRef} className="showcase-pin" style={{ "--n": n } as CSSProperties}>
        <div className="showcase-stage">
          <div className="showcase-items" key={narrow ? "narrow" : "wide"}>
            {items.map((item, i) => (
              <Piece key={item.id} item={item} i={i} pos={pos} narrow={narrow} />
            ))}
            <Link href={href(it)} className="showcase-hit" tabIndex={-1} aria-hidden="true" />
          </div>

          <div className="showcase-copy">
            <p className="eyebrow">{title}</p>
            <p className="showcase-count mono">
              {n} {unit}
            </p>
            <div className="showcase-mask">
              <AnimatePresence initial={false}>
                <motion.div
                  key={it.id}
                  className="showcase-text"
                  initial={{ y: "105%" }}
                  animate={{ y: "0%" }}
                  exit={{ y: "-105%" }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <h3 className="showcase-name">{it.name}</h3>
                  <p className="showcase-price mono">{formatKES(it.price)}</p>
                  <Link href={href(it)} className="btn btn--outline btn--sm">
                    View product
                  </Link>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="showcase-progress mono" aria-hidden="true">
            <span>
              {pad(cur + 1)} / {pad(n)}
            </span>
            <span className="showcase-bar">
              <motion.span style={{ scaleX: scrollYProgress }} />
            </span>
          </div>
        </div>
      </div>

      {/* prefers-reduced-motion: shown instead of the pinned stage (see globals.css). */}
      <ul className="showcase-list" aria-label={title}>
        {items.map((item) => (
          <li key={item.id}>
            <Link href={href(item)} className="showcase-card">
              <span className="showcase-card-shot">
                <Shot item={item} prefix="l" />
              </span>
              <span className="row-name">{item.name}</span>
              <span className="row-price mono">{formatKES(item.price)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Scroll progress 0..1 → item position 0..n-1 (holds for HOLD of each segment, eased handover). */
function position(v: number, n: number) {
  if (n < 2) return 0;
  const t = Math.min(1, Math.max(0, v)) * n;
  const k = Math.min(n - 1, Math.floor(t));
  if (k >= n - 1) return n - 1;
  const f = (t - k - HOLD) / (1 - HOLD);
  return f <= 0 ? k : k + ease(Math.min(1, f));
}

/** cubic-bezier(.2,.8,.2,1) as a function of x (Newton's method on the x curve). */
function ease(x: number) {
  const [x1, y1, x2, y2] = EASE;
  const bez = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const dBez = (t: number, a: number, b: number) =>
    3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const d = dBez(t, x1, x2);
    if (Math.abs(d) < 1e-6) break;
    t = Math.min(1, Math.max(0, t - (bez(t, x1, x2) - x) / d));
  }
  return bez(t, y1, y2);
}

/**
 * Where item i sits for a given distance d = i - position: past (d ≤ -1) gone, current (-1..0) fading
 * out and rising 24px, ghost (0..1) sliding in from +26vw, next ghost (1..2) fading in on the right.
 * Narrow screens have no ghost: the next item fades in in place.
 */
function look(d: number, narrow: boolean) {
  if (d <= -1) return { o: 0, x: 0, y: -24, s: 1 };
  if (d <= 0) return { o: 1 + d, x: 0, y: 24 * d, s: 1 };
  if (narrow) return { o: Math.max(0, 1 - d), x: 0, y: 0, s: 1 - 0.08 * Math.min(1, d) };
  if (d <= 1) return { o: 1 - 0.86 * d, x: 26 * d, y: 0, s: 1 - 0.08 * d };
  if (d <= 2) return { o: 0.14 * (2 - d), x: 26, y: 0, s: 0.92 };
  return { o: 0, x: 26, y: 0, s: 0.92 };
}

function Piece({ item, i, pos, narrow }: { item: ShowItem; i: number; pos: MotionValue<number>; narrow: boolean }) {
  // Function transforms only: motion hands range transforms of useScroll values to a native
  // ScrollTimeline, which throws for ranges outside 0..1 and takes the page down.
  const opacity = useTransform(pos, (p) => look(i - p, narrow).o);
  const x = useTransform(pos, (p) => `${look(i - p, narrow).x}vw`);
  const y = useTransform(pos, (p) => look(i - p, narrow).y);
  const scale = useTransform(pos, (p) => look(i - p, narrow).s);
  return (
    // Decorative: the copy beside it names the current item and links to it.
    <motion.div className="showcase-item" style={{ opacity, x, y, scale }} aria-hidden="true">
      <Shot item={item} prefix="s" alt="" />
    </motion.div>
  );
}

const NARROW = "(max-width: 640px)";
function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(NARROW);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}
