create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled form',
  description text not null default '',
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  settings jsonb not null default '{"collectEmail": false, "limitOneResponse": false, "sendResponseReceipt": false}'::jsonb,
  confirmation_message text not null default 'Your response has been recorded.',
  confirmation_image_url text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.forms add column if not exists confirmation_image_url text not null default '';

create table if not exists public.form_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  position integer not null default 0,
  type text not null check (type in ('short_text', 'long_text', 'multiple_choice', 'checkboxes', 'dropdown', 'date', 'time')),
  title text not null default 'Untitled question',
  description text not null default '',
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  image_url text not null default '',
  created_at timestamptz not null default now()
);

alter table public.form_questions add column if not exists image_url text not null default '';

create table if not exists public.form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  respondent_email text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.forms enable row level security;
alter table public.form_questions enable row level security;
alter table public.form_responses enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'forms' and policyname = 'Published forms are publicly readable') then
    create policy "Published forms are publicly readable" on public.forms for select using (status = 'published');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'form_questions' and policyname = 'Questions for published forms are publicly readable') then
    create policy "Questions for published forms are publicly readable" on public.form_questions for select using (exists (select 1 from public.forms where forms.id = form_questions.form_id and forms.status = 'published'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'forms' and policyname = 'Service role manages forms') then
    create policy "Service role manages forms" on public.forms for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'form_questions' and policyname = 'Service role manages form questions') then
    create policy "Service role manages form questions" on public.form_questions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'form_responses' and policyname = 'Service role manages form responses') then
    create policy "Service role manages form responses" on public.form_responses for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end
$$;

create index if not exists forms_status_idx on public.forms (status);
create index if not exists form_questions_form_position_idx on public.form_questions (form_id, position);
create index if not exists form_responses_form_created_idx on public.form_responses (form_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('form-question-images', 'form-question-images', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public form question images are readable') then
    create policy "Public form question images are readable" on storage.objects for select using (bucket_id = 'form-question-images');
  end if;
end
$$;
