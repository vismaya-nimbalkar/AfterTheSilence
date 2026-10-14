alter table public.products
  add column if not exists qikink_sku text;

alter table public.orders
  add column if not exists pod_provider text,
  add column if not exists qikink_order_id text,
  add column if not exists qikink_order_number text,
  add column if not exists qikink_checked_at timestamptz;

update public.orders
set pod_provider = 'printful'
where pod_order_id is not null
  and pod_provider is null;

alter table public.products
  add constraint products_qikink_sku_length
  check (qikink_sku is null or length(qikink_sku) <= 50);
