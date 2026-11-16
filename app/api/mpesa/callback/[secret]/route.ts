/**
 * Daraja STK Push callback: ${NEXT_PUBLIC_SITE_URL}/api/mpesa/callback/${MPESA_CALLBACK_SECRET}.
 * The secret in the path is the only thing that proves a request came from our STK push, so
 * anything else gets a plain 404. Settling is idempotent (settleOrder / mark_order_paid), so
 * Safaricom retries and replays change nothing.
 */
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getOrderByCheckoutRequest } from "@/lib/db";
import { parseStkCallback, settleOrder } from "@/lib/mpesa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCEPTED = { ResultCode: 0, ResultDesc: "Accepted" };

function secretMatches(given: string) {
  const expected = process.env.MPESA_CALLBACK_SECRET?.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const notFound = () => new NextResponse("Not found", { status: 404 });

export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  if (!secretMatches((await params).secret)) return notFound();

  const cb = parseStkCallback(await req.json().catch(() => null));
  // Not an STK callback, or not one of ours: nothing to retry, so accept it and move on.
  if (!cb) return NextResponse.json(ACCEPTED);

  try {
    const order = await getOrderByCheckoutRequest(cb.checkoutRequestId);
    if (!order) return NextResponse.json(ACCEPTED);
    await settleOrder(
      order,
      cb.resultCode === 0
        ? { paid: true, amount: cb.amount, receipt: cb.receipt ?? null, paidAt: cb.paidAt ?? new Date() }
        : { paid: false, resultDesc: cb.resultDesc || `M-Pesa result ${cb.resultCode}` },
    );
  } catch (e) {
    // Our side failed (e.g. the database): answer 500 so Safaricom sends the callback again.
    console.error("[mpesa callback]", cb.checkoutRequestId, e);
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Try again" }, { status: 500 });
  }
  return NextResponse.json(ACCEPTED);
}

export const GET = notFound;
