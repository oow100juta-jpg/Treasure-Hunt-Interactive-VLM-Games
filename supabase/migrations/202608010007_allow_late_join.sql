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
  first_assignment_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;
  if length(target_team_name) < 2 or length(target_team_name) > 40
    or length(target_normalized_name) < 2 or length(target_normalized_name) > 40
    or target_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid team registration';
  end if;

  select * into room_row
  from game_rooms
  where code = upper(target_room_code)
  for update;

  if not found then raise exception 'Room not found'; end if;
  if room_row.status = 'ended'
    or (room_row.status = 'active' and room_row.ends_at <= clock_timestamp()) then
    raise exception 'Game has ended';
  end if;
  if room_row.status = 'lobby' and not room_row.registration_open then
    raise exception 'Registration closed';
  end if;

  select count(*) into existing_team_count
  from teams
  where room_id = room_row.id;

  if existing_team_count >= room_row.maximum_teams then
    raise exception 'Room team limit reached';
  end if;

  insert into teams(room_id, name, normalized_name, participant_token_hash, status)
  values(
    room_row.id,
    target_team_name,
    target_normalized_name,
    target_token_hash,
    case when room_row.status = 'active' then 'searching' else 'waiting' end
  )
  returning * into team_row;

  if room_row.status = 'active' then
    first_assignment_id := assign_next_clue(team_row.id, true);
  end if;

  insert into participant_events(room_id, team_id, event_type, metadata)
  values(
    room_row.id,
    team_row.id,
    'joined',
    jsonb_build_object(
      'joinedAfterStart', room_row.status = 'active',
      'firstAssignmentId', first_assignment_id
    )
  );

  return jsonb_build_object(
    'roomCode', room_row.code,
    'team', jsonb_build_object(
      'id', team_row.id,
      'name', team_row.name,
      'roomId', team_row.room_id
    )
  );
end
$$;

revoke execute on function public.join_team(text,text,text,text) from public, anon, authenticated;
grant execute on function public.join_team(text,text,text,text) to service_role;

-- Registration remains open for the rest of an active game. Existing active
-- rooms are updated immediately; ended rooms remain closed.
update public.game_rooms
set registration_open = true
where status = 'active'
  and ends_at > clock_timestamp();

create or replace function public.start_game(target_room_id uuid, actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  room_row game_rooms%rowtype;
  team_row teams%rowtype;
  started timestamptz;
begin
  select * into room_row from game_rooms where id = target_room_id for update;
  if not found or not is_room_admin(target_room_id, actor_id) then raise exception 'Forbidden'; end if;
  if room_row.status = 'active' then return jsonb_build_object('started_at', room_row.started_at, 'idempotent', true); end if;
  if room_row.status = 'ended' then raise exception 'Game has ended'; end if;
  if not exists(select 1 from teams where room_id = target_room_id) then raise exception 'At least one team is required'; end if;

  started := clock_timestamp();
  update game_rooms set
    status = 'active',
    registration_open = true,
    started_at = started,
    leaderboard_freezes_at = started + make_interval(secs => leaderboard_visible_seconds),
    ends_at = started + make_interval(secs => game_duration_seconds)
  where id = target_room_id
  returning * into room_row;

  for team_row in select * from teams where room_id = target_room_id loop
    update teams set status = 'searching' where id = team_row.id;
    perform assign_next_clue(team_row.id, true);
  end loop;

  return jsonb_build_object(
    'started_at', room_row.started_at,
    'leaderboard_freezes_at', room_row.leaderboard_freezes_at,
    'ends_at', room_row.ends_at,
    'idempotent', false
  );
end
$$;

revoke execute on function public.start_game(uuid,uuid) from public, anon;
grant execute on function public.start_game(uuid,uuid) to authenticated, service_role;
