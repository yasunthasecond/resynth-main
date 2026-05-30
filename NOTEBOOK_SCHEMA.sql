-- =====================================================================
-- Resynth AI — NotebookLM Features Schema (run in Supabase SQL Editor)
-- =====================================================================

-- ── notebooks ─────────────────────────────────────────────────────────
create table if not exists public.notebooks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null default 'Untitled Notebook',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notebooks_user_id_created_at_idx on public.notebooks (user_id, created_at desc);

alter table public.notebooks enable row level security;

create policy "Notebooks select own" on public.notebooks
  for select to authenticated using ( user_id = auth.uid() );

create policy "Notebooks insert own" on public.notebooks
  for insert to authenticated with check ( user_id = auth.uid() );

create policy "Notebooks update own" on public.notebooks
  for update to authenticated using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );

create policy "Notebooks delete own" on public.notebooks
  for delete to authenticated using ( user_id = auth.uid() );

-- ── sources (documents attached to a notebook) ────────────────────────
create table if not exists public.sources (
  id uuid primary key default uuid_generate_v4(),
  notebook_id uuid not null references public.notebooks on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  filename text not null,
  content text not null, -- The extracted text content of the source
  created_at timestamptz not null default now()
);

create index if not exists sources_notebook_id_idx on public.sources (notebook_id);

alter table public.sources enable row level security;

create policy "Sources select own" on public.sources
  for select to authenticated using ( user_id = auth.uid() );

create policy "Sources insert own" on public.sources
  for insert to authenticated with check ( user_id = auth.uid() );

create policy "Sources update own" on public.sources
  for update to authenticated using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );

create policy "Sources delete own" on public.sources
  for delete to authenticated using ( user_id = auth.uid() );
