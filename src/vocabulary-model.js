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
