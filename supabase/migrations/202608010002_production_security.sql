create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.api_rate_limits (
  bucket_key text primary key,
  request_count integer not null check (request_count > 0),
  reset_at timestamptz not null
);

alter table private.api_rate_limits enable row level security;
revoke all on private.api_rate_limits from public, anon, authenticated;

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
  if length(bucket_key) <> 64 or max_requests < 1 or window_seconds < 1 or window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;

  insert into private.api_rate_limits as limits (bucket_key, request_count, reset_at)
  values (bucket_key, 1, request_now + make_interval(secs => window_seconds))
  on conflict (bucket_key) do update set
    request_count = case
      when limits.reset_at <= request_now then 1
      else limits.request_count + 1
    end,
    reset_at = case
      when limits.reset_at <= request_now then request_now + make_interval(secs => window_seconds)
      else limits.reset_at
    end
  returning request_count into current_count;

  return current_count <= max_requests;
end $$;

revoke execute on function public.consume_api_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text,integer,integer) to service_role;

create or replace function public.join_team(
  target_room_code text,
  target_team_name text,
  target_normalized_name text,
  target_token_hash text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  room_row game_rooms%rowtype;
  team_row teams%rowtype;
  existing_team_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;
  if length(target_team_name) < 2 or length(target_team_name) > 40
    or length(target_normalized_name) < 2 or length(target_normalized_name) > 40
    or target_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid team registration';
  end if;

  select * into room_row from game_rooms where code=upper(target_room_code) for update;
  if not found then raise exception 'Room not found'; end if;
  if room_row.status <> 'lobby' then raise exception 'Game already started'; end if;
  if not room_row.registration_open then raise exception 'Registration closed'; end if;

  select count(*) into existing_team_count from teams where room_id=room_row.id;
  if existing_team_count >= room_row.maximum_teams then raise exception 'Room team limit reached'; end if;

  insert into teams(room_id,name,normalized_name,participant_token_hash)
  values(room_row.id,target_team_name,target_normalized_name,target_token_hash)
  returning * into team_row;

  insert into participant_events(room_id,team_id,event_type,metadata)
  values(room_row.id,team_row.id,'joined','{}'::jsonb);

  return jsonb_build_object(
    'roomCode', room_row.code,
    'team', jsonb_build_object('id',team_row.id,'name',team_row.name,'roomId',team_row.room_id)
  );
end $$;

revoke execute on function public.join_team(text,text,text,text) from public, anon, authenticated;
grant execute on function public.join_team(text,text,text,text) to service_role;

create or replace function public.process_submission_decision(
  target_submission_id uuid, accepted boolean, detected_object text, reason text, confidence numeric,
  source text default 'ai', admin_id uuid default null, override_reason text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare sub submissions%rowtype; assignment clue_assignments%rowtype; room_row game_rooms%rowtype; clue_row clues%rowtype; points integer; next_id uuid; hidden_next_id uuid;
begin
  if source not in ('ai', 'admin') then
    raise exception 'Invalid decision source';
  end if;
  if source = 'ai' and auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;

  select * into sub from submissions where id=target_submission_id for update;
  if not found then raise exception 'Submission not found'; end if;
  select * into assignment from clue_assignments where id=sub.assignment_id for update;
  select * into room_row from game_rooms where id=sub.room_id;
  select * into clue_row from clues where id=assignment.clue_id;

  if source='admin' and (
    admin_id is null
    or (auth.role() is distinct from 'service_role' and admin_id is distinct from auth.uid())
    or not is_room_admin(sub.room_id, admin_id)
    or length(trim(coalesce(override_reason,''))) < 3
  ) then
    raise exception 'Invalid admin override';
  end if;

  if sub.final_decision = 'accepted' and source='admin' and not accepted then
    select id into hidden_next_id from clue_assignments where team_id=sub.team_id and sequence_number=assignment.sequence_number+1 and status='assigned' and not is_revealed for update;
    if hidden_next_id is null and exists(select 1 from clue_assignments where team_id=sub.team_id and sequence_number>assignment.sequence_number and status <> 'expired') then
      raise exception 'Cannot reverse after the team has progressed';
    end if;
    if hidden_next_id is not null then delete from clue_assignments where id=hidden_next_id; end if;
    points := assignment.awarded_score;
    insert into score_events(room_id,team_id,assignment_id,submission_id,event_type,points,metadata)
      values(sub.room_id,sub.team_id,assignment.id,sub.id,'admin_reversal',-points,jsonb_build_object('reason',override_reason)) on conflict do nothing;
    if found then update teams set total_score=greatest(0,total_score-points),completed_clue_count=greatest(0,completed_clue_count-1),status='rejected' where id=sub.team_id; end if;
    update clue_assignments set status='rejected',completed_at=null,awarded_score=0 where id=assignment.id;
    update submissions set final_decision='rejected',decision_source='admin',evaluation_reason=reason,overridden_by=admin_id,override_reason=process_submission_decision.override_reason,override_at=clock_timestamp(),evaluated_at=clock_timestamp() where id=sub.id;
    return jsonb_build_object('decision','rejected','reversed',true,'idempotent',false);
  end if;
  if sub.final_decision is not null then
    if source = 'ai'
      or (accepted and sub.final_decision = 'accepted')
      or (not accepted and sub.final_decision = 'rejected') then
      return jsonb_build_object('decision', sub.final_decision, 'idempotent', true);
    end if;
    if not (source='admin' and sub.final_decision='rejected' and accepted and assignment.status='rejected') then
      raise exception 'A finalized decision cannot be reversed after progression';
    end if;
  end if;
  if source='ai' and (room_row.status <> 'active' or room_row.ends_at <= now()) then
    update submissions set evaluation_status='failed', evaluation_reason='The game ended before evaluation completed.', evaluated_at=clock_timestamp() where id=sub.id;
    update clue_assignments set status='expired' where id=assignment.id;
    return jsonb_build_object('decision', 'failed', 'game_ended', true);
  end if;
  update submissions set evaluation_status='completed', ai_decision=case when source='ai' then case when accepted then 'accepted' else 'rejected' end else ai_decision end,
    final_decision=case when accepted then 'accepted' else 'rejected' end, decision_source=source,
    detected_object=process_submission_decision.detected_object, evaluation_reason=reason, confidence=process_submission_decision.confidence,
    overridden_by=case when source='admin' then admin_id else null end, override_reason=case when source='admin' then process_submission_decision.override_reason else null end,
    override_at=case when source='admin' then clock_timestamp() else null end, evaluated_at=clock_timestamp()
  where id=sub.id;
  if not accepted then
    update clue_assignments set status='rejected' where id=assignment.id;
    update teams set status='rejected' where id=sub.team_id;
    return jsonb_build_object('decision','rejected','idempotent',false);
  end if;
  points := round(greatest(60, 110 - sub.attempt_number * 10) * case clue_row.difficulty when 'medium' then 1.2 when 'hard' then 1.5 else 1 end * clue_row.weight);
  update clue_assignments set status='completed', completed_at=clock_timestamp(), awarded_score=points where id=assignment.id;
  insert into score_events(room_id,team_id,assignment_id,submission_id,event_type,points,metadata)
    values(sub.room_id,sub.team_id,assignment.id,sub.id,'clue_accepted',points,jsonb_build_object('difficulty',clue_row.difficulty,'attempt',sub.attempt_number)) on conflict do nothing;
  if found then update teams set total_score=total_score+points, completed_clue_count=completed_clue_count+1, status='accepted' where id=sub.team_id; end if;
  if room_row.status='active' and room_row.ends_at > now() then next_id := assign_next_clue(sub.team_id, false); end if;
  return jsonb_build_object('decision','accepted','points',points,'next_assignment_id',next_id,'idempotent',false);
end $$;

revoke execute on function public.process_submission_decision(uuid,boolean,text,text,numeric,text,uuid,text) from public, anon;
grant execute on function public.process_submission_decision(uuid,boolean,text,text,numeric,text,uuid,text) to authenticated, service_role;

create or replace function public.expire_room_if_needed(target_room_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role' and is_room_admin(target_room_id, auth.uid()) is not true then
    raise exception 'Forbidden';
  end if;
  update game_rooms set status='ended',ended_at=ends_at,registration_open=false where id=target_room_id and status='active' and ends_at <= now();
  if not found then return false; end if;
  update clue_assignments set status='expired' where room_id=target_room_id and status in ('assigned','active','reviewing','rejected');
  update teams set status='ended',ended_at=coalesce(ended_at,now()) where room_id=target_room_id;
  return true;
end $$;

revoke execute on function public.expire_room_if_needed(uuid) from public, anon;
grant execute on function public.expire_room_if_needed(uuid) to authenticated, service_role;
