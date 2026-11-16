"use client";

import type { MouseEvent } from "react";

/** ← → buttons for a card row (desktop only, CSS). They scroll the row's .row-track by most of its width. */
export function RowArrows({ label }: { label: string }) {
  const by = (dir: number) => (e: MouseEvent<HTMLButtonElement>) => {
    const track = e.currentTarget.closest(".row")?.querySelector<HTMLElement>(".row-track");
    track?.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: "smooth" });
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
