/* ===================== Storage ===================== */
const DIARY_KEY = 'wd_diary_v1';
const SHOWS_KEY = 'wd_shows_v1';
const SEEDED_KEY = 'wd_seeded_v1';

function loadDiary(){
  const raw = localStorage.getItem(DIARY_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveDiary(list){
  localStorage.setItem(DIARY_KEY, JSON.stringify(list));
}
function loadShows(){
  const raw = localStorage.getItem(SHOWS_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveShows(list){
  localStorage.setItem(SHOWS_KEY, JSON.stringify(list));
}

function ensureSeeded(){
  if (!localStorage.getItem(SEEDED_KEY)) {
    saveDiary(SEED_DIARY);
    saveShows(SEED_SHOWS);
    localStorage.setItem(SEEDED_KEY, '1');
  }
}
ensureSeeded();

let diary = loadDiary();
let shows = loadShows();

function persist(){
  saveDiary(diary);
  saveShows(shows);
}

function newId(prefix){
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

/* ===================== Utilities ===================== */
function fmtDate(iso){
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}
function fmtDateShort(iso){
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { day:'numeric', month:'short' });
}
function todayISO(){
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off*60000);
  return local.toISOString().slice(0,10);
}
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(()=> t.classList.remove('show'), 1800);
}
function escapeHtml(s){
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ===================== Navigation ===================== */
const screens = ['diary','shows','stats','show-detail'];
function showScreen(name){
  screens.forEach(s => {
    document.getElementById('screen-' + s).classList.toggle('active', s === name);
  });
  document.querySelectorAll('nav.tabbar button').forEach(b=>{
    b.classList.toggle('active', b.dataset.screen === name);
  });
  const fab = document.getElementById('fab-add');
  fab.style.display = (name === 'diary' || name === 'shows') ? 'block' : 'none';
  window.scrollTo(0,0);
}
document.querySelectorAll('nav.tabbar button').forEach(b=>{
  b.addEventListener('click', ()=> {
    showScreen(b.dataset.screen);
    if (b.dataset.screen === 'shows') renderShows();
    if (b.dataset.screen === 'stats') renderStats();
    if (b.dataset.screen === 'diary') renderDiary();
  });
});

document.getElementById('fab-add').addEventListener('click', ()=>{
  const active = document.querySelector('nav.tabbar button.active').dataset.screen;
  if (active === 'shows') openShowSheet(null);
  else openEntrySheet(null);
});

/* ===================== Diary rendering ===================== */
function renderDiary(filter){
  const list = document.getElementById('diary-list');
  const q = (filter || '').trim().toLowerCase();
  let items = diary.slice().sort((a,b)=> (b.date||'').localeCompare(a.date||'') || b.id.localeCompare(a.id));
  if (q) items = items.filter(e => (e.name||'').toLowerCase().includes(q));

  document.getElementById('diary-sub').textContent = diary.length.toLocaleString() + ' entries logged';

  if (!items.length){
    list.innerHTML = `<div class="empty"><div class="t">${q ? 'No matches' : 'No entries yet'}</div>${q ? 'Try a different search.' : 'Tap + to log the first thing you watched.'}</div>`;
    return;
  }

  let html = '';
  let lastDate = null;
  for (const e of items){
    if (e.date !== lastDate){
      html += `<div class="date-heading">${fmtDate(e.date)}</div>`;
      lastDate = e.date;
    }
    const epLabel = [
      e.season != null && e.season !== '' ? 'S' + e.season : null,
      e.episode != null && e.episode !== '' ? 'E' + e.episode : null
    ].filter(Boolean).join(' ');
    html += `
      <div class="stub" data-id="${e.id}">
        <div class="stub-main">
          <div class="show-name">${escapeHtml(e.name)}</div>
          <div class="meta">${epLabel ? `<span>${epLabel}</span>` : ''}${e.genre ? `<span>${escapeHtml(e.genre)}</span>` : ''}${e.timeMin ? `<span>${e.timeMin} min</span>` : ''}</div>
          ${e.comment ? `<div class="comment">${escapeHtml(e.comment)}</div>` : ''}
        </div>
        <div class="stub-divider"></div>
        <div class="rating-badge">${e.rating != null && e.rating !== '' ? e.rating : '—'}<span class="of10">/10</span></div>
      </div>`;
  }
  list.innerHTML = html;
  list.querySelectorAll('.stub').forEach(el=>{
    el.addEventListener('click', ()=> openEntrySheet(el.dataset.id));
  });
}
document.getElementById('diary-search').addEventListener('input', e => renderDiary(e.target.value));

/* ===================== Shows rendering ===================== */
function showStatsFor(name){
  const entries = diary.filter(e => e.name === name);
  const ratings = entries.map(e => Number(e.rating)).filter(n => !isNaN(n));
  const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length) : null;
  const totalMin = entries.reduce((sum,e)=> sum + (Number(e.timeMin)||0), 0);
  const lastWatched = entries.map(e=>e.date).filter(Boolean).sort().slice(-1)[0];
  return { count: entries.length, avg, totalMin, lastWatched, entries };
}

function renderShows(filter){
  const list = document.getElementById('shows-list');
  const q = (filter || '').trim().toLowerCase();
  let items = shows.slice().sort((a,b)=> a.name.localeCompare(b.name));
  if (q) items = items.filter(s => s.name.toLowerCase().includes(q));

  document.getElementById('shows-sub').textContent = shows.length.toLocaleString() + ' shows tracked';

  if (!items.length){
    list.innerHTML = `<div class="empty"><div class="t">${q ? 'No matches' : 'No shows yet'}</div>${q ? 'Try a different search.' : 'Tap + to add a show.'}</div>`;
    return;
  }

  let html = '';
  for (const s of items){
    const st = showStatsFor(s.name);
    html += `
      <div class="show-row" data-id="${s.id}">
        <div class="top">
          <div class="show-name">${escapeHtml(s.name)}</div>
          <span class="pill ${s.ended ? 'ended' : 'ongoing'}">${s.ended ? 'Ended' : 'Ongoing'}</span>
        </div>
        <div class="meta">
          ${escapeHtml(s.genre || '—')} · ${s.seasons || '?'} season${s.seasons==1?'':'s'} · ${s.episodes || '?'} episodes
          ${st.count ? ` · watched ${st.count}${st.avg!=null ? `, avg ${st.avg.toFixed(1)}` : ''}` : ' · not started'}
        </div>
      </div>`;
  }
  list.innerHTML = html;
  list.querySelectorAll('.show-row').forEach(el=>{
    el.addEventListener('click', ()=> openShowDetail(el.dataset.id));
  });
}
document.getElementById('shows-search').addEventListener('input', e => renderShows(e.target.value));

/* ===================== Show detail ===================== */
let currentShowId = null;
function openShowDetail(id){
  const s = shows.find(x => x.id === id);
  if (!s) return;
  currentShowId = id;
  document.getElementById('sd-title').textContent = s.name;
  const st = showStatsFor(s.name);
  document.getElementById('sd-sub').textContent = escapeHtml(s.genre || '') + (s.ended ? ' · Ended' : ' · Ongoing');

  const hrs = (st.totalMin/60).toFixed(1);
  let body = `
    <div class="stat-grid">
      <div class="stat-card"><div class="n">${st.count}</div><div class="l">episodes logged</div></div>
      <div class="stat-card"><div class="n">${st.avg != null ? st.avg.toFixed(1) : '—'}</div><div class="l">average rating</div></div>
      <div class="stat-card"><div class="n">${hrs}</div><div class="l">hours watched</div></div>
      <div class="stat-card"><div class="n">${st.lastWatched ? fmtDateShort(st.lastWatched) : '—'}</div><div class="l">last watched</div></div>
    </div>
    <div class="sheet-actions">
      <button class="btn btn-secondary" id="sd-edit">Edit show</button>
      <button class="btn btn-primary" id="sd-log">Log an episode</button>
    </div>
    <div class="section-title">Watch history</div>`;

  const entries = st.entries.slice().sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  if (!entries.length){
    body += `<div class="empty"><div class="t">Nothing logged yet</div>Log the first episode above.</div>`;
  } else {
    for (const e of entries){
      const epLabel = [
        e.season != null && e.season !== '' ? 'S' + e.season : null,
        e.episode != null && e.episode !== '' ? 'E' + e.episode : null
      ].filter(Boolean).join(' ');
      body += `
        <div class="stub" data-id="${e.id}">
          <div class="stub-main">
            <div class="show-name" style="font-size:15.5px;">${epLabel || 'Watched'}</div>
            <div class="meta"><span>${fmtDate(e.date)}</span>${e.timeMin ? `<span>${e.timeMin} min</span>` : ''}</div>
            ${e.comment ? `<div class="comment">${escapeHtml(e.comment)}</div>` : ''}
          </div>
          <div class="stub-divider"></div>
          <div class="rating-badge">${e.rating != null && e.rating !== '' ? e.rating : '—'}<span class="of10">/10</span></div>
        </div>`;
    }
  }

  document.getElementById('sd-body').innerHTML = body;
  document.getElementById('sd-edit').addEventListener('click', ()=> openShowSheet(id));
  document.getElementById('sd-log').addEventListener('click', ()=>{
    openEntrySheet(null, s.name, s.genre);
  });
  document.getElementById('sd-body').querySelectorAll('.stub').forEach(el=>{
    el.addEventListener('click', ()=> openEntrySheet(el.dataset.id));
  });

  showScreen('show-detail');
}

/* ===================== Entry sheet (add/edit) ===================== */
let editingEntryId = null;
function refreshShowNamesDatalist(){
  const dl = document.getElementById('show-names');
  const names = Array.from(new Set(shows.map(s=>s.name))).sort();
  dl.innerHTML = names.map(n => `<option value="${escapeHtml(n)}">`).join('');
}

function openEntrySheet(id, presetName, presetGenre){
  editingEntryId = id;
  const overlay = document.getElementById('entry-overlay');
  refreshShowNamesDatalist();

  if (id){
    const e = diary.find(x=>x.id===id);
    document.getElementById('entry-sheet-title').textContent = 'Edit entry';
    document.getElementById('e-name').value = e.name || '';
    document.getElementById('e-date').value = e.date || todayISO();
    document.getElementById('e-genre').value = e.genre || '';
    document.getElementById('e-season').value = e.season ?? '';
    document.getElementById('e-episode').value = e.episode ?? '';
    document.getElementById('e-time').value = e.timeMin ?? '';
    document.getElementById('e-rating').value = e.rating ?? 7;
    document.getElementById('e-comment').value = e.comment || '';
    document.getElementById('entry-delete-row').style.display = 'flex';
  } else {
    document.getElementById('entry-sheet-title').textContent = 'Log a watch';
    document.getElementById('e-name').value = presetName || '';
    document.getElementById('e-date').value = todayISO();
    document.getElementById('e-genre').value = presetGenre || '';
    document.getElementById('e-season').value = '';
    document.getElementById('e-episode').value = '';
    document.getElementById('e-time').value = '';
    document.getElementById('e-rating').value = 7;
    document.getElementById('e-comment').value = '';
    document.getElementById('entry-delete-row').style.display = 'none';
  }
  document.getElementById('e-rating-val').textContent = document.getElementById('e-rating').value;
  overlay.classList.add('active');
}
document.getElementById('e-rating').addEventListener('input', e=>{
  document.getElementById('e-rating-val').textContent = e.target.value;
});
function closeEntrySheet(){
  document.getElementById('entry-overlay').classList.remove('active');
}
document.getElementById('entry-cancel').addEventListener('click', closeEntrySheet);
document.getElementById('entry-overlay').addEventListener('click', e=>{
  if (e.target.id === 'entry-overlay') closeEntrySheet();
});
document.getElementById('entry-save').addEventListener('click', ()=>{
  const name = document.getElementById('e-name').value.trim();
  if (!name){ toast('Add a show name'); return; }
  const data = {
    name,
    date: document.getElementById('e-date').value || todayISO(),
    genre: document.getElementById('e-genre').value.trim(),
    season: document.getElementById('e-season').value === '' ? '' : Number(document.getElementById('e-season').value),
    episode: document.getElementById('e-episode').value === '' ? '' : Number(document.getElementById('e-episode').value),
    timeMin: document.getElementById('e-time').value === '' ? '' : Number(document.getElementById('e-time').value),
    rating: Number(document.getElementById('e-rating').value),
    comment: document.getElementById('e-comment').value.trim(),
  };
  data.hours = data.timeMin ? Math.round((data.timeMin/60)*100)/100 : '';

  if (editingEntryId){
    const idx = diary.findIndex(x=>x.id===editingEntryId);
    diary[idx] = { ...diary[idx], ...data };
    toast('Entry updated');
  } else {
    data.id = newId('d');
    diary.push(data);
    // auto-add show to master list if not present
    if (!shows.find(s => s.name.toLowerCase() === name.toLowerCase())){
      shows.push({ id: newId('s'), name, genre: data.genre, seasons: '', episodes: '', timePerEp: data.timeMin || '', timeToInvest: '', ended: false });
    }
    toast('Watch logged');
  }
  persist();
  closeEntrySheet();
  renderDiary(document.getElementById('diary-search').value);
  if (document.getElementById('screen-show-detail').classList.contains('active') && currentShowId){
    openShowDetail(currentShowId);
  }
});
document.getElementById('entry-delete').addEventListener('click', ()=>{
  if (!editingEntryId) return;
  diary = diary.filter(x => x.id !== editingEntryId);
  persist();
  closeEntrySheet();
  renderDiary(document.getElementById('diary-search').value);
  if (document.getElementById('screen-show-detail').classList.contains('active') && currentShowId){
    openShowDetail(currentShowId);
  }
  toast('Entry deleted');
});

/* ===================== Show sheet (add/edit) ===================== */
let editingShowId = null;
function openShowSheet(id){
  editingShowId = id;
  const overlay = document.getElementById('show-overlay');
  if (id){
    const s = shows.find(x=>x.id===id);
    document.getElementById('show-sheet-title').textContent = 'Edit show';
    document.getElementById('s-name').value = s.name || '';
    document.getElementById('s-genre').value = s.genre || '';
    document.getElementById('s-status').value = s.ended ? 'yes' : 'no';
    document.getElementById('s-seasons').value = s.seasons ?? '';
    document.getElementById('s-episodes').value = s.episodes ?? '';
    document.getElementById('s-timeperep').value = s.timePerEp ?? '';
    document.getElementById('show-delete-row').style.display = 'flex';
  } else {
    document.getElementById('show-sheet-title').textContent = 'Add a show';
    document.getElementById('s-name').value = '';
    document.getElementById('s-genre').value = '';
    document.getElementById('s-status').value = 'no';
    document.getElementById('s-seasons').value = '';
    document.getElementById('s-episodes').value = '';
    document.getElementById('s-timeperep').value = '';
    document.getElementById('show-delete-row').style.display = 'none';
  }
  overlay.classList.add('active');
}
function closeShowSheet(){
  document.getElementById('show-overlay').classList.remove('active');
}
document.getElementById('show-cancel').addEventListener('click', closeShowSheet);
document.getElementById('show-overlay').addEventListener('click', e=>{
  if (e.target.id === 'show-overlay') closeShowSheet();
});
document.getElementById('show-save').addEventListener('click', ()=>{
  const name = document.getElementById('s-name').value.trim();
  if (!name){ toast('Add a show name'); return; }
  const data = {
    name,
    genre: document.getElementById('s-genre').value.trim(),
    ended: document.getElementById('s-status').value === 'yes',
    seasons: document.getElementById('s-seasons').value === '' ? '' : Number(document.getElementById('s-seasons').value),
    episodes: document.getElementById('s-episodes').value === '' ? '' : Number(document.getElementById('s-episodes').value),
    timePerEp: document.getElementById('s-timeperep').value === '' ? '' : Number(document.getElementById('s-timeperep').value),
  };
  if (editingShowId){
    const idx = shows.findIndex(x=>x.id===editingShowId);
    shows[idx] = { ...shows[idx], ...data };
    toast('Show updated');
  } else {
    data.id = newId('s');
    data.timeToInvest = '';
    shows.push(data);
    toast('Show added');
  }
  persist();
  closeShowSheet();
  renderShows(document.getElementById('shows-search').value);
  if (document.getElementById('screen-show-detail').classList.contains('active') && currentShowId === editingShowId){
    openShowDetail(editingShowId);
  }
});
document.getElementById('show-delete').addEventListener('click', ()=>{
  if (!editingShowId) return;
  shows = shows.filter(x => x.id !== editingShowId);
  persist();
  closeShowSheet();
  renderShows(document.getElementById('shows-search').value);
  showScreen('shows');
  toast('Show removed');
});

/* ===================== Stats: chart primitives ===================== */
function sizeCanvasToParent(canvas, cssHeight){
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.parentElement.clientWidth;
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return { ctx, w: cssWidth, h: cssHeight };
}
function roundRectPath(ctx,x,y,w,h,r){
  r = Math.min(r, w/2, Math.max(h,0.001)/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function drawBarChart(canvas, labels, values, opts){
  opts = opts || {};
  const { ctx, w, h } = sizeCanvasToParent(canvas, opts.height || 150);
  ctx.clearRect(0,0,w,h);
  const n = values.length;
  if (!n) return;
  const max = Math.max(1, ...values);
  const gap = opts.gap ?? (n > 16 ? 3 : 8);
  const labelSpace = opts.showLabels === false ? 6 : 18;
  const valueSpace = opts.showValues ? 16 : 4;
  const baseline = h - labelSpace;
  const topPad = valueSpace;
  const plotH = baseline - topPad;
  const barW = (w - gap*(n-1)) / n;

  canvas._bars = [];
  values.forEach((v,i)=>{
    const bh = max > 0 ? (v/max) * plotH : 0;
    const x = i*(barW+gap);
    const y = baseline - bh;
    const isHi = opts.highlightIndex === i;
    ctx.fillStyle = isHi ? getCss('--amber') : (opts.colorHex || getCss('--teal'));
    if (bh > 0.5) { roundRectPath(ctx, x, y, Math.max(1,barW), bh, Math.min(3, barW/2)); ctx.fill(); }
    if (opts.showValues && v > 0){
      ctx.fillStyle = getCss('--text-dim');
      ctx.font = '9.5px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opts.valueFmt ? opts.valueFmt(v) : String(Math.round(v)), x+barW/2, y-4 < 9 ? 9 : y-4);
    }
    if (opts.showLabels !== false && labels[i] != null){
      ctx.fillStyle = isHi ? getCss('--amber') : getCss('--text-dim');
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x+barW/2, h-5);
    }
    canvas._bars.push({ x, w: barW, index: i });
  });
}
let _cssCache = {};
function getCss(varName){
  if (_cssCache[varName]) return _cssCache[varName];
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  _cssCache[varName] = v;
  return v;
}
function attachBarClick(canvas, onClick){
  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const bars = canvas._bars || [];
    for (const b of bars){
      if (x >= b.x && x <= b.x + b.w){ onClick(b.index); return; }
    }
  };
}

/* ===================== Stats: state & filters ===================== */
let statsYearFilter = 'all';   // 'all' or a year string
let statsGenreFilter = 'all';  // 'all' or a genre string

function scopedEntries(){
  return diary.filter(e => {
    if (statsYearFilter !== 'all' && !(e.date||'').startsWith(statsYearFilter)) return false;
    if (statsGenreFilter !== 'all' && (e.genre||'').trim() !== statsGenreFilter) return false;
    return true;
  });
}
function hoursOf(entries){
  return entries.reduce((s,e)=> s + (Number(e.timeMin)||0), 0) / 60;
}
function avgRatingOf(entries){
  const r = entries.map(e=>Number(e.rating)).filter(n=>!isNaN(n));
  return r.length ? r.reduce((a,b)=>a+b,0)/r.length : null;
}

function renderYearChips(){
  const years = Array.from(new Set(diary.map(e => (e.date||'').slice(0,4)).filter(Boolean))).sort();
  const row = document.getElementById('year-chips');
  let html = `<button class="chip ${statsYearFilter==='all'?'active':''}" data-year="all">All time</button>`;
  years.forEach(y => {
    html += `<button class="chip ${statsYearFilter===y?'active':''}" data-year="${y}">${y}</button>`;
  });
  row.innerHTML = html;
  row.querySelectorAll('.chip').forEach(el=>{
    el.addEventListener('click', ()=>{
      statsYearFilter = el.dataset.year;
      renderStats();
    });
  });
}
function renderGenreChips(){
  const counts = {};
  diary.forEach(e=>{
    const g = (e.genre||'').trim();
    if (!g) return;
    counts[g] = (counts[g]||0) + 1;
  });
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,12).map(x=>x[0]);
  const row = document.getElementById('genre-chips');
  let html = `<button class="chip ${statsGenreFilter==='all'?'active':''}" data-genre="all">All genres</button>`;
  top.forEach(g=>{
    html += `<button class="chip ${statsGenreFilter===g?'active':''}" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</button>`;
  });
  row.innerHTML = html;
  row.querySelectorAll('.chip').forEach(el=>{
    el.addEventListener('click', ()=>{
      statsGenreFilter = el.dataset.genre;
      renderStats();
    });
  });
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const bestIcons = {
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c1 1 1.5 2.3 1.5 3.5A4.5 4.5 0 0 1 12 18a6 6 0 0 1-6-6c0-4 3-6 3-8 1 1 1.5 2.5 1 3.5C11 6 12 4 12 2z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
};

function renderStats(){
  renderYearChips();
  renderGenreChips();

  const scoped = scopedEntries();
  const scopeLabel = [
    statsYearFilter === 'all' ? 'all time' : statsYearFilter,
    statsGenreFilter === 'all' ? null : statsGenreFilter
  ].filter(Boolean).join(' · ');
  document.getElementById('stats-sub').textContent = 'Showing ' + scopeLabel;

  const totalHours = hoursOf(scoped);
  const totalEpisodes = scoped.length;
  const avgRating = avgRatingOf(scoped);

  const dates = scoped.map(e=>e.date).filter(Boolean).sort();
  const first = dates[0], last = dates[dates.length-1];
  let perWeek = '—', perMonth = '—', perDay = '—';
  if (first && last){
    const days = Math.max(1, (new Date(last) - new Date(first)) / 86400000);
    perDay = (totalHours / days).toFixed(2);
    perWeek = (totalHours / (days/7)).toFixed(1);
    perMonth = (totalHours / (days/30.44)).toFixed(1);
  }
  const showsInScope = new Set(scoped.map(e=>e.name)).size;

  // delta vs previous year, only meaningful when one specific year selected
  let deltaHtml = '';
  if (statsYearFilter !== 'all'){
    const prevYear = String(Number(statsYearFilter) - 1);
    const prevEntries = diary.filter(e => (e.date||'').startsWith(prevYear) && (statsGenreFilter==='all' || (e.genre||'').trim()===statsGenreFilter));
    if (prevEntries.length){
      const prevHours = hoursOf(prevEntries);
      const diff = totalHours - prevHours;
      const pct = prevHours > 0 ? Math.round((diff/prevHours)*100) : null;
      if (pct != null){
        deltaHtml = `<span class="delta ${diff>=0?'up':'down'}">${diff>=0?'▲':'▼'} ${Math.abs(pct)}% vs ${prevYear}</span>`;
      }
    }
  }

  let html = `
    <div class="hero">
      <div class="big">${totalHours.toFixed(0)} hrs ${deltaHtml}</div>
      <div class="label">watched across ${totalEpisodes.toLocaleString()} episodes${statsGenreFilter!=='all' ? ' · ' + escapeHtml(statsGenreFilter) : ''}</div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="n">${avgRating != null ? avgRating.toFixed(2) : '—'}</div><div class="l">average rating</div></div>
      <div class="stat-card"><div class="n">${showsInScope}</div><div class="l">shows in this view</div></div>
      <div class="stat-card"><div class="n">${perWeek}</div><div class="l">hours / week</div></div>
      <div class="stat-card"><div class="n">${perMonth}</div><div class="l">hours / month</div></div>
      <div class="stat-card"><div class="n">${perDay}</div><div class="l">hours / day</div></div>
      <div class="stat-card"><div class="n">${dates.length ? fmtDateShort(last) : '—'}</div><div class="l">most recent watch</div></div>
    </div>`;

  if (!scoped.length){
    html += `<div class="empty"><div class="t">Nothing in this view</div>Try a different year or genre.</div>`;
    document.getElementById('stats-body').innerHTML = html;
    return;
  }

  // ---- Best of ----
  const byShowHours = {}, byShowRatings = {}, byDate = {};
  scoped.forEach(e=>{
    byShowHours[e.name] = (byShowHours[e.name]||0) + (Number(e.timeMin)||0)/60;
    if (!byShowRatings[e.name]) byShowRatings[e.name] = [];
    if (!isNaN(Number(e.rating))) byShowRatings[e.name].push(Number(e.rating));
    if (e.date){ (byDate[e.date] = byDate[e.date] || []).push(e); }
  });
  const mostWatched = Object.entries(byShowHours).sort((a,b)=>b[1]-a[1])[0];
  let ratedList = Object.entries(byShowRatings).filter(([,r])=>r.length>=3);
  if (!ratedList.length) ratedList = Object.entries(byShowRatings).filter(([,r])=>r.length>=1);
  const topRated = ratedList.map(([n,r])=>[n, r.reduce((a,b)=>a+b,0)/r.length, r.length]).sort((a,b)=>b[1]-a[1])[0];
  const busiestDay = Object.entries(byDate).sort((a,b)=>b[1].length-a[1].length)[0];

  const uniqueDates = Object.keys(byDate).sort();
  let longestStreak = 1, curStreak = 1, streakEnd = uniqueDates[0];
  for (let i=1;i<uniqueDates.length;i++){
    const prev = new Date(uniqueDates[i-1]), cur = new Date(uniqueDates[i]);
    if ((cur-prev)/86400000 === 1){
      curStreak++;
      if (curStreak > longestStreak){ longestStreak = curStreak; streakEnd = uniqueDates[i]; }
    } else curStreak = 1;
  }

  html += `<div class="section-title">Best of ${statsYearFilter==='all' ? 'all time' : statsYearFilter}</div>`;
  html += `<div class="best-grid">`;
  if (mostWatched){
    html += `<div class="best-card"><div class="icon">${bestIcons.trophy}</div><div class="body"><div class="k">Most watched</div><div class="v">${escapeHtml(mostWatched[0])}<span class="sec">${mostWatched[1].toFixed(0)}h</span></div></div></div>`;
  }
  if (topRated){
    html += `<div class="best-card"><div class="icon">${bestIcons.star}</div><div class="body"><div class="k">Highest rated${topRated[2]<3?' (limited data)':''}</div><div class="v">${escapeHtml(topRated[0])}<span class="sec">${topRated[1].toFixed(1)}/10</span></div></div></div>`;
  }
  if (longestStreak > 1){
    html += `<div class="best-card"><div class="icon">${bestIcons.flame}</div><div class="body"><div class="k">Longest daily streak</div><div class="v">${longestStreak} days<span class="sec">ending ${fmtDateShort(streakEnd)}</span></div></div></div>`;
  }
  if (busiestDay){
    html += `<div class="best-card"><div class="icon">${bestIcons.bolt}</div><div class="body"><div class="k">Busiest day</div><div class="v">${fmtDate(busiestDay[0])}<span class="sec">${busiestDay[1].length} episodes</span></div></div></div>`;
  }
  html += `</div>`;

  // ---- Yearly chart (always full history so you can click any year) ----
  const allYears = Array.from(new Set(diary.map(e=>(e.date||'').slice(0,4)).filter(Boolean))).sort();
  const genreScopedDiary = statsGenreFilter==='all' ? diary : diary.filter(e=>(e.genre||'').trim()===statsGenreFilter);
  const yearHours = allYears.map(y => hoursOf(genreScopedDiary.filter(e=>(e.date||'').startsWith(y))));
  const highlightIdx = statsYearFilter==='all' ? -1 : allYears.indexOf(statsYearFilter);

  html += `<div class="section-title">Hours by year</div><div class="section-sub">Tap a bar to filter the page to that year</div>`;
  html += `<div class="chart-card"><canvas id="chart-years"></canvas></div>`;

  // ---- Monthly chart ----
  let monthValues, monthSub;
  if (statsYearFilter !== 'all'){
    monthValues = MONTHS.map((_,i)=>{
      const mm = String(i+1).padStart(2,'0');
      return hoursOf(scoped.filter(e => (e.date||'').slice(5,7) === mm));
    });
    monthSub = `Hours per month in ${statsYearFilter}`;
  } else {
    monthValues = MONTHS.map((_,i)=>{
      const mm = String(i+1).padStart(2,'0');
      return hoursOf(scoped.filter(e => (e.date||'').slice(5,7) === mm));
    });
    monthSub = 'Hours per calendar month, across every year';
  }
  html += `<div class="section-title">By month</div><div class="section-sub">${monthSub}</div>`;
  html += `<div class="chart-card"><canvas id="chart-months"></canvas></div>`;

  // ---- Day of week chart ----
  const dowHours = [0,0,0,0,0,0,0];
  scoped.forEach(e=>{
    if (!e.date) return;
    const jsDay = new Date(e.date + 'T00:00:00').getDay(); // 0=Sun
    const idx = (jsDay + 6) % 7; // Mon=0..Sun=6
    dowHours[idx] += (Number(e.timeMin)||0)/60;
  });
  html += `<div class="section-title">By day of week</div><div class="section-sub">When you tend to watch</div>`;
  html += `<div class="chart-card"><canvas id="chart-dow"></canvas></div>`;

  // ---- Genre mix (year-scoped only, not genre-filtered) ----
  const genreHours = {};
  (statsYearFilter==='all' ? diary : diary.filter(e=>(e.date||'').startsWith(statsYearFilter))).forEach(e=>{
    const g = (e.genre||'Unspecified').trim() || 'Unspecified';
    genreHours[g] = (genreHours[g]||0) + (Number(e.timeMin)||0)/60;
  });
  const genreList = Object.entries(genreHours).sort((a,b)=>b[1]-a[1]);
  const genreTotal = genreList.reduce((s,[,v])=>s+v,0) || 1;
  const palette = [getCss('--teal'), getCss('--amber'), getCss('--rose'), '#7C9A5C', '#8C7FB3', '#C08A4F', '#5C8FA6', '#A65C6E'];
  html += `<div class="section-title">Genre mix</div><div class="section-sub">Share of hours by genre${statsYearFilter!=='all' ? ' in '+statsYearFilter : ''}</div>`;
  html += `<div class="mix-strip">` + genreList.slice(0,8).map(([g,v],i)=>`<div style="width:${(v/genreTotal*100).toFixed(2)}%;background:${palette[i%palette.length]}"></div>`).join('') + `</div>`;
  genreList.slice(0,8).forEach(([g,hrs],i)=>{
    const pct = Math.round((hrs/genreTotal)*100);
    html += `<div class="bar-row clickable" data-genre-jump="${escapeHtml(g)}"><div class="bl">${escapeHtml(g)}</div><div class="bar-track"><div class="bar-fill" data-w="${pct}" style="background:${palette[i%palette.length]}"></div></div><div class="bar-val">${hrs.toFixed(0)}h</div></div>`;
  });

  // ---- Top rated shows list ----
  const byShow2 = {};
  scoped.forEach(e=>{
    if (!byShow2[e.name]) byShow2[e.name] = [];
    if (!isNaN(Number(e.rating))) byShow2[e.name].push(Number(e.rating));
  });
  let topShows = Object.entries(byShow2).filter(([,r])=>r.length>=3);
  const minNote = topShows.length ? '3+ episodes' : '1+ episodes';
  if (!topShows.length) topShows = Object.entries(byShow2).filter(([,r])=>r.length>=1);
  topShows = topShows.map(([n,r])=>[n, r.reduce((a,b)=>a+b,0)/r.length, r.length]).sort((a,b)=>b[1]-a[1]).slice(0,8);

  html += `<div class="section-title">Highest rated</div><div class="section-sub">${minNote} in this view</div>`;
  if (!topShows.length){
    html += `<div class="empty"><div class="t">Not enough data yet</div>Rate a few episodes to see shows ranked here.</div>`;
  } else {
    for (const [name, avg, n] of topShows){
      const pct = Math.max(4, Math.round((avg/10)*100));
      html += `<div class="bar-row"><div class="bl">${escapeHtml(name)}</div><div class="bar-track"><div class="bar-fill" data-w="${pct}" style="background:var(--amber);"></div></div><div class="bar-val">${avg.toFixed(1)}</div></div>`;
    }
  }

  document.getElementById('stats-body').innerHTML = html;

  // animate bar fills in next frame
  requestAnimationFrame(()=>{
    document.querySelectorAll('#stats-body .bar-fill[data-w]').forEach(el=>{
      el.style.width = el.dataset.w + '%';
    });
  });

  // genre row click -> jump into that genre filter
  document.querySelectorAll('#stats-body [data-genre-jump]').forEach(el=>{
    el.addEventListener('click', ()=>{
      statsGenreFilter = el.dataset.genreJump;
      renderStats();
    });
  });

  // draw charts
  drawBarChart(document.getElementById('chart-years'), allYears, yearHours, {
    height: 140, showValues: true, highlightIndex: highlightIdx, valueFmt: v => v>=1 ? Math.round(v) : ''
  });
  attachBarClick(document.getElementById('chart-years'), (idx)=>{
    const y = allYears[idx];
    statsYearFilter = (statsYearFilter === y) ? 'all' : y;
    renderStats();
  });

  drawBarChart(document.getElementById('chart-months'), MONTHS, monthValues, {
    height: 130, showValues: true, valueFmt: v => v>=1 ? Math.round(v) : ''
  });

  drawBarChart(document.getElementById('chart-dow'), WEEKDAYS, dowHours, {
    height: 120, showValues: true, valueFmt: v => v>=1 ? Math.round(v) : ''
  });
}
window.addEventListener('resize', ()=>{
  if (document.getElementById('screen-stats').classList.contains('active')){
    clearTimeout(window._rsz);
    window._rsz = setTimeout(renderStats, 150);
  }
});

/* ===================== Settings / backup ===================== */
document.getElementById('open-settings').addEventListener('click', ()=>{
  document.getElementById('settings-overlay').classList.add('active');
});
document.getElementById('settings-close').addEventListener('click', ()=>{
  document.getElementById('settings-overlay').classList.remove('active');
});
document.getElementById('settings-overlay').addEventListener('click', e=>{
  if (e.target.id === 'settings-overlay') document.getElementById('settings-overlay').classList.remove('active');
});
document.getElementById('export-data').addEventListener('click', ()=>{
  const payload = { exportedAt: new Date().toISOString(), diary, shows };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `watch-diary-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Backup downloaded');
});
document.getElementById('import-file').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!Array.isArray(payload.diary) || !Array.isArray(payload.shows)) throw new Error('bad shape');
      diary = payload.diary;
      shows = payload.shows;
      persist();
      renderDiary();
      renderShows();
      renderStats();
      toast('Backup restored');
      document.getElementById('settings-overlay').classList.remove('active');
    } catch(err){
      toast('Could not read that file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

/* ===================== Service worker ===================== */
if ('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

/* ===================== Init ===================== */
renderDiary();
