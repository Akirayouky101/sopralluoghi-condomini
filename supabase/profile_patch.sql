create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, company, phone)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'company',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        company = excluded.company,
        phone = excluded.phone,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users manage own profile'
  ) then
    create policy "Users manage own profile"
      on public.profiles for all
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end;
$$;

insert into public.profiles (id, full_name, company, phone)
select
  id,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'company',
  raw_user_meta_data->>'phone'
from auth.users
on conflict (id) do nothing;

create index if not exists profiles_company_idx on public.profiles(company);
