alter table public.site_settings
  add column if not exists shop_enabled boolean not null default true;

alter table public.orders
  add column if not exists subtotal_amount numeric(12, 2),
  add column if not exists discount_amount numeric(12, 2) not null default 0,
  add column if not exists promo_code text,
  add column if not exists refunded_amount numeric(12, 2) not null default 0,
  add column if not exists refund_status text;

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

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12, 2) not null check (discount_value > 0),
  max_discount_amount numeric(12, 2),
  minimum_order_amount numeric(12, 2) not null default 0,
  max_uses integer check (max_uses is null or max_uses > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint promo_codes_percent_range check (discount_type != 'percent' or discount_value <= 100),
  constraint promo_codes_valid_dates check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id),
  code text not null,
  checkout_session_id uuid not null unique,
  razorpay_order_id text unique,
  order_id uuid references public.orders(id),
  subtotal_amount numeric(12, 2) not null,
  discount_amount numeric(12, 2) not null,
  status text not null default 'reserved' check (status in ('reserved', 'redeemed', 'released')),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  created_at timestamptz not null default now()
);

create index if not exists promo_redemptions_capacity_idx
  on public.promo_redemptions (promo_code_id, status, expires_at);

create table if not exists public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  razorpay_payment_id text not null,
  razorpay_refund_id text unique,
  amount numeric(12, 2) not null check (amount > 0),
  status text not null check (status in ('pending', 'processed', 'failed', 'unknown')),
  request_key uuid not null unique,
  admin_user_id uuid,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_refunds_order_id_idx on public.order_refunds (order_id);

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.order_refunds enable row level security;
alter table public.checkout_sessions enable row level security;
revoke all on public.promo_codes, public.promo_redemptions, public.order_refunds, public.checkout_sessions from public, anon, authenticated;
grant all on public.promo_codes, public.promo_redemptions, public.order_refunds, public.checkout_sessions to service_role;

create or replace function public.reserve_promo_redemption(
  p_code text,
  p_checkout_session_id uuid,
  p_subtotal_amount numeric
)
returns table (redemption_id uuid, normalized_code text, discount_amount numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  promo public.promo_codes%rowtype;
  use_count integer;
  discount numeric(12, 2);
begin
  select * into promo
  from public.promo_codes
  where code = upper(trim(p_code))
  for update;

  if not found or not promo.is_active then
    raise exception 'This promo code is not available.';
  end if;
  if promo.starts_at is not null and promo.starts_at > now() then
    raise exception 'This promo code is not active yet.';
  end if;
  if promo.expires_at is not null and promo.expires_at <= now() then
    raise exception 'This promo code has expired.';
  end if;
  if p_subtotal_amount < promo.minimum_order_amount then
    raise exception 'The order does not meet this promo code minimum.';
  end if;

  if promo.max_uses is not null then
    select count(*) into use_count
    from public.promo_redemptions
    where promo_code_id = promo.id
      and (status = 'redeemed' or (status = 'reserved' and expires_at > now()));
    if use_count >= promo.max_uses then
      raise exception 'This promo code has reached its usage limit.';
    end if;
  end if;

  if promo.discount_type = 'percent' then
    discount := round(p_subtotal_amount * promo.discount_value / 100, 2);
    if promo.max_discount_amount is not null then
      discount := least(discount, promo.max_discount_amount);
    end if;
  else
    discount := promo.discount_value;
  end if;
  discount := least(discount, p_subtotal_amount);

  insert into public.promo_redemptions (
    promo_code_id, code, checkout_session_id, subtotal_amount, discount_amount
  ) values (
    promo.id, promo.code, p_checkout_session_id, p_subtotal_amount, discount
  )
  returning id into redemption_id;

  normalized_code := promo.code;
  discount_amount := discount;
  return next;
end;
$$;

create or replace function public.reserve_order_refund(
  p_order_id uuid,
  p_amount numeric,
  p_request_key uuid,
  p_admin_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  order_total numeric(12, 2);
  payment_id text;
  reserved_total numeric(12, 2);
  refund_id uuid;
begin
  select total_amount, razorpay_payment_id into order_total, payment_id
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Order not found.'; end if;
  if payment_id is null or payment_id = '' then
    raise exception 'This order has no Razorpay payment to refund.';
  end if;
  if p_amount <= 0 or p_amount != round(p_amount, 2) then
    raise exception 'Refund amount must be greater than zero and have no more than two decimal places.';
  end if;

  select coalesce(sum(amount), 0) into reserved_total
  from public.order_refunds
  where order_id = p_order_id and status in ('pending', 'processed', 'unknown');

  if reserved_total + p_amount > order_total then
    raise exception 'Refund exceeds the remaining captured order amount.';
  end if;

  insert into public.order_refunds (
    order_id, razorpay_payment_id, amount, status, request_key, admin_user_id
  ) values (
    p_order_id, payment_id, p_amount, 'pending', p_request_key, p_admin_user_id
  )
  returning id into refund_id;

  return refund_id;
end;
$$;

revoke all on function public.reserve_promo_redemption(text, uuid, numeric) from public, anon, authenticated;
revoke all on function public.reserve_order_refund(uuid, numeric, uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_promo_redemption(text, uuid, numeric) to service_role;
grant execute on function public.reserve_order_refund(uuid, numeric, uuid, uuid) to service_role;
