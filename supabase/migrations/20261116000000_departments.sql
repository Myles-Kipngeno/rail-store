-- RAIL store: departments, fixed categories, and a size system per department.
-- Mirrors lib/types.ts (DEPARTMENTS, CATEGORIES, sizesFor). Run after 20261112000000_products.sql.
--
--   products.department  tops | bottoms | formal | shoes | accessories
--   products.category    one of that department's categories (replaces the free-text category)
--   colorway_stock.size  text: S M L XL XXL | waist 28..40 | EU 38..46 | ONE
--
-- Existing products are mapped from their garment type:
--   tee, jersey, tank, long -> tops/tees   shirt -> tops/shirts   hoodie -> tops/hoodies   jacket -> tops/jackets
--
-- Which sizes a product may stock, and the "non-tops need a front photo to publish" rule, are enforced
-- by clean() in app/admin/actions.ts (the only writer). The checks here keep the values well-formed.

-- The read-model view depends on products.category and colorway_stock.size: drop it, change, recreate.
drop view public.product_documents;

-- ---------------------------------------------------------------- department + category
alter table public.products add column department text;

update public.products set
  department = 'tops',
  category = case type
    when 'shirt'  then 'shirts'
    when 'hoodie' then 'hoodies'
    when 'jacket' then 'jackets'
    else 'tees'                    -- tee, jersey, tank, long
  end;

alter table public.products
  alter column department set not null,
  alter column category drop default,
  drop constraint if exists products_category_check,
  add constraint products_department_category_check check ((department, category) in (
    ('tops', 'tees'), ('tops', 'shirts'), ('tops', 'polos'), ('tops', 'hoodies'), ('tops', 'sweaters'), ('tops', 'jackets'),
    ('bottoms', 'jeans'), ('bottoms', 'sweatpants'), ('bottoms', 'cargo'), ('bottoms', 'shorts'), ('bottoms', 'trousers'),
    ('formal', 'suits'), ('formal', 'blazers'), ('formal', 'dress-shirts'), ('formal', 'dress-trousers'),
    ('shoes', 'sneakers'), ('shoes', 'boots'), ('shoes', 'formal-shoes'), ('shoes', 'slides'),
    ('accessories', 'caps'), ('accessories', 'bags'), ('accessories', 'belts'), ('accessories', 'socks')
  ));

-- ---------------------------------------------------------------- sizes
alter table public.colorway_stock
  alter column size type text using size::text,
  add constraint colorway_stock_size_check check (size in (
    'S', 'M', 'L', 'XL', 'XXL',
    '28', '30', '32', '34', '36', '38', '40',
    '39', '41', '42', '43', '44', '45', '46',
    'ONE'
  ));

drop type public.size_code;

-- ---------------------------------------------------------------- read model (same as before + department)
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
    'department', p.department,
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
          select jsonb_object_agg(s.size, s.qty)
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

grant select on public.product_documents to anon, authenticated, service_role;

-- ---------------------------------------------------------------- write model (same as before + department, text sizes)
create or replace function public.upsert_product(doc jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  pid text := doc->>'id';
  c jsonb;
  ci integer := 0;
  pr jsonb;
  pi integer;
  sd public.garment_side;
begin
  insert into public.products (id, name, type, department, category, price, description, details, published, position, created_at)
  values (
    pid,
    doc->>'name',
    (doc->>'type')::public.garment_type,
    doc->>'department',
    doc->>'category',
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
    department  = excluded.department,
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
    select pid, c->>'id', s.key, greatest(0, coalesce((s.value #>> '{}')::integer, 0))
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

-- create or replace keeps the existing grants; restated so this file reads on its own.
revoke all on function public.upsert_product(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_product(jsonb) to service_role;
