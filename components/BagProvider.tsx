"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Size } from "@/lib/types";

export interface BagLine {
  productId: string;
  colorId: string;
  size: Size;
  qty: number;
  /** Snapshot for display; prices are re-checked server-side at checkout. */
  name: string;
  colorName: string;
  hex: string;
  price: number;
}

interface BagCtx {
  lines: BagLine[];
  count: number;
  subtotal: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (line: Omit<BagLine, "qty">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  toast: string | null;
}

const Ctx = createContext<BagCtx | null>(null);
const KEY = "rail-bag-v1";
export const lineKey = (l: Pick<BagLine, "productId" | "colorId" | "size">) => `${l.productId}|${l.colorId}|${l.size}`;

export function BagProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<BagLine[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {}
  }, [lines]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const add = useCallback<BagCtx["add"]>((line, qty = 1) => {
    setLines((ls) => {
      const k = lineKey(line);
      const i = ls.findIndex((l) => lineKey(l) === k);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l));
      return [...ls, { ...line, qty }];
    });
    setToast(`${line.name} · ${line.colorName} · ${line.size}`);
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((ls) => (qty <= 0 ? ls.filter((l) => lineKey(l) !== key) : ls.map((l) => (lineKey(l) === key ? { ...l, qty } : l))));
  }, []);

  const remove = useCallback((key: string) => setLines((ls) => ls.filter((l) => lineKey(l) !== key)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<BagCtx>(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((n, l) => n + l.qty * l.price, 0),
      open,
      setOpen,
      add,
      setQty,
      remove,
      clear,
      toast,
    }),
    [lines, open, add, setQty, remove, clear, toast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBag() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBag must be used inside <BagProvider>");
  return v;
}
