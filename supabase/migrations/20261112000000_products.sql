-- RAIL store: product catalogue + product-images bucket.
-- Mirrors lib/types.ts exactly: Product -> Colorway (ordered) -> stock per size; prints per side (ordered).
-- Run with `supabase db push`, or paste into the Supabase SQL editor.
--
-- Access model
--   anon / authenticated : SELECT published products only (RLS). No writes.
--   service_role         : everything (bypasses RLS). Used only on the server (lib/db.ts, admin actions).

-- ---------------------------------------------------------------- enums (lib/types.ts)
create type public.garment_type as enum ('tee', 'long', 'shirt', 'hoodie', 'tank', 'jacket', 'jersey');
create type public.print_kind   as enum ('text', 'logo', 'drip', 'hands', 'distress', 'letter', 'number', 'badge');
create type public.size_code    as enum ('S', 'M', 'L', 'XL', 'XXL');
create type public.garment_side as enum ('front', 'back');

-- ---------------------------------------------------------------- tables
create table public.products (
  id          text primary key check (id ~ '^[a-z0-9-]{1,80}$'),
  name        text not null check (char_length(name) between 1 and 80),
  type        public.garment_type not null,
  category    text not null default 'Other' check (char_length(category) <= 30),
  price       integer not null check (price > 0),            -- whole KES
  description text not null default '' check (char_length(description) <= 1200),
  details     text[] not null default '{}' check (cardinality(details) <= 12),
  published   boolean not null default false,
  position    integer not null default 0,                    -- rack order (admin up/down)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.colorways (
  product_id  text not null references public.products (id) on delete cascade,
  id          text not null check (id ~ '^[a-z0-9-]{1,80}$'),
  position    integer not null,
  name        text not null check (char_length(name) between 1 and 80),
  hex         text not null check (hex ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$'),
  trim        text check (trim ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$'),
  sleeve      text check (sleeve ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$'),
  image_front text,
  image_back  text,
  primary key (product_id, id),
  unique (product_id, position)
);

create table public.colorway_stock (
  product_id  text not null,
  colorway_id text not null,
  size        public.size_code not null,
  qty         integer not null default 0 check (qty >= 0),
  primary key (product_id, colorway_id, size),
  foreign key (product_id, colorway_id) references public.colorways (product_id, id) on delete cascade
);

create table public.prints (
  product_id text not null references public.products (id) on delete cascade,
  side       public.garment_side not null,
  position   integer not null check (position between 0 and 3),
  kind       public.print_kind not null,
  text       text check (char_length(text) <= 40),
  num        text check (char_length(num) <= 3),
  primary key (product_id, side, position)
);

-- ---------------------------------------------------------------- indexes
create index products_rack_idx on public.products (position, created_at) where published;
create index products_position_idx on public.products (position, created_at);
-- colorways / stock / prints are reached through their primary keys (product_id leads each one).

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger products_touch before update on public.products
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- read model
-- One row per product, `doc` is exactly the Product JSON from lib/types.ts.
-- security_invoker: the view runs with the caller's rights, so RLS on the base tables applies.
create view public.product_documents with (security_invoker = true) as
select
  p.id,
  p.published,
  p.position,
  p.created_at,
  jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'type', p.type,
    'category', p.category,
    'price', p.price,
    'colors', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'hex', c.hex,
          'trim', c.trim,
          'sleeve', c.sleeve,
          'images', case when c.image_front is null and c.image_back is null then null
                         else jsonb_strip_nulls(jsonb_build_object('front', c.image_front, 'back', c.image_back)) end
        )) || jsonb_build_object('stock', coalesce((
          select jsonb_object_agg(s.size, s.qty order by s.size)
          from public.colorway_stock s
          where s.product_id = c.product_id and s.colorway_id = c.id
        ), '{}'::jsonb))
        order by c.position)
      from public.colorways c
      where c.product_id = p.id
    ), '[]'::jsonb),
    'print', jsonb_build_object(
      'front', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('k', pr.kind, 't', pr.text, 'n', pr.num)) order by pr.position)
        from public.prints pr where pr.product_id = p.id and pr.side = 'front'
      ), '[]'::jsonb),
      'back', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('k', pr.kind, 't', pr.text, 'n', pr.num)) order by pr.position)
        from public.prints pr where pr.product_id = p.id and pr.side = 'back'
      ), '[]'::jsonb)
    ),
    'description', p.description,
    'details', to_jsonb(p.details),
    'published', p.published,
    'createdAt', to_char(p.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ) as doc
from public.products p;

-- ---------------------------------------------------------------- write model (atomic, service_role only)
-- Takes a Product JSON (already validated by clean() in app/admin/actions.ts) and replaces it in one transaction.
create function public.upsert_product(doc jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  pid text := doc->>'id';
  c jsonb;
  ci integer := 0;
  pr jsonb;
  pi integer;
  sd public.garment_side;
begin
  insert into public.products (id, name, type, category, price, description, details, published, position, created_at)
  values (
    pid,
    doc->>'name',
    (doc->>'type')::public.garment_type,
    coalesce(doc->>'category', 'Other'),
    (doc->>'price')::integer,
    coalesce(doc->>'description', ''),
    coalesce(array(select jsonb_array_elements_text(doc->'details')), '{}'),
    coalesce((doc->>'published')::boolean, false),
    -- new pieces go to the end of the rack
    (select coalesce(max(position), -1) + 1 from public.products),
    coalesce((doc->>'createdAt')::timestamptz, now())
  )
  on conflict (id) do update set
    name        = excluded.name,
    type        = excluded.type,
    category    = excluded.category,
    price       = excluded.price,
    description = excluded.description,
    details     = excluded.details,
    published   = excluded.published;
  -- position and created_at are kept on update

  delete from public.colorways where product_id = pid;   -- cascades to colorway_stock
  delete from public.prints    where product_id = pid;

  for c in select * from jsonb_array_elements(coalesce(doc->'colors', '[]'::jsonb)) loop
    insert into public.colorways (product_id, id, position, name, hex, trim, sleeve, image_front, image_back)
    values (pid, c->>'id', ci, c->>'name', c->>'hex', c->>'trim', c->>'sleeve', c->'images'->>'front', c->'images'->>'back');

    insert into public.colorway_stock (product_id, colorway_id, size, qty)
    select pid, c->>'id', s.key::public.size_code, greatest(0, coalesce((s.value #>> '{}')::integer, 0))
    from jsonb_each(coalesce(c->'stock', '{}'::jsonb)) s;

    ci := ci + 1;
  end loop;

  foreach sd in array array['front', 'back']::public.garment_side[] loop
    pi := 0;
    for pr in select * from jsonb_array_elements(coalesce(doc->'print'->(sd::text), '[]'::jsonb)) loop
      insert into public.prints (product_id, side, position, kind, text, num)
      values (pid, sd, pi, (pr->>'k')::public.print_kind, pr->>'t', pr->>'n');
      pi := pi + 1;
    end loop;
  end loop;
end $$;

-- Rack order = order of ids. Unlisted products keep their relative order after the listed ones.
create function public.reorder_products(ids text[]) returns void
language sql set search_path = '' as $$
  with ranked as (
    select p.id,
           row_number() over (order by coalesce(array_position(ids, p.id), 1000000000), p.position, p.created_at) - 1 as rn
    from public.products p
  )
  update public.products p set position = r.rn
  from ranked r
  where r.id = p.id and p.position is distinct from r.rn;
$$;

revoke all on function public.upsert_product(jsonb) from public, anon, authenticated;
revoke all on function public.reorder_products(text[]) from public, anon, authenticated;
grant execute on function public.upsert_product(jsonb) to service_role;
grant execute on function public.reorder_products(text[]) to service_role;

-- ---------------------------------------------------------------- RLS
alter table public.products       enable row level security;
alter table public.colorways      enable row level security;
alter table public.colorway_stock enable row level security;
alter table public.prints         enable row level security;

create policy "Published products are public" on public.products
  for select to anon, authenticated using (published);

create policy "Colourways of published products are public" on public.colorways
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.published));

create policy "Stock of published products is public" on public.colorway_stock
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.published));

create policy "Prints of published products are public" on public.prints
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.published));

-- No insert/update/delete policies: only service_role (which bypasses RLS) can write.
revoke insert, update, delete, truncate on public.products, public.colorways, public.colorway_stock, public.prints from anon, authenticated;
grant select on public.product_documents to anon, authenticated, service_role;

-- ---------------------------------------------------------------- storage: product-images
-- Public bucket: photos are served straight from Supabase's CDN.
-- Uploads go through signed upload URLs minted by the admin server action (service_role), so no
-- insert policy is needed for anon. Size and type are enforced here as well as in the action.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 6291456, array['image/png', 'image/jpeg', 'image/webp', 'image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
