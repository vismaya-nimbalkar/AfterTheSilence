update public.orders
set tracking_provider = 'manual'
where tracking_provider = 'dtdc';
