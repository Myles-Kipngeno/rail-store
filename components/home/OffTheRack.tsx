import { readdir } from "node:fs/promises";
import path from "node:path";
import { STORE } from "@/lib/config";
import { Reveal } from "./Reveal";
import { imgProps } from "./shot";

/**
 * "Off the rack": customer photos, tilted ±2deg, from public/off-the-rack/*.jpg (drop files in and
 * redeploy). Renders nothing when the folder is empty or missing. Server component (reads the folder).
 */
export async function OffTheRack() {
  const dir = path.join(process.cwd(), "public", "off-the-rack");
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => /\.jpe?g$/i.test(f)).sort();
  if (!files.length) return null;
  return (
    <section className="home-section off" aria-labelledby="off-h">
      <Reveal>
        <div className="row-head">
          <h2 className="home-h" id="off-h">
            Off the rack
          </h2>
          <p className="muted off-sub">Worn by you. Tag {STORE.name} to end up here.</p>
        </div>
        <ul className="off-strip">
          {files.map((f, i) => (
            <li key={f} className="off-photo" style={{ rotate: `${i % 2 ? 2 : -2}deg` }}>
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img
                {...imgProps(`/off-the-rack/${encodeURIComponent(f)}`, `A customer wearing ${STORE.name}`, "(max-width: 640px) 60vw, 260px")}
                className="off-img"
              />
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
