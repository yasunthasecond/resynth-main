-- Migration V2: Convert Supabase Auth UUIDs to Clerk Auth String IDs

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

-- 2. Drop foreign keys referencing Supabase's auth.users table
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.chats drop constraint if exists chats_user_id_fkey;
alter table public.messages drop constraint if exists messages_user_id_fkey;
alter table public.daily_usage drop constraint if exists daily_usage_user_id_fkey;
alter table public.integrations drop constraint if exists integrations_user_id_fkey;

-- 3. Alter column types from uuid to text to support Clerk IDs ('user_...')
alter table public.profiles alter column id type text using id::text;
alter table public.chats alter column user_id type text using user_id::text;
alter table public.messages alter column user_id type text using user_id::text;
alter table public.daily_usage alter column user_id type text using user_id::text;

-- 4. Fix integrations table just in case it was created as uuid
alter table public.integrations alter column user_id type text using user_id::text;
