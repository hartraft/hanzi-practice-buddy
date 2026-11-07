export function normalizeCustomLists(value, makeId = () => crypto.randomUUID(), now = () => Date.now()) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(list => list && typeof list.name === 'string' && list.name.trim() && Array.isArray(list.words))
    .map(list => ({
      ...list,
      name: list.name.trim(),
      id: typeof list.id === 'string' && list.id ? list.id : makeId(),
      words: [...new Set(list.words.map(word => String(word).trim()).filter(Boolean))],
      updatedAt: Number.isFinite(Number(list.updatedAt)) && Number(list.updatedAt) > 0 ? Number(list.updatedAt) : now()
    }));
}

// Deterministic UUID-shaped ID for a list/word pair. This makes concurrent
// additions of the same word converge across devices without a shared clock.
export async function stableVocabularyItemId(listId, word) {
  const bytes = new TextEncoder().encode(String(listId) + '\u0000' + String(word).normalize('NFC').trim());
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)).slice(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
}

// Cloud-owned lists must never be written into device-wide local-only storage.
export function deviceLocalLists(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(list => list && !list._cloudOwned);
}
