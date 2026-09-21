create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text,
  display_name text not null,
  nickname text,
  avatar_url text,
  preferred_playing_handicap integer check (preferred_playing_handicap between -10 and 54),
  is_guest boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_unique on public.profiles (lower(email)) where email is not null;
create index profiles_auth_user_id_idx on public.profiles(auth_user_id);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  tee_name text,
  par integer check (par between 27 and 90),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.course_holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 36),
  par integer not null check (par between 3 and 6),
  stroke_index integer not null check (stroke_index between 1 and 36),
  unique(course_id, hole_number)
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  title text,
  course_id uuid references public.courses(id) on delete set null,
  course_name text not null,
  scheduled_at timestamptz,
  holes integer not null default 18 check (holes in (9,18)),
  starting_hole integer not null default 1 check (starting_hole between 1 and 18),
  format text not null check (format in ('betterball_match','fourball_match','betterball_stableford','individual_stableford','combined_stableford','stroke_play','skins')),
  status text not null default 'scheduled' check (status in ('scheduled','active','complete','cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rounds_created_by_idx on public.rounds(created_by);
create index rounds_scheduled_at_idx on public.rounds(scheduled_at);

create table public.round_players (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  team text not null check (team in ('A','B','INDIVIDUAL')),
  playing_handicap integer not null check (playing_handicap between -10 and 54),
  invitation_status text not null default 'pending' check (invitation_status in ('pending','accepted','declined','guest')),
  unique(round_id, profile_id)
);

create index round_players_profile_id_idx on public.round_players(profile_id);
create index round_players_round_id_idx on public.round_players(round_id);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  hole_number integer not null check (hole_number between 1 and 18),
  gross_score integer not null check (gross_score between 1 and 20),
  entered_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique(round_id, profile_id, hole_number)
);

create index scores_round_hole_idx on public.scores(round_id, hole_number);

create table public.presses (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  called_by_team text not null check (called_by_team in ('A','B')),
  start_hole integer not null check (start_hole between 1 and 18),
  status text not null default 'active' check (status in ('active','complete','cancelled')),
  winning_team text check (winning_team in ('A','B','HALVED')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index presses_round_id_idx on public.presses(round_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references public.rounds(id) on delete cascade,
  email text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  token uuid not null default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  unique(round_id, email)
);

create unique index invitations_token_idx on public.invitations(token);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set
    auth_user_id = new.id,
    is_guest = false,
    display_name = coalesce(nullif(new.raw_user_meta_data->>'display_name',''), display_name),
    updated_at = now()
  where lower(email) = lower(new.email) and auth_user_id is null;

  if not found then
    insert into public.profiles(auth_user_id,email,display_name,is_guest)
    values(new.id,new.email,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),split_part(new.email,'@',1)),false);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_holes enable row level security;
alter table public.rounds enable row level security;
alter table public.round_players enable row level security;
alter table public.scores enable row level security;
alter table public.presses enable row level security;
alter table public.invitations enable row level security;

create policy "authenticated golfers read profiles" on public.profiles for select to authenticated using (true);
create policy "golfers update own profile" on public.profiles for update to authenticated using (auth.uid() = auth_user_id) with check (auth.uid() = auth_user_id);
create policy "golfers create guests" on public.profiles for insert to authenticated with check (auth.uid() = created_by or auth.uid() = auth_user_id);
create policy "authenticated golfers read courses" on public.courses for select to authenticated using (true);
create policy "authenticated golfers create courses" on public.courses for insert to authenticated with check (auth.uid() = created_by);
create policy "authenticated golfers read holes" on public.course_holes for select to authenticated using (true);

create or replace function public.is_round_participant(check_round_id uuid, check_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rounds r where r.id = check_round_id and r.created_by = check_user_id
  ) or exists (
    select 1 from public.round_players rp join public.profiles p on p.id = rp.profile_id
    where rp.round_id = check_round_id and p.auth_user_id = check_user_id
  );
$$;

create or replace function public.is_round_creator(check_round_id uuid, check_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.rounds r where r.id = check_round_id and r.created_by = check_user_id);
$$;

revoke all on function public.is_round_participant(uuid,uuid) from public;
revoke all on function public.is_round_creator(uuid,uuid) from public;
grant execute on function public.is_round_participant(uuid,uuid) to authenticated;
grant execute on function public.is_round_creator(uuid,uuid) to authenticated;

create policy "participants read rounds" on public.rounds for select to authenticated using (public.is_round_participant(id, auth.uid()));
create policy "golfers create rounds" on public.rounds for insert to authenticated with check (created_by = auth.uid());
create policy "round creators update rounds" on public.rounds for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "participants read round players" on public.round_players for select to authenticated using (public.is_round_participant(round_id, auth.uid()));
create policy "round creators manage players" on public.round_players for all to authenticated using (public.is_round_creator(round_id, auth.uid())) with check (public.is_round_creator(round_id, auth.uid()));

create policy "participants read scores" on public.scores for select to authenticated using (public.is_round_participant(round_id, auth.uid()));
create policy "participants enter scores" on public.scores for all to authenticated using (public.is_round_participant(round_id, auth.uid())) with check (entered_by = auth.uid() and public.is_round_participant(round_id, auth.uid()));

create policy "participants read presses" on public.presses for select to authenticated using (public.is_round_participant(round_id, auth.uid()));
create policy "participants create presses" on public.presses for insert to authenticated with check (created_by = auth.uid() and public.is_round_participant(round_id, auth.uid()));

create policy "golfers read their invitations" on public.invitations for select to authenticated using (
  invited_by = auth.uid() or lower(email) = lower(coalesce(auth.jwt()->>'email',''))
);
create policy "round creators send invitations" on public.invitations for insert to authenticated with check (
  invited_by = auth.uid() and (round_id is null or exists (select 1 from public.rounds r where r.id=round_id and r.created_by=auth.uid()))
);

alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.round_players;
alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.presses;
