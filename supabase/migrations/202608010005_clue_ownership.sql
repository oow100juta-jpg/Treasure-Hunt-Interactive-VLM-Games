alter table public.clues
add column created_by uuid references public.profiles(id) on delete set null;

create index clues_created_by_idx on public.clues(created_by) where created_by is not null;
