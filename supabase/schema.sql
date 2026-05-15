create extension if not exists "pgcrypto";

create table if not exists public.condominiums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text not null,
  contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  survey_date date not null default current_date,
  status text not null default 'Bozza',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.survey_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  survey_id uuid not null references public.surveys(id) on delete cascade,
  title text not null,
  selected_checks text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.component_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  unit text not null,
  brand text,
  supplier text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.survey_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  survey_id uuid not null references public.surveys(id) on delete cascade,
  component_id uuid references public.component_catalog(id) on delete set null,
  description text not null,
  quantity numeric not null default 1,
  unit text not null default 'pz',
  created_at timestamptz not null default now()
);

create table if not exists public.survey_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  survey_id uuid not null references public.surveys(id) on delete cascade,
  storage_path text not null,
  caption text,
  section_title text,
  created_at timestamptz not null default now()
);

alter table public.condominiums enable row level security;
alter table public.surveys enable row level security;
alter table public.survey_sections enable row level security;
alter table public.component_catalog enable row level security;
alter table public.survey_materials enable row level security;
alter table public.survey_photos enable row level security;

create policy "Users manage own condominiums"
  on public.condominiums for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own surveys"
  on public.surveys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own survey sections"
  on public.survey_sections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own components"
  on public.component_catalog for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own survey materials"
  on public.survey_materials for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own survey photos"
  on public.survey_photos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists condominiums_user_id_idx on public.condominiums(user_id);
create index if not exists surveys_user_id_idx on public.surveys(user_id);
create index if not exists surveys_condominium_id_idx on public.surveys(condominium_id);
create index if not exists component_catalog_user_id_idx on public.component_catalog(user_id);
create index if not exists survey_materials_survey_id_idx on public.survey_materials(survey_id);
create index if not exists survey_photos_survey_id_idx on public.survey_photos(survey_id);
