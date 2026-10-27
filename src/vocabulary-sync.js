import { PowerSyncDatabase } from '@powersync/capacitor';
import { column, Schema, Table } from '@powersync/web';
import { createClient } from '@supabase/supabase-js';

const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  powerSyncUrl: import.meta.env.VITE_POWERSYNC_URL || ''
};

const schema = new Schema({
  vocabulary_lists: new Table({
    user_id: column.text,
    name: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text
  }),
  vocabulary_items: new Table({
    user_id: column.text,
    list_id: column.text,
    word: column.text,
    position: column.integer,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text
  })
});

let supabase = null;
let database = null;
let currentUser = null;
let onListsChanged = () => {};
let onStatusChanged = () => {};
let connectionPromise = null;
let watcherStarted = false;

function setStatus(status, detail = '') {
  onStatusChanged({ status, detail, configured: Boolean(supabase && database && config.powerSyncUrl), signedIn: Boolean(currentUser) });
}

class SupabasePowerSyncConnector {
  async fetchCredentials() {
    if (!supabase || !config.powerSyncUrl) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) return null;
    return { endpoint: config.powerSyncUrl, token: data.session.access_token };
  }

  async uploadData(db) {
    if (!supabase) return;
    const transaction = await db.getNextCrudTransaction();
    if (!transaction) return;

    for (const operation of transaction.crud) {
      const table = operation.table;
      if (!['vocabulary_lists', 'vocabulary_items'].includes(table)) {
        throw new Error(`Unexpected PowerSync table: ${table}`);
      }
      let result;
      if (operation.op === 'PUT') {
        result = await supabase.from(table).upsert({ id: operation.id, ...(operation.opData || {}) });
      } else if (operation.op === 'PATCH') {
        result = await supabase.from(table).update(operation.opData || {}).eq('id', operation.id);
      } else if (operation.op === 'DELETE') {
        // The app uses tombstones for normal deletes. This is a defensive fallback
        // for a locally removed row; the server's RLS still enforces ownership.
        result = await supabase.from(table).delete().eq('id', operation.id);
      } else {
        throw new Error(`Unsupported PowerSync operation: ${operation.op}`);
      }
      if (result.error) throw result.error;
    }
    await transaction.complete();
  }
}

export function syncConfiguration() {
  return {
    configured: Boolean(config.supabaseUrl && config.supabaseKey && config.powerSyncUrl),
    missing: [
      !config.supabaseUrl && 'VITE_SUPABASE_URL',
      !config.supabaseKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
      !config.powerSyncUrl && 'VITE_POWERSYNC_URL'
    ].filter(Boolean)
  };
}

export async function initVocabularySync(options = {}) {
  onListsChanged = options.onListsChanged || (() => {});
  onStatusChanged = options.onStatusChanged || (() => {});
  if (!config.supabaseUrl || !config.supabaseKey || !config.powerSyncUrl) {
    setStatus('local-only', 'Add Supabase and PowerSync client configuration to enable cloud sync.');
    return { configured: false };
  }

  supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  database = new PowerSyncDatabase({
    schema,
    database: { dbFilename: 'hanzi-vocabulary.sqlite' }
  });

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setStatus('error', error.message);
    return { configured: true, error };
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    // Avoid awaiting network/database operations inside Supabase's auth callback.
    Promise.resolve().then(() => handleSession(session)).catch(error => {
      setStatus('error', error.message || String(error));
    });
  });

  if (data.session) await handleSession(data.session);
  else setStatus('signed-out', 'Sign in to sync custom vocabulary. Local practice remains available.');
  return { configured: true };
}

async function handleSession(session) {
  if (!session) {
    currentUser = null;
    if (database) await database.disconnect();
    setStatus('signed-out', 'Signed out. Local practice remains available.');
    return;
  }
  currentUser = session.user;
  if (!database || !config.powerSyncUrl) return;
  if (connectionPromise) return connectionPromise;
  connectionPromise = (async () => {
    setStatus('syncing', 'Connecting to cloud sync…');
    await database.connect(new SupabasePowerSyncConnector());
    if (!watcherStarted && typeof database.watch === 'function') {
      watcherStarted = true;
      watchRemoteLists().catch(error => setStatus('error', error.message || String(error)));
    }
    setStatus('syncing', 'Connected; waiting for vocabulary updates.');
  })();
  try {
    await connectionPromise;
  } finally {
    connectionPromise = null;
  }
}

async function watchRemoteLists() {
  const stream = database.watch(
    'SELECT l.id, l.name, l.created_at, l.updated_at, l.deleted_at, i.id AS item_id, i.word, i.position, i.deleted_at AS item_deleted_at FROM vocabulary_lists l LEFT JOIN vocabulary_items i ON i.list_id = l.id WHERE l.deleted_at IS NULL ORDER BY l.updated_at DESC, i.position ASC'
  );
  for await (const result of stream) {
    const rows = result.rows?._array || result.rows || [];
    const byId = new Map();
    for (const row of rows) {
      if (row.deleted_at) continue;
      if (!byId.has(row.id)) {
        byId.set(row.id, {
          id: row.id,
          name: row.name,
          words: [],
          updatedAt: row.updated_at ? Date.parse(row.updated_at) || Date.now() : Date.now()
        });
      }
      if (row.word && !row.item_deleted_at) byId.get(row.id).words.push({ word: row.word, position: row.position || 0 });
    }
    const lists = [...byId.values()].map(list => ({
      ...list,
      words: list.words.sort((a, b) => a.position - b.position).map(item => item.word)
    }));
    onListsChanged(lists);
    setStatus('synced', `Synced ${lists.length} custom list(s).`);
  }
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Cloud sync is not configured. See docs/offline-vocabulary-sync.md.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (data.session) await handleSession(data.session);
  return data.user;
}

export async function signUp(email, password) {
  if (!supabase) throw new Error('Cloud sync is not configured. See docs/offline-vocabulary-sync.md.');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (data.session) await handleSession(data.session);
  return data.user;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  await handleSession(null);
}

export async function currentSyncUser() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  currentUser = data.user;
  return currentUser;
}

export async function persistCustomLists(lists) {
  if (!database || !currentUser) return;
  const now = new Date().toISOString();
  const existingListsResult = await database.getAll(
    'SELECT id, name, deleted_at FROM vocabulary_lists WHERE user_id = ?',
    [currentUser.id]
  );
  const existingLists = existingListsResult || [];
  const activeIds = new Set();

  for (const list of lists) {
    if (!list.id) list.id = crypto.randomUUID();
    activeIds.add(list.id);
    await database.execute(
      'INSERT INTO vocabulary_lists (id, user_id, name, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, deleted_at = vocabulary_lists.deleted_at',
      [list.id, currentUser.id, list.name, now, now]
    );

    const existingItems = await database.getAll(
      'SELECT id, word, deleted_at, position FROM vocabulary_items WHERE list_id = ?',
      [list.id]
    );
    const byWord = new Map(existingItems.filter(item => !item.deleted_at).map(item => [item.word, item]));
    const activeWords = new Set();
    for (let position = 0; position < list.words.length; position++) {
      const word = list.words[position];
      activeWords.add(word);
      const old = byWord.get(word);
      const itemId = old?.id || crypto.randomUUID();
      await database.execute(
        'INSERT INTO vocabulary_items (id, user_id, list_id, word, position, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET position = excluded.position, updated_at = excluded.updated_at, deleted_at = NULL',
        [itemId, currentUser.id, list.id, word, position, now, now]
      );
    }
    for (const item of existingItems) {
      if (!activeWords.has(item.word) && !item.deleted_at) {
        await database.execute('UPDATE vocabulary_items SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, item.id]);
      }
    }
  }

  for (const row of existingLists) {
    if (!activeIds.has(row.id) && !row.deleted_at) {
      await database.execute('UPDATE vocabulary_lists SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, row.id]);
    }
  }
  setStatus('syncing', 'Local vocabulary saved; cloud changes will sync when connected.');
}

export async function mergeLocalLists(localLists) {
  if (!database || !currentUser) return localLists;
  // Preserve local-only lists while merging remote data by stable ID or name.
  const result = [...localLists];
  const byId = new Map(result.filter(list => list.id).map(list => [list.id, list]));
  const byName = new Map(result.map(list => [list.name, list]));
  const remoteResult = await database.getAll(
    'SELECT id, name, updated_at, deleted_at FROM vocabulary_lists WHERE user_id = ?',
    [currentUser.id]
  );
  const deletedListIds = new Set((remoteResult || []).filter(row => row.deleted_at).map(row => row.id));
  // A remote list tombstone wins over a stale local snapshot.
  const surviving = result.filter(list => !list.id || !deletedListIds.has(list.id));
  const byIdLive = new Map(surviving.filter(list => list.id).map(list => [list.id, list]));
  const byNameLive = new Map(surviving.map(list => [list.name, list]));
  for (const remote of (remoteResult || []).filter(row => !row.deleted_at)) {
    const remoteItems = await database.getAll(
      'SELECT word, deleted_at FROM vocabulary_items WHERE list_id = ? ORDER BY position ASC',
      [remote.id]
    );
    const deletedWords = new Set((remoteItems || []).filter(item => item.deleted_at).map(item => item.word));
    const words = [...new Set((remoteItems || []).filter(item => !item.deleted_at).map(item => item.word).filter(Boolean))];
    const match = byIdLive.get(remote.id) || byNameLive.get(remote.name);
    if (match) {
      match.id = remote.id;
      match.words = [...new Set([...match.words.filter(word => !deletedWords.has(word)), ...words])];
      match.updatedAt = Math.max(match.updatedAt || 0, Date.parse(remote.updated_at) || 0);
    } else {
      const list = { id: remote.id, name: remote.name, words, updatedAt: Date.parse(remote.updated_at) || Date.now() };
      surviving.push(list);
      byIdLive.set(list.id, list);
      byNameLive.set(list.name, list);
    }
  }
  return surviving;
}
