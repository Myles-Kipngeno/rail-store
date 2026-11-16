"use client";

import Link from "next/link";
import { AnimatePresence, animate, motion, motionValue, useReducedMotion, type MotionValue } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
} from "react";
import { formatKES, totalStock } from "@/lib/format";
import { sizesFor, type Product, type Side, type Size } from "@/lib/types";
import { AddToBagButton, Header, Ticker } from "./Chrome";
import { Garment } from "./Garment";
import { ColorLayers, EASE, Flipper, HangTags, SizePicker } from "./Pieces";

type View = "rack" | "item";
type Rect = { left: number; top: number; width: number };

/* Rack swing: a damped spring on rotateZ around the hook. Peak angle for the hovered piece; halves per slot. */
const SWING = { type: "spring", stiffness: 120, damping: 8 } as const;
const SWING_DEG = 3;
const SWING_REACH = 2; // neighbours within this many slots get a smaller nudge
const SWING_KICK = 17.5; // deg/s of initial velocity per degree of peak swing (stiffness 120, damping 8, mass 1)
const NARROW = "(max-width: 640px)";
const LAND_SWING_DEG = 1.5; // the piece that just flew back onto its hanger
const CLOSE_PREP_MS = 200; // item view shrinks to 0.94 and the info panel fades before the reverse flight
const CLOSE_FLIGHT_MS = 680;

const FLIGHT_MS = 760;
const FLIGHT_EASE = "cubic-bezier(.2,.8,.2,1)";

/** Animate `el` from `from` to where it currently is (FLIP). Origin is top-centre, matching the hanger hook. */
function fly(el: HTMLElement, from: Rect, ms = FLIGHT_MS) {
  const to = el.getBoundingClientRect();
  if (!to.width) return;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top - to.top;
  const s = from.width / to.width;
  el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transform: "none" }], {
    duration: ms,
    easing: FLIGHT_EASE,
    fill: "backwards",
  });
}

export default function Store({
  products,
  categories: categoryList,
  rackStyle = "hanging",
}: {
  products: Product[];
  /** Fixed filter chips in this order (department pages). Only chips with pieces show. Default: derived from the pieces. */
  categories?: { value: string; label: string }[];
  /** "folded": trousers folded over the hanger bar on the rack (bottoms). The item view is unchanged. */
  rackStyle?: "hanging" | "folded";
}) {
  const reduce = useReducedMotion();
  const categories = useMemo(
    () => [
      "All",
      ...(categoryList
        ? categoryList.map((c) => c.value).filter((v) => products.some((p) => p.category === v))
        : Array.from(new Set(products.map((p) => p.category)))),
    ],
    [products, categoryList],
  );
  const chipLabel = (c: string) => categoryList?.find((x) => x.value === c)?.label ?? c;
  const [filter, setFilter] = useState("All");
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const visible = useMemo(
    () => (filter === "All" ? products : products.filter((p) => p.category === filter)),
    [products, filter],
  );

  const [view, setView] = useState<View>("rack");
  const [idx, setIdx] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [colorSel, setColorSel] = useState<Record<string, number>>({});
  const [side, setSide] = useState<Side>("front");
  const [sizeSel, setSizeSel] = useState<Record<string, Size | null>>({});
  const [closing, setClosing] = useState(false);

  const slotRefs = useRef(new Map<string, HTMLDivElement>());
  const lastPointer = useRef("");
  const cardFlyRef = useRef<HTMLDivElement | null>(null);
  const openFrom = useRef<Rect | null>(null);
  const closeFrom = useRef<{ id: string; rect: Rect } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const swings = useRef(new Map<string, MotionValue<number>>());
  const swingDir = useRef(1); // +1 = last movement was to the right
  const prevHover = useRef<string | null>(null);
  const swingOf = (id: string) => {
    let mv = swings.current.get(id);
    if (!mv) swings.current.set(id, (mv = motionValue(0)));
    return mv;
  };
  /** Swing `id` so it peaks at about `deg`. dir +1 = it was travelling right, so the hem swings right (negative rotateZ). */
  const kick = (id: string, deg: number, dir: number) => {
    const mv = swingOf(id);
    animate(mv, 0, { ...SWING, velocity: mv.getVelocity() - dir * deg * SWING_KICK });
  };

  const cur = view === "item" ? visible[idx] : undefined;
  const colorIndex = (p: Product) => Math.min(colorSel[p.id] ?? 0, p.colors.length - 1);

  /** Keep the address in step: this page's path + ?category= (when filtered) + ?piece= (item view). */
  const setUrl = (id?: string, category = filterRef.current) => {
    try {
      const q = new URLSearchParams();
      if (category !== "All") q.set("category", category);
      if (id) q.set("piece", id);
      const s = q.toString();
      window.history.replaceState(null, "", window.location.pathname + (s ? `?${s}` : ""));
    } catch {}
  };

  // Deep links: ?category=<slug> filters the rack, ?piece=<id> opens straight into the item view.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("category");
    const useCat = cat && categories.includes(cat) ? cat : "All";
    if (useCat !== "All") setFilter(useCat);
    const initialPiece = params.get("piece");
    if (!initialPiece) return;
    const list = useCat === "All" ? products : products.filter((p) => p.category === useCat);
    const i = list.findIndex((p) => p.id === initialPiece);
    if (i >= 0) {
      setIdx(i);
      setHover(initialPiece);
      setView("item");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = useCallback(
    (id: string) => {
      const i = visible.findIndex((p) => p.id === id);
      if (i < 0) return;
      const el = slotRefs.current.get(id);
      openFrom.current = el && !reduce ? el.getBoundingClientRect() : null;
      setIdx(i);
      setHover(id);
      setSide("front");
      setClosing(false);
      setView("item");
      setUrl(id);
    },
    [visible, reduce],
  );

  const close = useCallback(() => {
    const id = visible[idx]?.id;
    const el = cardFlyRef.current;
    if (id && el && !reduce) {
      closeFrom.current = { id, rect: el.getBoundingClientRect() };
      el.style.visibility = "hidden";
    }
    setHover(id ?? null);
    setView("rack");
    setUrl();
  }, [visible, idx, reduce]);

  // Close / Back to rack / Esc: the item view first shrinks and the info panel fades (200ms), then the
  // existing reverse flight runs. Reduced motion closes at once.
  const requestClose = useCallback(() => {
    if (closing) return;
    if (reduce) return close();
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false); // the exiting item view keeps its last props, so it stays shrunk while it fades
      close();
    }, CLOSE_PREP_MS);
  }, [closing, reduce, close]);

  const go = useCallback(
    (d: number) => {
      if (!visible.length) return;
      const n = (idx + d + visible.length) % visible.length;
      setIdx(n);
      setHover(visible[n].id);
      setSide("front");
      setUrl(visible[n].id);
    },
    [idx, visible],
  );

  // Closing flight: the garment flies from the item view back onto its hanger.
  useLayoutEffect(() => {
    if (view !== "rack" || !closeFrom.current) return;
    const { id, rect } = closeFrom.current;
    closeFrom.current = null;
    const el = slotRefs.current.get(id);
    if (!el) return;
    // Direction of travel onto the hanger, for the one small swing when it lands.
    const to = el.getBoundingClientRect();
    const dir = Math.sign(to.left + to.width / 2 - (rect.left + rect.width / 2)) || 1;
    fly(el, rect, CLOSE_FLIGHT_MS);
    if (!reduce) window.setTimeout(() => kick(id, LAND_SWING_DEG, dir), CLOSE_FLIGHT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Keyboard: ←/→ browse, F flips, Esc returns to the rack.
  useEffect(() => {
    if (view !== "item") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select, [role=dialog]")) return;
      if (closing) return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") requestClose();
      else if (e.key.toLowerCase() === "f") setSide((s) => (s === "front" ? "back" : "front"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, go, requestClose, closing]);

  // Swing: when the pulled-out piece changes, the piece entered and the piece left (plus up to 2 neighbours
  // each side) get a kick in the direction of travel, then a damped spring settles them back to 0.
  useEffect(() => {
    const prev = prevHover.current;
    prevHover.current = hover;
    if (reduce || view !== "rack" || prev === hover) return;
    const ids = visible.map((p) => p.id);
    const amp = new Map<number, number>();
    for (const id of [prev, hover]) {
      const c = id ? ids.indexOf(id) : -1;
      if (c < 0) continue;
      for (let d = -SWING_REACH; d <= SWING_REACH; d++) {
        const i = c + d;
        if (i >= 0 && i < ids.length) amp.set(i, Math.max(amp.get(i) ?? 0, SWING_DEG / 2 ** Math.abs(d)));
      }
    }
    for (const [i, deg] of amp) kick(ids[i], deg, swingDir.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, view, reduce, visible]);

  // Phones: the rail scroll-snaps and whichever piece ends up centred counts as hovered.
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc || view !== "rack") return;
    const mq = window.matchMedia(NARROW);
    let timer = 0;
    let last = sc.scrollLeft;
    const pickCentre = () => {
      if (!mq.matches) return;
      const r = sc.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      let best: string | null = null;
      let bestD = Infinity;
      for (const p of visible) {
        const g = slotRefs.current.get(p.id)?.getBoundingClientRect();
        if (!g) continue;
        const d = Math.abs(g.left + g.width / 2 - mid);
        if (d < bestD) [best, bestD] = [p.id, d];
      }
      if (best) setHover(best);
    };
    const onScroll = () => {
      const d = sc.scrollLeft - last;
      last = sc.scrollLeft;
      if (d) swingDir.current = d > 0 ? -1 : 1; // content travels opposite to the scroll
      window.clearTimeout(timer);
      timer = window.setTimeout(pickCentre, 90);
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    if (prevHover.current === null) pickCentre();
    return () => {
      sc.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [view, visible]);

  const hovered = products.find((p) => p.id === hover);

  return (
    <div className={`store ${view === "item" ? "mode-item" : "mode-rack"}`}>
      <Header count={products.length} />

      <nav className="filters" aria-label="Filter the rack">
        {categories.map((c) => (
          <button
            key={c}
            className={`chip ${filter === c ? "is-active" : ""}`}
            aria-pressed={filter === c}
            onClick={() => {
              setFilter(c);
              setHover(null);
              setUrl(undefined, c);
            }}
          >
            {chipLabel(c)}
          </button>
        ))}
      </nav>

      <main className="stage">
        {/* ───────── RACK ───────── */}
        <section className="rack" aria-label="The rack" aria-hidden={view === "item"}>
          <div className="rack-scroller" ref={scrollerRef}>
            <div
              className={`rail ${rackStyle === "folded" ? "rail--folded" : ""}`}
              style={{ "--n": products.length } as CSSProperties}
              onPointerMove={(e) => {
                if (e.pointerType === "mouse" && e.movementX) swingDir.current = Math.sign(e.movementX);
              }}
              onPointerLeave={(e) => e.pointerType === "mouse" && view === "rack" && setHover(null)}
            >
              <div className="rod" aria-hidden="true" />
              {products.map((p, i) => {
                const inFilter = visible.includes(p);
                const on = hover === p.id;
                const hoverIndex = products.findIndex((x) => x.id === hover);
                const after = hoverIndex >= 0 && i > hoverIndex;
                const isCur = cur?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={[
                      "slot",
                      on && "is-on",
                      after && "is-after",
                      !inFilter && "is-out",
                      view === "item" && !isCur && "is-dim",
                      isCur && "is-cur",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ "--d": Math.abs(i - Math.max(0, hoverIndex)), zIndex: on ? 50 : 20 - Math.abs(i - Math.max(0, hoverIndex)) } as CSSProperties}
                    tabIndex={inFilter && view === "rack" ? 0 : -1}
                    aria-label={`${p.name}, ${formatKES(p.price)}`}
                    onPointerEnter={(e) => e.pointerType === "mouse" && view === "rack" && setHover(p.id)}
                    onPointerMove={(e) => {
                      // Sheen follows the pointer over the pulled-out piece (CSS vars, no re-render).
                      if (!on || e.pointerType !== "mouse") return;
                      const g = slotRefs.current.get(p.id)?.getBoundingClientRect();
                      if (!g?.width) return;
                      e.currentTarget.style.setProperty("--sx", `${(((e.clientX - g.left) / g.width) * 100).toFixed(1)}%`);
                      e.currentTarget.style.setProperty("--sy", `${(((e.clientY - g.top) / g.height) * 100).toFixed(1)}%`);
                    }}
                    onFocus={(e) => view === "rack" && e.currentTarget.matches(":focus-visible") && setHover(p.id)}
                    onPointerDown={(e) => (lastPointer.current = e.pointerType)}
                    onClick={() => {
                      if (view !== "rack") return;
                      // Touch: first tap pulls the piece out, second tap opens it.
                      if (lastPointer.current !== "mouse" && lastPointer.current !== "" && hover !== p.id) {
                        setHover(p.id);
                        // Phones: also bring it to the centre (the centred piece is the pulled-out one).
                        if (window.matchMedia(NARROW).matches)
                          slotRefs.current
                            .get(p.id)
                            ?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
                      } else open(p.id);
                    }}
                  >
                    <span className="slot-shadow" aria-hidden="true" />
                    <div
                      className="slot-g"
                      ref={(el) => {
                        if (el) slotRefs.current.set(p.id, el);
                        else slotRefs.current.delete(p.id);
                      }}
                    >
                      <motion.div className="slot-swing" style={{ rotate: swingOf(p.id) }}>
                        <div className="slot-turn">
                          <Garment product={p} color={p.colors[colorIndex(p)]} sheen />
                          <span className="slot-tag" aria-hidden="true">
                            {formatKES(p.price)}
                          </span>
                        </div>
                      </motion.div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rack-caption" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={hovered?.id ?? "hint"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="caption-inner"
              >
                {hovered ? (
                  <>
                    <span className="caption-name">{hovered.name}</span>
                    <span className="caption-price mono">{formatKES(hovered.price)}</span>
                    <span className="caption-dots" aria-label={`${hovered.colors.length} colours`}>
                      {hovered.colors.map((c) => (
                        <i key={c.id} style={{ background: c.hex }} />
                      ))}
                    </span>
                  </>
                ) : (
                  <span className="muted">
                    <span className="only-hover">Hover a piece to pull it off the rack. Click to open it.</span>
                    <span className="only-touch">Tap a piece to pull it out. Tap again to open it.</span>
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="rack-cta">
            <button
              className="btn btn--outline"
              disabled={!hovered || !visible.includes(hovered)}
              onClick={() => hovered && open(hovered.id)}
            >
              See availability
            </button>
          </div>
        </section>

        {/* ───────── ITEM VIEW ───────── */}
        <AnimatePresence>
          {view === "item" && cur && (
            <ItemView
              key="item"
              visible={visible}
              idx={idx}
              side={side}
              setSide={setSide}
              colorIndex={colorIndex}
              setColor={(id, i) => setColorSel((m) => ({ ...m, [id]: i }))}
              size={sizeSel[cur.id] ?? null}
              setSize={(s) => setSizeSel((m) => ({ ...m, [cur.id]: s }))}
              go={go}
              close={requestClose}
              closing={closing}
              cardFlyRef={cardFlyRef}
              openFrom={openFrom}
            />
          )}
        </AnimatePresence>
      </main>

      <Ticker />
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── */

function useWidth() {
  const [w, setW] = useState(1200);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

function ItemView({
  visible,
  idx,
  side,
  setSide,
  colorIndex,
  setColor,
  size,
  setSize,
  go,
  close,
  closing,
  cardFlyRef,
  openFrom,
}: {
  visible: Product[];
  idx: number;
  side: Side;
  setSide: (s: Side) => void;
  colorIndex: (p: Product) => number;
  setColor: (id: string, i: number) => void;
  size: Size | null;
  setSize: (s: Size) => void;
  go: (d: number) => void;
  close: () => void;
  closing: boolean;
  cardFlyRef: React.MutableRefObject<HTMLDivElement | null>;
  openFrom: React.MutableRefObject<Rect | null>;
}) {
  const vw = useWidth();
  const [ready, setReady] = useState(!openFrom.current);
  const [invalid, setInvalid] = useState(false);
  const cur = visible[idx];
  const n = visible.length;
  const ci = colorIndex(cur);
  const color = cur.colors[ci];
  const cardW = vw < 640 ? Math.min(230, vw * 0.56) : 300;
  const off = vw < 640 ? vw * 0.5 : Math.min(360, vw * 0.3);

  // Opening flight: from the hanger on the rack to the centre.
  useLayoutEffect(() => {
    const el = cardFlyRef.current;
    if (el && openFrom.current) fly(el, openFrom.current);
    openFrom.current = null;
    const t = setTimeout(() => setReady(true), 420);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setInvalid(false), [idx, ci]);

  // Swipe on touch screens.
  const swipe = useRef<number | null>(null);
  const onDown = (e: RPointerEvent) => (swipe.current = e.clientX);
  const onUp = (e: RPointerEvent) => {
    if (swipe.current === null) return;
    const dx = e.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  };

  /** Validates (the size shake runs if no size) and returns the bag line; the button does the flight. */
  const prepareAdd = () => {
    if (!size || (color.stock[size] ?? 0) === 0) {
      setInvalid(true);
      return null;
    }
    return {
      line: {
        productId: cur.id,
        colorId: color.id,
        size,
        name: cur.name,
        colorName: color.name,
        hex: color.hex,
        price: cur.price,
      },
    };
  };

  return (
    <motion.section
      className={`item-view ${ready ? "is-ready" : ""}`}
      aria-label={cur.name}
      style={{ transformOrigin: "50% 30%" }}
      initial={{ opacity: 1 }}
      animate={{ scale: closing ? 0.94 : 1 }}
      transition={{ duration: 0.2, ease: EASE }}
      exit={{ opacity: 0, transition: { duration: 0.28 } }}
    >
      <button className="back-link" onClick={close}>
        ← Back to rack
      </button>
      <button className="close-x" onClick={close} aria-label="Close and go back to the rack">
        <span aria-hidden="true">×</span>
      </button>

      <div className="carousel" style={{ "--cw": `${cardW}px` } as CSSProperties} onPointerDown={onDown} onPointerUp={onUp}>
        {visible.map((p, i) => {
          let rel = (i - idx + n) % n;
          if (rel > n / 2) rel -= n; // -2 … +2
          if (n === 2 && rel !== 0) rel = 1;
          const isCur = rel === 0;
          const far = Math.abs(rel) > 1;
          return (
            <motion.div
              key={p.id}
              className={`card ${isCur ? "is-cur" : ""}`}
              style={{ zIndex: isCur ? 5 : far ? 1 : 3 }}
              initial={false}
              animate={{
                x: rel * off * (far ? 1.4 : 1),
                scale: isCur ? 1 : 0.72,
                opacity: isCur ? 1 : far || !ready ? 0 : 0.34,
                filter: isCur ? "blur(0px)" : "blur(5px)",
              }}
              transition={{ duration: 0.75, ease: EASE }}
              onClick={!isCur && !far ? () => go(rel) : undefined}
              aria-hidden={!isCur}
            >
              <div className="card-fly" ref={isCur ? cardFlyRef : undefined}>
                <Flipper side={isCur ? side : "front"}>
                  {(shown) => <ColorLayers product={p} colorIndex={colorIndex(p)} side={shown} />}
                </Flipper>
              </div>
              {isCur && p.colors.length > 1 && (
                <HangTags colors={p.colors} value={colorIndex(p)} onChange={(c) => setColor(p.id, c)} />
              )}
            </motion.div>
          );
        })}

        {n > 1 && (
          <>
            <button className="arrow arrow--prev" onClick={() => go(-1)} aria-label="Previous piece">
              ←
            </button>
            <button className="arrow arrow--next" onClick={() => go(1)} aria-label="Next piece">
              →
            </button>
          </>
        )}
      </div>

      <motion.div
        className="info"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: ready && !closing ? 1 : 0, y: ready ? 0 : 14 }}
        transition={{ duration: closing ? CLOSE_PREP_MS / 1000 : 0.45, ease: EASE }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={cur.id}
            className="info-head"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <h1 className="item-name">{cur.name}</h1>
            <span className="item-price mono">{formatKES(cur.price)}</span>
          </motion.div>
        </AnimatePresence>

        <div className="info-row">
          <div className="seg" role="group" aria-label="Side">
            {(["front", "back"] as const).map((s) => (
              <button key={s} aria-pressed={side === s} className={side === s ? "is-on" : ""} onClick={() => setSide(s)}>
                {s === "front" ? "Front" : "Back"}
              </button>
            ))}
          </div>
          <span className="color-name">
            <i style={{ background: color.hex }} />
            {color.name}
            {totalStock(color) === 0 && <em> · sold out</em>}
          </span>
        </div>

        <SizePicker sizes={sizesFor(cur)} color={color} value={size} onChange={(s) => { setSize(s); setInvalid(false); }} invalid={invalid} />

        <div className="ctas">
          <AddToBagButton prepare={prepareAdd} source={() => cardFlyRef.current} disabled={totalStock(color) === 0} />
          <Link className="btn btn--outline" href={`/p/${cur.id}?c=${color.id}`} prefetch>
            Full details
          </Link>
        </div>
        <p className="kbd-hint muted mono">← → browse · F flip · Esc rack</p>
      </motion.div>
    </motion.section>
  );
}
