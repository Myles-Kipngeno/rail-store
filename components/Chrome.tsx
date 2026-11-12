"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { STORE } from "@/lib/config";
import { useBag } from "./BagProvider";

export function Header({ count }: { count?: number }) {
  const bag = useBag();
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link href="/" className="nav-link">
          The rack
        </Link>
        {count !== undefined && <span className="muted mono hide-sm">{count} pieces</span>}
      </div>
      <Link href="/" className="logo" aria-label={`${STORE.name} home`}>
        {STORE.name}
      </Link>
      <div className="topbar-right">
        <span className="muted mono hide-sm">{STORE.drop}</span>
        <button className="bag-btn" onClick={() => bag.setOpen(true)}>
          Bag
          <motion.span key={bag.count} className="bag-count" initial={{ scale: 1.6 }} animate={{ scale: 1 }}>
            {bag.count}
          </motion.span>
        </button>
      </div>
    </header>
  );
}

export function Ticker() {
  const items = [...STORE.ticker, ...STORE.ticker];
  return (
    <div className="ticker" aria-label={STORE.ticker.join(", ")}>
      <div className="ticker-track" aria-hidden="true">
        {items.concat(items).map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
}
