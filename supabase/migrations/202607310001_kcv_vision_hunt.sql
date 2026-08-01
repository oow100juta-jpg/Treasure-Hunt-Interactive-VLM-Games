create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now()
);

create table public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique check (code = upper(code)),
  status text not null default 'lobby' check (status in ('lobby','active','ended')),
  registration_open boolean not null default true,
  maximum_teams integer not null default 20 check (maximum_teams > 0),
  game_duration_seconds integer not null check (game_duration_seconds > 0),
  leaderboard_visible_seconds integer not null check (leaderboard_visible_seconds >= 0 and leaderboard_visible_seconds <= game_duration_seconds),
  clue_progression_strategy text not null default 'easy_to_hard' check (clue_progression_strategy in ('random','easy_to_hard')),
  ending_title text not null default 'It ended…',
  ending_message text not null default 'Great hunting. The winner will be announced soon.',
  meeting_location text not null default '',
  final_leaderboard_visible boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  leaderboard_freezes_at timestamptz,
  ends_at timestamptz,
  ended_at timestamptz
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  participant_token_hash text not null,
  status text not null default 'waiting' check (status in ('waiting','searching','uploading','reviewing','rejected','accepted','viewing_leaderboard','freeze_notice','completed_all','ended','disconnected')),
  total_score integer not null default 0 check (total_score >= 0),
  completed_clue_count integer not null default 0 check (completed_clue_count >= 0),
  total_attempt_count integer not null default 0 check (total_attempt_count >= 0),
  leaderboard_freeze_acknowledged_at timestamptz,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (room_id, normalized_name)
);

create table public.clues (
  id uuid primary key default gen_random_uuid(),
  text text not null unique,
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  category text not null,
  expected_objects jsonb not null default '[]'::jsonb,
  weight numeric(6,2) not null default 1 check (weight > 0),
  order_group integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clue_assignments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  clue_id uuid not null references public.clues(id),
  sequence_number integer not null check (sequence_number > 0),
  status text not null default 'assigned' check (status in ('assigned','active','reviewing','rejected','completed','expired')),
  is_revealed boolean not null default false,
  assigned_at timestamptz not null default now(),
  first_viewed_at timestamptz,
  completed_at timestamptz,
  attempt_count integer not null default 0,
  awarded_score integer not null default 0,
  created_at timestamptz not null default now(),
  unique (room_id, team_id, clue_id),
  unique (team_id, sequence_number)
);
create unique index one_open_assignment_per_team on public.clue_assignments(team_id)
  where status in ('assigned','active','reviewing','rejected');

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  assignment_id uuid not null references public.clue_assignments(id) on delete cascade,
  image_path text not null,
  attempt_number integer not null check (attempt_number > 0),
  evaluation_status text not null default 'pending' check (evaluation_status in ('pending','processing','completed','failed')),
  ai_decision text check (ai_decision in ('accepted','rejected')),
  final_decision text check (final_decision in ('accepted','rejected')),
  decision_source text check (decision_source in ('ai','admin')),
  detected_object text,
  evaluation_reason text,
  confidence numeric(5,4) check (confidence between 0 and 1),
  overridden_by uuid references public.profiles(id),
  override_reason text,
  override_at timestamptz,
  submitted_at timestamptz not null default now(),
  evaluated_at timestamptz,
  unique (assignment_id, attempt_number)
);

create table public.score_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  assignment_id uuid not null references public.clue_assignments(id),
  submission_id uuid not null references public.submissions(id),
  event_type text not null check (event_type in ('clue_accepted','admin_reversal')),
  points integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (submission_id, event_type)
);

create table public.participant_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_room_admin(target_room_id uuid, actor_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select (auth.role() = 'service_role' or actor_id = auth.uid()) and exists(select 1 from game_rooms where id = target_room_id and created_by = actor_id) $$;

create or replace function public.assign_next_clue(target_team_id uuid, reveal_now boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  room_row game_rooms%rowtype;
  team_row teams%rowtype;
  next_clue_id uuid;
  next_sequence integer;
  completed_count integer;
  target_difficulty text;
  assignment_id uuid;
begin
  select * into team_row from teams where id = target_team_id for update;
  if not found then raise exception 'Team not found'; end if;
  select * into room_row from game_rooms where id = team_row.room_id;
  if room_row.status <> 'active' or room_row.ends_at <= now() then return null; end if;
  select id into assignment_id from clue_assignments where team_id = target_team_id and status in ('assigned','active','reviewing','rejected') limit 1;
  if assignment_id is not null then return assignment_id; end if;

  select count(*)::int into completed_count from clue_assignments where team_id = target_team_id and status = 'completed';
  next_sequence := completed_count + 1;
  target_difficulty := case when completed_count < 4 then 'easy' when completed_count < 8 then 'medium' else 'hard' end;

  select c.id into next_clue_id
  from clues c
  where c.is_active
    and not exists (select 1 from clue_assignments a where a.team_id = target_team_id and a.clue_id = c.id)
  order by
    case when room_row.clue_progression_strategy = 'easy_to_hard' and c.difficulty = target_difficulty then 0 else 1 end,
    case when room_row.clue_progression_strategy = 'random' then random() else coalesce(c.order_group, 9999) end,
    (select count(*) from clue_assignments open_a where open_a.clue_id = c.id and open_a.status in ('assigned','active','reviewing','rejected')),
    c.created_at
  limit 1;

  if next_clue_id is null then
    return null;
  end if;
  insert into clue_assignments(room_id, team_id, clue_id, sequence_number, status, is_revealed)
  values (team_row.room_id, target_team_id, next_clue_id, next_sequence, case when reveal_now then 'active' else 'assigned' end, reveal_now)
  returning id into assignment_id;
  return assignment_id;
exception when unique_violation then
  select id into assignment_id from clue_assignments where team_id = target_team_id and status in ('assigned','active','reviewing','rejected') limit 1;
  return assignment_id;
end $$;

create or replace function public.start_game(target_room_id uuid, actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare room_row game_rooms%rowtype; team_row teams%rowtype; started timestamptz;
begin
  select * into room_row from game_rooms where id = target_room_id for update;
  if not found or not is_room_admin(target_room_id, actor_id) then raise exception 'Forbidden'; end if;
  if room_row.status = 'active' then return jsonb_build_object('started_at', room_row.started_at, 'idempotent', true); end if;
  if room_row.status = 'ended' then raise exception 'Game has ended'; end if;
  if not exists(select 1 from teams where room_id = target_room_id) then raise exception 'At least one team is required'; end if;
  started := clock_timestamp();
  update game_rooms set status='active', registration_open=false, started_at=started,
    leaderboard_freezes_at=started + make_interval(secs => leaderboard_visible_seconds),
    ends_at=started + make_interval(secs => game_duration_seconds)
  where id=target_room_id returning * into room_row;
  for team_row in select * from teams where room_id=target_room_id loop
    update teams set status='searching' where id=team_row.id;
    perform assign_next_clue(team_row.id, true);
  end loop;
  return jsonb_build_object('started_at', room_row.started_at, 'leaderboard_freezes_at', room_row.leaderboard_freezes_at, 'ends_at', room_row.ends_at, 'idempotent', false);
end $$;

create or replace function public.end_game(target_room_id uuid, actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare room_row game_rooms%rowtype;
begin
  select * into room_row from game_rooms where id=target_room_id for update;
  if not found or not is_room_admin(target_room_id, actor_id) then raise exception 'Forbidden'; end if;
  if room_row.status='ended' then return jsonb_build_object('ended_at', room_row.ended_at, 'idempotent', true); end if;
  update game_rooms set status='ended', ended_at=clock_timestamp(), ends_at=least(coalesce(ends_at, clock_timestamp()), clock_timestamp()), registration_open=false where id=target_room_id returning * into room_row;
  update clue_assignments set status='expired' where room_id=target_room_id and status in ('assigned','active','reviewing','rejected');
  update teams set status='ended', ended_at=room_row.ended_at where room_id=target_room_id;
  return jsonb_build_object('ended_at', room_row.ended_at, 'idempotent', false);
end $$;

create or replace function public.process_submission_decision(
  target_submission_id uuid, accepted boolean, detected_object text, reason text, confidence numeric,
  source text default 'ai', admin_id uuid default null, override_reason text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare sub submissions%rowtype; assignment clue_assignments%rowtype; room_row game_rooms%rowtype; clue_row clues%rowtype; points integer; next_id uuid; hidden_next_id uuid;
begin
  select * into sub from submissions where id=target_submission_id for update;
  if not found then raise exception 'Submission not found'; end if;
  select * into assignment from clue_assignments where id=sub.assignment_id for update;
  select * into room_row from game_rooms where id=sub.room_id;
  select * into clue_row from clues where id=assignment.clue_id;
  if source='admin' and (admin_id is null or not is_room_admin(sub.room_id, admin_id) or length(trim(coalesce(override_reason,''))) < 3) then raise exception 'Invalid admin override'; end if;
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

create or replace function public.begin_submission(target_team_id uuid, target_image_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare team_row teams%rowtype; room_row game_rooms%rowtype; assignment clue_assignments%rowtype; attempt integer; new_id uuid;
begin
  select * into team_row from teams where id=target_team_id for update;
  select * into room_row from game_rooms where id=team_row.room_id;
  if room_row.status <> 'active' or room_row.ends_at <= now() then raise exception 'The game has ended'; end if;
  select * into assignment from clue_assignments where team_id=target_team_id and status in ('active','rejected') and is_revealed for update;
  if not found then raise exception 'No active clue'; end if;
  if exists(select 1 from submissions where assignment_id=assignment.id and evaluation_status in ('pending','processing')) then raise exception 'An evaluation is already in progress'; end if;
  attempt := assignment.attempt_count + 1;
  insert into submissions(room_id,team_id,assignment_id,image_path,attempt_number,evaluation_status)
    values(team_row.room_id,target_team_id,assignment.id,target_image_path,attempt,'processing') returning id into new_id;
  update clue_assignments set status='reviewing',attempt_count=attempt where id=assignment.id;
  update teams set status='reviewing',total_attempt_count=total_attempt_count+1,last_seen_at=now() where id=target_team_id;
  return jsonb_build_object('submission_id',new_id,'assignment_id',assignment.id,'attempt_number',attempt,'clue_id',assignment.clue_id);
end $$;

create or replace function public.expire_room_if_needed(target_room_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update game_rooms set status='ended',ended_at=ends_at,registration_open=false where id=target_room_id and status='active' and ends_at <= now();
  if not found then return false; end if;
  update clue_assignments set status='expired' where room_id=target_room_id and status in ('assigned','active','reviewing','rejected');
  update teams set status='ended',ended_at=coalesce(ended_at,now()) where room_id=target_room_id;
  return true;
end $$;

alter table profiles enable row level security;
alter table game_rooms enable row level security;
alter table teams enable row level security;
alter table clues enable row level security;
alter table clue_assignments enable row level security;
alter table submissions enable row level security;
alter table score_events enable row level security;
alter table participant_events enable row level security;

create policy "profiles own read" on profiles for select to authenticated using (id=auth.uid());
create policy "admins own rooms" on game_rooms for all to authenticated using (created_by=auth.uid()) with check (created_by=auth.uid());
create policy "admins room teams" on teams for select to authenticated using (is_room_admin(room_id,auth.uid()));
create policy "admins clues read" on clues for select to authenticated using (exists(select 1 from profiles where id=auth.uid() and role='admin'));
create policy "admins clues write" on clues for all to authenticated using (exists(select 1 from profiles where id=auth.uid() and role='admin')) with check (exists(select 1 from profiles where id=auth.uid() and role='admin'));
create policy "admins assignments" on clue_assignments for select to authenticated using (is_room_admin(room_id,auth.uid()));
create policy "admins submissions" on submissions for select to authenticated using (is_room_admin(room_id,auth.uid()));
create policy "admins scores" on score_events for select to authenticated using (is_room_admin(room_id,auth.uid()));
create policy "admins events" on participant_events for select to authenticated using (is_room_admin(room_id,auth.uid()));

revoke execute on function public.assign_next_clue(uuid,boolean) from public, anon, authenticated;
revoke execute on function public.begin_submission(uuid,text) from public, anon, authenticated;
revoke execute on function public.expire_room_if_needed(uuid) from public, anon;
revoke execute on function public.start_game(uuid,uuid) from public, anon;
revoke execute on function public.end_game(uuid,uuid) from public, anon;
revoke execute on function public.process_submission_decision(uuid,boolean,text,text,numeric,text,uuid,text) from public, anon;
grant execute on function public.assign_next_clue(uuid,boolean) to service_role;
grant execute on function public.begin_submission(uuid,text) to service_role;
grant execute on function public.expire_room_if_needed(uuid) to authenticated, service_role;
grant execute on function public.start_game(uuid,uuid) to authenticated, service_role;
grant execute on function public.end_game(uuid,uuid) to authenticated, service_role;
grant execute on function public.process_submission_decision(uuid,boolean,text,text,numeric,text,uuid,text) to authenticated, service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('participant-submissions','participant-submissions',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

do $$ begin
  alter publication supabase_realtime add table public.game_rooms;
  alter publication supabase_realtime add table public.teams;
  alter publication supabase_realtime add table public.clue_assignments;
  alter publication supabase_realtime add table public.submissions;
  alter publication supabase_realtime add table public.score_events;
exception when duplicate_object then null; end $$;
