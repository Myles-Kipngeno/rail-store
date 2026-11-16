"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { lineKey, useBag, type BagLine } from "@/components/BagProvider";
import { STORE } from "@/lib/config";
import { formatKES } from "@/lib/format";
import { getOrderStatus, startCheckout } from "./actions";

const POLL_MS = 3000;
const GIVE_UP_MS = 90_000;

type Phase =
  | { kind: "form" }
  | { kind: "waiting"; orderId: string; total: number; phone: string; since: number }
  | { kind: "slow"; orderId: string; total: number; phone: string }
  | { kind: "paid"; orderId: string; total: number; receipt: string | null; lines: BagLine[] }
  | { kind: "failed"; reason: string };

type Field = "name" | "phone" | "town" | "note";

/** 254712345678 → 0712 345 678 */
const prettyPhone = (p: string) => `0${p.slice(3, 6)} ${p.slice(6, 9)} ${p.slice(9)}`;

export default function CheckoutView({ enabled }: { enabled: boolean }) {
  const bag = useBag();
  const [ready, setReady] = useState(false); // the bag loads from localStorage after the first render
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [form, setForm] = useState({ name: "", phone: "", town: "", note: "", company: "" });
  const [error, setError] = useState<{ text: string; field?: Field } | null>(null);
  const [busy, setBusy] = useState(false);
  const snapshot = useRef<BagLine[]>([]);
  const clear = bag.clear;

  useEffect(() => setReady(true), []);

  // Poll the order every 3s while waiting, for up to 90s.
  useEffect(() => {
    if (phase.kind !== "waiting") return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const res = await getOrderStatus(phase.orderId).catch(() => null);
      if (stop) return;
      if (res?.ok && res.status === "PAID") {
        clear();
        setPhase({ kind: "paid", orderId: phase.orderId, total: res.total, receipt: res.receipt, lines: snapshot.current });
        return;
      }
      if (res?.ok && res.status === "FAILED")
        return setPhase({ kind: "failed", reason: res.reason || "The payment didn't go through." });
      if (res?.ok && res.status === "NEEDS_REVIEW")
        return setPhase({ kind: "failed", reason: "We need to check this payment by hand and will be in touch, so please don't pay again." });
      if (Date.now() - phase.since >= GIVE_UP_MS)
        return setPhase({ kind: "slow", orderId: phase.orderId, total: phase.total, phone: phase.phone });
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [phase, clear]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    snapshot.current = bag.lines;
    const res = await startCheckout({
      ...form,
      lines: bag.lines.map((l) => ({ productId: l.productId, colorId: l.colorId, size: l.size, qty: l.qty, price: l.price })),
    }).catch(() => ({ ok: false as const, error: "Couldn't reach the shop. Check your connection and try again." }));
    setBusy(false);
    if (!res.ok) return setError({ text: res.error, field: "field" in res ? res.field : undefined });
    setPhase({ kind: "waiting", orderId: res.orderId, total: res.total, phone: res.phone, since: Date.now() });
  };

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const invalid = (f: Field) => (error?.field === f ? true : undefined);

  if (phase.kind === "paid")
    return (
      <main className="checkout checkout--status">
        <section className="checkout-card" role="status">
          <p className="eyebrow">Paid</p>
          <h1 className="checkout-h">Thank you. Your order is in.</h1>
          <dl className="checkout-receipt mono">
            <dt>M-Pesa receipt</dt>
            <dd>{phase.receipt ?? "Arriving by SMS"}</dd>
            <dt>Order</dt>
            <dd>{phase.orderId.slice(0, 8).toUpperCase()}</dd>
            <dt>Paid</dt>
            <dd>{formatKES(phase.total)}</dd>
          </dl>
          {phase.lines.length > 0 && <Summary lines={phase.lines} total={phase.total} />}
          <p className="fine">We&apos;ll contact you to arrange delivery.</p>
          <Link href="/" className="btn btn--primary btn--block">
            Back to the rack
          </Link>
        </section>
      </main>
    );

  if (phase.kind === "waiting" || phase.kind === "slow")
    return (
      <main className="checkout checkout--status">
        <section className="checkout-card" role="status" aria-live="polite">
          <p className="eyebrow">{formatKES(phase.total)} · M-Pesa</p>
          <h1 className="checkout-h">Check your phone</h1>
          {phase.kind === "waiting" ? (
            <>
              <p>
                We sent a payment prompt to <strong className="mono">{prettyPhone(phase.phone)}</strong>. Enter your M-Pesa PIN to
                pay.
              </p>
              <p className="checkout-wait">
                <span className="checkout-spinner" aria-hidden="true" /> Waiting for M-Pesa…
              </p>
            </>
          ) : (
            <>
              <p>
                We haven&apos;t had confirmation yet. If you entered your PIN, don&apos;t pay again: we&apos;ll confirm your order
                as soon as M-Pesa does.
              </p>
              <button
                className="btn btn--primary btn--block"
                onClick={() => setPhase({ kind: "waiting", orderId: phase.orderId, total: phase.total, phone: phase.phone, since: Date.now() - GIVE_UP_MS + 15_000 })}
              >
                Check again
              </button>
              <button className="btn btn--ghost btn--block" onClick={() => setPhase({ kind: "form" })}>
                I didn&apos;t get a prompt, try again
              </button>
            </>
          )}
        </section>
      </main>
    );

  const lines = bag.lines;
  const empty = ready && lines.length === 0;

  return (
    <main className="checkout">
      <section className="checkout-main">
        <h1 className="checkout-h">Checkout</h1>
        {phase.kind === "failed" && (
          <p className="checkout-alert" role="alert">
            {phase.reason} You can try again.
          </p>
        )}
        {!enabled ? (
          <p className="checkout-alert">
            M-Pesa checkout isn&apos;t set up yet.{STORE.whatsapp ? " Order on WhatsApp from your bag for now." : ""}
          </p>
        ) : empty ? (
          <p>
            Your bag is empty. <Link href="/">Pull something off the rack.</Link>
          </p>
        ) : (
          <form className="checkout-form" onSubmit={submit} noValidate>
            <label className="field">
              <span className="field-label">Name</span>
              <input value={form.name} onChange={set("name")} autoComplete="name" maxLength={80} required aria-invalid={invalid("name")} />
            </label>
            <label className="field">
              <span className="field-label">M-Pesa phone number</span>
              <input
                value={form.phone}
                onChange={set("phone")}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0712 345 678"
                maxLength={20}
                required
                aria-invalid={invalid("phone")}
              />
            </label>
            <label className="field">
              <span className="field-label">Town</span>
              <input
                value={form.town}
                onChange={set("town")}
                autoComplete="address-level2"
                maxLength={60}
                required
                aria-invalid={invalid("town")}
              />
            </label>
            <label className="field">
              <span className="field-label">Note (optional)</span>
              <textarea value={form.note} onChange={set("note")} rows={3} maxLength={300} placeholder="Landmark, delivery time…" />
            </label>
            {/* Honeypot for bots: hidden from people and screen readers. */}
            <input value={form.company} onChange={set("company")} tabIndex={-1} autoComplete="off" className="news-hp" aria-hidden="true" />
            <p className="checkout-error" role="alert">
              {error?.text ?? ""}
            </p>
            <button className="btn btn--primary btn--block" disabled={busy || !ready || lines.length === 0}>
              {busy ? "Sending prompt…" : `Pay ${formatKES(bag.subtotal)} with M-Pesa`}
            </button>
            <p className="fine">You&apos;ll get an M-Pesa prompt on your phone. Delivery is arranged with you after payment.</p>
          </form>
        )}
      </section>
      {lines.length > 0 && (
        <aside className="checkout-side" aria-label="Order summary">
          <Summary lines={lines} total={bag.subtotal} />
        </aside>
      )}
    </main>
  );
}

function Summary({ lines, total }: { lines: BagLine[]; total: number }) {
  return (
    <div className="checkout-summary">
      <ul className="checkout-lines">
        {lines.map((l) => (
          <li key={lineKey(l)}>
            <span className="bag-swatch" style={{ background: l.hex }} />
            <span className="checkout-line-meta">
              <strong>{l.name}</strong>
              <span className="muted">
                {l.colorName} · {l.size} · ×{l.qty}
              </span>
            </span>
            <span className="mono">{formatKES(l.price * l.qty)}</span>
          </li>
        ))}
      </ul>
      <div className="subtotal">
        <span>Total</span>
        <strong>{formatKES(total)}</strong>
      </div>
    </div>
  );
}
