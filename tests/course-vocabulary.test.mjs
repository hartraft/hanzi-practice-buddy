import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCourseVocabulary, normalizeCourseApiBaseUrl } from '../src/course-vocabulary.js';

test('maps course-app vocabulary fields into Hanzi Practice Buddy entries', () => {
  const [entry] = normalizeCourseVocabulary([{
    id: 'word-1',
    word: '学习',
    traditional: '學習',
    simplified: '学习',
    mandarinPinyin: 'xué xí',
    cantoneseJyutping: 'hok6 zaap6',
    englishMeaning: 'to study',
    tags: ['verb', 'HSK 1']
  }]);
  assert.equal(entry.vocabulary, '學習');
  assert.equal(entry.pinyin, 'xué xí');
  assert.equal(entry.jyutping, 'hok6 zaap6');
  assert.equal(entry.context, 'to study');
  assert.equal(entry.pos, 'verb, HSK 1');
});

test('falls back to word and notes and ignores empty entries', () => {
  const entries = normalizeCourseVocabulary([
    { word: '你好', notes: 'hello' },
    { word: '  ' },
    null
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].vocabulary, '你好');
  assert.equal(entries[0].context, 'hello');
});

test('normalizes a safe course-app base URL', () => {
  assert.equal(normalizeCourseApiBaseUrl('https://course.example/'), 'https://course.example');
  assert.throws(() => normalizeCourseApiBaseUrl('https://user:pass@course.example'));
  assert.throws(() => normalizeCourseApiBaseUrl('file:///tmp/course'));
});
