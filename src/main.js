import { initVocabularySync, signIn, signUp, signOut, currentSyncUser, persistCustomLists, persistLocalCustomLists, mergeLocalLists, syncConfiguration } from './vocabulary-sync.js';
import { normalizeCustomLists, deviceLocalLists } from './vocabulary-model.js';
import { fetchCourseVocabulary, getCourseApiBaseUrl, saveCourseApiBaseUrl } from './course-vocabulary.js';

const converter = OpenCC.Converter({ from:'cn', to:'tw' });
const toneColors = {1:'#007AFF',2:'#34C759',3:'#FF9500',4:'#FF3B30',5:'#8E8E93'};
const BUILTIN_DECK_LABELS = {
  novice_1: 'TOCFL Novice 1 (160 entries)',
  novice_2: 'TOCFL Novice 2 (234 entries)',
  both: 'TOCFL Novice 1 & 2 (394 entries)'
};

let currentDeck = 'custom';
let vocabEntries = [];
let words = [];
let uniqueChars = [];
let charInfoMap = {};
let charIndex = 0;
let writer = null;
let isTransitioning = false;
let completionTimeout = null;
let feedbackTimeout = null;
let streak = 0;
let lastPracticeDate = null;
let todaySet = new Set();
let allCharsSet = new Set();

let prefs = {
  hidePrompt: false,
  hideOutline: false,
  noHint: false,
  dark: false
};

// ===== CUSTOM LIST STORAGE =====
const CUSTOM_LISTS_KEY = 'hanziPracticeBuddyCustomLists';
const MAX_CUSTOM_LISTS = 20;
const CUSTOM_LIST_PREFIX = 'custom:';

let customLists = [];      // [{ name, words: [], updatedAt }]
let activeCustomListId = null; // id of the saved custom list currently loaded, or null
let deckRestored = false;

// Cloud-owned rows must never enter the device-wide local-only cache.
function saveLocalListCache(){
  const localOnlyLists = deviceLocalLists(customLists);
  localStorage.setItem(CUSTOM_LISTS_KEY, JSON.stringify(localOnlyLists));
}

function listKey(name){ return CUSTOM_LIST_PREFIX + name; }
function customListName(key){ return key.startsWith(CUSTOM_LIST_PREFIX) ? key.slice(CUSTOM_LIST_PREFIX.length) : ''; }

function saveCustomLists(){
  try{
    for(const list of customLists){
      if(!list.id) list.id = crypto.randomUUID();
      if(!list.updatedAt) list.updatedAt = Date.now();
    }
    saveLocalListCache();
    persistLocalCustomLists(customLists).catch(error => {
      setSyncStatus('error', 'Local SQLite save failed: ' + (error.message || String(error)));
    });
    persistCustomLists(customLists).catch(error => {
      setSyncStatus('error', 'Local save succeeded; cloud sync will retry: ' + (error.message || String(error)));
    });
  }catch(e){
    alert('Could not save lists: browser storage is full.');
  }
}

function loadCustomLists(){
  const raw = localStorage.getItem(CUSTOM_LISTS_KEY);
  if(!raw){ customLists = []; return; }
  try{
    const parsed = JSON.parse(raw);
    customLists = normalizeCustomLists(parsed);
    // Persist generated stable IDs so future restarts and migrations reuse them.
    saveLocalListCache();
  }catch(e){ customLists = []; }
}

function renderDeckSelect(){
  const prevKey = els.deckSelect.value;
  els.deckSelect.innerHTML = '';
  customLists.forEach(l => {
    const opt = document.createElement('option');
    opt.value = listKey(l.name);
    opt.textContent = `📝 ${l.name} (${l.words.length} words)`;
    els.deckSelect.appendChild(opt);
  });
  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = 'Custom List (Textarea)';
  els.deckSelect.appendChild(customOpt);
  ['novice_1','novice_2','both'].forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = BUILTIN_DECK_LABELS[k];
    els.deckSelect.appendChild(opt);
  });
  const courseOpt = document.createElement('option');
  courseOpt.value = 'course_neon';
  courseOpt.textContent = 'Course-app vocabulary (Neon PostgreSQL)';
  els.deckSelect.appendChild(courseOpt);
  if([...els.deckSelect.options].some(o => o.value === prevKey)){
    els.deckSelect.value = prevKey;
  }
}

function isCustomListKey(key){
  return key.startsWith(CUSTOM_LIST_PREFIX) && customLists.some(l => listKey(l.name) === key);
}

function showCurrentListName(){
  if(!activeCustomListId){
    els.currentListName.textContent = 'Unsaved custom list';
    return;
  }
  const list = customLists.find(l => l.name === activeCustomListId);
  const when = list && list.updatedAt ? new Date(list.updatedAt).toLocaleDateString() : '';
  els.currentListName.textContent = `Saved list: ${activeCustomListId}${when ? ' (updated ' + when + ')' : ''}`;
}

const els = {
  wordList: document.getElementById('wordList'),
  char: document.getElementById('char'),
  pinyin: document.getElementById('pinyin'),
  vocabInfo: document.getElementById('vocabInfo'),
  writer: document.getElementById('writer'),
  streak: document.getElementById('streak'),
  stats: document.getElementById('stats'),
  deckSelect: document.getElementById('deckSelect'),
  customContainer: document.getElementById('customContainer'),
  currentListName: document.getElementById('currentListName'),
  progressIndicator: document.getElementById('progressIndicator'),
  hidePromptToggle: document.getElementById('hidePromptToggle'),
  hideOutlineToggle: document.getElementById('hideOutlineToggle'),
  noHintToggle: document.getElementById('noHintToggle'),
  feedback: document.getElementById('feedback'),
  completionMessage: document.getElementById('completionMessage')
};

function updateStreak(){
  const today = new Date().toISOString().slice(0,10);
  if(lastPracticeDate === today) return;
  const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
  streak = lastPracticeDate === yesterday ? streak + 1 : 1;
  lastPracticeDate = today;
  els.streak.textContent = `🔥 ${streak}`;
}

function saveProgress(){
  localStorage.setItem('hanziPracticeBuddy', JSON.stringify({
    currentDeck, words, uniqueChars, charIndex, streak, lastPracticeDate,
    today:[...todaySet], allChars:[...allCharsSet], prefs
  }));
}

function restoreProgress(){
  loadCustomLists();
  renderDeckSelect();

  const raw = localStorage.getItem('hanziPracticeBuddy');
  if(!raw) return;
  try{
    const d = JSON.parse(raw);
    currentDeck = d.currentDeck || 'custom';
    if(currentDeck.startsWith(CUSTOM_LIST_PREFIX) && !isCustomListKey(currentDeck)){
      // Saved list no longer exists in storage
      currentDeck = 'custom';
    }
    els.deckSelect.value = currentDeck;
    words = d.words || [];
    uniqueChars = d.uniqueChars || [];
    charIndex = d.charIndex || 0;
    streak = d.streak || 0;
    lastPracticeDate = d.lastPracticeDate || null;
    todaySet = new Set(d.today || []);
    allCharsSet = new Set(d.allChars || []);
    if (d.prefs) {
      prefs = d.prefs;
      els.hidePromptToggle.checked = prefs.hidePrompt;
      els.hideOutlineToggle.checked = prefs.hideOutline;
      els.noHintToggle.checked = prefs.noHint;
      if (prefs.dark) {
        document.body.classList.add('dark');
      }
    }
    
    if(currentDeck === 'custom'){
      els.customContainer.style.display = 'block';
      els.wordList.value = words.join('\n');
      showCurrentListName();
      if(uniqueChars.length > 0){
        showChar();
      }
    } else if(isCustomListKey(currentDeck)){
      els.customContainer.style.display = 'block';
      deckRestored = true;
      loadDeck(currentDeck);
    } else {
      els.customContainer.style.display = 'none';
      deckRestored = true;
      loadDeck(currentDeck);
    }
    
    els.streak.textContent = `🔥 ${streak}`;
    updateStatsText();
  }catch(e){}
}

async function loadDeck(deckKey){
  currentDeck = deckKey;
  if(isCustomListKey(deckKey)){
    const list = customLists.find(l => listKey(l.name) === deckKey);
    if(!list) return;
    els.customContainer.style.display = 'block';
    els.wordList.value = list.words.join('\n');
    loadWords();
    activeCustomListId = list.name;
    showCurrentListName();
    return;
  }
  if(deckKey === 'custom'){
    els.customContainer.style.display = 'block';
    activeCustomListId = null;
    showCurrentListName();
    loadWords();
    return;
  }
  els.customContainer.style.display = 'none';
  activeCustomListId = null;
  showCurrentListName();
  if(deckKey === 'course_neon'){
    els.customContainer.style.display = 'none';
    setCourseApiStatus('Loading vocabulary from course-app…');
    try {
      vocabEntries = await fetchCourseVocabulary();
      words = vocabEntries.map(entry => entry.vocabulary).filter(Boolean);
      setupCharsFromVocab();
      setCourseApiStatus(`Loaded ${vocabEntries.length} words from course-app.`);
    } catch (error) {
      setCourseApiStatus(error.message || String(error));
      alert('Could not load course-app vocabulary: ' + (error.message || String(error)));
    }
    return;
  }
  try{
    const res = await fetch('data/vocabulary_novice.json');
    const data = await res.json();
    vocabEntries = [];
    if(deckKey === 'novice_1' || deckKey === 'both'){
      vocabEntries.push(...(data.novice_1 || []));
    }
    if(deckKey === 'novice_2' || deckKey === 'both'){
      vocabEntries.push(...(data.novice_2 || []));
    }
    words = vocabEntries.map(e => e.vocabulary).filter(Boolean);
    setupCharsFromVocab();
  }catch(err){
    alert('Failed to load vocabulary dataset. Ensure data/vocabulary_novice.json exists.');
  }
}

function setupCharsFromVocab(){
  charInfoMap = {};
  const charSet = new Set();
  vocabEntries.forEach(entry => {
    const voc = converter(entry.vocabulary || '');
    voc.split('').forEach(c => {
      if (isHanzi(c)) {
        charSet.add(c);
        if(!charInfoMap[c]){
          charInfoMap[c] = entry;
        }
      }
    });
  });
  uniqueChars = Array.from(charSet);
  charIndex = 0;
  uniqueChars.forEach(c => allCharsSet.add(c));
  showChar();
  saveProgress();
}

function isHanzi(c){
  const code = c.codePointAt(0);
  // CJK Unified Ideographs + Extension A/B
  if (code >= 0x4E00 && code <= 0x9FFF) return true;
  if (code >= 0x3400 && code <= 0x4DBF) return true;
  if (code >= 0x20000 && code <= 0x2A6DF) return true;
  if (code >= 0x2A700 && code <= 0x2B73F) return true;
  if (code >= 0x2B740 && code <= 0x2B81F) return true;
  if (code >= 0x2B820 && code <= 0x2CEAF) return true;
  // Traditional variant extensions
  if (code >= 0xF900 && code <= 0xFAFF) return true;
  if (code >= 0x2F800 && code <= 0x2FA1F) return true;
  return false;
}

function loadWords(){
  let input = els.wordList.value.split('\n').map(w=>w.trim()).filter(Boolean);
  input = [...new Set(input)]; // remove duplicate words
  els.wordList.value = input.join('\n');
  if(!input.length){ alert('Enter at least one word'); return; }

  words = input.map(w => converter(w));
  activeCustomListId = null; // textarea contents are a fresh (unsaved) list
  showCurrentListName();

  // Build unique character list
  const charSet = new Set();
  words.forEach(w => w.split('').forEach(c => charSet.add(c)));
  uniqueChars = Array.from(charSet);

  charIndex = 0;
  uniqueChars.forEach(c => allCharsSet.add(c));

  els.char.textContent = '';
  els.pinyin.textContent = '';
  els.vocabInfo.textContent = '';
  els.writer.innerHTML = '';

  showChar();
  saveProgress();
}

function updateURL(){
  if(isCustomListKey(currentDeck)){
    history.replaceState(null,'',`?list=${encodeURIComponent(customListName(currentDeck))}`);
  } else if(currentDeck === 'custom'){
    const encoded = encodeURIComponent(words.join(' '));
    history.replaceState(null,'',`?words=${encoded}`);
  } else {
    history.replaceState(null,'',`?deck=${currentDeck}`);
  }
}

function loadFromURL(){
  const p = new URLSearchParams(location.search);
  if(p.has('deck')){
    const d = p.get('deck');
    if(['novice_1', 'novice_2', 'both', 'course_neon'].includes(d)){
      els.deckSelect.value = d;
      loadDeck(d);
      return;
    }
  }
  if(p.has('list')){
    const name = p.get('list');
    if(isCustomListKey(listKey(name))){
      els.deckSelect.value = listKey(name);
      loadDeck(listKey(name));
      return;
    }
  }
  if(p.has('words')){
    const list = [...new Set(p.get('words').split(/[ ,\n]+/).filter(Boolean))];
    if(list.length){
      els.wordList.value = list.join('\n');
      loadWords();
    }
  }
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function showChar(){
  if(!uniqueChars[charIndex]) return;
  const char = uniqueChars[charIndex];

  updateStreak(); todaySet.add(char); allCharsSet.add(char);

  if(prefs.hidePrompt){
    els.char.textContent = '';
    els.pinyin.textContent = '';
    els.vocabInfo.textContent = '';
  } else {
    els.char.textContent = char;
    try{
      const pyNum = pinyinPro.pinyin(char,{toneType:'num'});
      const tone = parseInt(pyNum.match(/[1-5]/)?.[0] || 5);
      els.char.style.color = toneColors[tone];
      els.pinyin.textContent = pinyinPro.pinyin(char,{toneType:'symbol'});
    }catch(e){ els.pinyin.textContent=''; }

    const info = charInfoMap[char];
    if(info){
      els.vocabInfo.innerHTML = `<b>Word:</b> ${escapeHtml(info.vocabulary)} | <b>Pinyin:</b> ${escapeHtml(info.pinyin)}<br><b>Context:</b> ${escapeHtml(info.context || 'N/A')} | <b>POS:</b> ${escapeHtml(info.pos || 'N/A')}`;
    } else {
      els.vocabInfo.textContent = '';
    }
  }

  els.progressIndicator.textContent = `Character ${charIndex + 1} of ${uniqueChars.length}`;

  els.writer.innerHTML='';
  const options = {
    width: 300,
    height: 300,
    showOutline: !prefs.hideOutline,
    showCharacter: false,
    leniency: prefs.noHint ? 0.6 : 0.8
  };

  writer = HanziWriter.create('writer', char, options);
  isTransitioning = false;
  els.feedback.classList.remove('show');
  els.completionMessage.hidden = true;
  writer.quiz({
    onComplete: handleCorrect,
    showHintAfterMisses: prefs.noHint ? 9999 : 3
  });
  updateStatsText();
  saveProgress();
  updateURL();
}

function handleCorrect(){
  // Hanzi Writer can report completion more than once; only advance once.
  if(isTransitioning) return;
  isTransitioning = true;
  els.feedback.classList.add('show');
  if(feedbackTimeout) clearTimeout(feedbackTimeout);
  feedbackTimeout = setTimeout(() => {
    els.feedback.classList.remove('show');
    isTransitioning = false;
    feedbackTimeout = null;
    advanceAfterCorrect();
  }, 1000);
}

function nextChar(){
  // Manual navigation should not race the success animation.
  if(isTransitioning) return;
  advanceAfterCorrect();
}

function advanceAfterCorrect(){
  if(charIndex >= uniqueChars.length - 1){ finishList(); return; }
  charIndex++;
  showChar();
}

function prevChar(){
  if(charIndex>0){ charIndex--; showChar(); }
}

function replayStroke(){
  if(writer){
    writer.animateCharacter();
  }
}

function finishList(){
  isTransitioning = false;
  els.feedback.classList.remove('show');
  els.completionMessage.hidden = false;
  if(completionTimeout) clearTimeout(completionTimeout);
  completionTimeout = setTimeout(() => {
    els.completionMessage.hidden = true;
    completionTimeout = null;
  }, 3000);
  els.char.textContent=''; els.pinyin.textContent=''; els.vocabInfo.textContent='';
  els.progressIndicator.textContent = `Completed ${uniqueChars.length} characters!`;
  els.writer.innerHTML='';
  writer = null;
  saveProgress();
}

function updateStatsText(){
  els.stats.textContent = `Daily streak: ${streak}\nToday practiced: ${[...todaySet].join(', ')}\nTotal characters learned: ${allCharsSet.size}`;
}

// ===== CUSTOM LIST MANAGEMENT =====
function saveCurrentList(){
  let input = els.wordList.value.split('\n').map(w=>w.trim()).filter(Boolean);
  if(!input.length){ alert('Enter at least one word'); return; }

  let name = '';
  if(activeCustomListId){
    name = activeCustomListId;
    const overwrite = confirm(`Update saved list "${name}" with the current words?`);
    if(!overwrite) return;
  } else {
    name = prompt('Name this word list:', 'My List');
    if(name === null) return;
    name = name.trim();
    if(!name){ alert('List name cannot be empty.'); return; }
    if(customLists.some(l => l.name === name)){
      const overwrite = confirm(`A list named "${name}" already exists. Overwrite it?`);
      if(!overwrite) return;
    }
  }

  if(customLists.length >= MAX_CUSTOM_LISTS && !customLists.some(l => l.name === name)){
    alert(`You can save at most ${MAX_CUSTOM_LISTS} lists. Delete one first.`);
    return;
  }

  let existing = customLists.find(l => l.name === name);
  if(existing){
    existing.words = [...new Set(input)];
    existing.updatedAt = Date.now();
  } else {
    customLists.push({ name, words: [...new Set(input)], updatedAt: Date.now() });
  }
  saveCustomLists();
  activeCustomListId = name;
  currentDeck = listKey(name);
  renderDeckSelect();
  els.deckSelect.value = currentDeck;
  // Refresh practice state from the saved textarea contents as part of saving.
  loadDeck(currentDeck);
  showCurrentListName();
  saveProgress();
  updateURL();
}

function newCustomList(){
  els.wordList.value = '';
  els.deckSelect.value = 'custom';
  currentDeck = 'custom';
  activeCustomListId = null;
  showCurrentListName();
  words = []; uniqueChars = []; charInfoMap = {}; charIndex = 0;
  els.char.textContent=''; els.pinyin.textContent=''; els.vocabInfo.textContent='';
  els.progressIndicator.textContent = '';
  els.writer.innerHTML=''; writer = null;
  updateStatsText();
  saveProgress();
  updateURL();
  els.wordList.focus();
}

function deleteCurrentList(){
  if(!activeCustomListId){ alert('No saved list is currently selected.'); return; }
  const name = activeCustomListId;
  if(!confirm(`Delete saved list "${name}"?`)) return;
  customLists = customLists.filter(l => l.name !== name);
  saveCustomLists();
  els.wordList.value = '';
  currentDeck = 'custom';
  activeCustomListId = null;
  renderDeckSelect();
  els.deckSelect.value = 'custom';
  showCurrentListName();
  words = []; uniqueChars = []; charInfoMap = {}; charIndex = 0;
  els.char.textContent=''; els.pinyin.textContent=''; els.vocabInfo.textContent='';
  els.progressIndicator.textContent = '';
  els.writer.innerHTML=''; writer = null;
  updateStatsText();
  saveProgress();
  updateURL();
}

// ===== IMPORT / EXPORT =====
function exportWords(){
  const blob = new Blob([JSON.stringify({ words, currentDeck })],{type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hanzi-practice-buddy-words.json'; a.click();
}

function importWords(){
  const input = document.createElement('input'); input.type='file'; input.accept='application/json';
  input.onchange = e => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        let deck = data.currentDeck || 'custom';
        // Restore exported contents even when a same-named list already exists locally.
        if(deck.startsWith(CUSTOM_LIST_PREFIX)){
          const name = customListName(deck);
          const input = [...new Set((data.words || []).map(String).filter(Boolean))];
          if(!input.length){ alert('File contains no words'); return; }
          if(customLists.length >= MAX_CUSTOM_LISTS && !customLists.some(l => l.name === name)){
            alert(`You can save at most ${MAX_CUSTOM_LISTS} lists. Delete one first.`); return;
          }
          let existing = customLists.find(l => l.name === name);
          if(existing){ existing.words = input; existing.updatedAt = Date.now(); }
          else { customLists.push({ name, words: input, updatedAt: Date.now() }); }
          saveCustomLists();
          renderDeckSelect();
          loadDeck(listKey(name));
          return;
        }
        els.deckSelect.value = deck;
        if(deck === 'custom'){
          els.customContainer.style.display = 'block';
          words = [...new Set(data.words || [])];
          els.wordList.value = words.join('\n');
          const charSet = new Set();
          words.forEach(w => w.split('').forEach(c => charSet.add(c)));
          uniqueChars = Array.from(charSet);
          charIndex = 0;
          uniqueChars.forEach(c => allCharsSet.add(c));
          activeCustomListId = null;
          showCurrentListName();
          showChar(); saveProgress();
        } else {
          loadDeck(deck);
        }
      }catch(err){ alert('Invalid JSON file'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ===== PDF WORKSHEET =====
function generatePDF(){
  if(uniqueChars.length === 0){ alert('Load a deck or word list first'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const boxSize = 25;
  const gridPerChar = 4;
  let x=margin, y=margin;

  uniqueChars.forEach(char=>{
    for(let row=0; row<gridPerChar; row++){
      for(let col=0; col<gridPerChar; col++){
        doc.rect(x + col*boxSize, y + row*boxSize, boxSize, boxSize);
        doc.setFontSize(14);
        doc.text(char, x + col*boxSize + 6, y + row*boxSize + 18);
      }
    }
    const py = pinyinPro.pinyin(char,{toneType:'symbol'});
    doc.setFontSize(12);
    doc.text(py, x + (gridPerChar*boxSize)/2, y + gridPerChar*boxSize + 5, {align:'center'});
    y += gridPerChar*boxSize + 15;
    if(y + gridPerChar*boxSize + 15 > pageHeight - margin){ doc.addPage(); y=margin; }
  });
  doc.save('hanzi-practice-buddy-worksheet.pdf');
}

// ===== EVENT LISTENERS =====
els.deckSelect.onchange = (e) => loadDeck(e.target.value);

function setCourseApiStatus(message) {
  const element = document.getElementById('courseApiStatus');
  if (element) element.textContent = message;
}

document.getElementById('courseApiBaseUrl').value = getCourseApiBaseUrl();
document.getElementById('saveCourseApiUrlBtn').onclick = () => {
  try {
    const savedUrl = saveCourseApiBaseUrl(document.getElementById('courseApiBaseUrl').value);
    document.getElementById('courseApiBaseUrl').value = savedUrl;
    setCourseApiStatus('Course-app API URL saved on this device. Select the Course-app vocabulary deck to load it.');
  } catch (error) {
    setCourseApiStatus(error.message || String(error));
  }
};
document.getElementById('loadBtn').onclick = loadWords;
document.getElementById('saveListBtn').onclick = saveCurrentList;
document.getElementById('newListBtn').onclick = newCustomList;
document.getElementById('deleteListBtn').onclick = deleteCurrentList;
document.getElementById('nextBtn').onclick = nextChar;
document.getElementById('prevBtn').onclick = prevChar;
document.getElementById('replayBtn').onclick = replayStroke;
document.getElementById('darkToggle').onclick = () => {
  document.body.classList.toggle('dark');
  prefs.dark = document.body.classList.contains('dark');
  saveProgress();
};

els.hidePromptToggle.onchange = (e) => {
  prefs.hidePrompt = e.target.checked;
  showChar();
};

els.hideOutlineToggle.onchange = (e) => {
  prefs.hideOutline = e.target.checked;
  showChar();
};

els.noHintToggle.onchange = (e) => {
  prefs.noHint = e.target.checked;
  showChar();
};

document.getElementById('exportBtn').onclick = exportWords;
document.getElementById('importBtn').onclick = importWords;
document.getElementById('pdfBtn').onclick = generatePDF;
document.getElementById('gamesBtn').onclick = () => alert('Games coming soon: Big2, Chinese Chess');

function setSyncStatus(status, detail = '') {
  const element = document.getElementById('syncStatus');
  if (!element) return;
  const labels = {
    'local-only': 'Local only',
    'offline': 'Offline',
    'signed-out': 'Signed out',
    'syncing': 'Syncing…',
    'synced': 'Synced',
    'error': 'Sync needs attention'
  };
  element.textContent = detail ? `${labels[status] || status}: ${detail}` : (labels[status] || status);
}

function setSyncControlsSignedIn(signedIn) {
  document.getElementById('syncSignInBtn').hidden = signedIn;
  document.getElementById('syncSignUpBtn').hidden = signedIn;
  document.getElementById('syncSignOutBtn').hidden = !signedIn;
  document.getElementById('syncPassword').autocomplete = signedIn ? 'off' : 'current-password';
}

document.getElementById('syncSignInBtn').addEventListener('click', async () => {
  const email = document.getElementById('syncEmail').value.trim();
  const password = document.getElementById('syncPassword').value;
  if (!email || !password) { setSyncStatus('error', 'Enter your email and password.'); return; }
  try {
    const result = await signIn(email, password);
    if (result.legacyCacheCleared) customLists = [];
    customLists = await mergeLocalLists(customLists);
    saveLocalListCache();
    renderDeckSelect();
    await persistCustomLists(customLists);
    setSyncControlsSignedIn(true);
    document.getElementById('syncPassword').value = '';
    setSyncStatus('syncing', 'Account connected; local lists are being merged.');
  } catch (error) {
    setSyncStatus('error', error.message || String(error));
  }
});

document.getElementById('syncSignUpBtn').addEventListener('click', async () => {
  const email = document.getElementById('syncEmail').value.trim();
  const password = document.getElementById('syncPassword').value;
  if (!email || !password) { setSyncStatus('error', 'Enter your email and password.'); return; }
  if (password.length < 8) { setSyncStatus('error', 'Use a password with at least 8 characters.'); return; }
  try {
    const result = await signUp(email, password);
    if (result.legacyCacheCleared) customLists = [];
    const user = await currentSyncUser();
    if (user) {
      customLists = await mergeLocalLists(customLists);
      saveLocalListCache();
      renderDeckSelect();
      await persistCustomLists(customLists);
      setSyncControlsSignedIn(true);
      setSyncStatus('syncing', 'Account connected; local lists are being merged.');
    } else {
      setSyncStatus('signed-out', 'Account request sent. Verify your email if required, then sign in.');
    }
  } catch (error) {
    setSyncStatus('error', error.message || String(error));
  }
});

document.getElementById('syncSignOutBtn').addEventListener('click', async () => {
  try {
    await signOut();
    setSyncControlsSignedIn(false);
    setSyncStatus('signed-out', 'Local lists remain on this device.');
  } catch (error) {
    setSyncStatus('error', error.message || String(error));
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  restoreProgress();
  const p = new URLSearchParams(location.search);
  if(!p.has('deck') && !p.has('words') && uniqueChars.length === 0 && !deckRestored){
    // Default to Novice 1 if nothing loaded
    els.deckSelect.value = 'novice_1';
    loadDeck('novice_1');
  } else {
    loadFromURL();
  }

  const configuration = syncConfiguration();
  document.getElementById('syncSignInBtn').disabled = !configuration.configured;
  document.getElementById('syncSignUpBtn').disabled = !configuration.configured;
  if (!configuration.configured) {
    setSyncStatus('local-only', 'Cloud sync is not configured. Local practice and lists still work.');
  }
  try {
    const syncInit = await initVocabularySync({
      initialLists: customLists,
      onStatusChanged: ({ status, detail, signedIn }) => {
        setSyncStatus(status, detail);
        setSyncControlsSignedIn(Boolean(signedIn));
        if (!signedIn) {
          // Drop the previous account's in-memory cloud snapshot on every sign-out.
          customLists = deviceLocalLists(customLists);
          saveLocalListCache();
          renderDeckSelect();
        }
      },
      onListsChanged: async () => {
        try {
          customLists = await mergeLocalLists(customLists);
          saveLocalListCache();
          await persistLocalCustomLists(customLists);
          renderDeckSelect();
          if (activeCustomListId && customLists.some(list => list.name === activeCustomListId)) {
            const list = customLists.find(item => item.name === activeCustomListId);
            els.wordList.value = list.words.join('\\n');
          }
        } catch (error) {
          setSyncStatus('error', error.message || String(error));
        }
      }
    });
    if (syncInit.legacyCacheCleared) customLists = [];
    customLists = await mergeLocalLists(syncInit.localLists || customLists);
    saveLocalListCache();
    await persistLocalCustomLists(customLists);
    renderDeckSelect();
    const user = await currentSyncUser();
    if (user) {
      customLists = await mergeLocalLists(customLists);
      saveLocalListCache();
      await persistLocalCustomLists(customLists);
      renderDeckSelect();
      await persistCustomLists(customLists);
      setSyncControlsSignedIn(true);
    }
  } catch (error) {
    setSyncStatus('error', error.message || String(error));
  }
});
