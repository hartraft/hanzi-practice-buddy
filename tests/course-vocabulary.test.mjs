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

test('fetches every page from the course-app vocabulary API', async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url.toString());
    const page = Number(new URL(url).searchParams.get('page'));
    return {
      ok: true,
      json: async () => ({
        totalPages: 2,
        content: page === 0
          ? [{ id: '1', traditional: '學' }]
          : [{ id: '2', traditional: '習' }]
      })
    };
  };
  const { fetchCourseVocabulary } = await import('../src/course-vocabulary.js');
  const entries = await fetchCourseVocabulary({ fetchImpl, baseUrl: 'https://course.example' });
  assert.deepEqual(entries.map(entry => entry.vocabulary), ['學', '習']);
  assert.equal(requested.length, 2);
  assert.match(requested[0], /page=0/);
  assert.match(requested[1], /page=1/);
});
