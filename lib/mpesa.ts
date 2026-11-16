/**
 * M-Pesa Daraja client: OAuth token, STK Push (Lipa na M-Pesa Online) and STK Push Query.
 * Server-only: the consumer secret and passkey never leave the server.
 *
 * Env (see .env.example): MPESA_ENV (sandbox | production), MPESA_CONSUMER_KEY,
 * MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_TYPE (paybill | till),
 * MPESA_PARTY_B, MPESA_CALLBACK_SECRET, NEXT_PUBLIC_SITE_URL.
 */
import "server-only";
import { revalidatePath } from "next/cache";
import { failPendingOrder, flagOrderForReview, markOrderPaid, type OrderRow } from "./db";

const env = (v: string | undefined) => v?.trim().replace(/^(["'])(.*)\1$/, "$2").trim() || undefined;

function config() {
  const cfg = {
    base: env(process.env.MPESA_ENV) === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
    consumerKey: env(process.env.MPESA_CONSUMER_KEY),
    consumerSecret: env(process.env.MPESA_CONSUMER_SECRET),
    shortcode: env(process.env.MPESA_SHORTCODE),
    passkey: env(process.env.MPESA_PASSKEY),
    type: env(process.env.MPESA_TYPE) === "till" ? ("till" as const) : ("paybill" as const),
    partyB: env(process.env.MPESA_PARTY_B),
    callbackSecret: env(process.env.MPESA_CALLBACK_SECRET),
    siteUrl: env(process.env.NEXT_PUBLIC_SITE_URL)?.replace(/\/+$/, ""),
  };
  const missing = (
    [
      ["MPESA_CONSUMER_KEY", cfg.consumerKey],
      ["MPESA_CONSUMER_SECRET", cfg.consumerSecret],
      ["MPESA_SHORTCODE", cfg.shortcode],
      ["MPESA_PASSKEY", cfg.passkey],
      ["MPESA_PARTY_B", cfg.partyB],
      ["MPESA_CALLBACK_SECRET", cfg.callbackSecret],
      ["NEXT_PUBLIC_SITE_URL", cfg.siteUrl],
    ] as const
  )
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) throw new MpesaError(`M-Pesa is not configured: missing ${missing.join(", ")}.`);
  return cfg as typeof cfg & { [K in "consumerKey" | "consumerSecret" | "shortcode" | "passkey" | "partyB" | "callbackSecret" | "siteUrl"]: string };
}

/** True when every M-Pesa env var is set. */
export function mpesaConfigured() {
  try {
    config();
    return true;
  } catch {
    return false;
  }
}

export class MpesaError extends Error {}

// ---------------------------------------------------------------- phone numbers
/**
 * Normalises a Kenyan mobile number to 2547XXXXXXXX / 2541XXXXXXXX.
 * Accepts 07…/01…, +2547…/+2541… and 2547…/2541… (spaces, dashes and brackets ignored).
 * Returns null for anything else.
 */
export function normalizePhone(input: string): string | null {
  const s = String(input ?? "").replace(/[\s\-().]/g, "");
  const m = /^(?:\+?254|0)([17]\d{8})$/.exec(s);
  return m ? `254${m[1]}` : null;
}

// ---------------------------------------------------------------- helpers
/** yyyyMMddHHmmss in Africa/Nairobi, as Daraja expects. */
export function timestamp(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

/** base64(shortcode + passkey + timestamp) */
export const password = (shortcode: string, passkey: string, ts: string) =>
  Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");

type DarajaError = { errorCode?: string; errorMessage?: string; requestId?: string };

async function call<T>(path: string, init: RequestInit, what: string): Promise<{ status: number; body: T & DarajaError }> {
  const { base } = config();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(20000) });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    throw new MpesaError(timedOut ? `M-Pesa didn't answer in time (${what}).` : `Couldn't reach M-Pesa (${what}).`);
  }
  const text = await res.text();
  let body: T & DarajaError;
  try {
    body = JSON.parse(text);
  } catch {
    throw new MpesaError(`M-Pesa sent an unexpected reply (${what}, HTTP ${res.status}).`);
  }
  return { status: res.status, body };
}

// ---------------------------------------------------------------- OAuth
let token: { value: string; expires: number } | undefined;

/** OAuth access token, cached until a minute before it expires (Daraja tokens last ~1 hour). */
export async function getToken(): Promise<string> {
  if (token && Date.now() < token.expires) return token.value;
  const { consumerKey, consumerSecret } = config();
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const { status, body } = await call<{ access_token?: string; expires_in?: string | number }>(
    "/oauth/v1/generate?grant_type=client_credentials",
    { method: "GET", headers: { Authorization: `Basic ${auth}` } },
    "token",
  );
  if (status !== 200 || !body.access_token)
    throw new MpesaError(`M-Pesa login failed: ${body.errorMessage ?? `HTTP ${status}`}. Check the consumer key and secret.`);
  const ttl = Math.max(60, Number(body.expires_in) || 3599);
  token = { value: body.access_token, expires: Date.now() + (ttl - 60) * 1000 };
  return token.value;
}

async function authed<T>(path: string, payload: unknown, what: string) {
  const t = await getToken();
  const res = await call<T>(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, what);
  // A token revoked early: drop it so the next call logs in again.
  if (res.status === 401) token = undefined;
  return res;
}

// ---------------------------------------------------------------- STK Push
export interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  customerMessage: string;
}

/** Sends the payment prompt to the customer's phone. amount is whole KES; phone is 2547…/2541…. */
export async function stkPush({ phone, amount }: { phone: string; amount: number }): Promise<StkPushResult> {
  const cfg = config();
  const ts = timestamp();
  const { status, body } = await authed<{
    MerchantRequestID?: string;
    CheckoutRequestID?: string;
    ResponseCode?: string;
    ResponseDescription?: string;
    CustomerMessage?: string;
  }>(
    "/mpesa/stkpush/v1/processrequest",
    {
      BusinessShortCode: cfg.shortcode,
      Password: password(cfg.shortcode, cfg.passkey, ts),
      Timestamp: ts,
      TransactionType: cfg.type === "till" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: cfg.partyB,
      PhoneNumber: phone,
      CallBackURL: `${cfg.siteUrl}/api/mpesa/callback/${cfg.callbackSecret}`,
      AccountReference: "RAIL",
      TransactionDesc: "RAIL order", // Daraja allows at most 13 characters
    },
    "payment request",
  );
  if (status !== 200 || body.ResponseCode !== "0" || !body.CheckoutRequestID)
    throw new MpesaError(
      `M-Pesa refused the payment request: ${body.errorMessage ?? body.ResponseDescription ?? `HTTP ${status}`}.`,
    );
  return {
    merchantRequestId: body.MerchantRequestID ?? "",
    checkoutRequestId: body.CheckoutRequestID,
    customerMessage: body.CustomerMessage ?? "",
  };
}

// ---------------------------------------------------------------- STK Push Query
export type StkQueryResult =
  | { state: "pending" }
  | { state: "paid"; resultDesc: string }
  | { state: "failed"; resultCode: string; resultDesc: string };

/**
 * Asks Daraja how a prompt ended. While the customer hasn't answered, Daraja replies with error
 * 500.001.1001 ("The transaction is being processed"): that is reported as pending.
 */
export async function stkQuery(checkoutRequestId: string): Promise<StkQueryResult> {
  const cfg = config();
  const ts = timestamp();
  const { status, body } = await authed<{ ResponseCode?: string; ResultCode?: string | number; ResultDesc?: string }>(
    "/mpesa/stkpushquery/v1/query",
    {
      BusinessShortCode: cfg.shortcode,
      Password: password(cfg.shortcode, cfg.passkey, ts),
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    },
    "payment status",
  );
  if (body.ResultCode === undefined || body.ResultCode === null) {
    if (body.errorCode === "500.001.1001" || status === 500 || status === 429) return { state: "pending" };
    throw new MpesaError(`M-Pesa status check failed: ${body.errorMessage ?? `HTTP ${status}`}.`);
  }
  const code = String(body.ResultCode);
  if (code === "4999") return { state: "pending" }; // "The transaction is still under processing"
  const desc = body.ResultDesc ?? "";
  return code === "0" ? { state: "paid", resultDesc: desc } : { state: "failed", resultCode: code, resultDesc: desc };
}

// ---------------------------------------------------------------- callback + settling orders
export interface StkCallback {
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  amount?: number;
  receipt?: string;
  paidAt?: Date;
}

/** Daraja's TransactionDate (yyyyMMddHHmmss, Nairobi time, sent as a number) → Date. */
export function nairobiDate(v: unknown): Date | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(v ?? ""));
  if (!m) return undefined;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+03:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Reads Body.stkCallback from a Daraja STK callback. Returns null when it isn't one. */
export function parseStkCallback(json: unknown): StkCallback | null {
  const cb = (json as { Body?: { stkCallback?: Record<string, unknown> } } | null)?.Body?.stkCallback;
  if (!cb || typeof cb.CheckoutRequestID !== "string" || !cb.CheckoutRequestID) return null;
  const resultCode = Number(cb.ResultCode);
  if (!Number.isInteger(resultCode)) return null;
  const items = (cb.CallbackMetadata as { Item?: { Name?: string; Value?: unknown }[] } | undefined)?.Item ?? [];
  const item = (name: string) => items.find((i) => i?.Name === name)?.Value;
  const amount = Number(item("Amount"));
  const receipt = item("MpesaReceiptNumber");
  return {
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode,
    resultDesc: String(cb.ResultDesc ?? "").slice(0, 300),
    ...(Number.isFinite(amount) && item("Amount") !== undefined ? { amount } : {}),
    ...(typeof receipt === "string" && /^[A-Z0-9]{6,20}$/.test(receipt) ? { receipt } : {}),
    ...(nairobiDate(item("TransactionDate")) ? { paidAt: nairobiDate(item("TransactionDate")) } : {}),
  };
}

export type Outcome =
  | { paid: true; amount?: number; receipt: string | null; paidAt: Date }
  | { paid: false; resultDesc: string };

/**
 * Applies a payment outcome (from the callback or the STK-query fallback) to an order. Idempotent:
 * a replay, or a second source reporting the same outcome, changes nothing.
 *  - failed  → PENDING becomes FAILED (with ResultDesc); anything else is left alone.
 *  - paid    → amount must equal total_kes (when known), then mark_order_paid() takes the stock
 *              out in one transaction (or sets NEEDS_REVIEW if stock ran out). A payment for an
 *              order already marked FAILED, or with the wrong amount, becomes NEEDS_REVIEW.
 * Revalidates the store pages when stock changed.
 */
export async function settleOrder(order: OrderRow, outcome: Outcome): Promise<void> {
  if (!outcome.paid) {
    if (order.status === "PENDING") await failPendingOrder(order.id, outcome.resultDesc || "Payment failed.");
    return;
  }
  if (outcome.amount !== undefined && outcome.amount !== order.total_kes) {
    await flagOrderForReview(order.id, outcome.receipt, `Paid KES ${outcome.amount}, but the order total is KES ${order.total_kes}.`);
    return;
  }
  if (order.status === "FAILED") {
    await flagOrderForReview(order.id, outcome.receipt, `Paid after the order was marked failed (${order.result_desc ?? "no reason"}).`);
    return;
  }
  const res = await markOrderPaid(order.id, outcome.receipt, outcome.paidAt);
  if (res.result === "paid" && res.product_ids.length) {
    revalidatePath("/");
    revalidatePath("/shop/[department]", "page");
    for (const id of res.product_ids) revalidatePath(`/p/${id}`);
  }
}
