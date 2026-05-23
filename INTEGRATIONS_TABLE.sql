-- Create integrations table
create table if not exists public.integrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  provider text not null,
  access_token text not null,
  refresh_token text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

-- RLS
alter table public.integrations enable row level security;

create policy "Users can view own integrations"
  on public.integrations for select
  to authenticated
  using ( user_id = auth.uid() );

create policy "Users can manage own integrations"
  on public.integrations for all
  to authenticated
  using ( user_id = auth.uid() )
  with check ( user_id = auth.uid() );
