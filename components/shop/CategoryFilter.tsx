"use client";

import { useEffect, useState, type ReactNode } from "react";

type Chip = { value: string; label: string };

/**
 * Category chips (+ All) over a list of server-rendered items (department shelf and grid pages; the rack
 * pages use Store's own chips). Only chips with items show. ?category=<slug> deep-links and stays in
 * the address bar as you filter. Items arrive as ready-made nodes, so no image code ships here.
 */
export function CategoryFilter({
  chips,
  items,
  wrapClassName,
  listClassName,
  label,
}: {
  chips: Chip[];
  items: { id: string; category: string; node: ReactNode }[];
  wrapClassName?: string;
  listClassName: string;
  label: string;
}) {
  const shown = chips.filter((c) => items.some((i) => i.category === c.value));
  const [cat, setCat] = useState("all");

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("category");
    if (c && shown.some((x) => x.value === c)) setCat(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (c: string) => {
    setCat(c);
    try {
      const url = new URL(window.location.href);
      if (c === "all") url.searchParams.delete("category");
      else url.searchParams.set("category", c);
      window.history.replaceState(null, "", url);
    } catch {}
  };

  const list = cat === "all" ? items : items.filter((i) => i.category === cat);
  return (
    <>
      {shown.length > 1 && (
        <nav className="filters" aria-label={`Filter ${label}`}>
          {[{ value: "all", label: "All" }, ...shown].map((c) => (
            <button
              key={c.value}
              type="button"
              className={`chip ${cat === c.value ? "is-active" : ""}`}
              aria-pressed={cat === c.value}
              onClick={() => pick(c.value)}
            >
              {c.label}
            </button>
          ))}
        </nav>
      )}
      <div className={wrapClassName}>
        <ul className={listClassName}>
          {list.map((i) => (
            <li key={i.id}>{i.node}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
