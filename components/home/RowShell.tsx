"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

/** One card width + the gap: what the buttons scroll by. */
function step(track: HTMLElement) {
  const item = track.querySelector<HTMLElement>(".row-item");
  const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
  return (item?.offsetWidth ?? track.clientWidth * 0.8) + gap;
}

/**
 * Client half of a home row (Row.tsx renders the cards on the server):
 * - reveal: when 20% of the row is in view, .is-in fades the header and cards up (CSS, --i × 60ms), once.
 * - mouse drag on the track (pointer events). Touch keeps native swipe. During a drag, snapping is off;
 *   on release it scrolls to the nearest card. A drag never counts as a click.
 */
export function RowShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const track = ref.current?.querySelector<HTMLElement>(".row-track");
    if (!track) return;
    let id = -1;
    let x0 = 0;
    let s0 = 0;
    let dragged = false;

    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      id = e.pointerId;
      x0 = e.clientX;
      s0 = track.scrollLeft;
      dragged = false;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - x0;
      if (!dragged) {
        if (Math.abs(dx) < 6) return;
        dragged = true;
        track.setPointerCapture(id);
        track.classList.add("is-dragging");
      }
      track.scrollLeft = s0 - dx;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      if (!dragged) return;
      track.classList.remove("is-dragging");
      const s = step(track);
      track.scrollTo({ left: Math.round(track.scrollLeft / s) * s, behavior: "smooth" });
    };
    // The click that ends a drag: swallow it so the card under the pointer doesn't open.
    const click = (e: globalThis.MouseEvent) => {
      if (!dragged) return;
      e.preventDefault();
      e.stopPropagation();
      dragged = false;
    };
    const noNativeDrag = (e: DragEvent) => e.preventDefault();

    track.addEventListener("pointerdown", down);
    track.addEventListener("pointermove", move);
    track.addEventListener("pointerup", up);
    track.addEventListener("pointercancel", up);
    track.addEventListener("click", click, true);
    track.addEventListener("dragstart", noNativeDrag);
    return () => {
      track.removeEventListener("pointerdown", down);
      track.removeEventListener("pointermove", move);
      track.removeEventListener("pointerup", up);
      track.removeEventListener("pointercancel", up);
      track.removeEventListener("click", click, true);
      track.removeEventListener("dragstart", noNativeDrag);
    };
  }, []);

  return (
    <div ref={ref} className={`row-shell ${shown ? "is-in" : ""}`}>
      {children}
    </div>
  );
}

/** ← → for a row: scroll its track by one card. */
export function RowArrows({ label }: { label: string }) {
  const by = (dir: number) => (e: MouseEvent<HTMLButtonElement>) => {
    const track = e.currentTarget.closest(".row-shell")?.querySelector<HTMLElement>(".row-track");
    if (!track) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: dir * step(track), behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <span className="row-arrows">
      <button type="button" className="row-arrow" onClick={by(-1)} aria-label={`Scroll ${label} left`}>
        ←
      </button>
      <button type="button" className="row-arrow" onClick={by(1)} aria-label={`Scroll ${label} right`}>
        →
      </button>
    </span>
  );
}
