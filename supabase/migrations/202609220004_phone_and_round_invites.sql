alter table public.profiles add column if not exists phone_number text;
alter table public.round_players add column if not exists invite_token uuid not null default gen_random_uuid();
create unique index if not exists round_players_invite_token_unique on public.round_players(invite_token);

create table if not exists public.round_guest_invites (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  invited_name text not null,
  phone_number text,
  team text not null default 'INDIVIDUAL' check (team in ('A','B','INDIVIDUAL')),
  playing_handicap integer not null default 0 check (playing_handicap between -10 and 54),
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  claimed_profile_id uuid references public.profiles(id) on delete set null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.round_guest_invites enable row level security;
create policy "round creators manage guest invites" on public.round_guest_invites for all to authenticated
using (public.is_round_creator(round_id, auth.uid()))
with check (public.is_round_creator(round_id, auth.uid()) and invited_by = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner_account boolean := lower(new.email) = 'gertm@gsdevelopments.co.za';
begin
  update public.profiles set auth_user_id = new.id, is_guest = false,
    display_name = coalesce(nullif(new.raw_user_meta_data->>'display_name',''), display_name),
    phone_number = coalesce(nullif(new.raw_user_meta_data->>'phone_number',''), phone_number),
    membership_status = case when owner_account then 'approved' else 'pending' end,
    is_admin = owner_account, updated_at = now()
  where lower(email) = lower(new.email) and auth_user_id is null;
  if not found then
    insert into public.profiles(auth_user_id,email,display_name,phone_number,is_guest,membership_status,is_admin)
    values(new.id,new.email,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),split_part(new.email,'@',1)),nullif(new.raw_user_meta_data->>'phone_number',''),false,case when owner_account then 'approved' else 'pending' end,owner_account);
  end if;
  return new;
end; $$;

create or replace function public.respond_to_round_invite(invitation_token uuid, response text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me public.profiles; rp public.round_players; gi public.round_guest_invites;
begin
  if response not in ('accepted','declined') then raise exception 'Invalid response.'; end if;
  select * into me from public.profiles where auth_user_id = auth.uid() and membership_status = 'approved';
  if me.id is null then raise exception 'Your profile must be approved first.'; end if;
  select * into rp from public.round_players where invite_token = invitation_token and profile_id = me.id;
  if rp.id is not null then
    update public.round_players set invitation_status = response where id = rp.id;
    return rp.round_id;
  end if;
  select * into gi from public.round_guest_invites where token = invitation_token and status = 'pending';
  if gi.id is null then raise exception 'Invitation not found or already answered.'; end if;
  update public.round_guest_invites set status = response, claimed_profile_id = me.id where id = gi.id;
  if response = 'accepted' then
    insert into public.round_players(round_id,profile_id,team,playing_handicap,invitation_status)
    values(gi.round_id,me.id,gi.team,gi.playing_handicap,'accepted') on conflict (round_id,profile_id) do update set invitation_status='accepted';
  end if;
  return gi.round_id;
end; $$;
grant execute on function public.respond_to_round_invite(uuid,text) to authenticated;
