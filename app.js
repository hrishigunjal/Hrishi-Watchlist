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

/* ===================== Stats ===================== */
function renderStats(){
  const totalMin = diary.reduce((sum,e)=> sum + (Number(e.timeMin)||0), 0);
  const totalHours = totalMin / 60;
  const totalEpisodes = diary.length;
  const ratings = diary.map(e=>Number(e.rating)).filter(n=>!isNaN(n));
  const avgRating = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : null;

  const dates = diary.map(e=>e.date).filter(Boolean).sort();
  const first = dates[0], last = dates[dates.length-1];
  let perWeek = '—', perMonth = '—', perDay = '—';
  if (first && last){
    const days = Math.max(1, (new Date(last) - new Date(first)) / 86400000);
    perDay = (totalHours / days).toFixed(2);
    perWeek = (totalHours / (days/7)).toFixed(1);
    perMonth = (totalHours / (days/30.44)).toFixed(1);
  }

  // genre breakdown by hours
  const genreHours = {};
  diary.forEach(e=>{
    const g = (e.genre || 'Unspecified').trim() || 'Unspecified';
    genreHours[g] = (genreHours[g]||0) + (Number(e.timeMin)||0)/60;
  });
  const genreList = Object.entries(genreHours).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxGenre = genreList.length ? genreList[0][1] : 1;

  // top rated shows (min 3 episodes logged)
  const byShow = {};
  diary.forEach(e=>{
    if (!byShow[e.name]) byShow[e.name] = [];
    if (!isNaN(Number(e.rating))) byShow[e.name].push(Number(e.rating));
  });
  const topShows = Object.entries(byShow)
    .filter(([,r]) => r.length >= 3)
    .map(([name,r]) => [name, r.reduce((a,b)=>a+b,0)/r.length, r.length])
    .sort((a,b)=> b[1]-a[1])
    .slice(0,8);

  // this year
  const year = new Date().getFullYear();
  const thisYear = diary.filter(e => e.date && e.date.startsWith(String(year)));
  const thisYearHours = thisYear.reduce((s,e)=> s + (Number(e.timeMin)||0), 0) / 60;

  let html = `
    <div class="hero">
      <div class="big">${totalHours.toFixed(0)} hrs</div>
      <div class="label">watched across ${totalEpisodes.toLocaleString()} episodes</div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="n">${avgRating != null ? avgRating.toFixed(2) : '—'}</div><div class="l">average rating</div></div>
      <div class="stat-card"><div class="n">${shows.length}</div><div class="l">shows tracked</div></div>
      <div class="stat-card"><div class="n">${perWeek}</div><div class="l">hours / week</div></div>
      <div class="stat-card"><div class="n">${perMonth}</div><div class="l">hours / month</div></div>
      <div class="stat-card"><div class="n">${perDay}</div><div class="l">hours / day</div></div>
      <div class="stat-card"><div class="n">${thisYearHours.toFixed(0)}</div><div class="l">hours in ${year}</div></div>
    </div>
    <div class="section-title">Hours by genre</div>`;

  if (!genreList.length){
    html += `<div class="empty"><div class="t">No data yet</div>Log a few watches to see genre stats.</div>`;
  } else {
    for (const [g, hrs] of genreList){
      const pct = Math.max(4, Math.round((hrs/maxGenre)*100));
      html += `<div class="bar-row"><div class="bl">${escapeHtml(g)}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><div class="bar-val">${hrs.toFixed(0)}h</div></div>`;
    }
  }

  html += `<div class="section-title">Highest rated (3+ episodes)</div>`;
  if (!topShows.length){
    html += `<div class="empty"><div class="t">Not enough data yet</div>Rate a few more episodes of a show to see it ranked here.</div>`;
  } else {
    for (const [name, avg, n] of topShows){
      const pct = Math.max(4, Math.round((avg/10)*100));
      html += `<div class="bar-row"><div class="bl">${escapeHtml(name)}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:var(--amber);"></div></div><div class="bar-val">${avg.toFixed(1)}</div></div>`;
    }
  }

  document.getElementById('stats-body').innerHTML = html;
}

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
