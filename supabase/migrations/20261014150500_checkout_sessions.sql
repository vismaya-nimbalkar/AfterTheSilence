create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  razorpay_order_id text not null unique,
  customer_email text not null,
  shipping_address jsonb not null,
  items jsonb not null,
  subtotal_amount numeric(12, 2) not null,
  discount_amount numeric(12, 2) not null default 0,
  promo_code text,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  order_id uuid references public.orders(id),
  created_at timestamptz not null default now()
);

alter table public.checkout_sessions enable row level security;
revoke all on public.checkout_sessions from public, anon, authenticated;
grant all on public.checkout_sessions to service_role;

notify pgrst, 'reload schema';
