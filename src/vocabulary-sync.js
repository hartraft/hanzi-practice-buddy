import { Capacitor } from '@capacitor/core';
import { PowerSyncDatabase as CapacitorPowerSyncDatabase } from '@powersync/capacitor';
import { column, PowerSyncDatabase as WebPowerSyncDatabase, Schema, Table } from '@powersync/web';
import { createClient } from '@supabase/supabase-js';
import { stableVocabularyItemId as stableItemId } from './vocabulary-model.js';

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
  }),
  local_vocabulary_lists: new Table({
    name: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text
  }, { localOnly: true }),
  local_vocabulary_items: new Table({
    list_id: column.text,
    word: column.text,
    position: column.integer,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text
  }, { localOnly: true })
});

const PowerSyncDatabase = Capacitor.isNativePlatform() ? CapacitorPowerSyncDatabase : WebPowerSyncDatabase;

let supabase = null;
let database = null;
let currentUser = null;
let onListsChanged = () => {};
let onStatusChanged = () => {};
let connectionPromise = null;
let watcherStarted = false;
let connectedUserId = null;
let localWriteQueue = Promise.resolve();


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
        result = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', operation.id);
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

  // Always open the local database, even without cloud configuration. Local-only
  // PowerSync tables provide durable SQLite storage on Android and SQLite/WASM on web.
  database = new PowerSyncDatabase({
    schema,
    database: { dbFilename: 'hanzi-vocabulary.sqlite' }
  });
  const storedLocal = await loadLocalCustomLists();
  const initialLists = options.initialLists || [];
  const mergedLocal = mergeListArrays(initialLists, storedLocal);
  await persistLocalCustomLists(mergedLocal);

  const configured = Boolean(config.supabaseUrl && config.supabaseKey && config.powerSyncUrl);
  if (!configured) {
    setStatus('local-only', 'Saved locally in SQLite. Add cloud configuration to enable cross-device sync.');
    return { configured: false, localLists: await loadLocalCustomLists() };
  }

  supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setStatus('error', error.message);
    return { configured: true, localLists: await loadLocalCustomLists(), error };
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    // Avoid awaiting network/database operations inside Supabase's auth callback.
    Promise.resolve().then(() => handleSession(session)).catch(error => {
      setStatus('error', error.message || String(error));
    });
  });

  const retrySync = () => {
    if (currentUser) setStatus('syncing', 'Connection restored; synchronising pending changes.');
    if (currentUser && !connectedUserId) {
      handleSession({ user: currentUser }).catch(() => {
        setStatus('offline', 'Local vocabulary is safe; cloud reconnect will retry.');
      });
    }
  };
  window.addEventListener('online', retrySync);
  window.addEventListener('offline', () => {
    setStatus('offline', 'Edits are saved locally and will sync when reconnected.');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') retrySync();
  });

  if (data.session) await handleSession(data.session);
  else setStatus('signed-out', 'Saved locally in SQLite. Sign in to sync across devices.');
  return { configured: true, localLists: await loadLocalCustomLists() };
}

async function handleSession(session) {
  if (!session) {
    const previousUserId = connectedUserId;
    if (database && previousUserId) await database.disconnect();
    connectedUserId = null;
    currentUser = null;
    setStatus('signed-out', 'Signed out. Local practice remains available.');
    return;
  }
  if (!database || !config.powerSyncUrl) {
    currentUser = session.user;
    return;
  }
  if (connectedUserId === session.user.id) {
    currentUser = session.user;
    return;
  }
  if (connectedUserId && connectedUserId !== session.user.id) {
    await database.disconnect();
    connectedUserId = null;
    watcherStarted = false;
  }
  currentUser = session.user;
  if (connectionPromise) return connectionPromise;
  connectionPromise = (async () => {
    setStatus('syncing', 'Connecting to cloud sync…');
    await database.connect(new SupabasePowerSyncConnector());
    connectedUserId = session.user.id;
    database.waitForFirstSync().then(() => {
      setStatus('synced', 'Cloud vocabulary is up to date.');
    }).catch(() => {
      setStatus('syncing', 'Local vocabulary is available; waiting for cloud connection.');
    });
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
    'SELECT l.id, l.user_id, l.name, l.created_at, l.updated_at, l.deleted_at, i.id AS item_id, i.word, i.position, i.deleted_at AS item_deleted_at FROM vocabulary_lists l LEFT JOIN vocabulary_items i ON i.list_id = l.id AND i.user_id = l.user_id WHERE l.user_id = ? AND l.deleted_at IS NULL ORDER BY l.updated_at DESC, i.position ASC, i.word ASC',
    [currentUser.id]
  );
  for await (const result of stream) {
    const rows = result.rows?._array || result.rows || [];
    const byId = new Map();
    for (const row of rows) {
      if (row.deleted_at) continue;
      if (!byId.has(row.id)) {
        byId.set(row.id, {
          id: row.id,
          _cloudOwned: true,
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
    if (database.currentStatus?.hasSynced) {
      setStatus('synced', `Synced ${lists.length} custom list(s).`);
    } else {
      setStatus('syncing', `Loaded ${lists.length} custom list(s) locally; initial sync is pending.`);
    }
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
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  currentUser = data.session?.user || null;
  return currentUser;
}

export async function persistCustomLists(lists) {
  if (!database || !currentUser) return;
  const now = new Date().toISOString();
  const existingLists = await database.getAll(
    'SELECT id, name, deleted_at FROM vocabulary_lists WHERE user_id = ?',
    [currentUser.id]
  );
  const listsById = new Map((existingLists || []).map(row => [row.id, row]));
  const activeIds = new Set();

  for (const list of lists) {
    if (!list.id) list.id = crypto.randomUUID();
    activeIds.add(list.id);
    const existingList = listsById.get(list.id);
    // Never overwrite a server tombstone with a stale local copy.
    if (existingList?.deleted_at) continue;
    if (!existingList) {
      await database.execute(
        'INSERT INTO vocabulary_lists (id, user_id, name, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)',
        [list.id, currentUser.id, list.name, now, now]
      );
    } else if (existingList.name !== list.name) {
      await database.execute(
        'UPDATE vocabulary_lists SET name = ?, updated_at = ? WHERE id = ?',
        [list.name, now, list.id]
      );
    }

    const existingItems = await database.getAll(
      'SELECT id, word, deleted_at, position FROM vocabulary_items WHERE list_id = ?',
      [list.id]
    );
    const activeItemsByWord = new Map(existingItems.filter(item => !item.deleted_at).map(item => [item.word, item]));
    const tombstonedWords = new Set(existingItems.filter(item => item.deleted_at).map(item => item.word));
    const activeWords = new Set();
    for (let position = 0; position < list.words.length; position++) {
      const word = list.words[position];
      activeWords.add(word);
      // A tombstone wins over a stale offline copy of the same vocabulary item.
      if (tombstonedWords.has(word)) continue;
      const existingItem = activeItemsByWord.get(word);
      if (existingItem) {
        if (existingItem.position !== position) {
          await database.execute(
            'UPDATE vocabulary_items SET position = ?, updated_at = ? WHERE id = ?',
            [position, now, existingItem.id]
          );
        }
        continue;
      }
      await database.execute(
        'INSERT INTO vocabulary_items (id, user_id, list_id, word, position, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
        [await stableItemId(list.id, word), currentUser.id, list.id, word, position, now, now]
      );
    }
    for (const item of existingItems) {
      if (!activeWords.has(item.word) && !item.deleted_at) {
        await database.execute('UPDATE vocabulary_items SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, item.id]);
      }
    }
  }

  for (const row of existingLists || []) {
    if (!activeIds.has(row.id) && !row.deleted_at) {
      await database.execute('UPDATE vocabulary_lists SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, row.id]);
    }
  }
  setStatus('syncing', 'Local vocabulary saved; cloud changes will sync when connected.');
}

function mergeListArrays(first, second) {
  const merged = [];
  const byId = new Map();
  const byName = new Map();
  for (const list of [...first, ...second]) {
    const existing = (list.id && byId.get(list.id)) || byName.get(list.name);
    if (existing) {
      if (!existing.id && list.id) existing.id = list.id;
      existing.words = [...new Set([...(existing.words || []), ...(list.words || [])])];
      existing.updatedAt = Math.max(existing.updatedAt || 0, list.updatedAt || 0);
    } else {
      const copy = { ...list, words: [...new Set(list.words || [])] };
      merged.push(copy);
      if (copy.id) byId.set(copy.id, copy);
      byName.set(copy.name, copy);
    }
  }
  return merged;
}

export async function persistLocalCustomLists(lists) {
  if (!database) return;
  // Cloud-owned lists are already stored by PowerSync in the authenticated
  // database. Never copy them into the shared device-local cache.
  const localOnlyLists = lists.filter(list => !list._cloudOwned);
  // Serialize writes so quick successive Save/Delete actions cannot interleave.
  localWriteQueue = localWriteQueue.then(async () => {
    const now = new Date().toISOString();
    const currentIds = new Set();
    for (const list of localOnlyLists) {
      if (!list.id) list.id = crypto.randomUUID();
      currentIds.add(list.id);
      const listUpdatedAt = new Date(list.updatedAt || Date.now()).toISOString();
      await database.execute(
        'INSERT INTO local_vocabulary_lists (id, name, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, deleted_at = local_vocabulary_lists.deleted_at',
        [list.id, list.name, now, listUpdatedAt]
      );
      const existing = await database.getAll('SELECT id, word, position, deleted_at FROM local_vocabulary_items WHERE list_id = ?', [list.id]);
      const activeByWord = new Map((existing || []).filter(item => !item.deleted_at).map(item => [item.word, item]));
      const tombstonedWords = new Set((existing || []).filter(item => item.deleted_at).map(item => item.word));
      const words = new Set(list.words || []);
      for (let position = 0; position < (list.words || []).length; position++) {
        const word = list.words[position];
        if (tombstonedWords.has(word)) continue;
        const old = activeByWord.get(word);
        if (old) {
          if (old.position !== position) {
            await database.execute('UPDATE local_vocabulary_items SET position = ?, updated_at = ? WHERE id = ?', [position, listUpdatedAt, old.id]);
          }
          continue;
        }
        await database.execute(
          'INSERT INTO local_vocabulary_items (id, list_id, word, position, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
          [await stableItemId(list.id, word), list.id, word, position, now, listUpdatedAt]
        );
      }
      for (const item of existing || []) {
        if (!words.has(item.word) && !item.deleted_at) {
          await database.execute('UPDATE local_vocabulary_items SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, item.id]);
        }
      }
    }
    const existingLists = await database.getAll('SELECT id, deleted_at FROM local_vocabulary_lists');
    for (const row of existingLists || []) {
      if (!currentIds.has(row.id) && !row.deleted_at) {
        await database.execute('UPDATE local_vocabulary_lists SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, row.id]);
        await database.execute('UPDATE local_vocabulary_items SET deleted_at = ?, updated_at = ? WHERE list_id = ? AND deleted_at IS NULL', [now, now, row.id]);
      }
    }
  });
  return localWriteQueue;
}

export async function loadLocalCustomLists() {
  if (!database) return [];
  const rows = await database.getAll('SELECT id, name, updated_at FROM local_vocabulary_lists WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE');
  const lists = [];
  for (const row of rows || []) {
    const items = await database.getAll('SELECT word FROM local_vocabulary_items WHERE list_id = ? AND deleted_at IS NULL ORDER BY position ASC, word ASC', [row.id]);
    lists.push({
      id: row.id,
      name: row.name,
      words: (items || []).map(item => item.word),
      updatedAt: Date.parse(row.updated_at) || Date.now()
    });
  }
  return lists;
}

export async function mergeLocalLists(localLists) {
  if (!database) return localLists;
  const localDbLists = await loadLocalCustomLists();
  const localDeletedListRows = await database.getAll('SELECT id FROM local_vocabulary_lists WHERE deleted_at IS NOT NULL');
  const localDeletedListIds = new Set((localDeletedListRows || []).map(row => row.id));
  const localDeletedItemRows = await database.getAll('SELECT list_id, word FROM local_vocabulary_items WHERE deleted_at IS NOT NULL');
  const localDeletedWordsByList = new Map();
  for (const row of localDeletedItemRows || []) {
    if (!localDeletedWordsByList.has(row.list_id)) localDeletedWordsByList.set(row.list_id, new Set());
    localDeletedWordsByList.get(row.list_id).add(row.word);
  }
  const result = mergeListArrays(localLists, localDbLists)
    .filter(list => !list.id || !localDeletedListIds.has(list.id))
    .map(list => ({
      ...list,
      words: (list.words || []).filter(word => !localDeletedWordsByList.get(list.id)?.has(word))
    }));
  if (!currentUser) return result;
  // Preserve local-only lists while merging remote data by stable ID or name.
  const byId = new Map(result.filter(list => list.id).map(list => [list.id, list]));
  const byName = new Map(result.map(list => [list.name, list]));
  const remoteResult = await database.getAll(
    'SELECT id, name, updated_at, deleted_at FROM vocabulary_lists WHERE user_id = ?',
    [currentUser.id]
  );
  const deletedListIds = new Set([
    ...localDeletedListIds,
    ...(remoteResult || []).filter(row => row.deleted_at).map(row => row.id)
  ]);
  // Local or remote tombstones win over stale snapshots.
  const surviving = result.filter(list => !list.id || !deletedListIds.has(list.id));
  const byIdLive = new Map(surviving.filter(list => list.id).map(list => [list.id, list]));
  const byNameLive = new Map(surviving.map(list => [list.name, list]));
  for (const remote of (remoteResult || []).filter(row => !row.deleted_at && !deletedListIds.has(row.id))) {
    const remoteItems = await database.getAll(
      'SELECT word, deleted_at FROM vocabulary_items WHERE list_id = ? ORDER BY position ASC',
      [remote.id]
    );
    const deletedWords = new Set([
      ...(remoteItems || []).filter(item => item.deleted_at).map(item => item.word),
      ...(localDeletedWordsByList.get(remote.id) || [])
    ]);
    const words = [...new Set((remoteItems || []).filter(item => !item.deleted_at && !deletedWords.has(item.word)).map(item => item.word).filter(Boolean))];
    const match = byIdLive.get(remote.id) || byNameLive.get(remote.name);
    if (match) {
      const remoteUpdatedAt = Date.parse(remote.updated_at) || 0;
      if (remoteUpdatedAt >= (match.updatedAt || 0)) match.name = remote.name;
      match.id = remote.id;
      match._cloudOwned = true;
      match.words = [...new Set([...match.words.filter(word => !deletedWords.has(word)), ...words])];
      match.updatedAt = Math.max(match.updatedAt || 0, remoteUpdatedAt);
    } else {
      const list = { id: remote.id, _cloudOwned: true, name: remote.name, words, updatedAt: Date.parse(remote.updated_at) || Date.now() };
      surviving.push(list);
      byIdLive.set(list.id, list);
      byNameLive.set(list.name, list);
    }
  }
  return surviving;
}
