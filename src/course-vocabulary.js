const STORAGE_KEY = 'hanziPracticeBuddyCourseApiBaseUrl';
const BUILD_TIME_BASE_URL = import.meta.env?.VITE_COURSE_API_BASE_URL || '';

export function normalizeCourseVocabulary(entries) {
  if (!Array.isArray(entries)) throw new Error('The course-app API did not return a vocabulary page.');
  return entries.map((entry) => ({
    id: String(entry.id || ''),
    vocabulary: String(entry.traditional || entry.word || entry.simplified || '').trim(),
    pinyin: String(entry.mandarinPinyin || ''),
    jyutping: String(entry.cantoneseJyutping || ''),
    simplified: String(entry.simplified || ''),
    context: String(entry.englishMeaning || entry.notes || ''),
    pos: Array.isArray(entry.tags) ? entry.tags.join(', ') : ''
  })).filter((entry) => entry.vocabulary);
}

export function normalizeCourseApiBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Enter the base URL of your course-app deployment.');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Enter a valid course-app URL, including https://.');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Use an http(s) URL without credentials, query parameters or a fragment.');
  }
  return url.toString().replace(/\/+$/, '');
}

export function getCourseApiBaseUrl() {
  const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
  return (saved || BUILD_TIME_BASE_URL).trim().replace(/\/+$/, '');
}

export function saveCourseApiBaseUrl(value) {
  const normalized = normalizeCourseApiBaseUrl(value);
  globalThis.localStorage?.setItem(STORAGE_KEY, normalized);
  return normalized;
}

export async function fetchCourseVocabulary({ fetchImpl = fetch, baseUrl = getCourseApiBaseUrl() } = {}) {
  const base = normalizeCourseApiBaseUrl(baseUrl);
  const pageSize = 200;
  const entries = [];
  const seen = new Set();

  for (let page = 0; page < 1000; page += 1) {
    const url = new URL(`${base}/api/vocabulary`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(pageSize));
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`Course-app vocabulary request failed (HTTP ${response.status}). Check the API URL and deployment.`);
    }
    const payload = await response.json();
    const pageEntries = Array.isArray(payload) ? payload : payload?.content;
    if (!Array.isArray(pageEntries)) {
      throw new Error('Unexpected course-app response. Expected a paginated vocabulary response with a content array.');
    }
    for (const entry of normalizeCourseVocabulary(pageEntries)) {
      const key = entry.id || entry.vocabulary;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push(entry);
      }
    }
    const totalPages = Number(payload?.totalPages);
    if (Number.isFinite(totalPages) && totalPages > 0) {
      if (page + 1 >= totalPages) break;
    } else if (pageEntries.length < pageSize) {
      break;
    }
  }

  if (!entries.length) throw new Error('The course-app vocabulary database returned no usable words.');
  return entries;
}
