create table if not exists public.post_editor_access (
  post_id uuid not null references public.posts(id) on delete cascade,
  editor_user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (post_id, editor_user_id)
);

alter table public.post_editor_access enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'post_editor_access'
      and policyname = 'Users can assign themselves to new posts'
  ) then
    create policy "Users can assign themselves to new posts"
      on public.post_editor_access for insert
      to authenticated
      with check (editor_user_id = auth.uid());
  end if;
end
$$;

create index if not exists post_editor_access_editor_user_idx
  on public.post_editor_access (editor_user_id);

create index if not exists post_editor_access_post_idx
  on public.post_editor_access (post_id);
