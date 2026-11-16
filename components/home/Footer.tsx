import Link from "next/link";
import { STORE } from "@/lib/config";

/** Store footer: name, links, delivery note, city. */
export function Footer() {
  const wa = STORE.whatsapp.replace(/\D/g, "");
  return (
    <footer className="foot">
      <div className="foot-brand">
        <Link href="/" className="logo">
          {STORE.name}
        </Link>
        <p className="muted">{STORE.description}</p>
      </div>
      <nav className="foot-links" aria-label="Footer">
        <Link href="/shop">Shop</Link>
        <a href="#delivery">Delivery</a>
        {wa ? (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
            Contact on WhatsApp
          </a>
        ) : null}
      </nav>
      <p className="foot-note muted" id="delivery">
        Delivery across Kenya · free in {STORE.city} over KES 5,000 · pay with M-Pesa or order on WhatsApp.
      </p>
      <p className="foot-city mono">
        {STORE.name} · {STORE.city}, Kenya · © {new Date().getFullYear()}
      </p>
    </footer>
  );
}
