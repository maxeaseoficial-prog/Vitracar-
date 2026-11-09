-- Applied as hosted migration vitracar_direct_signup_support.
-- No user passwords, session tokens, or unverified email claims are stored here.
create table if not exists private.vitracar_auth_limits (bucket text primary key, started_at timestamptz not null default now(), attempts integer not null default 0 check(attempts >= 0));
alter table private.vitracar_auth_limits enable row level security;
revoke all on private.vitracar_auth_limits from public, anon, authenticated;
grant usage on schema private to service_role;
grant select,insert,update,delete on private.vitracar_auth_limits to service_role;

create or replace function public.vitracar_take_auth_attempt(p_fingerprint text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer; t timestamptz := clock_timestamp();
begin
  if current_user not in ('service_role','postgres') then raise exception 'not permitted' using errcode='42501'; end if;
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then return false; end if;
  perform pg_advisory_xact_lock(98244, 1);
  delete from private.vitracar_auth_limits where started_at < t - interval '1 day';
  insert into private.vitracar_auth_limits as limits(bucket,started_at,attempts) values ('global',t,1)
    on conflict(bucket) do update set started_at=case when limits.started_at < t-interval '15 minutes' then t else limits.started_at end,
    attempts=case when limits.started_at < t-interval '15 minutes' then 1 else least(limits.attempts+1,1000000) end returning attempts into n;
  if n > 120 then return false; end if;
  insert into private.vitracar_auth_limits as limits(bucket,started_at,attempts) values ('email:'||p_fingerprint,t,1)
    on conflict(bucket) do update set started_at=case when limits.started_at < t-interval '15 minutes' then t else limits.started_at end,
    attempts=case when limits.started_at < t-interval '15 minutes' then 1 else least(limits.attempts+1,1000000) end returning attempts into n;
  return n <= 8;
end; $$;
revoke all on function public.vitracar_take_auth_attempt(text) from public,anon,authenticated;
grant execute on function public.vitracar_take_auth_attempt(text) to service_role;

-- Invoke only after the Auth password grant returns email_not_confirmed.
grant select (id,email,email_confirmed_at,banned_until,deleted_at) on auth.users to service_role;
create or replace function public.vitracar_pending_user_id(p_email text)
returns uuid language sql stable security invoker set search_path = '' as $$
  select u.id from auth.users u where lower(u.email)=lower(trim(p_email)) and u.email_confirmed_at is null and u.deleted_at is null and (u.banned_until is null or u.banned_until < now()) and current_user in ('service_role','postgres') limit 1;
$$;
revoke all on function public.vitracar_pending_user_id(text) from public,anon,authenticated;
grant execute on function public.vitracar_pending_user_id(text) to service_role;
comment on function public.vitracar_pending_user_id(text) is 'Service-role-only lookup. Use only after Auth password verification; never an email-only account activation endpoint.';
