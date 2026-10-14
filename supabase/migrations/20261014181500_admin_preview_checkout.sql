alter table public.checkout_sessions
  add column if not exists is_preview boolean not null default false;

alter table public.orders
  add column if not exists is_preview boolean not null default false;

notify pgrst, 'reload schema';
