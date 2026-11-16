-- RAIL store: newsletter subscribers (home page sign-up).
-- Written only by the `subscribe` server action (app/actions.ts → lib/db.ts addSubscriber) with the
-- service role. No public access at all: anon/authenticated can neither read nor write the list.

create table public.subscribers (
  email      text primary key check (
    char_length(email) between 6 and 254
    and email = lower(email)
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
  ),
  source     text not null default 'home' check (char_length(source) <= 30),
  created_at timestamptz not null default now()
);

alter table public.subscribers enable row level security;
-- No policies: only service_role (which bypasses RLS) can touch it.
revoke all on public.subscribers from anon, authenticated;
