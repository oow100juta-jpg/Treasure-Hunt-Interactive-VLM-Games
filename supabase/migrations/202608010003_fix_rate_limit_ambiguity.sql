create or replace function public.consume_api_rate_limit(
  bucket_key text,
  max_requests integer,
  window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_now timestamptz := clock_timestamp();
  current_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;
  if length(consume_api_rate_limit.bucket_key) <> 64 or max_requests < 1 or window_seconds < 1 or window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;

  insert into private.api_rate_limits as limits (bucket_key, request_count, reset_at)
  values (consume_api_rate_limit.bucket_key, 1, request_now + make_interval(secs => window_seconds))
  on conflict on constraint api_rate_limits_pkey do update set
    request_count = case
      when limits.reset_at <= request_now then 1
      else limits.request_count + 1
    end,
    reset_at = case
      when limits.reset_at <= request_now then request_now + make_interval(secs => window_seconds)
      else limits.reset_at
    end
  returning limits.request_count into current_count;

  return current_count <= max_requests;
end $$;

revoke execute on function public.consume_api_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text,integer,integer) to service_role;
