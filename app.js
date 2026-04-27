const DATA = window.PROVERBS_DATA || [];
const $ = (id) => document.getElementById(id);

const chapterSelect = $('chapterSelect');
const verseSelect = $('verseSelect');
const versesEl = $('verses');
const favBtn = $('favBtn');
const currentRef = $('currentRef');
const listenHint = $('listenHint');

let currentChapter = Number(localStorage.getItem('chapter') || 1);
let currentVerse = Number(localStorage.getItem('verse') || 1);
let fontSize = Number(localStorage.getItem('fontSize') || 21);
let isReading = false;
let readingIndex = 0;
let currentUtterance = null;

const defaultVoiceSettings = { rate: 0.88, pitch: 1, voiceURI: '', autoScroll: true };

function getVoiceSettings() {
  try { return { ...defaultVoiceSettings, ...JSON.parse(localStorage.getItem('voiceSettings') || '{}') }; }
  catch { return defaultVoiceSettings; }
}

function key(c, v) { return `p-${c}-${v}`; }
function favs() { return JSON.parse(localStorage.getItem('favs') || '[]'); }
function saveFavs(a) { localStorage.setItem('favs', JSON.stringify(a)); }
function noteKey(c, v) { return `note-${c}-${v}`; }
function getChapter(n) { return DATA.find(x => Number(x.chapter) === Number(n)); }

function init() {
  document.documentElement.style.setProperty('--font', fontSize + 'px');
  if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');

  for (let i = 1; i <= 31; i++) {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = `${i}장`;
    chapterSelect.appendChild(o);
  }

  chapterSelect.value = currentChapter;
  renderChapter();
  bind();
  registerSW();
}

function bind() {
  chapterSelect.onchange = () => {
    stopSpeak();
    currentChapter = Number(chapterSelect.value);
    currentVerse = 1;
    savePos();
    renderChapter(true);
  };

  verseSelect.onchange = () => {
    stopSpeak();
    currentVerse = Number(verseSelect.value);
    savePos();
    highlightAndScroll(true);
  };

  $('speakBtn').onclick = speakFromSelected;
  $('stopBtn').onclick = stopSpeak;
  $('prevBtn').onclick = () => changeChapter(-1);
  $('nextBtn').onclick = () => changeChapter(1);

  favBtn.onclick = () => toggleFavorite(currentChapter, currentVerse, true);
  $('noteOpenBtn').onclick = () => openNote(currentChapter, currentVerse);
  $('noteCloseBtn').onclick = () => $('notePanel').classList.add('hidden');
  $('noteSaveBtn').onclick = saveNote;
  $('favListBtn').onclick = renderFavs;
  $('favCloseBtn').onclick = () => $('favPanel').classList.add('hidden');
}

function renderChapter(scrollTop = false) {
  const ch = getChapter(currentChapter);
  if (!ch) return;

  chapterSelect.value = currentChapter;
  verseSelect.innerHTML = '';
  ch.verses.forEach(v => {
    const o = document.createElement('option');
    o.value = v.verse;
    o.textContent = `${v.verse}절부터`;
    verseSelect.appendChild(o);
  });

  if (!ch.verses.some(v => Number(v.verse) === Number(currentVerse))) currentVerse = 1;
  verseSelect.value = currentVerse;

  const favSet = new Set(favs());
  versesEl.innerHTML = `
    <div class="chapter-title">
      <h2>잠언 ${currentChapter}장</h2>
      <p>절을 터치하면 선택되고, 아래 읽기를 누르면 그 절부터 계속 읽습니다.</p>
    </div>
    ${ch.verses.map(v => {
      const k = key(currentChapter, v.verse);
      const hasNote = !!localStorage.getItem(noteKey(currentChapter, v.verse));
      return `<section class="verse ${v.verse === currentVerse ? 'active' : ''} ${favSet.has(k) ? 'is-fav' : ''} ${hasNote ? 'has-note' : ''}" tabindex="0" data-verse="${v.verse}">
        <span class="verse-num" aria-label="${v.verse}절">${v.verse}</span>
        <div class="verse-text">${escapeHtml(v.text)}</div>
      </section>`;
    }).join('')}`;

  versesEl.querySelectorAll('.verse').forEach(el => {
    el.addEventListener('click', () => {
      stopSpeak();
      currentVerse = Number(el.dataset.verse);
      verseSelect.value = currentVerse;
      savePos();
      highlightAndScroll(true);
    });
    el.addEventListener('dblclick', () => {
      currentVerse = Number(el.dataset.verse);
      verseSelect.value = currentVerse;
      savePos();
      speakFromSelected();
    });
  });

  updateSelectedUI();
  if (scrollTop) window.scrollTo({ top: 0, behavior: 'smooth' });
  else highlightAndScroll(false);
}

function highlightAndScroll(doScroll) {
  document.querySelectorAll('.verse').forEach(v => v.classList.toggle('active', Number(v.dataset.verse) === currentVerse));
  updateSelectedUI();
  if (doScroll) scrollToVerse(currentVerse, 'center');
}

function scrollToVerse(v, block = 'center') {
  const el = document.querySelector(`.verse[data-verse="${v}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block });
  el.focus({ preventScroll: true });
}

function updateSelectedUI() {
  currentRef.textContent = `잠언 ${currentChapter}장 ${currentVerse}절`;
  updateFavButton();
}

function savePos() {
  localStorage.setItem('chapter', currentChapter);
  localStorage.setItem('verse', currentVerse);
}

function changeChapter(d) {
  stopSpeak();
  currentChapter = Math.min(31, Math.max(1, currentChapter + d));
  currentVerse = 1;
  savePos();
  renderChapter(true);
}

function speakFromSelected() {
  stopSpeak(false);
  if (!('speechSynthesis' in window)) {
    alert('이 브라우저는 음성 읽기를 지원하지 않아요.');
    return;
  }
  const ch = getChapter(currentChapter);
  if (!ch) return;

  const startIndex = ch.verses.findIndex(v => Number(v.verse) === Number(currentVerse));
  readingIndex = Math.max(0, startIndex);
  isReading = true;
  document.body.classList.add('reading');
  $('speakBtn').textContent = '읽는 중';
  readNextVerse();
}

function readNextVerse() {
  if (!isReading) return;
  const ch = getChapter(currentChapter);
  if (!ch || readingIndex >= ch.verses.length) {
    stopSpeak();
    listenHint.textContent = '읽기가 끝났어요.';
    return;
  }

  const verse = ch.verses[readingIndex];
  currentVerse = Number(verse.verse);
  verseSelect.value = currentVerse;
  savePos();
  highlightCurrentReading();

  const settings = getVoiceSettings();
  if (settings.autoScroll) scrollToVerse(currentVerse, 'center');

  listenHint.textContent = `${currentVerse}절 말씀을 읽는 중`;

  const u = new SpeechSynthesisUtterance(verse.text); // 음성은 본문만 읽음
  u.lang = 'ko-KR';
  u.rate = Number(settings.rate || 0.88);
  u.pitch = Number(settings.pitch || 1);

  const voices = speechSynthesis.getVoices();
  const selected = voices.find(v => v.voiceURI === settings.voiceURI) || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('ko'));
  if (selected) u.voice = selected;

  u.onend = () => {
    if (!isReading) return;
    readingIndex += 1;
    setTimeout(readNextVerse, 180);
  };
  u.onerror = () => {
    if (!isReading) return;
    readingIndex += 1;
    setTimeout(readNextVerse, 180);
  };

  currentUtterance = u;
  speechSynthesis.speak(u);
}

function highlightCurrentReading() {
  document.querySelectorAll('.verse').forEach(v => {
    const on = Number(v.dataset.verse) === Number(currentVerse);
    v.classList.toggle('active', on);
    v.classList.toggle('reading-now', on);
  });
  updateSelectedUI();
}

function stopSpeak(resetText = true) {
  isReading = false;
  currentUtterance = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  document.body.classList.remove('reading');
  document.querySelectorAll('.verse').forEach(v => v.classList.remove('reading-now'));
  $('speakBtn').textContent = '선택 절부터 읽기';
  if (resetText) listenHint.textContent = '절을 터치하면 그 절부터 읽을 수 있어요.';
}

function toggleFavorite(c, v, rerender = false) {
  const k = key(c, v);
  let a = favs();
  a = a.includes(k) ? a.filter(x => x !== k) : [k, ...a];
  saveFavs(a);
  if (rerender) renderChapter(false);
  updateFavButton();
}

function updateFavButton() {
  favBtn.textContent = favs().includes(key(currentChapter, currentVerse)) ? '★ 해제' : '☆ 저장';
}

function openNote(c, v) {
  stopSpeak();
  $('notePanel').classList.remove('hidden');
  $('favPanel').classList.add('hidden');
  $('noteTitle').textContent = `잠언 ${c}장 ${v}절 노트`;
  $('noteText').value = localStorage.getItem(noteKey(c, v)) || '';
  $('noteText').focus();
}

function saveNote() {
  localStorage.setItem(noteKey(currentChapter, currentVerse), $('noteText').value.trim());
  $('notePanel').classList.add('hidden');
  renderChapter(false);
}

function renderFavs() {
  stopSpeak();
  $('favPanel').classList.remove('hidden');
  $('notePanel').classList.add('hidden');
  const a = favs();
  if (!a.length) {
    $('favList').innerHTML = '<p class="hint">아직 즐겨찾기가 없습니다.</p>';
    return;
  }
  $('favList').innerHTML = a.map(k => {
    const [, c, v] = k.split('-').map(Number);
    const ch = getChapter(c);
    const verse = ch?.verses.find(x => Number(x.verse) === Number(v));
    return `<div class="fav-item"><strong>잠언 ${c}장 ${v}절</strong><div>${escapeHtml(verse?.text || '')}</div><button data-c="${c}" data-v="${v}" type="button">이동</button></div>`;
  }).join('');
  $('favList').querySelectorAll('button').forEach(b => b.onclick = () => {
    currentChapter = Number(b.dataset.c);
    currentVerse = Number(b.dataset.v);
    savePos();
    $('favPanel').classList.add('hidden');
    renderChapter(false);
    setTimeout(() => highlightAndScroll(true), 50);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function registerSW() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

init();
