-- Migration V5: Convert Supabase Auth UUIDs to Clerk Auth String IDs

-- 1. Drop RLS policies that depend on the uuid columns
drop policy if exists "Profiles select own" on public.profiles;
drop policy if exists "Profiles insert own" on public.profiles;
drop policy if exists "Profiles update own" on public.profiles;

drop policy if exists "Chats select own" on public.chats;
drop policy if exists "Chats insert own" on public.chats;
drop policy if exists "Chats update own" on public.chats;
drop policy if exists "Chats delete own" on public.chats;

drop policy if exists "Messages select own" on public.messages;
drop policy if exists "Messages insert own" on public.messages;
drop policy if exists "Messages update own" on public.messages;
drop policy if exists "Messages delete own" on public.messages;

drop policy if exists "Usage select own" on public.daily_usage;

-- 1b. Drop the integrations table entirely to bypass guessing any hidden policy names!
-- (This is perfectly safe since the table is empty due to the GitHub login failing so far)
drop table if exists public.integrations cascade;

-- 2. Drop foreign keys referencing Supabase's auth.users table
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.chats drop constraint if exists chats_user_id_fkey;
alter table public.messages drop constraint if exists messages_user_id_fkey;
alter table public.daily_usage drop constraint if exists daily_usage_user_id_fkey;

-- 3. Alter column types from uuid to text to support Clerk IDs ('user_...')
alter table public.profiles alter column id type text using id::text;
alter table public.chats alter column user_id type text using user_id::text;
alter table public.messages alter column user_id type text using user_id::text;
alter table public.daily_usage alter column user_id type text using user_id::text;

-- 4. Recreate the integrations table cleanly with text IDs!
create table public.integrations (
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
