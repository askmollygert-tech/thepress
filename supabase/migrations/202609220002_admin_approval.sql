alter table public.profiles
  add column if not exists membership_status text not null default 'pending'
    check (membership_status in ('pending', 'approved', 'declined'));

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- The owner is approved automatically. Change this address here if ownership changes.
update public.profiles
set membership_status = 'approved', is_admin = true, updated_at = now()
where lower(email) = 'gertm@gsdevelopments.co.za';

update public.profiles
set membership_status = 'approved'
where is_guest = true;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner_account boolean := lower(new.email) = 'gertm@gsdevelopments.co.za';
begin
  update public.profiles set
    auth_user_id = new.id,
    is_guest = false,
    display_name = coalesce(nullif(new.raw_user_meta_data->>'display_name',''), display_name),
    membership_status = case when owner_account then 'approved' else 'pending' end,
    is_admin = owner_account,
    updated_at = now()
  where lower(email) = lower(new.email) and auth_user_id is null;

  if not found then
    insert into public.profiles(
      auth_user_id, email, display_name, is_guest, membership_status, is_admin
    ) values (
      new.id,
      new.email,
      coalesce(nullif(new.raw_user_meta_data->>'display_name',''),split_part(new.email,'@',1)),
      false,
      case when owner_account then 'approved' else 'pending' end,
      owner_account
    );
  end if;
  return new;
end;
$$;

create or replace function public.is_press_admin(check_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = check_user_id and is_admin = true
  );
$$;

drop policy if exists "authenticated golfers read profiles" on public.profiles;
create policy "approved golfers read approved profiles" on public.profiles
for select to authenticated using (
  auth.uid() = auth_user_id
  or public.is_press_admin(auth.uid())
  or membership_status = 'approved'
);

create or replace function public.approve_golfer(profile_to_approve uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare approved_profile public.profiles;
begin
  if not public.is_press_admin(auth.uid()) then
    raise exception 'Only The Press admin may approve golfers.';
  end if;

  update public.profiles
  set membership_status = 'approved', updated_at = now()
  where id = profile_to_approve and is_guest = false
  returning * into approved_profile;

  if approved_profile.id is null then
    raise exception 'Golfer application not found.';
  end if;
  return approved_profile;
end;
$$;

grant execute on function public.approve_golfer(uuid) to authenticated;
