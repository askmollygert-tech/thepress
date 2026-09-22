alter table public.rounds add column if not exists scorer_user_id uuid references auth.users(id) on delete set null;

alter table public.rounds drop constraint if exists rounds_status_check;
alter table public.rounds add constraint rounds_status_check
  check (status in ('scheduled','active','complete','cancelled','abandoned'));

create unique index if not exists only_one_active_press_round
  on public.rounds ((status)) where status = 'active';

create or replace function public.is_round_scorer(check_round_id uuid, check_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rounds
    where id = check_round_id and scorer_user_id = check_user_id and status = 'active'
  );
$$;

drop policy if exists "participants enter scores" on public.scores;
create policy "active scorer enters scores" on public.scores for all to authenticated
using (public.is_round_scorer(round_id, auth.uid()))
with check (entered_by = auth.uid() and public.is_round_scorer(round_id, auth.uid()));

create or replace function public.take_over_scoring(target_round_id uuid)
returns public.rounds language plpgsql security definer set search_path = public as $$
declare changed public.rounds;
begin
  if not public.is_round_participant(target_round_id, auth.uid()) then
    raise exception 'Only a player in this round may take over scoring.';
  end if;
  update public.rounds set scorer_user_id = auth.uid(), updated_at = now()
  where id = target_round_id and status = 'active' returning * into changed;
  if changed.id is null then raise exception 'This round is no longer active.'; end if;
  return changed;
end; $$;

create or replace function public.close_press_round(target_round_id uuid, final_status text)
returns public.rounds language plpgsql security definer set search_path = public as $$
declare changed public.rounds;
begin
  if final_status not in ('complete','abandoned') then raise exception 'Invalid final status.'; end if;
  if not (public.is_round_scorer(target_round_id, auth.uid()) or public.is_round_creator(target_round_id, auth.uid())) then
    raise exception 'Only the scorer or round creator may close this round.';
  end if;
  update public.rounds set status = final_status, updated_at = now()
  where id = target_round_id and status = 'active' returning * into changed;
  return changed;
end; $$;

grant execute on function public.take_over_scoring(uuid) to authenticated;
grant execute on function public.close_press_round(uuid,text) to authenticated;
