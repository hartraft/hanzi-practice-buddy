-- Additive household shopping schema. Existing vocabulary_* tables are untouched.
create table if not exists public.households (
  id uuid primary key, name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now()
);
create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Household member', joined_at timestamptz not null default now(),
  constraint household_members_household_user_key unique (household_id, user_id)
);
create table if not exists public.shopping_lists (
  id uuid primary key, household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.shopping_items (
  id uuid primary key, list_id uuid not null references public.shopping_lists(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120), quantity text, notes text,
  is_checked integer not null default 0 check (is_checked in (0, 1)),
  checked_by uuid references auth.users(id) on delete set null, checked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.household_invitations (
  id uuid primary key, household_id uuid not null references public.households(id) on delete cascade,
  invitee_email text not null check (length(trim(invitee_email)) between 3 and 320),
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null, accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'), created_at timestamptz not null default now()
);
create index if not exists household_members_user_idx on public.household_members(user_id);
create index if not exists household_members_household_idx on public.household_members(household_id);
create index if not exists shopping_lists_household_idx on public.shopping_lists(household_id);
create index if not exists shopping_items_list_position_idx on public.shopping_items(list_id, position);
create index if not exists household_invitations_email_idx on public.household_invitations(lower(invitee_email));

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_household_member(target_household uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.household_members hm
    where hm.household_id = target_household and hm.user_id = (select auth.uid()));
$$;
revoke all on function private.is_household_member(uuid) from public, anon;
grant execute on function private.is_household_member(uuid) to authenticated;

create or replace function public.add_household_creator()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare member_name text;
begin
  select coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''), nullif(u.email, ''), 'Household member')
  into member_name from auth.users u where u.id = new.created_by;
  insert into public.household_members (household_id, user_id, display_name)
  values (new.id, new.created_by, coalesce(member_name, 'Household member'))
  on conflict (household_id, user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.add_household_creator() from public, anon, authenticated;
drop trigger if exists households_add_creator on public.households;
create trigger households_add_creator after insert on public.households
for each row execute function public.add_household_creator();

-- Replace the invitation RPC with SECURITY INVOKER. The row policies and
-- column-level grants constrain exactly which invitation can be accepted.
create or replace function public.accept_household_invitation(invitation_uuid uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  target_household uuid;
  member_name text := coalesce(
    nullif((select auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    nullif((select auth.jwt() -> 'user_metadata' ->> 'name'), ''),
    'Household member'
  );
begin
  if current_user_id is null or current_email = '' then
    raise exception 'A signed-in account with an email address is required';
  end if;

  update public.household_invitations
  set accepted_by = current_user_id, accepted_at = now()
  where id = invitation_uuid
    and lower(invitee_email) = current_email
    and accepted_at is null
    and expires_at > now()
  returning household_id into target_household;

  if target_household is null then
    raise exception 'Invitation not found, expired, or addressed to another account';
  end if;

  insert into public.household_members (household_id, user_id, display_name)
  values (target_household, current_user_id, member_name)
  on conflict (household_id, user_id) do nothing;

  return target_household;
end;
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;
alter table public.household_invitations enable row level security;

drop policy if exists "household members can read households" on public.households;
create policy "household members can read households" on public.households for select to authenticated using (private.is_household_member(id));
drop policy if exists "users can create their own household" on public.households;
create policy "users can create their own household" on public.households for insert to authenticated with check (created_by = (select auth.uid()));

drop policy if exists "household members can read membership" on public.household_members;
create policy "household members can read membership" on public.household_members for select to authenticated using (private.is_household_member(household_id));

drop policy if exists "household members can read lists" on public.shopping_lists;
create policy "household members can read lists" on public.shopping_lists for select to authenticated using (private.is_household_member(household_id));
drop policy if exists "household members can create lists" on public.shopping_lists;
create policy "household members can create lists" on public.shopping_lists for insert to authenticated with check (created_by = (select auth.uid()) and private.is_household_member(household_id));
drop policy if exists "household members can update lists" on public.shopping_lists;
create policy "household members can update lists" on public.shopping_lists for update to authenticated using (private.is_household_member(household_id)) with check (private.is_household_member(household_id));
drop policy if exists "household members can delete lists" on public.shopping_lists;
create policy "household members can delete lists" on public.shopping_lists for delete to authenticated using (private.is_household_member(household_id));

drop policy if exists "household members can read shopping items" on public.shopping_items;
create policy "household members can read shopping items" on public.shopping_items for select to authenticated
using (exists (select 1 from public.shopping_lists sl where sl.id = shopping_items.list_id and private.is_household_member(sl.household_id)));
drop policy if exists "household members can add shopping items" on public.shopping_items;
create policy "household members can add shopping items" on public.shopping_items for insert to authenticated
with check (created_by = (select auth.uid()) and exists (select 1 from public.shopping_lists sl where sl.id = shopping_items.list_id and private.is_household_member(sl.household_id)));
drop policy if exists "household members can update shopping items" on public.shopping_items;
create policy "household members can update shopping items" on public.shopping_items for update to authenticated
using (exists (select 1 from public.shopping_lists sl where sl.id = shopping_items.list_id and private.is_household_member(sl.household_id)))
with check (exists (select 1 from public.shopping_lists sl where sl.id = shopping_items.list_id and private.is_household_member(sl.household_id)));
drop policy if exists "household members can delete shopping items" on public.shopping_items;
create policy "household members can delete shopping items" on public.shopping_items for delete to authenticated
using (exists (select 1 from public.shopping_lists sl where sl.id = shopping_items.list_id and private.is_household_member(sl.household_id)));

drop policy if exists "household members and invitees can read invitations" on public.household_invitations;
create policy "household members and invitees can read invitations" on public.household_invitations for select to authenticated
using (private.is_household_member(household_id) or lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));
drop policy if exists "household members can create invitations" on public.household_invitations;
create policy "household members can create invitations" on public.household_invitations for insert to authenticated
with check (invited_by = (select auth.uid()) and accepted_at is null and private.is_household_member(household_id));

drop policy if exists "invitees can accept their own invitation" on public.household_invitations;
create policy "invitees can accept their own invitation" on public.household_invitations for update to authenticated
using (lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')) and accepted_at is null and expires_at > now())
with check (lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')) and accepted_by = (select auth.uid()) and accepted_at is not null);

drop policy if exists "invited users can join their household" on public.household_members;
create policy "invited users can join their household" on public.household_members for insert to authenticated
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.household_invitations hi where hi.household_id = household_members.household_id
  and lower(hi.invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  and hi.accepted_by = (select auth.uid()) and hi.accepted_at is not null
));

grant select, insert, update, delete on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, insert, update, delete on public.shopping_lists to authenticated;
grant select, insert, update, delete on public.shopping_items to authenticated;
grant select, insert on public.household_invitations to authenticated;
grant insert on public.household_members to authenticated;
grant update (accepted_by, accepted_at) on public.household_invitations to authenticated;
grant all on public.households, public.household_members, public.shopping_lists, public.shopping_items, public.household_invitations to service_role;

-- Keep the PowerSync publication separate from Supabase Realtime.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'powersync') then
    execute 'create publication powersync for table public.households, public.household_members, public.shopping_lists, public.shopping_items';
  else
    if not exists (select 1 from pg_publication_tables where pubname = 'powersync' and schemaname = 'public' and tablename = 'households') then
      execute 'alter publication powersync add table public.households';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'powersync' and schemaname = 'public' and tablename = 'household_members') then
      execute 'alter publication powersync add table public.household_members';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'powersync' and schemaname = 'public' and tablename = 'shopping_lists') then
      execute 'alter publication powersync add table public.shopping_lists';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'powersync' and schemaname = 'public' and tablename = 'shopping_items') then
      execute 'alter publication powersync add table public.shopping_items';
    end if;
  end if;
end $$;
