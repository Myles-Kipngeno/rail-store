-- RAIL store: drawn bottoms and shoes. New garment_type values for Trousers.tsx and Shoe.tsx.
-- Mirrors GARMENT_TYPES / DRAWN_TYPES in lib/types.ts. Which department may use which type is checked by
-- clean() in app/admin/actions.ts (the only writer).
-- New enum values can't be used in the transaction that adds them, so the demo seed is a separate file
-- (20261120000100_demo_bottoms_shoes.sql).
alter type public.garment_type add value if not exists 'pants';
alter type public.garment_type add value if not exists 'cargo';
alter type public.garment_type add value if not exists 'joggers';
alter type public.garment_type add value if not exists 'shorts';
alter type public.garment_type add value if not exists 'sneaker';
alter type public.garment_type add value if not exists 'boot';
alter type public.garment_type add value if not exists 'slide';
