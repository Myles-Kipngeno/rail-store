"use client";

import { useActionState, useEffect, useRef } from "react";
import { subscribe, type SubscribeState } from "@/app/actions";
import { useBag } from "../BagProvider";

/**
 * Footer sign-up. The `subscribe` server action validates, lowercases and stores the email (duplicates
 * are ignored silently; a honeypot field catches bots). Success shows the shared toast and clears the field.
 */
export function FooterNewsletter() {
  const [state, action, pending] = useActionState<SubscribeState, FormData>(subscribe, null);
  const bag = useBag();
  const form = useRef<HTMLFormElement>(null);
  const notify = bag.notify;
  useEffect(() => {
    if (!state?.ok) return;
    notify(state.message);
    form.current?.reset();
  }, [state, notify]);
  const error = state && !state.ok ? state.message : "";
  return (
    <form ref={form} action={action} className="news-form" noValidate>
      <label htmlFor="foot-email" className="sr-only">
        Email address
      </label>
      <input
        id="foot-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        aria-invalid={error ? true : undefined}
        aria-describedby="foot-news-msg"
      />
      {/* Honeypot for bots: hidden from people and screen readers. */}
      <input name="company" tabIndex={-1} autoComplete="off" className="news-hp" aria-hidden="true" />
      <button className="btn btn--primary" disabled={pending}>
        {pending ? "Signing up…" : "Sign up"}
      </button>
      <p id="foot-news-msg" className="news-msg is-error" role="alert">
        {error}
      </p>
    </form>
  );
}
