import { supabase } from './supabase.js';

export async function findMembership(userId) {
  const { data, error } = await supabase.from('household_members').select('household_id').eq('user_id', userId).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findPendingInvitations(email) {
  if (!email) return [];
  const { data, error } = await supabase.from('household_invitations')
    .select('id, household_id, invitee_email, households(name)')
    .eq('invitee_email', email.toLowerCase()).is('accepted_at', null).gt('expires_at', new Date().toISOString());
  if (error) throw error;
  return data || [];
}

export async function getHouseholdAndList(householdId) {
  const [householdResult, listResult] = await Promise.all([
    supabase.from('households').select('id, name').eq('id', householdId).single(),
    supabase.from('shopping_lists').select('id, name').eq('household_id', householdId).order('created_at').limit(1).maybeSingle()
  ]);
  if (householdResult.error) throw householdResult.error;
  if (listResult.error) throw listResult.error;
  let list = listResult.data;
  if (!list) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const { data, error } = await supabase.from('shopping_lists').insert({
      id: crypto.randomUUID(), household_id: householdId, name: 'Shopping list', created_by: authData.user.id
    }).select('id, name').single();
    if (error) throw error;
    list = data;
  }
  return { household: householdResult.data, list };
}

export async function createHousehold(user) {
  const householdId = crypto.randomUUID();
  const { error: householdError } = await supabase.from('households').insert({
    id: householdId, name: 'Our household', created_by: user.id
  });
  if (householdError) throw householdError;
  const { data: list, error: listError } = await supabase.from('shopping_lists').insert({
    id: crypto.randomUUID(), household_id: householdId, name: 'Shopping list', created_by: user.id
  }).select('id, name').single();
  if (listError) throw listError;
  const { data: household, error: fetchError } = await supabase.from('households').select('id, name').eq('id', householdId).single();
  if (fetchError) throw fetchError;
  return { household, list };
}

export async function acceptInvitation(invitationId) {
  const { data, error } = await supabase.rpc('accept_household_invitation', { invitation_uuid: invitationId });
  if (error) throw error;
  return data;
}

export async function inviteByEmail(householdId, userId, email) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) throw new Error('Enter a valid Google account email address.');
  const { error } = await supabase.from('household_invitations').insert({
    id: crypto.randomUUID(), household_id: householdId, invitee_email: normalizedEmail, invited_by: userId
  });
  if (error) throw error;
}
