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

drop policy if exists "invitees can accept their own invitation" on public.household_invitations;
create policy "invitees can accept their own invitation"
on public.household_invitations for update to authenticated
using (
  lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  and accepted_at is null
  and expires_at > now()
)
with check (
  lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  and accepted_by = (select auth.uid())
  and accepted_at is not null
);

drop policy if exists "invited users can join their household" on public.household_members;
create policy "invited users can join their household"
on public.household_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.household_invitations hi
    where hi.household_id = household_members.household_id
      and lower(hi.invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      and hi.accepted_by = (select auth.uid())
      and hi.accepted_at is not null
  )
);

revoke all on function public.accept_household_invitation(uuid) from public, anon;
grant execute on function public.accept_household_invitation(uuid) to authenticated;
grant insert on public.household_members to authenticated;
grant update (accepted_by, accepted_at) on public.household_invitations to authenticated;
