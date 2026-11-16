"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { STORE } from "@/lib/config";
import { DEPARTMENT_LABELS, DEPARTMENTS } from "@/lib/types";
import { useBag, type BagLine } from "./BagProvider";

/* Add-to-bag timings (the reference video). */
const SPIN_MS = 550; // "Adding" spinner before the flight
const FLY_MS = 700; // garment copy → Bag button
const ADDED_MS = 2400; // "Added to bag ✓" + "View bag →"
const LIME = "rgb(185 245 61)"; // --lime; WAAPI keyframes can't read CSS variables

/** Department nav: header links on desktop, full-screen sheet on phones. */
export const NAV = DEPARTMENTS.map((d) => ({ href: `/shop/${d}`, label: DEPARTMENT_LABELS[d] }));

// The sheet only loads once someone taps Menu: keeps it off every page's first-load JS.
const MenuSheet = dynamic(() => import("./MenuSheet"), { ssr: false });

/** Phones: ☰ opens a full-screen sheet (components/MenuSheet.tsx). */
function MenuButton() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false); // keep the sheet mounted after first use so its exit animation runs
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="menu-btn"
        aria-expanded={open}
        aria-controls="menu-sheet"
        onPointerEnter={() => setLoaded(true)}
        onFocus={() => setLoaded(true)}
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
      >
        <span className="menu-icon" aria-hidden="true" />
        Menu
      </button>
      {loaded && <MenuSheet open={open} onClose={() => setOpen(false)} returnFocus={btnRef} />}
    </>
  );
}

export function Header({ count }: { count?: number }) {
  const bag = useBag();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const countRef = useRef<HTMLSpanElement>(null);
  const seen = useRef(bag.pulse); // the provider outlives pages: only react to adds made while mounted

  // Something landed in the bag: the count does a spring bounce and the button gets a brief lime ring.
  useEffect(() => {
    if (bag.pulse === seen.current) return;
    seen.current = bag.pulse;
    if (reduce) return;
    const c = countRef.current;
    if (c)
      animate(c, { scale: 1.35 }, { duration: 0.12, ease: "easeOut" }).then(() =>
        animate(c, { scale: 1 }, { type: "spring", stiffness: 520, damping: 9 }),
      );
    bag.buttonRef.current?.animate(
      [
        { outline: `2px solid ${LIME}`, outlineOffset: "3px" },
        { outline: `2px solid rgb(185 245 61 / 0)`, outlineOffset: "9px" },
      ],
      { duration: 700, easing: "ease-out" },
    );
  }, [bag.pulse, bag.buttonRef, reduce]);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <MenuButton />
        <nav className="dept-nav" aria-label="Departments">
          {NAV.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="nav-link"
              aria-current={pathname === d.href ? "page" : undefined}
            >
              {d.label}
            </Link>
          ))}
        </nav>
        {count !== undefined && <span className="muted mono hide-md">{count} pieces</span>}
      </div>
      <Link href="/" className="logo" aria-label={`${STORE.name} home`}>
        {STORE.name}
      </Link>
      <div className="topbar-right">
        <span className="muted mono hide-sm">{STORE.drop}</span>
        <button className="bag-btn" ref={bag.buttonRef} onClick={() => bag.setOpen(true)}>
          Bag
          <span ref={countRef} className="bag-count">
            {bag.count}
          </span>
        </button>
      </div>
    </header>
  );
}

/**
 * A copy of `src` flies along an arc onto `dst`, shrinking to 0.12 and fading out (WAAPI; the middle
 * keyframe sits above the straight line, which makes the arc). Resolves when it lands.
 */
function flyToBag(src: HTMLElement | null, dst: HTMLElement | null): Promise<void> {
  const a = src?.getBoundingClientRect();
  const b = dst?.getBoundingClientRect();
  if (!src || !a?.width || !b?.width) return Promise.resolve();
  const ghost = src.cloneNode(true) as HTMLElement;
  ghost.setAttribute("aria-hidden", "true");
  ghost.classList.add("bag-ghost");
  Object.assign(ghost.style, {
    left: `${a.left}px`,
    top: `${a.top}px`,
    width: `${a.width}px`,
    height: `${a.height}px`,
  });
  document.body.appendChild(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const lift = Math.min(160, Math.abs(dy) * 0.35 + 60);
  const anim = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { offset: 0.45, transform: `translate(${dx * 0.38}px, ${dy * 0.45 - lift}px) scale(0.55)`, opacity: 0.95 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0 },
    ],
    { duration: FLY_MS, easing: "cubic-bezier(.45,0,.3,1)", fill: "forwards" },
  );
  return anim.finished.then(
    () => ghost.remove(),
    () => ghost.remove(),
  );
}

type Phase = "idle" | "adding" | "added";

/**
 * Add to bag with the full sequence: spinner ("Adding", width kept) → a copy of the garment flies to the
 * Bag button → bag.add() on landing → "Added to bag ✓" + "View bag →" for 2.4s → reset.
 * `prepare` validates (and shows the size shake itself) and returns the line, or null to stop.
 * Reduced motion: no spinner or flight, the line is added at once and only the button state changes.
 */
export function AddToBagButton({
  prepare,
  source,
  className = "btn btn--primary",
  block,
  disabled,
  children = "Add to bag",
}: {
  prepare: () => { line: Omit<BagLine, "qty">; qty?: number } | null;
  source: () => HTMLElement | null;
  className?: string;
  block?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const bag = useBag();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [width, setWidth] = useState<number>();
  const resetTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  const added = () => {
    setPhase("added");
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      setPhase("idle");
      setWidth(undefined);
    }, ADDED_MS);
  };

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (phase !== "idle") return;
    const item = prepare();
    if (!item) return;
    setWidth(e.currentTarget.getBoundingClientRect().width);
    if (reduce) {
      bag.add(item.line, item.qty);
      added();
      return;
    }
    setPhase("adding");
    // Not cancelled on unmount: closing the view mid-flight must not lose the line.
    window.setTimeout(async () => {
      await flyToBag(source(), bag.buttonRef.current);
      bag.add(item.line, item.qty);
      added();
    }, SPIN_MS);
  };

  return (
    <div className={`atb ${block ? "atb--block" : ""}`}>
      <button
        type="button"
        className={`${className} atb-btn ${phase !== "idle" ? `is-${phase}` : ""}`}
        style={phase === "adding" ? { width } : phase === "added" ? { minWidth: width } : undefined}
        onClick={onClick}
        disabled={disabled}
        aria-busy={phase === "adding"}
      >
        {phase === "adding" ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Adding
          </>
        ) : phase === "added" ? (
          "Added to bag ✓"
        ) : (
          children
        )}
      </button>
      <AnimatePresence initial={false}>
        {phase === "added" && (
          <motion.button
            type="button"
            className="link-btn atb-view"
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: reduce ? 0 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={() => bag.setOpen(true)}
          >
            View bag →
          </motion.button>
        )}
      </AnimatePresence>
      <span className="sr-only" aria-live="polite">
        {phase === "added" ? "Added to bag" : ""}
      </span>
    </div>
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
