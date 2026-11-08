create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_household_member(target_household uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household and hm.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_household_member(uuid) from public, anon;
grant execute on function private.is_household_member(uuid) to authenticated;

drop policy if exists "household members can read households" on public.households;
create policy "household members can read households" on public.households for select to authenticated
using (private.is_household_member(id));
drop policy if exists "household members can read membership" on public.household_members;
create policy "household members can read membership" on public.household_members for select to authenticated
using (private.is_household_member(household_id));
drop policy if exists "household members can read lists" on public.shopping_lists;
create policy "household members can read lists" on public.shopping_lists for select to authenticated
using (private.is_household_member(household_id));
drop policy if exists "household members can create lists" on public.shopping_lists;
create policy "household members can create lists" on public.shopping_lists for insert to authenticated
with check (created_by = (select auth.uid()) and private.is_household_member(household_id));
drop policy if exists "household members can update lists" on public.shopping_lists;
create policy "household members can update lists" on public.shopping_lists for update to authenticated
using (private.is_household_member(household_id)) with check (private.is_household_member(household_id));
drop policy if exists "household members can delete lists" on public.shopping_lists;
create policy "household members can delete lists" on public.shopping_lists for delete to authenticated
using (private.is_household_member(household_id));
drop policy if exists "household members and invitees can read invitations" on public.household_invitations;
create policy "household members and invitees can read invitations" on public.household_invitations for select to authenticated
using (private.is_household_member(household_id) or lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));
drop policy if exists "household members can create invitations" on public.household_invitations;
create policy "household members can create invitations" on public.household_invitations for insert to authenticated
with check (invited_by = (select auth.uid()) and accepted_at is null and private.is_household_member(household_id));

drop function if exists public.is_household_member(uuid);
