"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { STORE } from "@/lib/config";
import { formatKES } from "@/lib/format";
import { lineKey, useBag } from "./BagProvider";

export function BagDrawer() {
  const bag = useBag();

  useEffect(() => {
    if (!bag.open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && bag.setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bag]);

  const message = [
    `Hi ${STORE.name}, I'd like to order:`,
    ...bag.lines.map((l) => `• ${l.name} (${l.colorName}, ${l.size}) x${l.qty} = ${formatKES(l.price * l.qty)}`),
    `Total: ${formatKES(bag.subtotal)}`,
  ].join("\n");
  const waHref = STORE.whatsapp ? `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(message)}` : null;

  return (
    <>
      <AnimatePresence>
        {bag.open && (
          <>
            <motion.div
              className="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => bag.setOpen(false)}
            />
            <motion.aside
              className="drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Your bag"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 36 }}
            >
              <header className="drawer-head">
                <h2>Bag ({bag.count})</h2>
                <button className="link-btn" onClick={() => bag.setOpen(false)}>
                  Close
                </button>
              </header>

              {bag.lines.length === 0 ? (
                <p className="drawer-empty">Your bag is empty. Pull something off the rack.</p>
              ) : (
                <ul className="bag-list">
                  <AnimatePresence initial={false}>
                    {bag.lines.map((l) => {
                      const k = lineKey(l);
                      return (
                        <motion.li
                          key={k}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 40 }}
                          className="bag-line"
                        >
                          <span className="bag-swatch" style={{ background: l.hex }} />
                          <div className="bag-meta">
                            <strong>{l.name}</strong>
                            <span>
                              {l.colorName} · {l.size}
                            </span>
                          </div>
                          <div className="qty" aria-label="Quantity">
                            <button onClick={() => bag.setQty(k, l.qty - 1)} aria-label="One less">
                              −
                            </button>
                            <span>{l.qty}</span>
                            <button onClick={() => bag.setQty(k, l.qty + 1)} aria-label="One more">
                              +
                            </button>
                          </div>
                          <span className="bag-price">{formatKES(l.price * l.qty)}</span>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}

              {bag.lines.length > 0 && (
                <footer className="drawer-foot">
                  <div className="subtotal">
                    <span>Subtotal</span>
                    <strong>{formatKES(bag.subtotal)}</strong>
                  </div>
                  <p className="fine">Delivery is worked out at checkout.</p>
                  {waHref ? (
                    <a className="btn btn--primary btn--block" href={waHref} target="_blank" rel="noopener noreferrer">
                      Order on WhatsApp
                    </a>
                  ) : (
                    <p className="fine">Set NEXT_PUBLIC_WHATSAPP_NUMBER to turn on WhatsApp ordering.</p>
                  )}
                  <button className="btn btn--ghost btn--block" disabled title="M-Pesa checkout is added in phase 2">
                    Pay with M-Pesa
                  </button>
                </footer>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bag.toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
          >
            <span>Added: {bag.toast}</span>
            <button className="link-btn" onClick={() => bag.setOpen(true)}>
              View bag
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
