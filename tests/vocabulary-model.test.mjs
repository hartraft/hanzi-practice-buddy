import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCustomLists, stableVocabularyItemId } from '../src/vocabulary-model.js';

test('normalizes legacy lists and creates stable IDs for migration', () => {
  const legacy = [{ name: '  HSK 1 ', words: ['你好', '你好', ' 谢谢 '] }];
  const first = normalizeCustomLists(legacy, () => 'list-id', () => 123);
  const second = normalizeCustomLists(first, () => 'new-id', () => 456);
  assert.equal(first.length, 1);
  assert.equal(first[0].name, 'HSK 1');
  assert.deepEqual(first[0].words, ['你好', '谢谢']);
  assert.equal(first[0].id, 'list-id');
  assert.equal(second[0].id, 'list-id');
  assert.equal(second[0].updatedAt, 123);
});

test('ignores malformed list records and invalid roots', () => {
  assert.deepEqual(normalizeCustomLists(null), []);
  assert.deepEqual(normalizeCustomLists([{ name: '', words: ['字'] }, { name: 'ok', words: 'not-array' }]), []);
});

test('stable item IDs converge across devices and distinguish different words', async () => {
  const first = await stableVocabularyItemId('list-uuid', '你好');
  const second = await stableVocabularyItemId('list-uuid', '你好');
  const different = await stableVocabularyItemId('list-uuid', '謝謝');
  assert.equal(first, second);
  assert.notEqual(first, different);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});


test('device-local cache excludes cloud-owned lists', async () => {
  const { deviceLocalLists } = await import('../src/vocabulary-model.js');
  const local = { id: 'local', name: 'Local', words: ['你好'] };
  const remote = { id: 'remote', _cloudOwned: true, name: 'Cloud', words: ['學習'] };
  assert.deepEqual(deviceLocalLists([local, remote]), [local]);
  assert.deepEqual(deviceLocalLists(null), []);
});
