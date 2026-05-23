-- Migration: Convert Supabase Auth UUIDs to Clerk Auth String IDs

-- 1. Drop foreign keys referencing Supabase's auth.users table
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.chats drop constraint if exists chats_user_id_fkey;
alter table public.messages drop constraint if exists messages_user_id_fkey;
alter table public.daily_usage drop constraint if exists daily_usage_user_id_fkey;
alter table public.integrations drop constraint if exists integrations_user_id_fkey;

-- 2. Alter column types from uuid to text to support Clerk IDs ('user_...')
alter table public.profiles alter column id type text using id::text;
alter table public.chats alter column user_id type text using user_id::text;
alter table public.messages alter column user_id type text using user_id::text;
alter table public.daily_usage alter column user_id type text using user_id::text;

-- 3. Fix integrations table just in case it was created as uuid
alter table public.integrations alter column user_id type text using user_id::text;
