create table if not exists public.travel_countries (
  id uuid primary key default gen_random_uuid(),
  country_name text not null,
  map_id text not null unique,
  country_code text not null,
  status text not null default 'caution' check (status in ('safe', 'caution', 'reconsider', 'do_not_travel')),
  notes text not null default '',
  advisories jsonb not null default '[]'::jsonb,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.travel_countries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'travel_countries'
      and policyname = 'Travel advisories are publicly readable when published'
  ) then
    create policy "Travel advisories are publicly readable when published"
      on public.travel_countries for select
      using (published = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'travel_countries'
      and policyname = 'Service role manages travel advisories'
  ) then
    create policy "Service role manages travel advisories"
      on public.travel_countries for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;

create index if not exists travel_countries_published_idx
  on public.travel_countries (published);

create table if not exists public.travel_settings (
  id text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.travel_settings (id, enabled)
values ('global', true)
on conflict (id) do nothing;

alter table public.travel_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'travel_settings'
      and policyname = 'Travel visibility is publicly readable'
  ) then
    create policy "Travel visibility is publicly readable"
      on public.travel_settings for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'travel_settings'
      and policyname = 'Service role manages travel visibility'
  ) then
    create policy "Service role manages travel visibility"
      on public.travel_settings for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;
  