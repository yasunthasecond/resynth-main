-- 1. Add locked_until to profiles
alter table public.profiles add column if not exists locked_until timestamptz;

-- 2. Update increment_usage to support 24-hour individual cooldown
drop function if exists public.increment_usage(int);
create or replace function public.increment_usage(p_limit int)
returns table (used int, limit_ int, allowed boolean, unlock_at text)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
  v_count int;
  v_locked timestamptz;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;
  
  -- Check if currently locked (cooldown active)
  select locked_until into v_locked from profiles where id = v_uid;
  if v_locked is not null and v_locked > now() then
    return query select p_limit, p_limit, false, to_char(v_locked at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    return;
  end if;
  
  -- Insert fresh day tracking if needed
  insert into daily_usage (user_id, day, count) values (v_uid, v_day, 0)
    on conflict (user_id, day) do nothing;
  
  select count into v_count from daily_usage where user_id = v_uid and day = v_day;
  
  -- If somehow already hit limit but not locked (e.g. legacy row)
  if v_count >= p_limit then
    v_locked := now() + interval '24 hours';
    update profiles set locked_until = v_locked where id = v_uid;
    return query select v_count, p_limit, false, to_char(v_locked at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    return;
  end if;
  
  -- Increment usage
  update daily_usage set count = count + 1 where user_id = v_uid and day = v_day
    returning count into v_count;
    
  -- If they just hit the limit on this exact message, lock them for 24 hours
  if v_count >= p_limit then
    v_locked := now() + interval '24 hours';
    update profiles set locked_until = v_locked where id = v_uid;
    return query select v_count, p_limit, true, to_char(v_locked at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    return;
  end if;
  
  return query select v_count, p_limit, true, null::text;
end;
$$;
grant execute on function public.increment_usage(int) to authenticated;
