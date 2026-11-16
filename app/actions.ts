"use server";

import { addSubscriber } from "@/lib/db";

export type SubscribeState = { ok: boolean; message: string } | null;

// Same shape the subscribers table checks: something@domain.tld, no spaces, max 254 chars.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Home page newsletter form (components/home/Newsletter.tsx). */
export async function subscribe(_prev: SubscribeState, form: FormData): Promise<SubscribeState> {
  // Honeypot: a field people can't see. Bots fill it; pretend it worked.
  if (String(form.get("company") ?? "")) return { ok: true, message: "You're on the list." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return { ok: false, message: "Enter a valid email address." };
  try {
    await addSubscriber(email);
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Couldn't sign you up just now. Try again in a minute." };
  }
  return { ok: true, message: "You're on the list. New drops land in your inbox first." };
}
