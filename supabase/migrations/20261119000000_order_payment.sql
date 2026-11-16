-- RAIL store: M-Pesa payment confirmation (part 2).
-- mark_order_paid() is called by the Daraja callback route and by the STK-query fallback in the
-- checkout status action (lib/mpesa.ts settleFromCallback / settleFromQuery). Service role only.

-- Why an order failed or needs review: Daraja's ResultDesc, or our own note (e.g. amount mismatch).
alter table public.orders add column result_desc text check (char_length(result_desc) <= 300);

-- Marks a PENDING order paid and takes its lines out of stock, in one transaction.
--   * Locks the order row, so the callback and the status fallback can't both decrement stock.
--   * Only acts on PENDING. Called again for an order already PAID / NEEDS_REVIEW with no receipt
--     yet (the fallback confirms without one), it just fills the receipt in: no stock change.
--   * If any line lacks stock, nothing is decremented and the order becomes NEEDS_REVIEW
--     (the customer has paid; a person sorts it out).
-- Returns { result: paid | needs_review | receipt_added | noop | not_found, product_ids: text[] }.
-- product_ids lists the products whose stock changed, for revalidatePath.
create function public.mark_order_paid(order_id uuid, receipt text, paid_at timestamptz)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  o public.orders%rowtype;
  short integer;
  ids text[];
begin
  select * into o from public.orders where id = order_id for update;
  if not found then
    return jsonb_build_object('result', 'not_found', 'product_ids', '[]'::jsonb);
  end if;

  if o.status <> 'PENDING' then
    if o.status in ('PAID', 'NEEDS_REVIEW') and o.mpesa_receipt is null and receipt is not null then
      update public.orders set mpesa_receipt = receipt where id = order_id;
      return jsonb_build_object('result', 'receipt_added', 'product_ids', '[]'::jsonb);
    end if;
    return jsonb_build_object('result', 'noop', 'product_ids', '[]'::jsonb);
  end if;

  -- Lock the stock rows this order needs, then check every line before touching any of them.
  perform 1
  from public.colorway_stock s
  join public.order_lines l
    on l.product_id = s.product_id and l.colorway_id = s.colorway_id and l.size = s.size
  where l.order_id = mark_order_paid.order_id
  for update of s;

  select count(*) into short
  from public.order_lines l
  left join public.colorway_stock s
    on s.product_id = l.product_id and s.colorway_id = l.colorway_id and s.size = l.size
  where l.order_id = mark_order_paid.order_id
    and coalesce(s.qty, 0) < l.qty;

  if short > 0 then
    update public.orders
    set status = 'NEEDS_REVIEW',
        mpesa_receipt = coalesce(receipt, mpesa_receipt),
        paid_at = mark_order_paid.paid_at,
        result_desc = 'Paid, but ' || short || ' line(s) no longer had enough stock. Nothing was taken out of stock.'
    where id = order_id;
    return jsonb_build_object('result', 'needs_review', 'product_ids', '[]'::jsonb);
  end if;

  update public.colorway_stock s
  set qty = s.qty - l.qty
  from public.order_lines l
  where l.order_id = mark_order_paid.order_id
    and s.product_id = l.product_id and s.colorway_id = l.colorway_id and s.size = l.size
    and s.qty >= l.qty;

  select array_agg(distinct l.product_id) into ids from public.order_lines l where l.order_id = mark_order_paid.order_id;

  update public.orders
  set status = 'PAID',
      mpesa_receipt = coalesce(receipt, mpesa_receipt),
      paid_at = mark_order_paid.paid_at
  where id = order_id;

  return jsonb_build_object('result', 'paid', 'product_ids', to_jsonb(coalesce(ids, '{}')));
end $$;

revoke all on function public.mark_order_paid(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.mark_order_paid(uuid, text, timestamptz) to service_role;
