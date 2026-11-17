"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { Product } from "@/lib/types";
import { Garment } from "../Garment";
import type { ImgProps } from "./shot";

/**
 * One lookbook card. `img`: a published photo (next/image props computed on the server). `drawn`: the
 * placeholder until real photos exist, a product's drawing on a colour-tinted background.
 */
export type Look = {
  id: string;
  caption: string;
  productId?: string;
  img?: ImgProps;
  drawn?: { product: Product; colorId: string; bg: string };
};

/** Drift speed, px/s (leftwards). */
const DRIFT = 40;
/** Curved wall: rotateY per viewport width of distance from the centre, its clamp, and depth. */
const TILT = 36;
const TILT_MAX = 22;
const DEPTH = 60;
const SKEW_MAX = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

const REDUCE = "(prefers-reduced-motion: reduce)";
function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(REDUCE);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
}

/**
 * "Off the rack": a curved wall of portrait cards that drifts left and loops.
 * One rAF loop (transforms only) places every card: rotateY = clamp(offset × -36deg, ±22deg) and
 * translateZ = -|offset| × 60px, where offset = (card centre - viewport centre) / viewport width, so cards
 * on the left face right and cards on the right face left. Track velocity adds a skewX (max 4deg) that
 * settles back. Drift pauses on hover, focus and drag; ← → nudge one card; drag (mouse) or swipe (touch)
 * with a fling. The loop stops off-screen and in a hidden tab.
 * prefers-reduced-motion: a plain scroll-snap row, no drift, tilt or skew.
 */
export default function Lookbook({ looks }: { looks: Look[] }) {
  const reduce = useReducedMotion();
  const nudge = useRef<(dir: number) => void>(() => {});
  return (
    <section className="home-section lookbook" aria-labelledby="lookbook-h">
      <div className="row-head lookbook-head">
        <div className="row-titles">
          <p className="eyebrow">Lookbook</p>
          <h2 className="home-h" id="lookbook-h">
            Off the rack
          </h2>
        </div>
        <span className="row-arrows">
          <button type="button" className="row-arrow" onClick={() => nudge.current(-1)} aria-label="Previous photos">
            ←
          </button>
          <button type="button" className="row-arrow" onClick={() => nudge.current(1)} aria-label="Next photos">
            →
          </button>
        </span>
      </div>
      {reduce ? <Plain looks={looks} nudge={nudge} /> : <Wall looks={looks} nudge={nudge} />}
    </section>
  );
}

function Card({ look, i, copy }: { look: Look; i: number; copy: number }) {
  const hidden = copy > 0; // loop duplicates: decorative, out of the tab order
  const color = look.drawn && (look.drawn.product.colors.find((c) => c.id === look.drawn!.colorId) ?? look.drawn.product.colors[0]);
  return (
    <li className={`lb-card ${i % 2 ? "is-short" : ""}`} aria-hidden={hidden || undefined}>
      <div className="lb-inner" style={look.drawn ? ({ "--lb-bg": look.drawn.bg } as CSSProperties) : undefined}>
        {look.img ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img {...look.img} className="lb-img" draggable={false} />
        ) : look.drawn && color ? (
          <Garment product={look.drawn.product} color={color} className="lb-drawn" />
        ) : null}
        {look.caption && <p className="lb-caption mono">{look.caption}</p>}
        {look.productId && (
          <Link href={`/p/${look.productId}`} className="lb-pill" tabIndex={hidden ? -1 : undefined} draggable={false}>
            Shop the look
          </Link>
        )}
      </div>
    </li>
  );
}

type Nudge = { current: (dir: number) => void };

function Wall({ looks, nudge }: { looks: Look[]; nudge: Nudge }) {
  const viewRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  // Copies of the list laid end to end, enough to cover the viewport while it loops.
  const [copies, setCopies] = useState(3);
  const n = looks.length;

  useEffect(() => {
    const view = viewRef.current;
    const track = trackRef.current;
    if (!view || !track || !n) return;

    let cards: HTMLElement[] = [];
    let centres: number[] = [];
    let setW = 0; // width of one copy of the list (incl. its trailing gap): the loop length
    let cardStep = 300;
    let vw = 1;
    const measure = () => {
      cards = Array.from(track.children) as HTMLElement[];
      centres = cards.map((c) => c.offsetLeft + c.offsetWidth / 2);
      vw = view.clientWidth || 1;
      setW = cards[n] ? cards[n].offsetLeft - cards[0].offsetLeft : track.scrollWidth;
      cardStep = setW / n;
      const need = Math.max(2, Math.ceil(vw / Math.max(1, setW)) + 1);
      if (need > copies) setCopies(need);
    };
    measure();

    let x = 0;
    let v = 0; // fling velocity, px/s
    let skew = 0;
    let hover = false;
    let focus = false;
    let drag: { id: number; startX: number; base: number; lastX: number; lastT: number; vel: number; moved: boolean } | null = null;
    let tween: { from: number; to: number; t0: number } | null = null;
    let suppressClick = false;
    let last = 0;
    let raf = 0;

    const wrap = () => {
      if (setW <= 0) return;
      let shift = 0;
      while (x + shift <= -setW) shift += setW;
      while (x + shift > 0) shift -= setW;
      if (!shift) return;
      x += shift;
      if (drag) drag.base += shift;
      if (tween) {
        tween.from += shift;
        tween.to += shift;
      }
    };

    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const prev = x;
      if (drag) {
        // x is set by the pointer
      } else if (tween) {
        const k = Math.min(1, (now - tween.t0) / 600);
        x = tween.from + (tween.to - tween.from) * easeOut(k);
        if (k >= 1) tween = null;
      } else if (Math.abs(v) > DRIFT) {
        x += v * dt;
        v *= Math.pow(0.05, dt); // fling decays to the drift
      } else if (!hover && !focus) {
        v = 0;
        x -= DRIFT * dt;
      }
      const vel = dt ? (x - prev) / dt : 0;
      wrap();
      skew += (clamp(-vel / 150, -SKEW_MAX, SKEW_MAX) - skew) * Math.min(1, dt * 8);

      track.style.transform = `translate3d(${x}px,0,0)`;
      const mid = vw / 2;
      for (let i = 0; i < cards.length; i++) {
        const off = (centres[i] + x - mid) / vw;
        if (off < -1.2 || off > 1.2) continue; // off-screen: leave as is
        const ry = clamp(off * -TILT, -TILT_MAX, TILT_MAX);
        cards[i].style.transform = `translateZ(${(-Math.abs(off) * DEPTH).toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) skewX(${skew.toFixed(2)}deg)`;
      }
      raf = requestAnimationFrame(frame);
    };

    let onScreen = false;
    const run = () => {
      const go = onScreen && !document.hidden;
      if (go && !raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      } else if (!go && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      run();
    });
    io.observe(view);
    document.addEventListener("visibilitychange", run);
    const ro = new ResizeObserver(measure);
    ro.observe(view);

    nudge.current = (dir: number) => {
      v = 0;
      const from = x;
      tween = { from, to: from - dir * cardStep, t0: performance.now() };
      if (!raf) {
        // off-screen or hidden: just jump
        x = tween.to;
        tween = null;
        wrap();
      }
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = { id: e.pointerId, startX: e.clientX, base: x, lastX: e.clientX, lastT: e.timeStamp, vel: 0, moved: false };
      tween = null;
      v = 0;
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.startX;
      if (!drag.moved) {
        if (Math.abs(dx) < 6) return;
        drag.moved = true;
        view.setPointerCapture(e.pointerId);
        view.classList.add("is-dragging");
      }
      x = drag.base + dx;
      const dt = (e.timeStamp - drag.lastT) / 1000;
      if (dt > 0) drag.vel = drag.vel * 0.6 + ((e.clientX - drag.lastX) / dt) * 0.4;
      drag.lastX = e.clientX;
      drag.lastT = e.timeStamp;
    };
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) {
        suppressClick = true;
        v = clamp(drag.vel, -3000, 3000);
        view.classList.remove("is-dragging");
      }
      drag = null;
    };
    const click = (e: MouseEvent) => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
    };
    const enter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hover = true;
    };
    const leave = () => {
      hover = false;
    };
    const fin = () => {
      focus = true;
    };
    const fout = (e: FocusEvent) => {
      if (!view.contains(e.relatedTarget as Node | null)) focus = false;
    };
    const noNativeDrag = (e: DragEvent) => e.preventDefault();

    view.addEventListener("pointerdown", down);
    view.addEventListener("pointermove", move);
    view.addEventListener("pointerup", up);
    view.addEventListener("pointercancel", up);
    view.addEventListener("click", click, true);
    view.addEventListener("pointerenter", enter);
    view.addEventListener("pointerleave", leave);
    view.addEventListener("focusin", fin);
    view.addEventListener("focusout", fout);
    view.addEventListener("dragstart", noNativeDrag);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", run);
      nudge.current = () => {};
      view.removeEventListener("pointerdown", down);
      view.removeEventListener("pointermove", move);
      view.removeEventListener("pointerup", up);
      view.removeEventListener("pointercancel", up);
      view.removeEventListener("click", click, true);
      view.removeEventListener("pointerenter", enter);
      view.removeEventListener("pointerleave", leave);
      view.removeEventListener("focusin", fin);
      view.removeEventListener("focusout", fout);
      view.removeEventListener("dragstart", noNativeDrag);
    };
  }, [n, copies, nudge]);

  return (
    <div ref={viewRef} className="lb-view">
      <ul ref={trackRef} className="lb-track">
        {Array.from({ length: copies }, (_, copy) =>
          looks.map((look, i) => <Card key={`${copy}-${look.id}`} look={look} i={i} copy={copy} />),
        )}
      </ul>
    </div>
  );
}

/** Reduced motion: one copy in a plain scroll-snap row; the buttons scroll by one card. */
function Plain({ looks, nudge }: { looks: Look[]; nudge: Nudge }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    nudge.current = (dir: number) => {
      const t = ref.current;
      const card = t?.querySelector<HTMLElement>(".lb-card");
      if (!t || !card) return;
      t.scrollBy({ left: dir * (card.offsetWidth + (parseFloat(getComputedStyle(t).columnGap) || 0)) });
    };
    return () => {
      nudge.current = () => {};
    };
  }, [nudge]);
  return (
    <ul ref={ref} className="lb-plain">
      {looks.map((look, i) => (
        <Card key={look.id} look={look} i={i} copy={0} />
      ))}
    </ul>
  );
}
