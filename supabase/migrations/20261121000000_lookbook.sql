-- RAIL store: "Off the rack" lookbook (home page, components/home/Lookbook.tsx).
-- Lifestyle photos (opaque WebP in the product-images bucket, uploaded by the admin), an optional link to a
-- product, a caption, rack-style ordering and a publish flag. Written only by the admin server actions
-- (app/admin/actions.ts → lib/db.ts) with the service role. The public can read published rows.

create table public.lookbook (
  id          uuid primary key default gen_random_uuid(),
  src         text not null check (char_length(src) between 1 and 500),
  product_id  text references public.products (id) on delete set null,
  caption     text not null default '' check (char_length(caption) <= 140),
  position    int not null default 0,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index lookbook_position_idx on public.lookbook (position, created_at);

alter table public.lookbook enable row level security;

create policy "Published lookbook photos are public" on public.lookbook
  for select to anon, authenticated using (published);

revoke all on public.lookbook from anon, authenticated;
grant select on public.lookbook to anon, authenticated;

-- Same shape as reorder_products: one transaction, ids not listed keep their relative order after the listed ones.
create function public.reorder_lookbook(ids uuid[]) returns void
language sql set search_path = '' as $$
  with ranked as (
    select l.id,
           row_number() over (order by coalesce(array_position(ids, l.id), 1000000000), l.position, l.created_at) - 1 as rn
    from public.lookbook l
  )
  update public.lookbook l set position = r.rn
  from ranked r
  where r.id = l.id and l.position is distinct from r.rn;
$$;

revoke all on function public.reorder_lookbook(uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_lookbook(uuid[]) to service_role;
