create table public.room_clues (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  clue_id uuid not null references public.clues(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (room_id, clue_id)
);

alter table public.room_clues enable row level security;

create policy "admins room clue pool read" on public.room_clues
  for select to authenticated
  using (public.is_room_admin(room_id, auth.uid()));

create policy "admins room clue pool add" on public.room_clues
  for insert to authenticated
  with check (public.is_room_admin(room_id, auth.uid()));

create policy "admins room clue pool remove" on public.room_clues
  for delete to authenticated
  using (public.is_room_admin(room_id, auth.uid()));

grant select, insert, delete on table public.room_clues to authenticated;
grant all on table public.room_clues to service_role;

insert into public.room_clues(room_id, clue_id)
select room.id, clue.id
from public.game_rooms room
cross join public.clues clue
where clue.is_active
on conflict do nothing;

create or replace function public.populate_new_room_clues()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into room_clues(room_id, clue_id)
  select new.id, clue.id from clues clue where clue.is_active
  on conflict do nothing;
  return new;
end
$$;

create trigger populate_new_room_clues
after insert on public.game_rooms
for each row execute function public.populate_new_room_clues();

revoke execute on function public.populate_new_room_clues() from public, anon, authenticated;

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
  from room_clues room_clue
  join clues c on c.id = room_clue.clue_id
  where room_clue.room_id = room_row.id
    and c.is_active
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
end
$$;

revoke execute on function public.assign_next_clue(uuid,boolean) from public, anon, authenticated;
grant execute on function public.assign_next_clue(uuid,boolean) to service_role;
