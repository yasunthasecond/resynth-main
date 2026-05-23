create table if not exists public.integrations (
    id uuid default gen_random_uuid() primary key,
    user_id text not null,
    provider text not null,
    access_token text not null,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(user_id, provider)
);

alter table public.integrations enable row level security;
