import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCustomLists } from '../src/vocabulary-model.js';

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
