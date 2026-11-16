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
import { useRef, useState, type CSSProperties } from "react";
import { formatKES } from "@/lib/format";
import type { ImgProps } from "./shot";

/** `img`: next/image props computed on the server (imgProps in ./shot), so no next/image code ships here. */
export type Pair = { id: string; name: string; price: number; img: ImgProps };

/**
 * Bottoms, one pair at a time.
 * Desktop: a pinned section (height = pairs × 80vh, 100vh sticky stage). Scroll progress crossfades each
 * pair into the next (opacity + y); the upcoming pair waits to the right, faded (opacity .15, blur 6px).
 * Phones (CSS ≤640px): a horizontal swipe carousel instead.
 */
export default function Bottoms({ pairs }: { pairs: Pair[] }) {
  const pinRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: pinRef, offset: ["start start", "end end"] });
  const n = pairs.length;
  const [cur, setCur] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const i = n > 1 ? Math.min(n - 1, Math.max(0, Math.round(v * (n - 1)))) : 0;
    setCur((c) => (c === i ? c : i));
  });
  const p = pairs[cur];
  const label = `${n} ${n === 1 ? "pair" : "pairs"}`;

  return (
    <section className="home-section bottoms" aria-labelledby="bottoms-h">
      <h2 className="sr-only" id="bottoms-h">
        Bottoms
      </h2>

      <div ref={pinRef} className="bottoms-pin" style={{ "--n": n } as CSSProperties}>
        <div className="bottoms-stage">
          <div className="bottoms-copy">
            <p className="eyebrow">Bottoms · {label}</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={p.id}
                className="bottoms-copy-item"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
              >
                <h3 className="bottoms-name">{p.name}</h3>
                <p className="bottoms-price mono">{formatKES(p.price)}</p>
                <Link href={`/p/${p.id}`} className="btn btn--outline btn--sm">
                  View product
                </Link>
              </motion.div>
            </AnimatePresence>
            {n > 1 && (
              <p className="bottoms-count mono" aria-hidden="true">
                {String(cur + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
              </p>
            )}
          </div>
          <div className="bottoms-photos">
            {pairs.map((pair, i) => (
              <PairPhoto key={pair.id} pair={pair} i={i} n={n} progress={scrollYProgress} />
            ))}
          </div>
        </div>
      </div>

      <ul className="bottoms-swipe" aria-label="Bottoms">
        {pairs.map((pair) => (
          <li key={pair.id}>
            <Link href={`/p/${pair.id}`} className="bottoms-card">
              <span className="bottoms-card-shot">
                {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
                <img {...pair.img} className="shot-img" />
              </span>
              <span className="row-name">{pair.name}</span>
              <span className="row-price mono">{formatKES(pair.price)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Piecewise-linear map of v over xs → ys (xs ascending), clamped at both ends. */
function lerp(v: number, xs: number[], ys: number[]) {
  if (v <= xs[0]) return ys[0];
  for (let k = 1; k < xs.length; k++) {
    if (v <= xs[k]) return ys[k - 1] + ((ys[k] - ys[k - 1]) * (v - xs[k - 1])) / (xs[k] - xs[k - 1]);
  }
  return ys[ys.length - 1];
}

/**
 * Pair i is centred at progress i/(n-1): next = right + faded + blurred, current = centre, past = risen
 * and gone. Function transforms on purpose: motion would otherwise hand range-based transforms of
 * useScroll to a native ScrollTimeline, and ranges reaching past 0..1 (first/last pair) make the browser
 * throw ("offsets must be monotonically non-decreasing"), which takes the whole page down.
 */
function PairPhoto({ pair, i, n, progress }: { pair: Pair; i: number; n: number; progress: MotionValue<number> }) {
  const step = 1 / Math.max(1, n - 1);
  const c = i * step;
  const at = [c - 2 * step, c - step, c, c + step];
  const single = n === 1;
  const map = (ys: number[]) => (v: number) => (single ? ys[2] : lerp(v, at, ys));
  const opacity = useTransform(progress, map([0, 0.15, 1, 0]));
  const x = useTransform(progress, (v) => `${map([95, 62, 0, 0])(v)}%`);
  const y = useTransform(progress, map([0, 0, 0, -40]));
  const scale = useTransform(progress, map([0.78, 0.78, 1, 1]));
  const filter = useTransform(progress, (v) => `blur(${map([6, 6, 0, 2])(v)}px)`);
  return (
    // Decorative: the copy beside it names the current pair and links to it.
    <motion.div className="bottoms-photo" style={{ opacity, x, y, scale, filter }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...pair.img} alt="" className="shot-img" />
    </motion.div>
  );
}
