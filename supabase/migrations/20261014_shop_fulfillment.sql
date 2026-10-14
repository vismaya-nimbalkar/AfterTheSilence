alter table public.products
  add column if not exists is_pod boolean not null default true,
  add column if not exists pod_print_file_url text;

alter table public.orders
  add column if not exists pod_order_id text,
  add column if not exists tracking_number text,
  add column if not exists fulfillment_error text,
  add column if not exists tracking_url text,
  add column if not exists tracking_provider text;
