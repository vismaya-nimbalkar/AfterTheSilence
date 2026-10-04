create table if not exists public.site_settings (
  id text primary key,
  contact_phone text not null default '',
  contact_email text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id)
values ('global')
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'site_settings'
      and policyname = 'Site settings are publicly readable'f
  ) then
    create policy "Site settings are publicly readable"
      on public.site_settings for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'site_settings'
      and policyname = 'Service role manages site settings'
  ) then
    create policy "Service role manages site settings"
      on public.site_settings for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;