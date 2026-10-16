/* Roadkit: generic UI. Everything shown comes from a roadmap JSON (see docs/SCHEMA.md). */
(() => {
'use strict';

const PALETTE = ['#3a68d1', '#d8a436', '#8854ba', '#168450', '#ce6e4c', '#2a9aa8'];
const NS = 'http://www.w3.org/2000/svg';
const KEY = { progress: id => `roadkit:v1:progress:${id}`, last: 'roadkit:v1:last' };
const G = { spineX: 420, nodeW: 290, optX: 800, optW: 255, top: 110, gap: 56, msGap: 40, optGap: 14, mapW: 1135, msW: 210 };

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const br = s => esc(s).replace(/\n/g, '<br>');
const str = v => (v == null ? '' : String(v));
const arr = v => (Array.isArray(v) ? v : []);
const hex = v => (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(str(v)) ? v : '');
const slug = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const safeUrl = u => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : '#'; } catch { return '#'; } };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};
async function getJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

const S = {
  manifest: null, defaults: {}, L: {}, labelCache: {},
  rm: null, localRm: null, progress: {}, selected: null, phase: 'all', search: '',
  links: [], legendEl: null, svg: null,
};

/* ---------- theme: auto (follows the system), light or dark ---------- */
const THEME_KEY = 'roadkit:v1:theme';
const THEME_NEXT = { auto: 'light', light: 'dark', dark: 'auto' };
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const themeMode = () => { const m = store.get(THEME_KEY); return m === 'light' || m === 'dark' ? m : 'auto'; };

function updateThemeBtn() {
  const m = themeMode(), name = S.L['theme' + m[0].toUpperCase() + m.slice(1)];
  if (S.L.theme && name) $('themeBtn').textContent = `${S.L.theme}: ${name}`;
}

function applyTheme() {
  const m = themeMode(), dark = m === 'dark' || (m === 'auto' && darkQuery.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e131b' : '#f6f7fb');
  updateThemeBtn();
}

/* ---------- normalize: tolerant reader (tools/roadkit.py check is the strict one) ---------- */
function normLinks(v) {
  return arr(v).map(l => {
    if (typeof l === 'string') return { title: l, url: l };
    if (Array.isArray(l)) return { title: str(l[0]), url: str(l[1]) };
    return { title: str(l?.title || l?.url), url: str(l?.url) };
  }).filter(l => l.url);
}

function normalize(raw, fallbackId) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('JSON must be an object');
  if (!Array.isArray(raw.nodes) || !raw.nodes.length) throw new Error('"nodes" must be a non-empty list');
  const warn = [];
  const meta = { ...raw.meta };
  meta.title = str(meta.title) || 'Roadmap';
  const hasPhases = Array.isArray(raw.phases) && raw.phases.length > 0;
  const phases = (hasPhases ? raw.phases : [{ id: '_main' }]).map((p, i) => ({
    id: String(p.id ?? `p${i + 1}`), title: str(p.title), summary: str(p.summary), period: str(p.period),
    milestone: str(p.milestone), color: hex(p.color) || PALETTE[i % PALETTE.length], index: i, nodes: [],
  }));
  const phaseById = Object.fromEntries(phases.map(p => [p.id, p]));
  const byId = {}, nodes = [];
  raw.nodes.forEach((r, i) => {
    if (!r || typeof r !== 'object') return;
    const id = String(r.id ?? `n${i + 1}`);
    if (byId[id]) { warn.push(`duplicate node id "${id}" ignored`); return; }
    let phase = str(r.phase);
    if (!phaseById[phase]) { if (hasPhases) warn.push(`node "${id}": unknown phase "${phase}"`); phase = phases[0].id; }
    const n = {
      id, phase, title: str(r.title) || id, time: str(r.time), summary: str(r.summary),
      topics: arr(r.topics).map(String), challenge: str(r.challenge), success: str(r.success),
      links: normLinks(r.links), optional: !!r.optional, anchor: str(r.anchor),
    };
    n.hay = [n.title, n.summary, ...n.topics].join(' ').toLocaleLowerCase();
    byId[id] = n; nodes.push(n);
  });
  let core = nodes.filter(n => !n.optional);
  if (!core.length) throw new Error('needs at least one non-optional node');
  const sorted = [...core].sort((a, b) => phaseById[a.phase].index - phaseById[b.phase].index);
  if (sorted.some((n, i) => n !== core[i])) warn.push('core nodes were reordered to follow phase order');
  core = sorted;
  core.forEach((n, i) => { n.num = i + 1; phaseById[n.phase].nodes.push(n); });
  nodes.filter(n => n.optional).forEach(n => {
    if (!byId[n.anchor] || byId[n.anchor].optional) {
      const fb = phaseById[n.phase].nodes.at(-1) || core[0];
      warn.push(`optional "${n.id}": invalid anchor "${n.anchor}", using "${fb.id}"`);
      n.anchor = fb.id;
    }
  });
  if (warn.length) console.warn(`[roadmap ${raw.id || fallbackId}]`, warn);
  const th = raw.theme || {};
  return {
    id: str(raw.id) || slug(fallbackId) || slug(meta.title) || 'roadmap', meta,
    theme: { accent: hex(th.accent) || '#233b65', brand: hex(th.brandAccent) || '#7549bd' },
    labels: raw.labels && typeof raw.labels === 'object' ? raw.labels : {},
    phases, hasPhases, nodes, core, byId, phaseById, warn,
  };
}

/* ---------- labels / chrome ---------- */
async function loadLabels(lang) {
  const avail = S.manifest.languages || [];
  const pick = [lang, str(lang).split('-')[0], 'pt-BR'].find(c => c && avail.includes(c)) || 'pt-BR';
  S.labelCache[pick] ??= await getJson(`src/labels/${pick}.json`);
  return S.labelCache[pick];
}

function applyI18n() {
  const L = S.L;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = L[el.dataset.i18n] ?? ''; });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = L[el.dataset.i18nPlaceholder] ?? ''; });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', L[el.dataset.i18nAria] ?? ''));
  updateThemeBtn();
}

function applyChrome() {
  const { rm, L } = S, m = rm.meta;
  document.documentElement.lang = m.language || 'pt-BR';
  document.documentElement.style.setProperty('--accent', rm.theme.accent);
  document.documentElement.style.setProperty('--brand', rm.theme.brand);
  document.title = m.title;
  applyI18n();
  const brand = m.brand || {};
  $('logo').innerHTML = `${esc(brand.plain ?? 'road')}<b>${esc(brand.accent ?? 'kit')}</b>`;
  $('tagline').innerHTML = br(m.tagline);
  $('eyebrow').textContent = str(m.eyebrow);
  $('title').textContent = m.title;
  $('subtitle').textContent = str(m.subtitle);
  $('sidebarNote').innerHTML = br(m.sidebarNote);
  $('sidebarNote').style.display = m.sidebarNote ? '' : 'none';
  $('footer').textContent = str(m.footer);

  const nav = $('phaseNav');
  nav.replaceChildren();
  const addNav = (key, label, color) => {
    const b = document.createElement('button');
    b.className = 'nav-btn' + (S.phase === key ? ' active' : '');
    b.dataset.phase = key;
    b.innerHTML = `<span class="nav-dot" style="background:${color}"></span>${esc(label)}`;
    b.addEventListener('click', () => setPhase(key));
    nav.append(b);
  };
  addNav('all', L.fullRoadmap, rm.theme.accent);
  if (rm.hasPhases) rm.phases.filter(p => p.nodes.length).forEach(p => addNav(p.id, `${String(p.index + 1).padStart(2, '0')} | ${p.title}`, p.color));
}

function buildSwitch() {
  const sel = $('roadmapSelect');
  sel.replaceChildren();
  const groups = {};
  (S.manifest.groups || []).forEach(g => {
    const og = document.createElement('optgroup'); og.label = g.title; groups[g.id] = og; sel.append(og);
  });
  S.manifest.roadmaps.forEach(r => {
    const o = document.createElement('option');
    o.value = r.id; o.textContent = `${r.icon ? r.icon + ' ' : ''}${r.title}`;
    (groups[r.group] || sel).append(o);
  });
  if (S.localRm) {
    const o = document.createElement('option');
    o.value = '__local__'; o.textContent = `${S.localRm.meta.title} (${S.L.localFile})`;
    sel.append(o);
  }
  [...sel.querySelectorAll('optgroup')].forEach(g => { if (!g.children.length) g.remove(); });
  sel.value = S.rm?.id === S.localRm?.id && S.localRm ? '__local__' : (S.rm?.id ?? '');
}

/* ---------- map build + layout ---------- */
function phaseDone(ph) { return ph.nodes.length > 0 && ph.nodes.every(n => S.progress[n.id]); }

function buildMap() {
  const { rm, L } = S, map = $('map');
  map.replaceChildren();
  S.svg = document.createElementNS(NS, 'svg');
  S.svg.setAttribute('class', 'diagram');
  S.svg.setAttribute('aria-hidden', 'true');
  map.append(S.svg);
  const shown = rm.phases.filter(p => p.nodes.length);
  shown.forEach(ph => {
    ph.flagEl = ph.msEl = null;
    if (ph.title) {
      const f = document.createElement('div');
      f.className = 'phase-flag'; f.style.setProperty('--flag', ph.color);
      f.innerHTML = `<div class="phase-kicker">${esc(L.phase)} ${String(ph.index + 1).padStart(2, '0')}${ph.period ? ' | ' + esc(ph.period) : ''}</div><strong>${esc(ph.title)}</strong>${ph.summary ? `<span>${esc(ph.summary)}</span>` : ''}`;
      map.append(f); ph.flagEl = f;
    }
    if (ph.milestone) {
      const m = document.createElement('div');
      m.className = 'milestone'; m.textContent = ph.milestone;
      map.append(m); ph.msEl = m;
    }
  });
  rm.nodes.forEach(n => {
    const el = document.createElement('div');
    el.className = 'road-node' + (n.optional ? ' optional-node' : '');
    el.dataset.node = n.id;
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    const num = n.optional ? '+' : String(n.num).padStart(2, '0');
    const meta = [n.time, n.optional ? L.optionalTag : ''].filter(Boolean).join(' | ');
    el.innerHTML = `<span class="node-num">${num}</span><span class="node-txt"><span class="node-name">${esc(n.title)}</span>${meta ? `<span class="node-meta">${esc(meta)}</span>` : ''}</span><button class="node-check" title="${esc(L.toggleDone)}" aria-label="${esc(L.toggleDone)}: ${esc(n.title)}"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    el.addEventListener('click', () => select(n.id));
    el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); select(n.id); } });
    el.querySelector('.node-check').addEventListener('click', e => { e.stopPropagation(); toggle(n.id); });
    map.append(el); n.el = el;
    n.isDone = () => !!S.progress[n.id];
  });
  const lg = document.createElement('div');
  lg.className = 'legend';
  lg.innerHTML = `<div class="heading">${esc(L.legendTitle)}</div><div class="legend-item"><span class="swatch"></span> ${esc(L.legendMain)}</div><div class="legend-item"><span class="swatch green"></span> ${esc(L.legendDone)}</div>${rm.nodes.some(n => n.optional) ? `<div class="legend-item"><span class="swatch opt"></span> ${esc(L.legendOptional)}</div>` : ''}<div class="hint">${esc(L.legendHint)}</div>`;
  map.append(lg); S.legendEl = lg;
}

function layout() {
  const { rm } = S, map = $('map'), svg = S.svg;
  if (!svg) return;
  svg.replaceChildren();
  S.links = [];
  const cx = G.spineX + G.nodeW / 2;
  const shown = rm.phases.filter(p => p.nodes.length);
  const spine = [];
  let y = G.top, flagBottom = 0, lastWasMs = false;
  shown.forEach(ph => {
    if (flagBottom) y = Math.max(y, flagBottom + 30);
    if (ph.flagEl) { ph.flagEl.style.top = y + 'px'; flagBottom = y + ph.flagEl.offsetHeight; }
    ph.nodes.forEach(n => {
      const h = n.el.offsetHeight;
      Object.assign(n, { x: G.spineX, y, h });
      n.el.style.left = n.x + 'px'; n.el.style.top = y + 'px';
      const opts = rm.nodes.filter(o => o.optional && o.anchor === n.id);
      const hs = opts.map(o => o.el.offsetHeight);
      const total = hs.reduce((a, b) => a + b, 0) + G.optGap * Math.max(0, opts.length - 1);
      let oy = total <= h ? y + (h - total) / 2 : y;
      opts.forEach((o, i) => {
        Object.assign(o, { x: G.optX, y: oy, h: hs[i] });
        o.el.style.left = o.x + 'px'; o.el.style.top = oy + 'px';
        const sx = n.x + G.nodeW, sy = n.y + h / 2, ex = o.x, ey = oy + hs[i] / 2, mx = sx + (ex - sx) / 2;
        addLine(`M${sx} ${sy} L${mx} ${sy} L${mx} ${ey} L${ex} ${ey}`, true, n, o);
        oy += hs[i] + G.optGap;
      });
      spine.push(n);
      y += Math.max(h, total) + G.gap;
      lastWasMs = false;
    });
    if (ph.msEl) {
      const msY = y - G.gap + G.msGap, mh = ph.msEl.offsetHeight;
      ph.msEl.style.left = (cx - G.msW / 2) + 'px'; ph.msEl.style.top = msY + 'px';
      const ms = { y: msY, h: mh, isDone: () => phaseDone(ph) };
      ph.ms = ms; spine.push(ms);
      y = msY + mh + G.msGap;
      lastWasMs = true;
    }
  });
  for (let i = 0; i < spine.length - 1; i++) {
    const a = spine[i], b = spine[i + 1];
    addLine(`M${cx} ${a.y + a.h} L${cx} ${b.y}`, false, a, b);
  }
  let mapH = y - (lastWasMs ? G.msGap : G.gap) + 70;
  const lh = S.legendEl.offsetHeight, ly = Math.max(flagBottom + 30, mapH - lh - 30);
  S.legendEl.style.top = ly + 'px';
  mapH = Math.max(mapH, ly + lh + 30);
  map.style.width = G.mapW + 'px'; map.style.height = mapH + 'px';
  svg.setAttribute('width', G.mapW); svg.setAttribute('height', mapH);
  svg.setAttribute('viewBox', `0 0 ${G.mapW} ${mapH}`);
  refresh();
}

function addLine(d, optional, a, b) {
  const el = document.createElementNS(NS, 'path');
  el.setAttribute('d', d);
  if (optional) el.setAttribute('class', 'optional');
  S.svg.append(el);
  S.links.push({ el, a, b });
}

/* ---------- state refresh ---------- */
function dimmed(n) {
  return (S.phase !== 'all' && n.phase !== S.phase) || !!(S.search && !n.hay.includes(S.search));
}

function refresh() {
  const { rm, L } = S;
  if (!rm) return;
  rm.nodes.forEach(n => {
    const done = !!S.progress[n.id];
    n.el.classList.toggle('completed', done);
    n.el.classList.toggle('selected', S.selected === n.id);
    n.el.classList.toggle('dimmed', dimmed(n));
    n.el.setAttribute('aria-label', `${n.title}, ${done ? L.statusDone : L.statusPending}`);
    n.el.querySelector('.node-check').setAttribute('aria-pressed', String(done));
  });
  rm.phases.forEach(ph => ph.msEl?.classList.toggle('reached', phaseDone(ph)));
  S.links.forEach(l => l.el.classList.toggle('done', !!(l.a.isDone() && l.b.isDone())));
  const qty = rm.core.filter(n => S.progress[n.id]).length;
  $('progressText').textContent = `${qty} / ${rm.core.length}`;
  $('barFill').style.width = (qty / rm.core.length * 100) + '%';
}

function renderDetail() {
  const { rm, L } = S, box = $('detailContent'), n = rm.byId[S.selected];
  if (!n) {
    box.className = 'detail-placeholder';
    box.innerHTML = `${rm.meta.icon ? `<span class="big">${esc(rm.meta.icon)}</span>` : ''}<strong>${esc(L.placeholderTitle)}</strong><br>${esc(L.placeholderText)}`;
    return;
  }
  const ph = rm.phaseById[n.phase];
  const kicker = n.optional ? L.optionalKicker : [n.time, ph.title].filter(Boolean).join(' | ');
  const done = !!S.progress[n.id];
  box.className = '';
  box.innerHTML =
    `<div class="panel-kicker">${esc(kicker)}</div><h2>${esc(n.title)}</h2>` +
    (n.summary ? `<p>${esc(n.summary)}</p>` : '') +
    (n.topics.length ? `<h3>${esc(L.topics)}</h3><div>${n.topics.map(t => `<span class="topic">${esc(t)}</span>`).join('')}</div>` : '') +
    (n.challenge ? `<h3>${esc(L.challenge)}</h3><div class="mission">${esc(n.challenge)}</div>` : '') +
    (n.success ? `<h3>${esc(L.success)}</h3><p>${esc(n.success)}</p>` : '') +
    (n.links.length ? `<h3>${esc(L.resources)}</h3>${n.links.map(l => `<a class="resource" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(l.url))}">${esc(l.title)}</a>`).join('')}` : '') +
    `<button class="complete-action ${done ? 'done' : ''}" id="completeAction">${esc(done ? L.markUndone : L.markDone)}</button><p class="small-note">${esc(L.doneHint)}</p>`;
  $('completeAction').addEventListener('click', () => toggle(n.id));
}

/* ---------- interactions ---------- */
function select(id, scroll = false) {
  S.selected = id;
  refresh(); renderDetail();
  if (scroll) {
    const n = S.rm.byId[id];
    window.scrollTo({ top: Math.max(0, $('map').getBoundingClientRect().top + window.scrollY + n.y - 200), behavior: 'smooth' });
    const view = $('mapViewport');
    view.scrollTo({ left: Math.max(0, n.x - (view.clientWidth - G.nodeW) / 2), behavior: 'smooth' });
  }
  $('detail').classList.add('open');
}

function toggle(id) {
  S.progress[id] = !S.progress[id];
  store.set(KEY.progress(S.rm.id), JSON.stringify(S.progress));
  refresh(); renderDetail();
}

function setPhase(key) {
  S.phase = key;
  document.querySelectorAll('[data-phase]').forEach(b => b.classList.toggle('active', b.dataset.phase === key));
  refresh();
  const first = key === 'all' ? null : S.rm.phaseById[key]?.nodes[0];
  const top = $('map').getBoundingClientRect().top + window.scrollY + (first ? first.y - 110 : 0);
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

function next() {
  const n = S.rm.core.find(x => !S.progress[x.id]) || S.rm.core.at(-1);
  select(n.id, true);
}

/* ---------- roadmap loading ---------- */
function showMessage(title, html) {
  $('map').replaceChildren();
  $('map').style.height = '420px';
  const d = document.createElement('div');
  d.className = 'empty';
  d.innerHTML = `<h2>${esc(title)}</h2><p>${html}</p>`;
  $('map').append(d);
}

async function setRoadmap(rm, { local = false } = {}) {
  S.L = { ...S.defaults, ...await loadLabels(rm.meta.language), ...rm.labels };
  S.rm = rm;
  if (local) S.localRm = rm;
  let p = {};
  try { p = JSON.parse(store.get(KEY.progress(rm.id)) || '{}') || {}; } catch { /* corrupt entry */ }
  S.progress = p;
  S.selected = rm.core[0].id; S.phase = 'all'; S.search = '';
  $('search').value = '';
  applyChrome(); buildSwitch(); buildMap(); layout(); renderDetail();
  $('detail').classList.remove('open');
  $('mapViewport').scrollLeft = window.innerWidth < 800 ? 270 : 0;
  window.scrollTo({ top: 0 });
  document.fonts?.ready.then(() => S.rm === rm && layout());
}

async function openEntry(entry) {
  try {
    const rm = normalize(await getJson(entry.file), entry.id);
    await setRoadmap(rm);
    store.set(KEY.last, rm.id);
    history.replaceState(null, '', `?r=${encodeURIComponent(entry.id)}`);
  } catch (err) {
    console.error(err);
    showMessage(S.L.loadFail || 'Could not load the roadmap', `<code>${esc(entry.file)}</code><br>${esc(err.message)}`);
  }
}

async function openLocalFile(file) {
  try {
    const rm = normalize(JSON.parse(await file.text()), file.name.replace(/\.json$/i, ''));
    await setRoadmap(rm, { local: true });
  } catch (err) {
    alert(`${S.L.loadFail}: ${err.message}`);
  }
}

/* ---------- progress import / export ---------- */
function exportProgress() {
  const { rm } = S;
  const blob = new Blob([JSON.stringify({ roadmap: rm.id, title: rm.meta.title, version: 1, exportedAt: new Date().toISOString(), progress: S.progress }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `${rm.id}-progress.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 300);
}

async function importProgress(file) {
  try {
    const obj = JSON.parse(await file.text()), p = obj.progress || obj;
    if (!p || typeof p !== 'object') throw new Error('invalid format');
    S.progress = {};
    for (const id of Object.keys(S.rm.byId)) if (typeof p[id] === 'boolean') S.progress[id] = p[id];
    store.set(KEY.progress(S.rm.id), JSON.stringify(S.progress));
    refresh(); renderDetail();
    alert(S.L.importOk);
  } catch (err) { alert(S.L.importFail + err.message); }
}

/* ---------- boot ---------- */
function wire() {
  $('nextBtn').addEventListener('click', next);
  $('startBtn').addEventListener('click', next);
  $('detailClose').addEventListener('click', () => $('detail').classList.remove('open'));
  $('search').addEventListener('input', e => { S.search = e.target.value.toLocaleLowerCase().trim(); refresh(); });
  $('exportBtn').addEventListener('click', exportProgress);
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async e => { const f = e.target.files?.[0]; if (f) await importProgress(f); e.target.value = ''; });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm(S.L.confirmReset)) return;
    S.progress = {}; store.set(KEY.progress(S.rm.id), '{}'); refresh(); renderDetail();
  });
  $('openFileBtn').addEventListener('click', () => $('openFile').click());
  $('themeBtn').addEventListener('click', () => { store.set(THEME_KEY, THEME_NEXT[themeMode()]); applyTheme(); });
  darkQuery.addEventListener('change', applyTheme);
  $('openFile').addEventListener('change', async e => { const f = e.target.files?.[0]; if (f) await openLocalFile(f); e.target.value = ''; });
  $('roadmapSelect').addEventListener('change', e => {
    if (e.target.value === '__local__') return setRoadmap(S.localRm, { local: true });
    const entry = S.manifest.roadmaps.find(r => r.id === e.target.value);
    if (entry) openEntry(entry);
  });
  addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
  addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
  addEventListener('drop', e => {
    e.preventDefault(); document.body.classList.remove('dragging');
    const f = [...(e.dataTransfer?.files || [])].find(x => /\.json$/i.test(x.name));
    if (f) openLocalFile(f);
  });
}

async function init() {
  wire();
  applyTheme();
  try {
    [S.manifest, S.defaults] = await Promise.all([getJson('manifest.json'), getJson('src/labels/pt-BR.json')]);
  } catch (err) {
    console.error(err);
    showMessage('Servidor não encontrado', 'Abra pelo servidor local: <code>python3 tools/roadkit.py serve</code> e acesse <code>http://localhost:8765</code>.<br>(Abrir o <code>index.html</code> direto do disco não funciona: o navegador bloqueia a leitura dos JSONs.)');
    return;
  }
  S.L = S.defaults;
  applyI18n();
  buildSwitch();
  const want = new URLSearchParams(location.search).get('r') || store.get(KEY.last);
  const entry = S.manifest.roadmaps.find(r => r.id === want) || S.manifest.roadmaps[0];
  if (!entry) { showMessage('Nenhum roadmap', 'Crie um JSON em <code>roadmaps/</code> e rode <code>python3 tools/roadkit.py check</code>. Ou arraste um arquivo .json para esta página.'); return; }
  await openEntry(entry);
}

init();
})();
