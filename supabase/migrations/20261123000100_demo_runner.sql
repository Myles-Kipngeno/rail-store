-- RAIL store: the demo Runner uses the new "runner" shape (no-op if the demo seed hasn't been applied).
update public.products set type = 'runner' where id = 'demo-runner' and type = 'sneaker';
