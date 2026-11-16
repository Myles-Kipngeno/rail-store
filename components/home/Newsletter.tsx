"use client";

import { useActionState } from "react";
import { subscribe, type SubscribeState } from "@/app/actions";
import { Reveal } from "./Reveal";

/** Email sign-up. The server action validates and stores it (subscribers table via lib/db.ts). */
export function Newsletter() {
  const [state, action, pending] = useActionState<SubscribeState, FormData>(subscribe, null);
  return (
    <section className="home-section news" aria-labelledby="news-h">
      <Reveal className="news-inner">
        <h2 className="home-h" id="news-h">
          First on the rail
        </h2>
        <p className="muted">New drops and restocks before anyone else. No spam.</p>
        {state?.ok ? (
          <p className="news-msg is-ok" role="status">
            {state.message}
          </p>
        ) : (
          <form action={action} className="news-form" noValidate>
            <label htmlFor="news-email" className="sr-only">
              Email address
            </label>
            <input
              id="news-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              aria-invalid={state ? !state.ok : undefined}
              aria-describedby="news-msg"
            />
            {/* Honeypot for bots: hidden from people and screen readers. */}
            <input name="company" tabIndex={-1} autoComplete="off" className="news-hp" aria-hidden="true" />
            <button className="btn btn--primary" disabled={pending}>
              {pending ? "Signing up…" : "Sign up"}
            </button>
          </form>
        )}
        <p id="news-msg" className="news-msg is-error" role="alert">
          {state && !state.ok ? state.message : ""}
        </p>
      </Reveal>
    </section>
  );
}
