-- RAIL store: orders paid with M-Pesa (Daraja STK Push).
-- Written only by server actions with the service role (app/checkout/actions.ts → lib/db.ts).
-- No public access at all: anon/authenticated can neither read nor write orders.
--
-- Lifecycle: PENDING (STK push sent) → PAID (callback or STK query says paid) | FAILED (cancelled,
-- timed out, wrong PIN, push refused). NEEDS_REVIEW = paid but something doesn't add up (e.g. the
-- amount), for a person to sort out. The callback route that sets PAID + mpesa_receipt is part 2.

create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  status              text not null default 'PENDING'
                      check (status in ('PENDING', 'PAID', 'FAILED', 'NEEDS_REVIEW')),
  name                text not null check (char_length(name) between 1 and 80),
  phone               text not null check (phone ~ '^254[17][0-9]{8}$'),  -- 2547XXXXXXXX / 2541XXXXXXXX
  town                text not null check (char_length(town) between 1 and 60),
  note                text not null default '' check (char_length(note) <= 300),
  total_kes           integer not null check (total_kes > 0),              -- whole KES, priced from products
  checkout_request_id text unique,                                         -- Daraja CheckoutRequestID
  mpesa_receipt       text unique,                                         -- e.g. QK12ABC3DE (set by the callback)
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);

-- One row per product + colourway + size. product_id/colorway_id are the same keys as
-- public.colorways (product_id, id), kept without a foreign key so order history survives a
-- product being deleted. unit_price_kes is products.price at the time of the order.
create table public.order_lines (
  order_id       uuid not null references public.orders (id) on delete cascade,
  product_id     text not null check (product_id ~ '^[a-z0-9-]{1,80}$'),
  colorway_id    text not null check (colorway_id ~ '^[a-z0-9-]{1,80}$'),
  size           text not null check (char_length(size) between 1 and 4),
  qty            integer not null check (qty between 1 and 10),
  unit_price_kes integer not null check (unit_price_kes > 0),
  primary key (order_id, product_id, colorway_id, size)
);

create index orders_pending_idx on public.orders (created_at) where status = 'PENDING';

-- Order + lines in one transaction. Input is already validated and priced by the server action.
-- o: { name, phone, town, note, total_kes }   lines: [{ product_id, colorway_id, size, qty, unit_price_kes }]
create function public.create_order(o jsonb, lines jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  oid uuid;
begin
  if jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) = 0 then
    raise exception 'create_order: an order needs at least one line';
  end if;

  insert into public.orders (name, phone, town, note, total_kes)
  values (o->>'name', o->>'phone', o->>'town', coalesce(o->>'note', ''), (o->>'total_kes')::integer)
  returning id into oid;

  insert into public.order_lines (order_id, product_id, colorway_id, size, qty, unit_price_kes)
  select oid, l->>'product_id', l->>'colorway_id', l->>'size', (l->>'qty')::integer, (l->>'unit_price_kes')::integer
  from jsonb_array_elements(lines) l;

  if (select sum(qty * unit_price_kes) from public.order_lines where order_id = oid) <> (o->>'total_kes')::integer then
    raise exception 'create_order: total does not match the lines';
  end if;

  return oid;
end $$;

revoke all on function public.create_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb) to service_role;

alter table public.orders      enable row level security;
alter table public.order_lines enable row level security;
-- No policies: only service_role (which bypasses RLS) can touch them.
revoke all on public.orders, public.order_lines from anon, authenticated;
