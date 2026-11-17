-- RAIL store: "runner" drawn shoe shape (mesh upper, sculpted midsole, reflective heel; Shoe.tsx).
-- Its own file: a new enum value can't be used in the same transaction that adds it (see the next file).
alter type public.garment_type add value if not exists 'runner';
