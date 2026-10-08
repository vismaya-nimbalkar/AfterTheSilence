create table if not exists public.site_settings (
  id text primary key,
  contact_phone text not null default '',
  contact_email text not null default '',
  about_heading text not null default 'No Longer Silent',
  about_body text not null default 'This is a blog created for queer people in India to find relevant, accessible information about social, medical, and legal transitioning. It exists as a resource for those trying to navigate complex systems; both socially, legally, and medically. Alongside practical guides, this blog also features writing on social issues affecting the queer community in India, with a focus on lived experiences, systemic barriers, and the realities that are often ignored or oversimplified.',
  about_contact_label text not null default 'Contact me at',
  about_contact_separator text not null default 'or',
  about_writer_prompt text not null default 'If you would like to apply to be a writer, please',
  about_writer_link_text text not null default 'apply here',
  about_writer_link_url text not null default 'https://afterthesilence.org/forms/apply-to-be-an-editor-with-after-the-silence',
  updated_at timestamptz not null default now()
);

alter table public.site_settings
  add column if not exists about_heading text not null default 'No Longer Silent',
  add column if not exists about_body text not null default 'This is a blog created for queer people in India to find relevant, accessible information about social, medical, and legal transitioning. It exists as a resource for those trying to navigate complex systems; both socially, legally, and medically. Alongside practical guides, this blog also features writing on social issues affecting the queer community in India, with a focus on lived experiences, systemic barriers, and the realities that are often ignored or oversimplified.',
  add column if not exists about_contact_label text not null default 'Contact me at',
  add column if not exists about_contact_separator text not null default 'or',
  add column if not exists about_writer_prompt text not null default 'If you would like to apply to be a writer, please',
  add column if not exists about_writer_link_text text not null default 'apply here',
  add column if not exists about_writer_link_url text not null default 'https://afterthesilence.org/forms/apply-to-be-an-editor-with-after-the-silence';

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
      and policyname = 'Site settings are publicly readable'
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