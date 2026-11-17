import Link from "next/link";
import { STORE } from "@/lib/config";
import { getProducts } from "@/lib/db";
import { usesPexels } from "@/lib/types";
import { FooterNewsletter } from "./FooterNewsletter";

/**
 * Site footer: Visit, Newsletter, Shop and Help columns, then a giant RAIL wordmark.
 * On the home page it follows `.page-main` and is revealed: it sits sticky at the bottom under the
 * page (globals.css `.page-main + .site-foot`), so scrolling to the end uncovers it. Elsewhere it is
 * a plain footer. While any published product shows a Pexels stock photo (the demo photos), it credits Pexels.
 */
export async function SiteFooter() {
  const wa = STORE.whatsapp.replace(/\D/g, "");
  const pexels = (await getProducts()).some(usesPexels);
  return (
    <footer className="site-foot">
      <div className="foot-cols">
        <section aria-labelledby="foot-visit">
          <h2 className="eyebrow" id="foot-visit">
            Visit
          </h2>
          <p className="foot-strong">{STORE.city}, Kenya</p>
          {STORE.hours.length ? (
            <ul className="foot-list">
              {STORE.hours.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Opening hours on WhatsApp.</p>
          )}
        </section>

        <section className="foot-news" aria-labelledby="foot-news-h">
          <h2 className="eyebrow" id="foot-news-h">
            Newsletter
          </h2>
          <p className="foot-strong">Get early access to new drops</p>
          <FooterNewsletter />
        </section>

        <nav aria-labelledby="foot-shop">
          <h2 className="eyebrow" id="foot-shop">
            Shop
          </h2>
          <ul className="foot-list">
            <li>
              <Link href="/#new-arrivals">New arrivals</Link>
            </li>
            <li>
              <Link href="/shop/bottoms">Bottoms</Link>
            </li>
            <li>
              <Link href="/shop/shoes">Shoes</Link>
            </li>
            <li>
              <Link href="/shop">All products</Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="foot-help">
          <h2 className="eyebrow" id="foot-help">
            Help
          </h2>
          <ul className="foot-list">
            {wa && (
              <li>
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                  Order on WhatsApp
                </a>
              </li>
            )}
            <li>
              <a href="#delivery">Delivery</a>
            </li>
          </ul>
        </nav>
      </div>

      <p className="foot-note muted" id="delivery">
        Delivery across Kenya · free in {STORE.city} over KES 5,000 · pay with M-Pesa or order on WhatsApp.
      </p>
      <p className="foot-mark" aria-hidden="true">
        <span>{STORE.name}</span>
      </p>
      <p className="foot-city mono">
        {STORE.name} · {STORE.city}, Kenya · © {new Date().getFullYear()}
        {pexels && (
          <>
            {" · "}
            <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">
              Demo photos via Pexels
            </a>
          </>
        )}
      </p>
    </footer>
  );
}
