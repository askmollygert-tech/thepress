alter table public.profiles add column if not exists home_club text;
alter table public.profiles add column if not exists fun_answer text;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique(requester_id, addressee_id)
);

alter table public.friendships enable row level security;

create policy "golfers read own friendships" on public.friendships for select to authenticated using (
  exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.id in (requester_id, addressee_id))
);
create policy "golfers send friend requests" on public.friendships for insert to authenticated with check (
  exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.id = requester_id)
);
create policy "golfers answer friend requests" on public.friendships for update to authenticated using (
  exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.id = addressee_id)
) with check (
  exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.id = addressee_id)
);
create policy "golfers remove own friendships" on public.friendships for delete to authenticated using (
  exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.id in (requester_id, addressee_id))
);

create index if not exists friendships_requester_idx on public.friendships(requester_id);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id);
