-- =====================================================================
-- Resynth AI — Supabase schema (run in Supabase SQL Editor)
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ── profiles ──────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  plan text not null default 'free',           -- free | pro | elite
  subscription_status text default 'free',     -- free | active | cancelled | expired
  dodo_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles select own" on public.profiles;
create policy "Profiles select own" on public.profiles
  for select to authenticated using ( id = auth.uid() );

drop policy if exists "Profiles insert own" on public.profiles;
create policy "Profiles insert own" on public.profiles
  for insert to authenticated with check ( id = auth.uid() );

drop policy if exists "Profiles update own" on public.profiles;
create policy "Profiles update own" on public.profiles
  for update to authenticated using ( id = auth.uid() ) with check ( id = auth.uid() );

-- Auto-create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ── chats ─────────────────────────────────────────────────────────────
create table if not exists public.chats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_user_id_created_at_idx on public.chats (user_id, created_at desc);

alter table public.chats enable row level security;

drop policy if exists "Chats select own" on public.chats;
create policy "Chats select own" on public.chats
  for select to authenticated using ( user_id = auth.uid() );

drop policy if exists "Chats insert own" on public.chats;
create policy "Chats insert own" on public.chats
  for insert to authenticated with check ( user_id = auth.uid() );

drop policy if exists "Chats update own" on public.chats;
create policy "Chats update own" on public.chats
  for update to authenticated using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );

drop policy if exists "Chats delete own" on public.chats;
create policy "Chats delete own" on public.chats
  for delete to authenticated using ( user_id = auth.uid() );

-- ── messages ──────────────────────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid not null references public.chats on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  reaction text check (reaction in ('like', 'dislike') or reaction is null),
  created_at timestamptz not null default now()
);

create index if not exists messages_chat_id_created_at_idx on public.messages (chat_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "Messages select own" on public.messages;
create policy "Messages select own" on public.messages
  for select to authenticated using ( user_id = auth.uid() );

drop policy if exists "Messages insert own" on public.messages;
create policy "Messages insert own" on public.messages
  for insert to authenticated with check ( user_id = auth.uid() );

drop policy if exists "Messages update own" on public.messages;
create policy "Messages update own" on public.messages
  for update to authenticated using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );

drop policy if exists "Messages delete own" on public.messages;
create policy "Messages delete own" on public.messages
  for delete to authenticated using ( user_id = auth.uid() );

-- ── daily_usage ───────────────────────────────────────────────────────
create table if not exists public.daily_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.daily_usage enable row level security;

drop policy if exists "Usage select own" on public.daily_usage;
create policy "Usage select own" on public.daily_usage
  for select to authenticated using ( user_id = auth.uid() );

-- Allow user/server to increment via RPC below; no direct writes from anon

-- RPC: increment_usage(daily count for caller) → returns {used,limit_,allowed}
create or replace function public.increment_usage(p_limit int)
returns table (used int, limit_ int, allowed boolean)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
  v_count int;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;
  insert into daily_usage (user_id, day, count) values (v_uid, v_day, 0)
    on conflict (user_id, day) do nothing;
  select count into v_count from daily_usage where user_id = v_uid and day = v_day;
  if v_count >= p_limit then
    return query select v_count, p_limit, false;
    return;
  end if;
  update daily_usage set count = count + 1 where user_id = v_uid and day = v_day
    returning count into v_count;
  return query select v_count, p_limit, true;
end;
$$;

grant execute on function public.increment_usage(int) to authenticated;

-- RPC: current_usage → just return today's count
create or replace function public.current_usage()
returns table (used int, day date)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
  v_count int;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;
  select count into v_count from daily_usage where user_id = v_uid and day = v_day;
  return query select coalesce(v_count, 0), v_day;
end;
$$;

grant execute on function public.current_usage() to authenticated;

-- ── dodo_webhook_events (audit log) ───────────────────────────────────
create table if not exists public.dodo_webhook_events (
  id text primary key,
  event_type text,
  data jsonb,
  received_at timestamptz not null default now()
);

alter table public.dodo_webhook_events enable row level security;
-- (No policies = no client access; server uses service role)

-- Done.
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
