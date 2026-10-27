create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('voyageur','hote')),
  created_at timestamptz not null default now()
);

grant select, insert on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "Users read their own role"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

create policy "Users record their own role at signup"
  on public.user_roles for insert to authenticated
  with check (user_id = auth.uid());