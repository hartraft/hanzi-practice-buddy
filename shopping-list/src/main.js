import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { PowerSyncDatabase } from '@powersync/capacitor';
import { supabase, isConfigured, powerSyncUrl } from './lib/supabase.js';
import { AppSchema } from './db/schema.js';
import { SupabasePowerSyncConnector } from './db/connector.js';
import {
  acceptInvitation, createHousehold, findMembership, findPendingInvitations,
  getHouseholdAndList, inviteByEmail
} from './lib/households.js';
import './styles.css';

const root = document.querySelector('#app');
const authRedirect = 'hartraft-shopping://auth/callback';
let currentUser = null;
let currentHousehold = null;
let currentList = null;
let powerSync = null;
let items = [];

function showMessage(message, isError = false) {
  const target = document.querySelector('#toast');
  if (!target) return;
  target.textContent = message;
  target.classList.toggle('error', isError);
  target.hidden = false;
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => { target.hidden = true; }, 3600);
}
function setBusy(value) { document.querySelectorAll('button').forEach(button => { button.disabled = value; }); }
function renderShell(content) {
  root.innerHTML = content;
  const toast = document.createElement('div');
  toast.id = 'toast'; toast.className = 'toast'; toast.hidden = true; root.append(toast);
}
function renderSetupError() {
  renderShell(`<section class="auth-screen"><div class="brand-mark">✓</div><p class="eyebrow">HOUSEHOLD SHOPPING</p><h1>One list.<br>Two phones.</h1><p class="muted">Add your Supabase and PowerSync settings before signing in.</p><div class="setup-card"><strong>Configuration required</strong><p>Set <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> and <code>VITE_POWERSYNC_URL</code> in <code>.env.local</code>, then rebuild.</p></div></section>`);
}
function renderLogin() {
  renderShell(`<section class="auth-screen"><div class="brand-mark">✓</div><p class="eyebrow">HOUSEHOLD SHOPPING</p><h1>One list.<br>Two phones.</h1><p class="muted">Add what you need. Check it off together. Your list stays in sync.</p><button class="google-button" id="google-login"><span class="google-g">G</span> Continue with Google</button><p class="fine-print">Use the Google account you want to share with your household.</p></section>`);
  document.querySelector('#google-login').addEventListener('click', signInWithGoogle);
}
async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirect, skipBrowserRedirect: true, queryParams: { access_type: 'offline', prompt: 'select_account' } }
    });
    if (error) throw error;
    if (!data.url) throw new Error('Google sign-in did not return an authorization URL.');
    if (Capacitor.isNativePlatform()) await Browser.open({ url: data.url });
    else window.location.assign(data.url);
  } catch (error) { showMessage(error.message || 'Could not start Google sign-in.', true); }
}
async function handleAuthUrl(url) {
  try {
    const callback = new URL(url);
    const code = callback.searchParams.get('code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else {
      const accessToken = callback.searchParams.get('access_token');
      const refreshToken = callback.searchParams.get('refresh_token');
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) throw error;
      }
    }
    await Browser.close().catch(() => {});
  } catch (error) { showMessage(error.message || 'Could not complete sign-in.', true); }
}
async function initializePowerSync() {
  if (powerSync) return;
  if (!powerSyncUrl) throw new Error('PowerSync URL is not configured.');
  powerSync = new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: 'household-shopping.sqlite' } });
  await powerSync.connect(new SupabasePowerSyncConnector(supabase, powerSyncUrl));
}
function renderCreateHousehold() {
  renderShell(`<section class="auth-screen"><div class="brand-mark">✓</div><p class="eyebrow">WELCOME</p><h1>Start your<br>household list.</h1><p class="muted">Create a shared space, then invite your partner using their Google account email.</p><button class="primary-button" id="create-household">Create household</button><button class="text-button" id="sign-out">Sign out</button></section>`);
  document.querySelector('#create-household').addEventListener('click', async () => {
    setBusy(true);
    try { const result = await createHousehold(currentUser); await openHousehold(result.household, result.list); }
    catch (error) { showMessage(error.message || 'Could not create household.', true); }
    finally { setBusy(false); }
  });
  document.querySelector('#sign-out').addEventListener('click', signOut);
}
function renderInvitations(invitations) {
  renderShell(`<section class="auth-screen"><div class="brand-mark">✓</div><p class="eyebrow">YOU'RE INVITED</p><h1>Join your<br>household.</h1><p class="muted">A shared shopping list is waiting for <strong>${currentUser.email}</strong>.</p><div id="invitation-options" class="invitation-options"></div><button class="text-button" id="sign-out">Sign out</button></section>`);
  const options = document.querySelector('#invitation-options');
  invitations.forEach(invite => {
    const card = document.createElement('div'); card.className = 'invite-card';
    card.innerHTML = '<strong></strong><span>Shared shopping list</span><button class="primary-button">Accept invitation</button>';
    card.querySelector('strong').textContent = invite.households?.name || 'Your household';
    card.querySelector('button').addEventListener('click', async () => {
      setBusy(true);
      try {
        const householdId = await acceptInvitation(invite.id);
        const result = await getHouseholdAndList(householdId);
        await openHousehold(result.household, result.list);
      } catch (error) { showMessage(error.message || 'Could not accept invitation.', true); }
      finally { setBusy(false); }
    });
    options.append(card);
  });
  document.querySelector('#sign-out').addEventListener('click', signOut);
}
async function openHousehold(household, list) {
  currentHousehold = household; currentList = list;
  await initializePowerSync();
  renderShoppingList();
  startWatchingItems();
}
function renderShoppingList() {
  renderShell(`<header class="topbar"><div class="topbar-brand"><span class="brand-mark small">✓</span><div><strong>Our Shopping List</strong><small id="household-name"></small></div></div><button class="avatar-button" id="sign-out" aria-label="Sign out">↗</button></header>
  <section class="list-page"><div class="list-heading"><div><p class="eyebrow">THE SHARED LIST</p><h1>Shopping</h1></div><span class="sync-pill" id="sync-status"><i></i> Online</span></div>
  <div class="progress-card"><div class="progress-copy"><strong id="progress-count">0 of 0 bought</strong><span id="progress-percent">0%</span></div><div class="progress-track"><div id="progress-fill"></div></div></div>
  <form id="add-form" class="add-form"><label class="sr-only" for="item-name">Add an item</label><input id="item-name" autocomplete="off" placeholder="Add an item…" maxlength="120" required /><input id="item-quantity" class="quantity-input" autocomplete="off" placeholder="Qty" maxlength="40" aria-label="Quantity (optional)" /><button class="add-button" type="submit" aria-label="Add item">+</button></form>
  <div class="section-heading"><h2>To buy</h2><span id="remaining-count">0</span></div><div id="active-items" class="items-list"></div>
  <div class="section-heading bought-heading"><h2>Bought</h2><span id="bought-count">0</span></div><div id="bought-items" class="items-list bought-list"></div>
  <section class="share-card"><div class="share-icon">↗</div><div class="share-copy"><strong>Shop together</strong><p>Invite your partner to use the same live list.</p></div><button class="outline-button" id="show-invite">Invite</button></section>
  <form id="invite-form" class="invite-form" hidden><label for="invite-email">Partner's Google account email</label><div class="invite-fields"><input id="invite-email" type="email" placeholder="partner@gmail.com" required /><button class="primary-button" type="submit">Send invite</button></div><p class="hint">They can sign in with this Google account and accept the invitation in the app.</p></form></section>
  <footer class="footer-note">Changes sync across your household devices automatically.</footer>`);
  document.querySelector('#household-name').textContent = currentHousehold.name;
  document.querySelector('#sign-out').addEventListener('click', signOut);
  document.querySelector('#add-form').addEventListener('submit', addItem);
  document.querySelector('#show-invite').addEventListener('click', () => {
    const form = document.querySelector('#invite-form'); form.hidden = !form.hidden;
    if (!form.hidden) document.querySelector('#invite-email').focus();
  });
  document.querySelector('#invite-form').addEventListener('submit', sendInvite);
  updateOnlineStatus();
}
async function startWatchingItems() {
  if (!powerSync || !currentList) return;
  const sql = `SELECT shopping_items.*, COALESCE(household_members.display_name, 'Household member') AS checked_by_name
    FROM shopping_items LEFT JOIN household_members
      ON household_members.user_id = shopping_items.checked_by AND household_members.household_id = ?
    WHERE shopping_items.list_id = ?
    ORDER BY shopping_items.is_checked ASC, shopping_items.position ASC, shopping_items.created_at ASC`;
  try {
    for await (const result of powerSync.watch(sql, [currentHousehold.id, currentList.id])) {
      items = result.rows?._array || []; renderItems();
    }
  } catch (error) {
    console.error(error); showMessage('Live list updates are temporarily unavailable.', true);
  }
}
function createItemRow(item) {
  const row = document.createElement('article'); row.className = `item-row${item.is_checked ? ' is-checked' : ''}`;
  const checkbox = document.createElement('button'); checkbox.className = 'item-check'; checkbox.type = 'button';
  checkbox.setAttribute('aria-label', item.is_checked ? `Uncheck ${item.name}` : `Check off ${item.name}`);
  checkbox.textContent = item.is_checked ? '✓' : ''; checkbox.addEventListener('click', () => toggleItem(item));
  const copy = document.createElement('div'); copy.className = 'item-copy';
  const name = document.createElement('strong'); name.textContent = item.name; copy.append(name);
  if (item.quantity || (item.is_checked && item.checked_by_name)) {
    const meta = document.createElement('span');
    meta.textContent = item.is_checked ? `Bought by ${item.checked_by_name || 'household member'}` : item.quantity;
    copy.append(meta);
  }
  const remove = document.createElement('button'); remove.className = 'remove-item'; remove.type = 'button';
  remove.setAttribute('aria-label', `Remove ${item.name}`); remove.textContent = '×'; remove.addEventListener('click', () => removeItem(item));
  row.append(checkbox, copy, remove); return row;
}
function renderItems() {
  const active = items.filter(item => !item.is_checked);
  const bought = items.filter(item => item.is_checked);
  document.querySelector('#active-items').replaceChildren(...active.map(createItemRow));
  document.querySelector('#bought-items').replaceChildren(...bought.map(createItemRow));
  document.querySelector('#remaining-count').textContent = active.length;
  document.querySelector('#bought-count').textContent = bought.length;
  const total = items.length; const percent = total ? Math.round(bought.length / total * 100) : 0;
  document.querySelector('#progress-count').textContent = `${bought.length} of ${total} bought`;
  document.querySelector('#progress-percent').textContent = `${percent}%`;
  document.querySelector('#progress-fill').style.width = `${percent}%`;
  if (!active.length) {
    const empty = document.createElement('p'); empty.className = 'empty-state';
    empty.textContent = total ? 'Everything is in the basket. Nice work!' : 'Your list is empty. Add your first item above.';
    document.querySelector('#active-items').append(empty);
  }
}
async function addItem(event) {
  event.preventDefault();
  const nameInput = document.querySelector('#item-name'); const quantityInput = document.querySelector('#item-quantity');
  const name = nameInput.value.trim(); if (!name) return;
  const now = new Date().toISOString();
  try {
    await powerSync.execute(`INSERT INTO shopping_items
      (id, list_id, name, quantity, notes, is_checked, checked_by, checked_at, created_by, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, 0, NULL, NULL, ?, ?, ?, ?)`,
      [crypto.randomUUID(), currentList.id, name, quantityInput.value.trim() || null, currentUser.id, items.length, now, now]);
    nameInput.value = ''; quantityInput.value = ''; nameInput.focus();
  } catch (error) { showMessage(error.message || 'Could not add item.', true); }
}
async function toggleItem(item) {
  const checked = !item.is_checked; const now = new Date().toISOString();
  try {
    await powerSync.execute('UPDATE shopping_items SET is_checked = ?, checked_by = ?, checked_at = ?, updated_at = ? WHERE id = ?',
      [checked ? 1 : 0, checked ? currentUser.id : null, checked ? now : null, now, item.id]);
  } catch (error) { showMessage(error.message || 'Could not update item.', true); }
}
async function removeItem(item) {
  try { await powerSync.execute('DELETE FROM shopping_items WHERE id = ?', [item.id]); }
  catch (error) { showMessage(error.message || 'Could not remove item.', true); }
}
async function sendInvite(event) {
  event.preventDefault(); const emailInput = document.querySelector('#invite-email');
  try {
    await inviteByEmail(currentHousehold.id, currentUser.id, emailInput.value);
    emailInput.value = ''; showMessage('Invitation saved. Ask your partner to sign in and accept it.');
  } catch (error) { showMessage(error.message || 'Could not create invitation.', true); }
}
function updateOnlineStatus() {
  const status = document.querySelector('#sync-status'); if (!status) return;
  const online = navigator.onLine; status.classList.toggle('offline', !online);
  status.innerHTML = `<i></i>${online ? 'Online · syncing' : 'Offline · saved here'}`;
}
async function signOut() {
  try {
    if (powerSync) { await powerSync.disconnectAndClear(); powerSync = null; }
    await supabase.auth.signOut();
    currentUser = null; currentHousehold = null; currentList = null; renderLogin();
  } catch (error) { showMessage(error.message || 'Could not sign out.', true); }
}
async function boot(session) {
  if (!session?.user) { currentUser = null; renderLogin(); return; }
  currentUser = session.user;
  try {
    const membership = await findMembership(currentUser.id);
    if (membership) {
      const result = await getHouseholdAndList(membership.household_id);
      await openHousehold(result.household, result.list); return;
    }
    const invitations = await findPendingInvitations(currentUser.email);
    if (invitations.length) { renderInvitations(invitations); return; }
    renderCreateHousehold();
  } catch (error) {
    console.error(error); showMessage(error.message || 'Could not load your household.', true); renderCreateHousehold();
  }
}
async function start() {
  if (!isConfigured || !powerSyncUrl) { renderSetupError(); return; }
  if (Capacitor.isNativePlatform()) {
    App.addListener('appUrlOpen', ({ url }) => handleAuthUrl(url));
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) supabase.auth.getSession().then(({ data }) => boot(data.session));
    });
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  supabase.auth.onAuthStateChange((_event, session) => queueMicrotask(() => boot(session)));
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  await boot(data.session);
}
start().catch(error => {
  console.error(error);
  renderShell(`<section class="auth-screen"><h1>Something went wrong</h1><p class="muted">${String(error.message || error)}</p><button class="primary-button" onclick="location.reload()">Try again</button></section>`);
});
