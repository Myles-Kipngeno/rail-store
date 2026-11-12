"use client";

import { useEffect, useRef, useState } from "react";
import { frameGarment, removeBackground, type RemovalProgress } from "@/lib/cutout";

const PREF_KEY = "rail-admin-remove-bg";

function readPref() {
  try {
    return localStorage.getItem(PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

type Stage = { kind: "idle" } | { kind: "working"; progress?: RemovalProgress } | { kind: "preview"; blob: Blob; url: string };

/**
 * Take photo / Choose file → (optional background removal) → framed preview on a checkerboard →
 * "Use photo" hands the processed file to `onUse` (the admin's upload), "Retake" discards it.
 */
export default function PhotoCapture({ onUse, disabled }: { onUse: (file: File) => void; disabled?: boolean }) {
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [error, setError] = useState<string>();
  const [cutout, setCutout] = useState(true);
  const run = useRef(0);

  useEffect(() => setCutout(readPref()), []);
  useEffect(() => () => void (stage.kind === "preview" && URL.revokeObjectURL(stage.url)), [stage]);

  const toggleCutout = (on: boolean) => {
    setCutout(on);
    try {
      localStorage.setItem(PREF_KEY, on ? "1" : "0");
    } catch {
      /* private mode: preference just isn't remembered */
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const id = ++run.current;
    setError(undefined);
    setStage({ kind: "working" });
    let source: Blob = file;
    if (cutout) {
      try {
        source = await removeBackground(file, (progress) => {
          if (run.current === id) setStage({ kind: "working", progress });
        });
      } catch (err) {
        if (run.current !== id) return;
        setError(`Background removal failed (${err instanceof Error ? err.message : "unknown error"}). Using the original photo.`);
        source = file;
      }
    }
    try {
      const blob = await frameGarment(source);
      if (run.current !== id) return;
      setStage({ kind: "preview", blob, url: URL.createObjectURL(blob) });
    } catch {
      if (run.current !== id) return;
      setError("Couldn't read that photo. Try a JPG, PNG or WebP.");
      setStage({ kind: "idle" });
    }
  };

  const reset = () => {
    run.current++;
    setError(undefined);
    setStage({ kind: "idle" });
  };

  const use = () => {
    if (stage.kind !== "preview") return;
    const type = stage.blob.type || "image/webp"; // Safari may encode PNG instead of WebP
    onUse(new File([stage.blob], `photo.${type === "image/png" ? "png" : "webp"}`, { type }));
    reset();
  };

  const p = stage.kind === "working" ? stage.progress : undefined;
  const pct = p && p.total > 0 ? Math.min(100, Math.round((p.current / p.total) * 100)) : undefined;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={picker}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {stage.kind === "idle" && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button type="button" className="btn btn--outline btn--sm" disabled={disabled} onClick={() => camera.current?.click()}>
              Take photo
            </button>
            <button type="button" className="btn btn--ghost btn--sm" disabled={disabled} onClick={() => picker.current?.click()}>
              Choose file
            </button>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={cutout} onChange={(e) => toggleCutout(e.target.checked)} />
            Remove background
          </label>
        </>
      )}

      {stage.kind === "working" && (
        <div role="status" style={{ display: "grid", gap: 6, fontSize: 12 }}>
          <span>{cutout ? "Cutting out… (first time downloads the model, ~40 MB)" : "Framing photo…"}</span>
          {cutout && (
            <progress max={100} value={pct} style={{ width: "100%", height: 6, accentColor: "var(--ink)" }}>
              {pct ?? 0}%
            </progress>
          )}
        </div>
      )}

      {stage.kind === "preview" && (
        <div style={{ display: "grid", gap: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stage.url}
            alt="Processed photo preview"
            style={{
              width: "100%",
              maxWidth: 200,
              aspectRatio: "200 / 260",
              objectFit: "contain",
              borderRadius: 4,
              border: "1px solid var(--line)",
              background: "repeating-conic-gradient(#dfe2dc 0% 25%, #f7f8f6 0% 50%) 0 0 / 16px 16px",
            }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button type="button" className="btn btn--primary btn--sm" disabled={disabled} onClick={use}>
              Use photo
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
              Retake
            </button>
          </div>
        </div>
      )}

      {error && (
        <span role="alert" style={{ fontSize: 12, color: "#b3261e" }}>
          {error}
        </span>
      )}
    </div>
  );
}
