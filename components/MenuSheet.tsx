"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, type RefObject } from "react";
import { STORE } from "@/lib/config";
import { NAV } from "./Chrome";

/**
 * Phones: full-screen menu sheet; the links slide in one after another. Esc, ✕, a link or a route change
 * closes it. Locks page scroll while open, moves focus in, and hands it back to the Menu button.
 * Loaded on demand by Chrome.tsx (next/dynamic), so it isn't in any page's first-load JS.
 */
export default function MenuSheet({
  open,
  onClose,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Close after navigating. Only on a real change: this mounts on the first tap, already open.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    closeRef.current();
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => sheetRef.current?.querySelector<HTMLElement>("a")?.focus(), 60);
    const btn = returnFocus.current;
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      btn?.focus();
    };
  }, [open, returnFocus]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={sheetRef}
          id="menu-sheet"
          className="menu-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2, delay: reduce ? 0 : 0.1 } }}
          transition={{ duration: reduce ? 0 : 0.2 }}
        >
          <div className="menu-sheet-top">
            <Link href="/" className="logo" onClick={onClose}>
              {STORE.name}
            </Link>
            <button type="button" className="close-x" onClick={onClose} aria-label="Close menu">
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <ul className="menu-links">
            {[{ href: "/", label: "The rack" }, ...NAV].map((d, i) => (
              <motion.li
                key={d.href}
                initial={reduce ? false : { opacity: 0, x: -28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: -16, transition: { duration: 0.15 } }}
                transition={{ duration: 0.42, delay: reduce ? 0 : 0.06 + i * 0.055, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <Link
                  href={d.href}
                  className="menu-link"
                  aria-current={pathname === d.href ? "page" : undefined}
                  onClick={onClose}
                >
                  {d.label}
                </Link>
              </motion.li>
            ))}
          </ul>
          <p className="menu-foot muted mono">
            {STORE.drop} · {STORE.city}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
