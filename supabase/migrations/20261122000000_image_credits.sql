-- RAIL store: stock-photo credits on colourway photos (Colorway.images.credit in lib/types.ts).
-- { source: "pexels", photographer, url } for the front photo, set by scripts/demo-photos.ts. The admin keeps
-- a credit only while its photo stays the colour's front (saveProduct in app/admin/actions.ts).
-- Same view and write function as 20261116000000_departments.sql, plus image_credit.

alter table public.colorways
  add column image_credit jsonb check (
    image_credit is null or (
      jsonb_typeof(image_credit) = 'object'
      and image_credit->>'source' = 'pexels'
      and char_length(coalesce(image_credit->>'photographer', '')) between 1 and 120
      and coalesce(image_credit->>'url', '') ~ '^https://(www\.)?pexels\.com/'
    )
  );

-- ---------------------------------------------------------------- read model (+ images.credit)
create or replace view public.product_documents with (security_invoker = true) as
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
                         else jsonb_strip_nulls(jsonb_build_object(
                           'front', c.image_front,
                           'back', c.image_back,
                           'credit', case when c.image_front is not null then c.image_credit end
                         )) end
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


-- ---------------------------------------------------------------- write model (+ image_credit)
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
    insert into public.colorways (product_id, id, position, name, hex, trim, sleeve, image_front, image_back, image_credit)
    values (
      pid, c->>'id', ci, c->>'name', c->>'hex', c->>'trim', c->>'sleeve',
      c->'images'->>'front', c->'images'->>'back',
      case when jsonb_typeof(c->'images'->'credit') = 'object' then c->'images'->'credit' end
    );

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


revoke all on function public.upsert_product(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_product(jsonb) to service_role;
