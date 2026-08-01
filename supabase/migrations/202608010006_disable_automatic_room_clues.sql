-- New rooms start with an empty clue pool. Admins explicitly choose shared
-- clues or create room-specific clues from the room dashboard.
drop trigger if exists populate_new_room_clues on public.game_rooms;
drop function if exists public.populate_new_room_clues();

-- Detach seed/library clues that the old trigger automatically added to
-- existing rooms. The clues remain in the shared library and can be selected
-- manually; administrator-created clues stay attached to their rooms.
delete from public.room_clues as room_clue
using public.clues as clue
where room_clue.clue_id = clue.id
  and clue.created_by is null;
