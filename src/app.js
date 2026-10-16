/* Roadkit: generic UI. Everything shown comes from a roadmap JSON (see docs/SCHEMA.md). */
(() => {
'use strict';

const PALETTE = ['#3a68d1', '#d8a436', '#8854ba', '#168450', '#ce6e4c', '#2a9aa8'];
const NS = 'http://www.w3.org/2000/svg';
const KEY = {
  state: id => `roadkit:v2:state:${id}`,
  progress: id => `roadkit:v1:progress:${id}`, // legacy, read once to migrate
  ts: id => `roadkit:v2:ts:${id}`,           // when the saved progress last changed (ms), used to sync with the server
  backup: id => `roadkit:v2:backup:${id}`,   // local progress replaced by the server's, kept just in case
  view: id => `roadkit:v1:view:${id}`,
  last: 'roadkit:v1:last',
  token: 'roadkit:v1:token',
};
const G = { spineX: 420, nodeW: 290, optX: 800, optW: 255, subX: 1110, subW: 230, top: 110, gap: 56, msGap: 40, optGap: 14, mapW: 1135, mapW2: 1370, msW: 210 };
const NEST = 22;   // narrow layout: indent per sub-topic level
const NARROW_BELOW = 860;   // map viewport width (px) under which the compact vertical layout is used
const MAX_SCALE = 1.4;      // the wide layout is scaled to fit the viewport, up to this factor
const STATUSES = ['todo', 'working', 'review', 'finished'];
const FONT_SCALE = { small: 0.95, normal: 1.1, large: 1.25, xlarge: 1.4 };
const FS_KEY = 'roadkit:v1:fs', SKIP_KEY = 'roadkit:v1:skip', DETAIL_KEY = 'roadkit:v1:detailw';
const STATUS_LABEL = { todo: 'kanbanTodo', working: 'kanbanWorking', review: 'kanbanReview', finished: 'kanbanFinished' };

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const br = s => esc(s).replace(/\n/g, '<br>');
const str = v => (v == null ? '' : String(v));
const fmt = (s, o) => str(s).replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
const arr = v => (Array.isArray(v) ? v : []);
const hex = v => (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(str(v)) ? v : '');
const okStatus = v => (STATUSES.includes(v) ? v : 'todo');
/* A node with tasks follows them: all finished is finished, all todo is todo, everything left
   in review or finished is review, anything else is working. */
function deriveStatus(sts) {
  if (!sts.length || sts.every(s => s === 'todo')) return 'todo';
  if (sts.every(s => s === 'finished')) return 'finished';
  if (sts.includes('review') && sts.every(s => s === 'review' || s === 'finished')) return 'review';
  return 'working';
}
const slug = s => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const safeUrl = u => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : '#'; } catch { return '#'; } };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};
async function getText(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
}
const getJson = async url => JSON.parse(await getText(url));

const S = {
  manifest: null, defaults: {}, L: {}, labelCache: {},
  rm: null, localRm: null, state: { nodes: {}, tasks: {} }, view: 'map', selected: null, phase: 'all', search: '',
  links: [], legendEl: null, svg: null, warnOpen: new Set(),
};

const ICON = {
  warn: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 2l6.5 11.5h-13z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 6.6v3.2M8 11.7v.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  left: '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M7.5 2.5L4 6l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M4.5 2.5L8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  grip: '<svg viewBox="0 0 8 14" width="8" height="14" aria-hidden="true"><g fill="currentColor"><circle cx="2" cy="2" r="1.1"/><circle cx="6" cy="2" r="1.1"/><circle cx="2" cy="7" r="1.1"/><circle cx="6" cy="7" r="1.1"/><circle cx="2" cy="12" r="1.1"/><circle cx="6" cy="12" r="1.1"/></g></svg>',
};

/* ---------- theme: auto (follows the system), light or dark ---------- */
const THEME_KEY = 'roadkit:v1:theme', LANG_KEY = 'roadkit:v1:lang';
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const themeMode = () => { const m = store.get(THEME_KEY); return m === 'light' || m === 'dark' ? m : 'auto'; };

function updateThemeBtn() {
  const m = themeMode();
  document.querySelectorAll('#themeSeg [data-theme-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeMode === m)));
}

function applyTheme() {
  const m = themeMode(), dark = m === 'dark' || (m === 'auto' && darkQuery.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e131b' : '#f6f7fb');
  updateThemeBtn();
}

/* ---------- settings: text size and skipped-topic warning ---------- */
const fontName = () => { const v = store.get(FS_KEY); return FONT_SCALE[v] ? v : 'normal'; };
const langSetting = () => { const v = store.get(LANG_KEY); return v && (S.manifest?.languages || []).includes(v) ? v : 'auto'; };
const uiLang = rm => (langSetting() !== 'auto' ? langSetting() : rm?.meta.language) || 'pt-BR';
const skipSetting = () => { const v = store.get(SKIP_KEY); return v === 'off' || v === '3' || v === '5' ? v : '0'; };
const skipTolerance = () => (skipSetting() === 'off' ? Infinity : Number(skipSetting()));
const toolbarHeight = () => $('toolbar').offsetHeight;

function applyFont() {
  document.documentElement.style.setProperty('--fs', FONT_SCALE[fontName()]);
  document.querySelectorAll('#fontSeg [data-fs]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fs === fontName())));
}

function syncToolbarHeight() {
  document.documentElement.style.setProperty('--tb-h', toolbarHeight() + 'px');
}

/* Text metrics changed: card heights differ, so the map needs a new layout. */
function metricsChanged() {
  requestAnimationFrame(() => {
    syncToolbarHeight();
    if (S.rm && S.svg && S.view === 'map') layout();
  });
}

function setSettingsOpen(open) {
  $('settings').hidden = !open;
  $('settingsBtn').setAttribute('aria-expanded', String(open));
}

function resetProgress() {
  if (!confirm(S.L.confirmReset)) return;
  S.state = { nodes: {}, tasks: {} };
  changed();
}

/* ---------- normalize: tolerant reader (tools/roadkit.py check is the strict one) ---------- */
function normLinks(v) {
  return arr(v).map(l => {
    if (typeof l === 'string') return { title: l, url: l };
    if (Array.isArray(l)) return { title: str(l[0]), url: str(l[1]) };
    return { title: str(l?.title || l?.url), url: str(l?.url) };
  }).filter(l => l.url);
}

function normTasks(v) {
  const seen = new Set(), out = [];
  arr(v).forEach((t, j) => {
    if (typeof t === 'string') t = { title: t };
    if (!t || typeof t !== 'object') return;
    const title = str(t.title);
    if (!title) return;
    let id = str(t.id) || slug(title) || `t${j + 1}`;
    if (seen.has(id)) id = `${id}-${j + 1}`;
    seen.add(id);
    out.push({ id, title, note: str(t.note), status: okStatus(t.status) });
  });
  return out;
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
      links: normLinks(r.links), optional: !!r.optional, parentId: str(r.parent) || (r.optional ? str(r.anchor) : ''),
      tasks: normTasks(r.tasks), children: [], parent: null, depth: 0,
    };
    n.explicit = STATUSES.includes(r.status);
    n.status = n.explicit ? r.status : null;   // settled below, once the tree is known
    n.hay = [n.title, n.summary, ...n.topics, ...n.tasks.map(t => t.title)].join(' ').toLocaleLowerCase();
    byId[id] = n; nodes.push(n);
  });
  // tree: a node hangs from `parent` (or, for optional ones, the older `anchor`); up to 2 levels below a main topic
  const MAX_DEPTH = 2;
  nodes.forEach(n => {
    const p = byId[n.parentId];
    if (n.parentId && (!p || p === n)) warn.push(`node "${n.id}": unknown parent "${n.parentId}"`);
    else if (p) n.parent = p;
  });
  nodes.forEach(n => {   // cut cycles
    const seen = new Set();
    for (let p = n; p; p = p.parent) { if (seen.has(p)) { warn.push(`node "${n.id}": parent loop, made a main topic`); n.parent = null; break; } seen.add(p); }
  });
  const depthOf = n => (n.parent ? depthOf(n.parent) + 1 : 0);
  nodes.forEach(n => { while (n.parent && depthOf(n) > MAX_DEPTH) { warn.push(`node "${n.id}": too deep, moved up one level`); n.parent = n.parent.parent; } });
  let core = nodes.filter(n => !n.optional && !n.parent);
  if (!core.length) throw new Error('needs at least one non-optional node');
  const sorted = [...core].sort((a, b) => phaseById[a.phase].index - phaseById[b.phase].index);
  if (sorted.some((n, i) => n !== core[i])) warn.push('core nodes were reordered to follow phase order');
  core = sorted;
  core.forEach((n, i) => { n.num = i + 1; phaseById[n.phase].nodes.push(n); });
  nodes.filter(n => n.optional && !n.parent).forEach(n => {   // optional with no valid parent: hang it from the last topic of its phase
    const fb = phaseById[n.phase].nodes.filter(x => !x.parent).at(-1) || core.find(x => x.phase === n.phase) || core[0];
    warn.push(`optional "${n.id}": no valid parent "${n.parentId}", using "${fb.id}"`);
    n.parent = fb;
  });
  nodes.forEach(n => { if (n.parent) n.parent.children.push(n); });
  let maxDepth = 0;
  nodes.forEach(n => {
    n.depth = depthOf(n); maxDepth = Math.max(maxDepth, n.depth);
    let r = n; while (r.parent) r = r.parent;
    n.phase = r.phase;   // sub-topics live in the phase of their main topic
  });
  // status: explicit, else derived from tasks and required sub-topics
  const settle = n => {
    n.children.forEach(settle);
    if (!n.explicit) n.status = deriveStatus([...n.tasks.map(t => t.status), ...n.children.filter(c => !c.optional).map(c => c.status)]);
  };
  core.forEach(settle);
  if (warn.length) console.warn(`[roadmap ${raw.id || fallbackId}]`, warn);
  const th = raw.theme || {};
  return {
    id: str(raw.id) || slug(fallbackId) || slug(meta.title) || 'roadmap', meta,
    theme: { accent: hex(th.accent) || '#233b65', brand: hex(th.brandAccent) || '#7549bd' },
    labels: raw.labels && typeof raw.labels === 'object' ? raw.labels : {},
    defaultView: meta.defaultView === 'kanban' ? 'kanban' : 'map',
    phases, hasPhases, nodes, core, byId, phaseById, warn, maxDepth,
  };
}

/* ---------- state: node and task statuses (only the user's changes are stored) ---------- */
const taskKey = (n, t) => `${n.id}/${t.id}`;
const nodeStatus = n => S.state.nodes[n.id] ?? n.status;
const taskStatus = (n, t) => S.state.tasks[taskKey(n, t)] ?? t.status;
const isDone = n => nodeStatus(n) === 'finished';
const finishedTasks = n => n.tasks.filter(t => taskStatus(n, t) === 'finished').length;
const phaseDone = ph => ph.nodes.length > 0 && ph.nodes.every(isDone);

const emptyState = () => ({ nodes: {}, tasks: {} });
const hasProgress = st => Object.keys(st.nodes).length > 0 || Object.keys(st.tasks).length > 0;

/* Keeps only what still exists in the roadmap and has a valid status. */
function cleanState(rm, saved) {
  const st = emptyState();
  for (const [id, v] of Object.entries(saved?.nodes || {})) if (rm.byId[id] && STATUSES.includes(v)) st.nodes[id] = v;
  for (const n of rm.nodes) for (const t of n.tasks) { const v = saved?.tasks?.[taskKey(n, t)]; if (STATUSES.includes(v)) st.tasks[taskKey(n, t)] = v; }
  return st;
}

function loadState(rm) {
  let st = emptyState(), saved = null;
  try { saved = JSON.parse(store.get(KEY.state(rm.id)) || 'null'); } catch { /* corrupt entry */ }
  if (saved && typeof saved === 'object') {
    st = cleanState(rm, saved);
  } else {
    try {
      const old = JSON.parse(store.get(KEY.progress(rm.id)) || '{}') || {};
      for (const id of Object.keys(rm.byId)) if (old[id] === true) st.nodes[id] = 'finished';
    } catch { /* ignore */ }
  }
  S.state = st;
  S.ts = Number(store.get(KEY.ts(rm.id))) || 0;
}

function saveState() {
  if (S.preview) return;   // editor drafts are never stored
  store.set(KEY.state(S.rm.id), JSON.stringify(S.state));
  store.set(KEY.ts(S.rm.id), String(S.ts));
}

const requiredKids = n => n.children.filter(c => !c.optional);
const deriveNode = n => deriveStatus([...n.tasks.map(t => taskStatus(n, t)), ...requiredKids(n).map(nodeStatus)]);
/* a sub-topic changed: the topics above it follow */
function bubble(n) { for (let p = n.parent; p; p = p.parent) if (p.tasks.length || requiredKids(p).length) S.state.nodes[p.id] = deriveNode(p); }

function setTaskStatus(n, t, st) {
  if (taskStatus(n, t) === st) return;
  S.state.tasks[taskKey(n, t)] = st;
  S.state.nodes[n.id] = deriveNode(n);
  bubble(n);
  changed();
}

/* Moving a node to finished or todo applies to all its tasks; leaving finished reopens them too. */
function setNodeStatus(n, st) {
  const prev = nodeStatus(n);
  if (prev === st) return;
  S.state.nodes[n.id] = st;
  if (st === 'finished' || st === 'todo' || prev === 'finished') {   // applies to all of its tasks and required sub-topics
    const apply = x => { x.tasks.forEach(t => { S.state.tasks[taskKey(x, t)] = st; }); requiredKids(x).forEach(c => { S.state.nodes[c.id] = st; apply(c); }); };
    apply(n);
  }
  bubble(n);
  changed();
}

const toggleDone = n => setNodeStatus(n, isDone(n) ? 'todo' : 'finished');

function changed() {
  S.ts = Date.now();
  saveState();
  refresh(); renderBoard(); renderDetail();
  schedulePush();
}

/* ---------- sync: progress also lives on the server (data/<id>.json), localStorage is the offline cache ---------- */
const SYNC_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const sync = { timer: 0, chain: Promise.resolve(), api: true, asked: false };

function setSyncStatus(kind) {
  sync.status = kind;
  const el = $('syncStatus');
  if (!el) return;
  el.dataset.kind = kind;
  el.textContent = S.L?.['sync_' + kind] ?? '';
}

const syncEnabled = () => !!S.rm && !S.isLocal && !S.preview && sync.api && SYNC_ID.test(S.rm.id);

async function apiFetch(method, path, body, keepalive = false) {
  const call = () => fetch(path, {
    method, keepalive, cache: 'no-store',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(store.get(KEY.token) ? { Authorization: `Bearer ${store.get(KEY.token)}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let r = await call();
  if (r.status === 401 && !sync.asked) {
    sync.asked = true;   // ask once per page load
    const t = prompt(S.L.syncTokenPrompt);
    if (t) { store.set(KEY.token, t.trim()); r = await call(); }
  }
  return r;
}
const api = (method, rm, body, keepalive = false) => apiFetch(method, `api/state/${encodeURIComponent(rm.id)}`, body, keepalive);

/* Replaces the local progress with the server's (keeping a backup of unsynced local data). */
function adopt(rm, remote) {
  if (S.rm !== rm) return;
  if (S.ts === 0 && hasProgress(S.state)) store.set(KEY.backup(rm.id), JSON.stringify(S.state));
  S.state = cleanState(rm, remote.state);
  S.ts = remote.updatedAt;
  saveState();
  refresh(); renderBoard(); renderDetail();
}

function schedulePush() {
  if (!syncEnabled()) return setSyncStatus('local');
  clearTimeout(sync.timer);
  sync.timer = setTimeout(() => { sync.timer = 0; push(); }, 500);
}

function queue(fn) { return (sync.chain = sync.chain.then(fn, fn)); }

const push = (keepalive = false) => queue(async () => {
  const rm = S.rm;
  if (!syncEnabled()) return;
  if (!S.ts) { S.ts = Date.now(); saveState(); }   // progress saved before sync existed: give it a date
  try {
    const r = await api('PUT', rm, { updatedAt: S.ts, state: S.state }, keepalive);
    if (r.status === 409) { adopt(rm, await r.json()); setSyncStatus('on'); }
    else if (r.ok) setSyncStatus('on');
    else if (r.status === 401) setSyncStatus('auth');
    else if ([404, 405, 501].includes(r.status)) { sync.api = false; setSyncStatus('local'); }
    else setSyncStatus('offline');
  } catch { setSyncStatus('offline'); }
});

const pull = () => queue(async () => {
  const rm = S.rm;
  if (!syncEnabled() || sync.timer) return;   // a pending push will reconcile anyway
  try {
    const r = await api('GET', rm);
    if (S.rm !== rm) return;
    if (r.status === 401) return setSyncStatus('auth');
    if ([404, 405, 501].includes(r.status)) { sync.api = false; return setSyncStatus('local'); }
    if (r.status === 204) {   // nothing on the server yet: send what this browser has
      if (hasProgress(S.state)) { setSyncStatus('syncing'); push(); } else setSyncStatus('on');
      return;
    }
    if (!r.ok) return setSyncStatus('offline');
    const remote = await r.json();
    if (remote.updatedAt > S.ts) adopt(rm, remote);
    if (remote.updatedAt < S.ts) { setSyncStatus('syncing'); push(); return; }
    setSyncStatus('on');
  } catch { setSyncStatus('offline'); }
});

/* ---------- labels / chrome ---------- */
async function loadLabels(lang) {
  const avail = S.manifest.languages || [];
  const pick = [lang, str(lang).split('-')[0], 'pt-BR'].find(c => c && avail.includes(c)) || 'pt-BR';
  S.labelCache[pick] ??= await getJson(`src/labels/${pick}.json`);
  return S.labelCache[pick];
}

function buildLangSel() {
  const sel = $('langSel');
  sel.replaceChildren(...['auto', ...(S.manifest.languages || [])].map(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c === 'auto' ? S.L.langAuto : (LANG_NAMES[c] || c);
    return o;
  }));
  sel.value = langSetting();
}

function applyI18n() {
  const L = S.L;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = L[el.dataset.i18n] ?? ''; });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = L[el.dataset.i18nPlaceholder] ?? ''; });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = L[el.dataset.i18nTitle] ?? ''; });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', L[el.dataset.i18nAria] ?? ''));
  updateThemeBtn();
  if (S.manifest) buildLangSel();
}

function applyChrome() {
  const { rm, L } = S, m = rm.meta;
  document.documentElement.lang = uiLang(rm);
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

/* ---------- roadmap picker (sidebar) ---------- */
const groupTitle = g => ({ roadmaps: S.L.groupMine, 'examples/pt-BR': S.L['groupExamples_pt-BR'], 'examples/en': S.L.groupExamples_en })[g.id] || g.title;
const entryById = id => S.manifest?.roadmaps.find(r => r.id === id);
const visibleRoadmaps = () => S.manifest.roadmaps.filter(r => !r.hidden);

/* How far along a roadmap is: the open one uses live state, the others the server's copy or this browser's. */
function progressOf(entry) {
  let nodes;
  if (S.rm?.id === entry.id) nodes = S.state.nodes;
  else {
    const remote = S.remote?.[entry.id];
    let local = null;
    try { local = JSON.parse(store.get(KEY.state(entry.id)) || 'null'); } catch { /* ignore */ }
    nodes = (remote && remote.updatedAt >= (Number(store.get(KEY.ts(entry.id))) || 0) ? remote.nodes : local?.nodes) ?? remote?.nodes ?? {};
  }
  const dflt = new Set(entry.doneByDefault || []);
  const total = entry.topics || 0;
  const done = (entry.coreIds || []).filter(id => (nodes[id] ?? (dflt.has(id) ? 'finished' : 'todo')) === 'finished').length;
  return { done, total, complete: total > 0 && done >= total };
}

async function loadRemoteStates() {
  try {
    const r = await apiFetch('GET', 'api/states');
    if (r.ok) S.remote = await r.json();
  } catch { /* offline: this browser's copy is used */ }
}

const progressChip = pr => pr.complete
  ? `<span class="chip-done" title="${esc(S.L.rmDone)}">✓ ${esc(S.L.rmDone)}</span>`
  : `<span class="chip-n">${pr.done}/${pr.total}</span>`;

function updatePickerBtn() {
  if (!S.rm) { $('rmIcon').textContent = '▦'; $('rmName').textContent = '—'; $('rmChip').textContent = ''; return; }
  const entry = entryById(S.rm.id), local = S.isLocal;
  $('rmIcon').textContent = S.rm.meta.icon || '▦';
  $('rmName').textContent = S.rm.meta.title + (local ? ` (${S.L.localFile})` : '');
  const pr = entry && !local ? progressOf(entry) : { done: S.rm.core.filter(isDone).length, total: S.rm.core.length };
  pr.complete = pr.total > 0 && pr.done >= pr.total;
  $('rmChip').innerHTML = pr.complete ? `<span class="chip-done" title="${esc(S.L.rmDone)}">✓</span>` : `<span class="chip-n">${pr.done}/${pr.total}</span>`;
}

function rmRowHtml(r, { manage = false } = {}) {
  const pr = progressOf(r), open = S.rm?.id === r.id && !S.isLocal;
  const pct = pr.total ? Math.round(pr.done / pr.total * 100) : 0;
  const head = `<span class="rm-ico" aria-hidden="true">${esc(r.icon || '▦')}</span><span class="rm-meta"><span class="rm-t">${esc(r.title)}${r.editable ? ` <span class="rm-tag">${esc(S.L.rmMadeHere)}</span>` : ''}</span>` +
    (manage && r.description ? `<span class="rm-sub">${esc(r.description)}</span>` : '') +
    `<span class="rm-bar${pr.complete ? ' full' : ''}"><i style="width:${pct}%"></i></span></span><span class="rm-prog">${progressChip(pr)}</span>`;
  if (!manage) return `<button type="button" class="rm-item${open ? ' on' : ''}" role="menuitem" data-open="${esc(r.id)}"${open ? ' aria-current="true"' : ''}>${head}</button>`;
  const btn = (act, label, cls = '') => `<button type="button" class="rm-act ${cls}" data-rm="${act}" data-id="${esc(r.id)}">${esc(label)}</button>`;
  const L = S.L;
  if (S.confirmDel === r.id) {
    return `<div class="rm-row confirm"><div class="rm-line">${head}</div><div class="rm-ask"><p>${esc(fmt(L.rmDeleteAsk, { title: r.title }))}</p><div class="rm-acts">` +
      btn('delete-progress', L.rmDeleteWith, 'danger') + btn('delete-keep', L.rmDeleteKeep, 'danger') + btn('cancel', L.rmCancel) + '</div></div></div>';
  }
  return `<div class="rm-row${r.hidden ? ' is-hidden' : ''}"><div class="rm-line">${head}</div><div class="rm-acts">` +
    (r.hidden ? btn('restore', L.rmRestore) : btn('open', L.rmOpen) + (r.editable ? btn('edit', L.rmEdit) : '') + btn('duplicate', L.rmDuplicate)) +
    (r.editable ? btn('delete', L.rmDelete, 'danger') : (r.hidden ? '' : btn('hide', L.rmHide))) + '</div></div>';
}

function renderPicker() {
  const groups = (S.manifest.groups || []).map(g => ({ g, items: visibleRoadmaps().filter(r => r.group === g.id) })).filter(x => x.items.length);
  let html = groups.map(({ g, items }) => `<div class="rm-group">${esc(groupTitle(g))}</div>${items.map(r => rmRowHtml(r)).join('')}`).join('');
  if (S.localRm) html += `<div class="rm-group">${esc(S.L.localFile)}</div><button type="button" class="rm-item${S.isLocal ? ' on' : ''}" role="menuitem" data-open="__local__"><span class="rm-ico" aria-hidden="true">${esc(S.localRm.meta.icon || '▦')}</span><span class="rm-meta"><span class="rm-t">${esc(S.localRm.meta.title)}</span></span></button>`;
  if (!html) html = `<p class="rm-empty">${esc(S.L.rmNone)}</p>`;
  $('rmPop').innerHTML = `<div class="rm-list">${html}</div><div class="rm-foot"><button type="button" class="rm-foot-btn" data-act="new">+ ${esc(S.L.newRoadmap)}</button><button type="button" class="rm-foot-btn" data-act="manage">${esc(S.L.manageRoadmaps)}</button></div>`;
}

function setPicker(open) {
  const pop = $('rmPop');
  if (open) {
    renderPicker();
    const r = $('rmBtn').getBoundingClientRect(), w = Math.min(340, innerWidth - 16);
    pop.style.cssText = `left:${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px;top:${r.bottom + 6}px;width:${w}px;max-height:${Math.max(220, innerHeight - r.bottom - 20)}px`;
    loadRemoteStates().then(() => { if (!pop.hidden) renderPicker(); });
  }
  pop.hidden = !open;
  $('rmBtn').setAttribute('aria-expanded', String(open));
}

async function openById(id) {
  setPicker(false);
  if (id === '__local__') return setRoadmap(S.localRm, { local: true });
  const entry = entryById(id);
  if (entry && !(S.rm?.id === id && !S.isLocal)) await openEntry(entry);
}

function buildSwitch() { updatePickerBtn(); }

/* ---------- manager dialog: list, hide, delete, duplicate ---------- */
const needServer = () => sync.api === false;

function renderManage() {
  const dlg = $('manageDlg');
  if (!dlg.open) return;
  const L = S.L, hidden = S.manifest.roadmaps.filter(r => r.hidden);
  const groups = (S.manifest.groups || []).map(g => ({ g, items: visibleRoadmaps().filter(r => r.group === g.id) })).filter(x => x.items.length);
  let html = needServer() ? `<p class="dlg-note warn">${esc(L.rmNoServer)}</p>` : `<p class="dlg-note">${esc(L.rmHideHint)}</p>`;
  html += groups.map(({ g, items }) => `<div class="rm-group">${esc(groupTitle(g))}</div>${items.map(r => rmRowHtml(r, { manage: true })).join('')}`).join('');
  if (!groups.length) html += `<p class="rm-empty">${esc(L.rmNone)}</p>`;
  if (hidden.length) html += `<div class="rm-group">${esc(L.rmHidden)} (${hidden.length})</div>${hidden.map(r => rmRowHtml(r, { manage: true })).join('')}`;
  const body = $('manageBody'), top = body.scrollTop;
  body.innerHTML = html;
  body.scrollTop = top;
  dlg.querySelectorAll('[data-act=new]').forEach(b => { b.disabled = needServer(); });
}

async function openManage() {
  setPicker(false);
  S.confirmDel = null;
  $('manageDlg').showModal();
  renderManage();
  await loadRemoteStates();
  renderManage();
}

async function reloadManifest() {
  S.manifest = await getJson('manifest.json');
  updatePickerBtn(); renderManage();
  if (!$('rmPop').hidden) renderPicker();
}

/* Runs a server call for the manager; on failure tells the user why. */
async function manageCall(method, path, body) {
  try {
    const r = await apiFetch(method, path, body);
    if (r.ok) return r;
    if ([404, 405, 501].includes(r.status) && !(r.headers.get('Content-Type') || '').includes('json')) { sync.api = false; renderManage(); alert(S.L.rmNoServer); return null; }
    const j = await r.json().catch(() => ({}));
    alert(j.error || (j.errors || []).join('\n') || `HTTP ${r.status}`);
  } catch { alert(S.L.rmNoServer); }
  return null;
}

async function afterRemoval(id) {
  await reloadManifest();
  if (S.rm?.id === id && !S.isLocal) {
    const next = visibleRoadmaps()[0];
    if (next) await openEntry(next); else { S.rm = null; showMessage(S.L.rmNone, `<button type="button" class="primary" data-act="new">${esc(S.L.newRoadmap)}</button>`); }
  }
}

async function manageAction(act, id) {
  const entry = entryById(id), L = S.L;
  if (!entry) return;
  if (act === 'open') { $('manageDlg').close(); return openById(id); }
  if (act === 'edit') return openEditor(entry);
  if (act === 'duplicate') return duplicateRoadmap(entry);
  if (act === 'delete') { S.confirmDel = id; return renderManage(); }
  if (act === 'cancel') { S.confirmDel = null; return renderManage(); }
  if (act === 'hide' || act === 'restore') {
    if (!await manageCall('PUT', `api/hidden/${encodeURIComponent(id)}`, { hidden: act === 'hide' })) return;
    return afterRemoval(act === 'hide' ? id : null);
  }
  if (act === 'delete-keep' || act === 'delete-progress') {
    const wipe = act === 'delete-progress';
    if (!await manageCall('DELETE', `api/roadmaps/${encodeURIComponent(id)}${wipe ? '?progress=1' : ''}`)) return;
    S.confirmDel = null;
    if (wipe) [KEY.state(id), KEY.ts(id), KEY.backup(id), KEY.view(id)].forEach(k => store.del(k));
    return afterRemoval(id);
  }
}

async function duplicateRoadmap(entry) {
  const L = S.L;
  try {
    const raw = JSON.parse(await getText(entry.file));
    delete raw.$schema;
    const ids = new Set(S.manifest.roadmaps.map(r => r.id));
    let id = `${raw.id}-copy`, n = 2;
    while (ids.has(id)) id = `${raw.id}-copy-${n++}`;
    raw.id = id;
    raw.meta = { ...raw.meta, title: `${raw.meta.title} ${L.rmCopySuffix}` };
    if (!await manageCall('POST', `api/roadmaps?category=${encodeURIComponent(catPath(entry.group) ?? '')}`, raw)) return;
    await reloadManifest();
    $('manageDlg').close();
    await openEntry(entryById(id));
  } catch (err) { alert(err.message); }
}

/* ---------- editor screen: a form (or the raw JSON) on the left, a live preview on the right ---------- */
const LANG_NAMES = { 'pt-BR': 'Português (Brasil)', en: 'English' };
const ed = { id: null, base: null, model: null, mode: 'form', dirty: false, n: 0 };
const NODE_TEXT = ['time', 'summary', 'challenge', 'success'];

function modelFromJson(j) {
  const m = j.meta || {};
  return {
    title: str(m.title), subtitle: str(m.subtitle), description: str(m.description), icon: str(m.icon),
    accent: hex(j.theme?.accent) || '', brandColor: hex(j.theme?.brandAccent) || '', logoPlain: str(m.brand?.plain), logoAccent: str(m.brand?.accent),
    language: str(m.language) || S.rm?.meta.language || 'pt-BR',
    phases: arr(j.phases).map(p => ({ key: str(p.id) || `p${ed.n++}`, orig: p, title: str(p.title), period: str(p.period), color: hex(p.color) || '' })),
    nodes: treeOrder(arr(j.nodes).map(n => ({
      orig: n, tmp: `t${ed.n++}`, title: str(n.title), phase: str(n.phase), open: false, optional: !!n.optional, parent: str(n.parent) || (n.optional ? str(n.anchor) : ''),
      ...Object.fromEntries(NODE_TEXT.map(k => [k, str(n[k])])),
      topics: arr(n.topics).map(str).join('\n'), tasks: arr(n.tasks).map(t => str(t?.title)).join('\n'),
      links: arr(n.links).map(l => `${str(l?.title)} | ${str(l?.url)}`).join('\n'),
    }))),
  };
}

const rowId = r => r.orig?.id || r.tmp;
/* Rows stay in tree order (each one right after its parent's subtree), so moving, removing and indenting are slices of one array. */
function treeOrder(rows) {
  const ids = new Set(rows.map(rowId)), kids = new Map(), roots = [], out = [], seen = new Set();
  rows.forEach(r => {
    if (r.parent && r.parent !== rowId(r) && ids.has(r.parent)) { if (!kids.has(r.parent)) kids.set(r.parent, []); kids.get(r.parent).push(r); }
    else { r.parent = ''; roots.push(r); }
  });
  const walk = r => { if (seen.has(r)) return; seen.add(r); out.push(r); (kids.get(rowId(r)) || []).forEach(walk); };
  roots.forEach(walk); rows.forEach(walk);
  return out;
}
const rowDepths = rows => { const d = new Map(); return rows.map(r => { const v = r.parent ? (d.get(r.parent) ?? 0) + 1 : 0; d.set(rowId(r), v); return v; }); };

const blankNode = (phase, parent = '') => ({ orig: null, tmp: `t${ed.n++}`, title: '', phase, parent, optional: false, open: false, time: '', summary: '', challenge: '', success: '', topics: '', tasks: '', links: '' });
const lines = t => str(t).split('\n').map(x => x.trim()).filter(Boolean);

/* preview: ids are the rows' temporary keys, so they stay put while you type; saving makes real slugs. */
function buildJson(model, base, preview = false) {
  const used = new Set((S.manifest?.roadmaps || []).map(r => r.id));
  const fresh = (set, text, fallback) => { const b = slug(text) || fallback; let id = b, i = 2; while (set.has(id)) id = `${b}-${i++}`; set.add(id); return id; };
  const meta = { ...(base?.meta || {}), title: model.title.trim() || (preview ? S.L.edTitleNew : ''), language: model.language };
  for (const k of ['subtitle', 'description', 'icon']) { const v = model[k].trim(); if (v) meta[k] = v; else delete meta[k]; }
  const brand = { ...(base?.meta?.brand || {}) };
  for (const [k, v] of [['plain', model.logoPlain.trim()], ['accent', model.logoAccent.trim()]]) { if (v) brand[k] = v; else delete brand[k]; }
  if (Object.keys(brand).length) meta.brand = brand; else delete meta.brand;
  const theme = { ...(base?.theme || {}) };
  for (const [k, v] of [['accent', model.accent], ['brandAccent', model.brandColor]]) { if (v) theme[k] = v; else delete theme[k]; }
  const phaseIds = new Set(model.phases.map(p => p.orig?.id).filter(Boolean)), idOf = {};
  const phases = model.phases.filter(p => p.title.trim()).map(p => {
    const o = { ...(p.orig || {}), id: p.orig?.id || (preview ? p.key : fresh(phaseIds, p.title, 'fase')), title: p.title.trim() };
    if (p.period.trim()) o.period = p.period.trim(); else delete o.period;
    if (p.color) o.color = p.color; else delete o.color;
    idOf[p.key] = o.id;
    return o;
  });
  const nodeIds = new Set(model.nodes.map(n => n.orig?.id).filter(Boolean));
  const rows = model.nodes.filter(n => n.title.trim()), idByRow = new Map();
  rows.forEach(n => idByRow.set(rowId(n), n.orig?.id || (preview ? n.tmp : fresh(nodeIds, n.title, 'topico'))));
  const hangs = n => !!n.parent && idByRow.has(n.parent) && n.parent !== rowId(n);
  const built = new Map(rows.map(n => {
    const o = { ...(n.orig || {}), id: idByRow.get(rowId(n)), title: n.title.trim() };
    for (const k of NODE_TEXT) { const v = n[k].trim(); if (v) o[k] = v; else delete o[k]; }
    const topics = lines(n.topics); if (topics.length) o.topics = topics; else delete o.topics;
    const old = arr(n.orig?.tasks), taskIds = new Set(old.map(t => t.id)), tasks = lines(n.tasks).map((t, k) => old.find(x => x.title === t) || { id: preview ? `k${k}` : fresh(taskIds, t, 'tarefa'), title: t });
    if (tasks.length) o.tasks = tasks; else delete o.tasks;
    const links = lines(n.links).map(l => { const i = l.indexOf('|'); return i < 0 ? { title: l, url: l } : { title: l.slice(0, i).trim() || l.slice(i + 1).trim(), url: l.slice(i + 1).trim() }; });
    if (links.length) o.links = links; else delete o.links;
    delete o.anchor;   // `parent` replaces the older name
    if (hangs(n)) { o.parent = idByRow.get(n.parent); delete o.phase; if (n.optional) o.optional = true; else delete o.optional; }
    else { delete o.parent; delete o.optional; if (phases.length) o.phase = idOf[n.phase] || phases[0].id; else delete o.phase; }
    return [rowId(n), o];
  }));
  const kids = new Map();
  rows.filter(hangs).forEach(n => { if (!kids.has(n.parent)) kids.set(n.parent, []); kids.get(n.parent).push(n); });
  const flat = n => [built.get(rowId(n)), ...(kids.get(rowId(n)) || []).flatMap(flat)];
  let groups = rows.filter(n => !hangs(n)).map(n => ({ phase: built.get(rowId(n)).phase, list: flat(n) }));
  if (preview) for (const p of phases) if (!groups.some(g => g.phase === p.id)) groups.push({ phase: p.id, list: [{ id: `ghost-${p.id}`, title: S.L.edGhostTitle, phase: p.id, summary: S.L.edGhostSummary }] });   // a phase with no topics yet still shows up
  if (phases.length) { const idx = id => phases.findIndex(p => p.id === id); groups = groups.map((g, i) => [g, i]).sort((a, b) => idx(a[0].phase) - idx(b[0].phase) || a[1] - b[1]).map(x => x[0]); }
  const nodes = groups.flatMap(g => g.list);
  const id = base?.id || (preview ? 'draft' : fresh(used, model.title, 'roadmap'));
  const { phases: _p, nodes: _n, ...rest } = base || {};
  const { theme: _t, ...rest2 } = rest;
  const out = { ...rest2, schemaVersion: 1, id, meta };
  if (Object.keys(theme).length) out.theme = theme;
  if (phases.length) out.phases = phases;
  out.nodes = nodes;
  return out;
}

const fld = (label, inner, cls = '') => `<label class="ed-f ${cls}"><span>${esc(label)}</span>${inner}</label>`;
const inp = (f, v, ph = '', extra = '') => `<input type="text" data-f="${f}" value="${esc(v)}" placeholder="${esc(ph)}" ${extra}>`;
const area = (f, v, rows = 3) => `<textarea data-f="${f}" rows="${rows}">${esc(v)}</textarea>`;
const DEFAULT_ACCENT = '#233b65', DEFAULT_BRAND = '#7549bd';
/* A color picker that stays empty (the default) until you choose one; the arrow clears it again. */
const colorField = (f, v, dflt, label = '', kind = 'top') => `<span class="ed-color${v ? ' set' : ''}"><input type="color" data-f="${f}" value="${esc(v || dflt)}"${label ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''}><button type="button" data-do="reset-color" data-kind="${kind}" data-f="${f}" title="${esc(S.L.edColorReset)}" aria-label="${esc(S.L.edColorReset)}">↺</button></span>`;
const logoHtml = m => `${esc(m.logoPlain || 'road')}<b style="color:${esc(m.brandColor || DEFAULT_BRAND)}">${esc(m.logoAccent || 'kit')}</b>`;
const rowBtns = L => `<span class="ed-btns"><button type="button" data-do="up" title="${esc(L.edMoveUp)}" aria-label="${esc(L.edMoveUp)}">↑</button><button type="button" data-do="down" title="${esc(L.edMoveDown)}" aria-label="${esc(L.edMoveDown)}">↓</button><button type="button" data-do="rm" class="x" title="${esc(L.edRemove)}" aria-label="${esc(L.edRemove)}">×</button></span>`;

function renderForm() {
  const L = S.L, m = ed.model, langs = S.manifest.languages?.length ? S.manifest.languages : ['pt-BR', 'en'];
  const phaseOpts = sel => m.phases.map(p => `<option value="${esc(p.key)}"${p.key === sel ? ' selected' : ''}>${esc(p.title || L.edPhaseTitle)}</option>`).join('');
  $('editBody').innerHTML =
    `<div class="ed-grid">${fld(L.edName, inp('title', m.title), 'wide')}${fld(L.edLanguage, `<select data-f="language">${langs.map(c => `<option value="${esc(c)}"${c === m.language ? ' selected' : ''}>${esc(LANG_NAMES[c] || c)}</option>`).join('')}</select>`)}${fld(L.edIcon, inp('icon', m.icon, '🚀', 'maxlength="8"'))}${fld(L.edSubtitle, inp('subtitle', m.subtitle), 'wide')}${fld(L.edDescription, inp('description', m.description), 'wide')}</div>` +
    `<h3 class="ed-h">${esc(L.edColors)}</h3><div class="ed-grid">${fld(L.edAccent, colorField('accent', m.accent, DEFAULT_ACCENT))}${fld(L.edBrandColor, colorField('brandColor', m.brandColor, DEFAULT_BRAND))}${fld(L.edLogo, `<span class="ed-logo-row">${inp('logoPlain', m.logoPlain, 'road')}${inp('logoAccent', m.logoAccent, 'kit')}<span class="ed-logo" id="logoMini">${logoHtml(m)}</span></span>`, 'wide')}</div><p class="ed-hint">${esc(L.edColorsHint)}</p>` +
    `<h3 class="ed-h">${esc(L.edPhases)}</h3><div data-list="phases">${m.phases.map((p, i) => `<div class="ed-row" data-i="${i}">${inp('title', p.title, L.edPhaseTitle)}${inp('period', p.period, L.edPhasePeriod)}${colorField('color', p.color, PALETTE[i % PALETTE.length], L.edPhaseColor, 'phase')}${rowBtns(L)}</div>`).join('')}</div><button type="button" class="secondary ed-add" data-do="add-phase">+ ${esc(L.edAddPhase)}</button>` +
    `<h3 class="ed-h">${esc(L.edTopics)}</h3><div data-list="nodes">${topicCards(m, L, phaseOpts)}</div>` +
    `<button type="button" class="secondary ed-add" data-do="add-node">+ ${esc(L.edAddTopic)}</button><p class="ed-hint">${esc(L.edHint)}</p>`;
}

function topicCards(m, L, phaseOpts) {
  const depths = rowDepths(m.nodes);
  let rootNo = 0;
  return m.nodes.map((n, i) => {
    const d = depths[i], root = d === 0;
    if (root) rootNo++;
    const second = root
      ? (m.phases.length ? `<select data-f="phase" aria-label="${esc(L.edPhaseOf)}">${phaseOpts(n.phase || m.phases[0].key)}</select>` : '')
      : `<label class="ed-chk"><input type="checkbox" data-f="optional"${n.optional ? ' checked' : ''}> ${esc(L.edOptional)}</label>`;
    return `<div class="ed-card d${d}${n.open ? ' open' : ''}" data-i="${i}" style="--d:${d}"><div class="ed-row"><span class="ed-num">${root ? rootNo : '↳'}</span>${inp('title', n.title, L.edTopicTitle)}${rowBtns(L)}<span class="ed-br"></span>${second}${inp('time', n.time, L.edTime)}</div>` +
      `<div class="ed-acts"><button type="button" class="ed-more" data-do="more" aria-expanded="${n.open}">${n.open ? '▾' : '▸'} ${esc(L.edDetails)}</button>${d < 2 ? `<button type="button" class="ed-more" data-do="add-sub">${esc(L.edAddSub)}</button>` : ''}</div>` +
      (n.open ? `<div class="ed-det">${fld(L.edSummary, area('summary', n.summary, 2), 'wide')}${fld(L.edStudy, area('topics', n.topics))}${fld(L.edTasks, area('tasks', n.tasks))}${fld(L.edChallenge, area('challenge', n.challenge, 2))}${fld(L.edSuccess, area('success', n.success, 2))}${fld(L.edLinks, area('links', n.links), 'wide')}</div>` : '') + '</div>';
  }).join('');
}

/* Category = the section (folder) a roadmap lives in. */
const catPath = group => (group === 'roadmaps' ? '' : String(group).startsWith('roadmaps/') ? String(group).slice('roadmaps/'.length) : null);

function buildCategorySelect() {
  const sel = $('edCat'), opts = [['', S.L.groupMine], ...S.manifest.groups.filter(g => catPath(g.id)).map(g => [catPath(g.id), g.title])];
  if (ed.cat && ed.cat !== '__new__' && !opts.some(o => o[0] === ed.cat)) opts.push([ed.cat, ed.cat]);
  opts.push(['__new__', S.L.edCategoryNew]);
  sel.replaceChildren(...opts.map(([value, textContent]) => Object.assign(document.createElement('option'), { value, textContent })));
  sel.value = ed.cat;
  $('edCatNew').hidden = ed.cat !== '__new__';
  $('edCatNew').value = ed.catNew;
  sel.title = S.L.edCategoryHint;
}

function showEditErr(list) { $('editErr').innerHTML = list.length ? `<strong>${esc(S.L.edErrors)}</strong><ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''; }

function setEditMode(mode) {
  if (mode === ed.mode && $('editBody').firstChild) return;
  showEditErr([]);
  if (mode === 'json') {
    const json = buildJson(ed.model, ed.base);
    $('editBody').innerHTML = `<textarea class="ed-json" id="edJson" spellcheck="false" aria-label="JSON"></textarea>`;
    $('edJson').value = JSON.stringify(json, null, 2);
  } else if (ed.mode === 'json' && $('edJson')) {
    try {
      const j = JSON.parse($('edJson').value);
      if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('not an object');
      ed.base = j; ed.model = modelFromJson(j);
    } catch (err) { showEditErr([S.L.edJsonInvalid + err.message]); return; }
    renderForm();
  } else renderForm();
  ed.mode = mode;
  $('editMode').querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
}

/* ---- live preview ---- */
/* Nothing to draw yet: the toolbar and the details panel show the draft itself, not the roadmap that was open before. */
async function showPreviewHint() {
  S.L = { ...S.defaults, ...await loadLabels(uiLang({ meta: { language: ed.model?.language } })) };
  S.rm = null; S.preview = true; S.state = emptyState();
  applyI18n();
  const L = S.L, m = ed.model, form = ed.mode === 'form', root = document.documentElement;
  root.style.setProperty('--accent', (form && m.accent) || DEFAULT_ACCENT); root.style.setProperty('--brand', (form && m.brandColor) || DEFAULT_BRAND);
  root.lang = uiLang({ meta: { language: m?.language } });
  const title = (form && m.title.trim()) || L.edTitleNew;
  document.title = title;
  $('eyebrow').textContent = '';
  $('title').textContent = title;
  $('subtitle').textContent = form ? m.subtitle : '';
  $('footer').textContent = '';
  $('progressText').textContent = '0 / 0';
  $('barFill').style.width = '0%';
  const box = $('detailContent');
  box.className = 'detail-placeholder';
  box.innerHTML = `${form && m.icon ? `<span class="big">${esc(m.icon)}</span>` : ''}<strong>${esc(L.placeholderTitle)}</strong><br>${esc(L.placeholderText)}`;
  showMessage(L.edPreviewEmptyTitle, esc(L.edPreviewEmptyText));
}

async function rebuildPreview(first = false) {
  let rm = null;
  try {
    const json = ed.mode === 'json' ? JSON.parse($('edJson').value) : buildJson(ed.model, ed.base, true);
    if (json && Array.isArray(json.nodes) && json.nodes.length) rm = normalize(json, 'draft');
  } catch { /* half-typed JSON: keep what is on screen */ }
  if (!rm) {
    if (first || ed.mode === 'form' || !S.rm) await showPreviewHint();
    return;
  }
  await setRoadmap(rm, { preview: true, keep: !first && !!S.rm && S.preview });
  rm.nodes.filter(n => n.id.startsWith('ghost-')).forEach(n => n.el.classList.add('ghost'));
}

let previewTimer = 0;
const schedulePreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(() => S.editing && rebuildPreview(), 250); };

/* Clicking a topic in the preview scrolls the form to its row. */
function focusEditorRow(id) {
  if (ed.mode !== 'form') return;
  const i = ed.model.nodes.findIndex(r => (r.orig?.id || r.tmp) === id), card = $('editBody').querySelector(`[data-list=nodes] .ed-card[data-i="${i}"]`);
  if (!card || card.contains(document.activeElement)) return;
  card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  card.classList.add('flash');
  setTimeout(() => card.classList.remove('flash'), 900);
}

/* ---- enter / leave ---- */
async function openEditor(entry = null) {
  if (S.editing) return;
  let base = null;
  if (entry) {
    try { base = JSON.parse(await getText(entry.file)); } catch (err) { return alert(err.message); }
  }
  ed.id = entry ? entry.id : null; ed.base = base; ed.dirty = false; ed.mode = 'form';
  ed.cat = catPath((entry || entryById(S.rm?.id))?.group ?? '') ?? ''; ed.catNew = '';
  ed.prev = S.rm ? { id: S.rm.id, local: S.isLocal } : null;
  ed.model = base ? modelFromJson(base) : { ...modelFromJson({ meta: {}, nodes: [] }), nodes: [blankNode('')] };
  if (!base) ed.model.language = S.rm?.meta.language || 'pt-BR';
  S.L = { ...S.defaults, ...await loadLabels(uiLang({ meta: { language: ed.model.language } })) };   // the editor speaks the draft's language, not the previous roadmap's
  applyI18n();
  $('editTitle').textContent = entry ? S.L.edTitleEdit : S.L.edTitleNew;
  buildCategorySelect();
  $('editBody').replaceChildren();
  showEditErr([]);
  if ($('manageDlg').open) $('manageDlg').close();
  setPicker(false); setDrawer(false);
  S.editing = true;
  document.body.classList.add('editing');
  $('editorPane').hidden = false;
  setEditMode('form');
  $('editBody').scrollTop = 0;
  await rebuildPreview(true);
  window.scrollTo({ top: 0 });
  $('editBody').querySelector('input')?.focus();
}

async function leaveEditor(savedId = null) {
  clearTimeout(previewTimer);
  S.editing = false; S.preview = false; ed.dirty = false;
  document.body.classList.remove('editing', 'edit-preview');
  $('editorPane').hidden = true;
  const visible = visibleRoadmaps();
  const back = savedId ? entryById(savedId) : ed.prev && !ed.prev.local ? entryById(ed.prev.id) : null;
  if (back) return openEntry(back);
  if (ed.prev?.local && S.localRm) return setRoadmap(S.localRm, { local: true });
  if (visible[0]) return openEntry(visible[0]);
  S.rm = null;
  updatePickerBtn();
  showMessage(S.L.rmNone, `<button type="button" class="primary" data-act="new">${esc(S.L.newRoadmap)}</button>`);
}

function closeEditor() {
  if (ed.dirty && !confirm(S.L.edDiscard)) return;
  leaveEditor();
}

async function saveEditor() {
  let json;
  try {
    if (ed.mode === 'json') json = JSON.parse($('edJson').value);
    else {
      json = buildJson(ed.model, ed.base);
      if (!json.meta.title || !json.nodes.length) return showEditErr([S.L.edNeedTitle]);
    }
  } catch (err) { return showEditErr([S.L.edJsonInvalid + err.message]); }
  showEditErr([]);
  $('editSave').disabled = true;
  try {
    let cat = ed.cat, extra = '';
    if (cat === '__new__') {
      const title = ed.catNew.trim(), name = slug(title).slice(0, 40);
      if (!name) return showEditErr([S.L.edCategoryNeedName]);
      cat = name; extra = `&categoryTitle=${encodeURIComponent(title)}`;
    }
    const q = `?category=${encodeURIComponent(cat)}${extra}`;
    const r = await apiFetch(ed.id ? 'PUT' : 'POST', (ed.id ? `api/roadmaps/${encodeURIComponent(ed.id)}` : 'api/roadmaps') + q, json);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return showEditErr(j.errors || [j.error || (r.status === 404 || r.status === 405 ? S.L.rmNoServer : `HTTP ${r.status}`)]);
    await reloadManifest();
    await leaveEditor(json.id);
  } catch { showEditErr([S.L.rmNoServer]); }
  finally { $('editSave').disabled = false; }
}

function wireEditor() {
  const body = $('editBody');
  const move = (list, i, d) => { const j = i + d; if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]]; };
  const rerender = () => { const top = body.scrollTop; renderForm(); body.scrollTop = top; };
  body.addEventListener('input', e => {
    ed.dirty = true;
    schedulePreview();
    const f = e.target.dataset.f, card = e.target.closest('[data-i]');
    if (f && !card && ed.mode === 'form') {   // name, subtitle, icon, colors...
      ed.model[f] = e.target.value;
      if (e.target.type === 'color') e.target.closest('.ed-color').classList.add('set');
      if (/^(logo|brandColor)/.test(f)) $('logoMini').innerHTML = logoHtml(ed.model);
      return;
    }
    if (!f || !card || ed.mode !== 'form') return;
    const kind = e.target.closest('[data-list]').dataset.list, row = ed.model[kind][+card.dataset.i];
    row[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (e.target.type === 'color') e.target.closest('.ed-color').classList.add('set');
    if (kind === 'phases' && f === 'title') body.querySelectorAll(`select[data-f=phase] option[value="${CSS.escape(row.key)}"]`).forEach(o => { o.textContent = row.title || S.L.edPhaseTitle; });
  });
  body.addEventListener('change', e => {
    const f = e.target.dataset.f;
    if (f && !e.target.closest('[data-i]')) { ed.dirty = true; ed.model[f] = e.target.value; schedulePreview(); }
    else if (f === 'phase') schedulePreview();
  });
  body.addEventListener('click', e => {
    const b = e.target.closest('[data-do]');
    if (!b || ed.mode !== 'form') return;
    ed.dirty = true;
    const card = b.closest('[data-i]'), i = card ? +card.dataset.i : -1, m = ed.model, kind = card?.closest('[data-list]').dataset.list;
    const end = k => { const d = rowDepths(m.nodes); let j = k + 1; while (j < m.nodes.length && d[j] > d[k]) j++; return j; };
    const moveTree = dir => {   // swap this row's subtree with its neighbouring sibling's
      const sibs = m.nodes.map((r, k) => k).filter(k => m.nodes[k].parent === m.nodes[i].parent), at = sibs.indexOf(i), other = sibs[at + dir];
      if (other === undefined) return;
      const a0 = i, a1 = end(i), b0 = other, b1 = end(other), A = m.nodes.slice(a0, a1), B = m.nodes.slice(b0, b1);
      if (dir < 0) m.nodes.splice(b0, a1 - b0, ...A, ...B); else m.nodes.splice(a0, b1 - a0, ...B, ...A);
    };
    let focusAt = -1;
    switch (b.dataset.do) {
      case 'up': if (kind === 'nodes') moveTree(-1); else move(m[kind], i, -1); break;
      case 'down': if (kind === 'nodes') moveTree(1); else move(m[kind], i, 1); break;
      case 'rm':
        if (kind === 'nodes') m.nodes.splice(i, end(i) - i); else m[kind].splice(i, 1);
        if (kind === 'nodes' && !m.nodes.length) m.nodes.push(blankNode(m.phases[0]?.key || ''));
        break;
      case 'more': m.nodes[i].open = !m.nodes[i].open; break;
      case 'add-sub': focusAt = end(i); m.nodes.splice(focusAt, 0, blankNode('', rowId(m.nodes[i]))); break;
      case 'reset-color': if (b.dataset.kind === 'phase') m.phases[i].color = ''; else m[b.dataset.f] = ''; break;
      case 'add-phase': m.phases.push({ key: `p${ed.n++}`, orig: null, title: '', period: '', color: '' }); break;
      case 'add-node': m.nodes.push(blankNode(m.phases.at(-1)?.key || '')); break;
    }
    rerender();
    if (b.dataset.do !== 'more') schedulePreview();
    if (focusAt >= 0) body.querySelector(`[data-list=nodes] .ed-card[data-i="${focusAt}"] input`)?.focus();
    if (b.dataset.do === 'add-node') body.querySelector('[data-list=nodes] .ed-card:last-child input')?.focus();
    if (b.dataset.do === 'add-phase') body.querySelector('[data-list=phases] .ed-row:last-child input')?.focus();
  });
  /* the topic you are editing is the one selected in the preview */
  body.addEventListener('focusin', e => {
    const card = e.target.closest('.ed-card');
    if (!card || !S.rm) return;
    const row = ed.model.nodes[+card.dataset.i], id = row && (row.orig?.id || row.tmp);
    if (id && S.rm.byId[id] && S.selected !== id) select(id, true, { drawer: false });
  });
  $('editMode').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) { setEditMode(b.dataset.mode); schedulePreview(); } });
  $('editSave').addEventListener('click', saveEditor);
  $('edCat').addEventListener('change', e => { ed.cat = e.target.value; ed.dirty = true; $('edCatNew').hidden = ed.cat !== '__new__'; if (!$('edCatNew').hidden) $('edCatNew').focus(); });
  $('edCatNew').addEventListener('input', e => { ed.catNew = e.target.value; ed.dirty = true; });
  $('edBack').addEventListener('click', closeEditor);
  $('edCancel').addEventListener('click', closeEditor);
  $('edPreviewBtn').addEventListener('click', () => { document.body.classList.add('edit-preview'); window.scrollTo({ top: 0 }); S.rm && S.view === 'map' && layout(); });
  $('edBackEdit').addEventListener('click', () => document.body.classList.remove('edit-preview'));
  addEventListener('beforeunload', e => { if (S.editing && ed.dirty) e.preventDefault(); });
}

/* ---------- map build + layout ---------- */
function metaText(n) {
  const kids = requiredKids(n), fin = kids.filter(c => nodeStatus(c) === 'finished').length;
  return [n.time, n.optional ? S.L.optionalTag : '', n.tasks.length ? `${finishedTasks(n)}/${n.tasks.length}` : '', kids.length ? `↳ ${fin}/${kids.length}` : ''].filter(Boolean).join(' | ');
}

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
    el.className = 'road-node' + (n.optional ? ' optional-node' : n.parent ? ' sub-node' : '') + (n.depth ? ` depth-${n.depth}` : '');
    el.dataset.node = n.id;
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    const num = n.optional ? '+' : n.parent ? '↳' : String(n.num).padStart(2, '0');
    const meta = metaText(n);
    el.innerHTML = `<span class="node-num">${num}</span><span class="node-txt"><span class="node-name">${esc(n.title)}</span>${meta ? `<span class="node-meta">${esc(meta)}</span>` : ''}</span><button class="node-check" title="${esc(L.toggleDone)}" aria-label="${esc(L.toggleDone)}: ${esc(n.title)}"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    el.addEventListener('click', () => select(n.id));
    el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); select(n.id); } });
    el.querySelector('.node-check').addEventListener('click', e => { e.stopPropagation(); toggleDone(n); });
    map.append(el); n.el = el; n.metaEl = el.querySelector('.node-meta');
    n.isDone = () => isDone(n);
  });
  const lg = document.createElement('div');
  lg.className = 'legend';
  lg.innerHTML = `<div class="heading">${esc(L.legendTitle)}</div><div class="legend-item"><span class="swatch"></span> ${esc(L.legendMain)}</div><div class="legend-item"><span class="swatch green"></span> ${esc(L.legendDone)}</div>${rm.nodes.some(n => n.optional) ? `<div class="legend-item"><span class="swatch opt"></span> ${esc(L.legendOptional)}</div>` : ''}${rm.nodes.some(n => n.parent && !n.optional) ? `<div class="legend-item"><span class="swatch sub"></span> ${esc(L.legendSub)}</div>` : ''}<div class="hint">${esc(L.legendHint)}</div>`;
  map.append(lg); S.legendEl = lg;
}

function geometry() {
  const vw = $('mapViewport').clientWidth || G.mapW, wide = S.rm?.maxDepth >= 2 ? G.mapW2 : G.mapW;
  if (vw < NARROW_BELOW) return { narrow: true, mapW: Math.max(280, vw), scale: 1 };
  return { narrow: false, mapW: wide, scale: Math.min(MAX_SCALE, vw / wide) };
}

/* Sub-topics: each level sits in its own column to the right (wide) or indented below (narrow). */
const kidsHeight = n => (n.children.length
  ? n.children.reduce((sum, c) => sum + Math.max(c.el.offsetHeight, kidsHeight(c)), 0) + G.optGap * (n.children.length - 1) : 0);

function placeKidsWide(n, top) {
  let cy = top;
  n.children.forEach(c => {
    const h = c.el.offsetHeight, kh = kidsHeight(c);
    Object.assign(c, { x: c.depth === 1 ? G.optX : G.subX, y: cy, h });
    c.el.style.left = c.x + 'px'; c.el.style.top = cy + 'px';
    const sx = n.x + n.el.offsetWidth, sy = n.y + n.h / 2, ex = c.x, ey = cy + h / 2, mx = sx + (ex - sx) / 2;
    addLine(`M${sx} ${sy} L${mx} ${sy} L${mx} ${ey} L${ex} ${ey}`, c.optional, n, c);
    placeKidsWide(c, kh <= h ? cy + (h - kh) / 2 : cy);
    cy += Math.max(h, kh) + G.optGap;
  });
}

/* returns the y just below the last placed descendant */
function placeKidsNarrow(n, top, nodeX) {
  let oy = top;
  n.children.forEach(c => {
    const h = c.el.offsetHeight, cx = nodeX + NEST * c.depth;
    Object.assign(c, { x: cx, y: oy, h });
    c.el.style.left = cx + 'px'; c.el.style.top = oy + 'px';
    const px = n.x + 10, ey = oy + h / 2;
    addLine(`M${px} ${n.y + n.h} L${px} ${ey} L${cx} ${ey}`, c.optional, n, c);
    oy = placeKidsNarrow(c, oy + h + 10, nodeX);
  });
  return oy;
}

/* Wide: central spine with phase flags on the left and optional branches on the right,
   drawn in a fixed design space and scaled to fit. Narrow: one column timeline, with the
   line on the left, phase headers above their topics and optional topics nested below. */
function layout() {
  const { rm } = S, map = $('map'), svg = S.svg;
  if (!svg || S.view === 'kanban') return;
  const geo = S.geo = geometry(), nw = geo.narrow;
  const nodeX = nw ? 44 : G.spineX, nodeW = nw ? geo.mapW - nodeX - 16 : G.nodeW;
  const gap = nw ? 30 : G.gap, msGap = nw ? 22 : G.msGap, lineX = nw ? 24 : nodeX + nodeW / 2;
  const shown = rm.phases.filter(p => p.nodes.length);
  svg.replaceChildren();
  S.links = [];

  // widths first, because card heights depend on them
  rm.nodes.forEach(n => { n.el.style.width = nw ? (nodeW - NEST * n.depth) + 'px' : ''; });
  shown.forEach(ph => {
    if (ph.flagEl) { ph.flagEl.style.width = nw ? nodeW + 'px' : ''; ph.flagEl.style.left = nw ? nodeX + 'px' : ''; }
    if (ph.msEl) ph.msEl.style.width = nw ? nodeW + 'px' : '';
  });
  S.legendEl.style.width = nw ? nodeW + 'px' : '';
  S.legendEl.style.left = nw ? nodeX + 'px' : '';

  const spine = [];
  let y = nw ? 24 : G.top, flagBottom = 0, lastWasMs = false;
  shown.forEach(ph => {
    if (nw) {
      if (ph.flagEl) { ph.flagEl.style.top = y + 'px'; y += ph.flagEl.offsetHeight + 18; }
    } else {
      if (flagBottom) y = Math.max(y, flagBottom + 30);
      if (ph.flagEl) { ph.flagEl.style.top = y + 'px'; flagBottom = y + ph.flagEl.offsetHeight; }
    }
    ph.nodes.forEach(n => {
      const h = n.el.offsetHeight;
      Object.assign(n, { x: nodeX, y, h });
      n.el.style.left = n.x + 'px'; n.el.style.top = y + 'px';
      let slot = h;
      if (n.children.length) {
        if (nw) {
          const end = placeKidsNarrow(n, y + h + 10, nodeX);
          slot = end - 10 - y;
        } else {
          const total = kidsHeight(n);
          placeKidsWide(n, total <= h ? y + (h - total) / 2 : y);
          slot = Math.max(h, total);
        }
      }
      spine.push(n);
      y += slot + gap;
      lastWasMs = false;
    });
    if (ph.msEl) {
      const msY = y - gap + msGap, mh = ph.msEl.offsetHeight, msX = nw ? nodeX : lineX - G.msW / 2;
      ph.msEl.style.left = msX + 'px'; ph.msEl.style.top = msY + 'px';
      const ms = { x: msX, y: msY, h: mh, isDone: () => phaseDone(ph) };
      ph.ms = ms; spine.push(ms);
      y = msY + mh + msGap;
      lastWasMs = true;
    }
  });

  if (nw) {
    spine.forEach((it, i) => {
      const my = it.y + it.h / 2, nx = spine[i + 1];
      addLine(`M${lineX} ${my} L${it.x} ${my}`, false, it, it);
      if (nx) addLine(`M${lineX} ${my} L${lineX} ${nx.y + nx.h / 2}`, false, it, nx);
    });
  } else {
    for (let i = 0; i < spine.length - 1; i++) {
      const a = spine[i], b = spine[i + 1];
      addLine(`M${lineX} ${a.y + a.h} L${lineX} ${b.y}`, false, a, b);
    }
  }

  const lh = S.legendEl.offsetHeight;
  let mapH, ly;
  if (nw) {
    ly = y - (lastWasMs ? msGap : gap) + 28;
    mapH = ly + lh + 28;
  } else {
    mapH = y - (lastWasMs ? msGap : gap) + 70;
    ly = Math.max(flagBottom + 30, mapH - lh - 30);
    mapH = Math.max(mapH, ly + lh + 30);
  }
  S.legendEl.style.top = ly + 'px';
  map.style.width = geo.mapW + 'px'; map.style.height = mapH + 'px';
  map.style.transform = geo.scale === 1 ? '' : `scale(${geo.scale})`;
  $('mapFrame').style.width = geo.mapW * geo.scale + 'px';
  $('mapFrame').style.height = mapH * geo.scale + 'px';
  svg.setAttribute('width', geo.mapW); svg.setAttribute('height', mapH);
  svg.setAttribute('viewBox', `0 0 ${geo.mapW} ${mapH}`);
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
    const st = nodeStatus(n), done = st === 'finished';
    n.el.classList.toggle('completed', done);
    n.el.classList.toggle('st-working', st === 'working');
    n.el.classList.toggle('st-review', st === 'review');
    n.el.classList.toggle('selected', S.selected === n.id);
    n.el.classList.toggle('dimmed', dimmed(n));
    n.el.setAttribute('aria-label', `${n.title}, ${L[STATUS_LABEL[st]]}`);
    n.el.querySelector('.node-check').setAttribute('aria-pressed', String(done));
    if (n.metaEl) n.metaEl.textContent = metaText(n);
  });
  rm.phases.forEach(ph => ph.msEl?.classList.toggle('reached', phaseDone(ph)));
  S.links.forEach(l => l.el.classList.toggle('done', !!(l.a.isDone() && l.b.isDone())));
  const real = S.preview ? rm.core.filter(n => !n.id.startsWith('ghost-')) : rm.core;   // editor placeholders don't count
  const qty = real.filter(isDone).length;
  $('progressText').textContent = `${qty} / ${real.length}`;
  $('barFill').style.width = (real.length ? qty / real.length * 100 : 0) + '%';
  updatePickerBtn();
}

function applyFilters() {
  refresh();
  renderBoard();
}

/* ---------- skipped-topic warning ---------- */
/* A topic that moved past "todo" while earlier main topics are not finished is a skipped topic. */
function pendingBefore(n) {
  if (n.optional || n.parent || nodeStatus(n) === 'todo') return [];
  return S.rm.core.slice(0, S.rm.core.indexOf(n)).filter(x => !isDone(x));
}

function skipInfo(n) {
  const miss = pendingBefore(n);
  return miss.length > skipTolerance() ? miss : null;
}

function skipNote(miss) {
  const L = S.L, shown = miss.slice(0, 4);
  return `<div class="skip-note" role="note"><strong>${esc(fmt(miss.length === 1 ? L.skipWarnOne : L.skipWarnMany, { n: miss.length }))}</strong><ul>${shown.map(x => `<li>${esc(x.title)}</li>`).join('')}${miss.length > shown.length ? `<li>${esc(fmt(L.skipWarnMore, { n: miss.length - shown.length }))}</li>` : ''}</ul></div>`;
}

/* ---------- roadmap kanban ---------- */
function renderBoard() {
  if (S.view !== 'kanban' || !S.rm) return;
  const { rm, L } = S, board = $('board');
  $('boardHint').textContent = L.kanbanHint;
  const cols = Object.fromEntries(STATUSES.map(s => [s, []]));
  rm.nodes.forEach(n => { if (!dimmed(n)) cols[nodeStatus(n)].push(n); });
  board.innerHTML = STATUSES.map((s, i) => {
    const cards = cols[s].map(n => {
      const ph = rm.phaseById[n.phase], tot = n.tasks.length, fin = finishedTasks(n), miss = skipInfo(n), open = !!miss && S.warnOpen.has(n.id);
      return `<div class="kcard${S.selected === n.id ? ' selected' : ''}" data-drag data-node="${esc(n.id)}" tabindex="0" style="--flag:${ph.color}">` +
        `<span class="grip">${ICON.grip}</span>` +
        `<div class="kc-top">${rm.hasPhases && ph.title ? `<span class="kc-phase">${esc(ph.title)}</span>` : ''}${n.optional ? `<span class="kc-opt">${esc(L.optionalTag)}</span>` : ''}${n.parent && !n.optional ? `<span class="kc-sub">↳ ${esc(n.parent.title)}</span>` : ''}${miss ? `<button type="button" class="kc-warn${open ? ' on' : ''}" data-warn aria-expanded="${open}" aria-label="${esc(L.skipWarnLabel)}" title="${esc(L.skipWarnLabel)}">${ICON.warn}</button>` : ''}</div>` +
        `<div class="kc-title">${esc(n.title)}</div>` + (open ? skipNote(miss) : '') +
        (n.time ? `<div class="kc-time">${esc(n.time)}</div>` : '') +
        (tot ? `<div class="kc-prog"><span class="kc-bar"><i style="width:${Math.round(fin / tot * 100)}%"></i></span><span>${fin}/${tot}</span></div>` : '') +
        moveButtons(i) + `</div>`;
    }).join('');
    return `<div class="kcol dropcol" data-col="${s}"><div class="kcol-h"><span class="kdot k-${s}"></span><span>${esc(L[STATUS_LABEL[s]])}</span><b>${cols[s].length}</b></div><div class="kcol-body">${cards || `<div class="kempty">${esc(L.kanbanEmpty)}</div>`}</div></div>`;
  }).join('');
}

function moveButtons(i) {
  const L = S.L;
  return `<div class="mv-row"><button type="button" class="mv" data-move="-1" aria-label="${esc(L.moveLeft)}" title="${esc(L.moveLeft)}"${i === 0 ? ' disabled' : ''}>${ICON.left}</button><button type="button" class="mv" data-move="1" aria-label="${esc(L.moveRight)}" title="${esc(L.moveRight)}"${i === STATUSES.length - 1 ? ' disabled' : ''}>${ICON.right}</button></div>`;
}

function setView(v, persist = true) {
  S.view = v === 'kanban' ? 'kanban' : 'map';
  document.body.classList.toggle('view-kanban', S.view === 'kanban');
  document.querySelectorAll('#viewSeg [data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === S.view)));
  if (persist && S.rm && !S.preview) store.set(KEY.view(S.rm.id), S.view);
  if (S.view === 'kanban') renderBoard();
  else if (S.svg) layout();
}

/* ---------- details panel, with the per-card task kanban ---------- */
function renderDetail() {
  if (!S.rm) return;
  const { rm, L } = S, box = $('detailContent'), n = rm.byId[S.selected];
  if (!n) {
    box.className = 'detail-placeholder';
    box.innerHTML = `${rm.meta.icon ? `<span class="big">${esc(rm.meta.icon)}</span>` : ''}<strong>${esc(L.placeholderTitle)}</strong><br>${esc(L.placeholderText)}`;
    return;
  }
  const ph = rm.phaseById[n.phase], st = nodeStatus(n), done = st === 'finished', miss = skipInfo(n);
  const trail = []; for (let p = n.parent; p; p = p.parent) trail.unshift(p.title);
  const kicker = n.optional ? L.optionalKicker : n.parent ? trail.join(' › ') : [n.time, ph.title].filter(Boolean).join(' | ');
  const subs = n.children.length
    ? `<h3>${esc(L.subtopics)} <span class="h3-count">${requiredKids(n).filter(c => nodeStatus(c) === 'finished').length}/${requiredKids(n).length}</span></h3><div class="sublist">${n.children.map(c => `<button type="button" class="subitem s-${nodeStatus(c)}" data-goto="${esc(c.id)}"><span class="kdot k-${nodeStatus(c)}"></span><span>${esc(c.title)}</span>${c.optional ? `<em>${esc(L.optionalTag)}</em>` : ''}</button>`).join('')}</div>`
    : '';
  const tasks = n.tasks.length
    ? `<h3>${esc(L.tasks)} <span class="h3-count">${finishedTasks(n)}/${n.tasks.length}</span></h3><div class="mini" data-dnd-root data-node="${esc(n.id)}">` +
      STATUSES.map((s, i) => {
        const items = n.tasks.filter(t => taskStatus(n, t) === s);
        return `<div class="lane dropcol" data-col="${s}"><div class="lane-h"><span class="kdot k-${s}"></span><span>${esc(L[STATUS_LABEL[s]])}</span><b>${items.length}</b></div><div class="lane-body">` +
          (items.map(t => `<div class="tcard" data-drag data-task="${esc(t.id)}" tabindex="0"><span class="grip">${ICON.grip}</span><div class="tc-body"><div class="tc-title">${esc(t.title)}</div>${t.note ? `<div class="tc-note">${esc(t.note)}</div>` : ''}</div>${moveButtons(i)}</div>`).join('') || `<div class="kempty">${esc(L.kanbanEmpty)}</div>`) +
          `</div></div>`;
      }).join('') + `</div>`
    : '';
  box.className = '';
  box.innerHTML =
    `<div class="panel-kicker">${esc(kicker)}</div><h2>${esc(n.title)}</h2>` +
    `<div class="statusbar" role="group" aria-label="${esc(L.status)}">${STATUSES.map(s => `<button type="button" data-status="${s}" class="s-${s}${s === st ? ' on' : ''}" aria-pressed="${s === st}">${esc(L[STATUS_LABEL[s]])}</button>`).join('')}</div>` +
    (miss ? skipNote(miss) : '') +
    (n.summary ? `<p>${esc(n.summary)}</p>` : '') +
    subs +
    (n.topics.length ? `<h3>${esc(L.topics)}</h3><div>${n.topics.map(t => `<span class="topic">${esc(t)}</span>`).join('')}</div>` : '') +
    (n.challenge ? `<h3>${esc(L.challenge)}</h3><div class="mission">${esc(n.challenge)}</div>` : '') +
    tasks +
    (n.success ? `<h3>${esc(L.success)}</h3><p>${esc(n.success)}</p>` : '') +
    (n.links.length ? `<h3>${esc(L.resources)}</h3>${n.links.map(l => `<a class="resource" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(l.url))}">${esc(l.title)}</a>`).join('')}` : '') +
    `<button class="complete-action ${done ? 'done' : ''}" id="completeAction">${esc(done ? L.markUndone : L.markDone)}</button><p class="small-note">${esc(L.doneHint)}</p>`;
}

/* ---------- interactions ---------- */
function setDrawer(open) {
  $('detail').classList.toggle('open', open);
  $('scrim').classList.toggle('open', open);
  $('detailGrip').classList.toggle('open', open);
}

/* Drag the left edge of the details panel to resize it; the width is remembered. */
function wireDetailResize() {
  const grip = $('detailGrip'), root = document.documentElement;
  const MIN = 280, MAX_FRAC = 0.6;
  const clampW = w => Math.round(Math.min(Math.max(w, MIN), Math.max(MIN, innerWidth * MAX_FRAC)));
  const current = () => $('detail').getBoundingClientRect().width;
  const apply = w => root.style.setProperty('--detail-w', w + 'px');
  const saved = parseInt(store.get(DETAIL_KEY), 10);
  if (saved) apply(clampW(saved));
  let start = null;
  const done = () => { if (S.rm && S.svg && S.view === 'map') layout(); };
  grip.addEventListener('pointerdown', e => {
    start = { x: e.clientX, w: current() };
    grip.setPointerCapture(e.pointerId);
    grip.classList.add('drag'); document.body.classList.add('resizing');
  });
  grip.addEventListener('pointermove', e => { if (start) apply(clampW(start.w + start.x - e.clientX)); });
  const stop = () => {
    if (!start) return;
    start = null; grip.classList.remove('drag'); document.body.classList.remove('resizing');
    store.set(DETAIL_KEY, String(Math.round(current())));
    done();
  };
  grip.addEventListener('pointerup', stop);
  grip.addEventListener('pointercancel', stop);
  grip.addEventListener('dblclick', () => { root.style.removeProperty('--detail-w'); store.set(DETAIL_KEY, ''); done(); });
  grip.addEventListener('keydown', e => {
    const d = { ArrowLeft: 24, ArrowRight: -24 }[e.key];
    if (!d) return;
    e.preventDefault();
    apply(clampW(current() + d)); store.set(DETAIL_KEY, String(Math.round(current()))); done();
  });
}

function select(id, scroll = false, { drawer = true } = {}) {
  S.selected = id;
  refresh(); renderDetail();
  document.querySelectorAll('.kcard').forEach(c => c.classList.toggle('selected', c.dataset.node === id));
  if (scroll && S.view === 'map') {
    const n = S.rm.byId[id], s = S.geo.scale;
    window.scrollTo({ top: Math.max(0, $('mapFrame').getBoundingClientRect().top + window.scrollY + n.y * s - (window.innerWidth < 800 ? 100 : toolbarHeight() + 90)), behavior: 'smooth' });
    const view = $('mapViewport');
    view.scrollTo({ left: Math.max(0, n.x * s - (view.clientWidth - n.el.offsetWidth * s) / 2), behavior: 'smooth' });
  }
  if (drawer) setDrawer(true);
  if (S.editing) focusEditorRow(id);
}

function setPhase(key) {
  S.phase = key;
  document.querySelectorAll('[data-phase]').forEach(b => b.classList.toggle('active', b.dataset.phase === key));
  applyFilters();
  if (S.view !== 'map') return;
  const ph = key === 'all' ? null : S.rm.phaseById[key], first = ph?.nodes[0];
  const target = first ? (ph.flagEl ? parseFloat(ph.flagEl.style.top) : first.y) * S.geo.scale : 0;
  const top = $('mapFrame').getBoundingClientRect().top + window.scrollY + (first ? target - (window.innerWidth < 800 ? 12 : toolbarHeight() + 20) : 0);
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

function next() {
  if (!S.rm) return;
  const n = S.rm.core.find(x => !isDone(x)) || S.rm.core.at(-1);
  select(n.id, true);
}

/* A card (node or task) that was dropped on, or moved to, another column. */
function moveCard(el, col) {
  if (!STATUSES.includes(col)) return;
  if (el.dataset.task) {
    const n = S.rm.byId[el.closest('.mini').dataset.node], t = n?.tasks.find(x => x.id === el.dataset.task);
    if (t) setTaskStatus(n, t, col);
  } else {
    const n = S.rm.byId[el.dataset.node];
    if (n) setNodeStatus(n, col);
  }
}

function moveBy(el, dir) {
  const i = STATUSES.indexOf(el.closest('.dropcol').dataset.col) + dir;
  if (i >= 0 && i < STATUSES.length) moveCard(el, STATUSES[i]);
}

/* ---------- drag and drop (pointer events: mouse, pen and touch via the grip) ---------- */
const dnd = { st: null, suppress: false };
const DRAG_START = 6, EDGE = 80;

/* On narrow screens the board scrolls sideways, so a dock with the four columns is shown while dragging. */
function showDock(show) {
  const dock = $('dock');
  if (show) dock.innerHTML = STATUSES.map(s => `<div class="dock-slot" data-col="${s}"><span class="kdot k-${s}"></span>${esc(S.L[STATUS_LABEL[s]])}</div>`).join('');
  dock.hidden = !show;
}

function dndTarget(st) {
  const el = document.elementFromPoint(st.lx, st.ly);
  const slot = st.dock ? el?.closest('.dock-slot') : null;
  if (slot) return slot;
  const col = el?.closest('.dropcol');
  return col && col.closest('[data-dnd-root]') === st.root ? col : null;
}

function dndHover(st) {
  const col = dndTarget(st);
  if (col === st.col) return;
  st.col?.classList.remove('drop-over');
  col?.classList.add('drop-over');
  st.col = col;
}

function dndTick() {
  const st = dnd.st;
  if (!st?.started) return;
  if (st.vy) { if (st.vscroll === window) window.scrollBy(0, st.vy); else st.vscroll.scrollTop += st.vy; }
  if (st.vx) st.root.scrollLeft += st.vx;
  if (st.vx || st.vy) dndHover(st);
  st.raf = requestAnimationFrame(dndTick);
}

function dndEnd(drop) {
  const st = dnd.st;
  dnd.st = null;
  if (!st) return;
  cancelAnimationFrame(st.raf);
  st.ghost?.remove();
  st.el.classList.remove('is-dragging');
  document.body.classList.remove('dnd-active');
  document.querySelectorAll('.drop-over').forEach(c => c.classList.remove('drop-over'));
  if (st.dock) showDock(false);
  if (!st.started) return;
  dnd.suppress = true;
  setTimeout(() => { dnd.suppress = false; }, 60);
  if (drop && st.col && st.col.dataset.col !== st.from) moveCard(st.el, st.col.dataset.col);
}

function wireDnd() {
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-drag]');
    if (!el || (e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('button')) return;
    if (e.pointerType === 'touch' && !e.target.closest('.grip')) return;   // touch scrolls; the grip drags
    const root = el.closest('[data-dnd-root]');
    dnd.st = { el, root, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, started: false, from: el.closest('.dropcol')?.dataset.col, col: null, ghost: null, ox: 0, oy: 0, vx: 0, vy: 0, dock: false, vscroll: root.id === 'board' ? window : $('detail') };
  });
  document.addEventListener('pointermove', e => {
    const st = dnd.st;
    if (!st) return;
    if (!st.started) {
      if (Math.hypot(e.clientX - st.x, e.clientY - st.y) < DRAG_START) return;
      const r = st.el.getBoundingClientRect();
      st.started = true; st.ox = st.x - r.left; st.oy = st.y - r.top;
      st.ghost = st.el.cloneNode(true);
      st.ghost.classList.add('ghost');
      st.ghost.style.width = r.width + 'px';
      document.body.append(st.ghost);
      st.el.classList.add('is-dragging');
      document.body.classList.add('dnd-active');
      st.dock = st.root.id === 'board' && st.root.scrollWidth > st.root.clientWidth + 4;
      if (st.dock) showDock(true);
      st.raf = requestAnimationFrame(dndTick);
    }
    e.preventDefault();
    st.lx = e.clientX; st.ly = e.clientY;
    st.ghost.style.left = (e.clientX - st.ox) + 'px';
    st.ghost.style.top = (e.clientY - st.oy) + 'px';
    dndHover(st);
    const speed = d => Math.round(5 + (1 - Math.min(Math.max(d, 0), EDGE) / EDGE) * 20);
    const vr = st.vscroll === window ? { top: 0, bottom: innerHeight } : st.vscroll.getBoundingClientRect();
    st.vy = e.clientY < vr.top + EDGE ? -speed(e.clientY - vr.top) : (!st.dock && e.clientY > vr.bottom - EDGE ? speed(vr.bottom - e.clientY) : 0);
    st.vx = 0;
    if (st.root.id === 'board') {
      const r = st.root.getBoundingClientRect();
      if (e.clientX < r.left + EDGE) st.vx = -speed(e.clientX - r.left); else if (e.clientX > r.right - EDGE) st.vx = speed(r.right - e.clientX);
    }
  }, { passive: false });
  document.addEventListener('pointerup', () => dndEnd(true));
  document.addEventListener('pointercancel', () => dndEnd(false));
  addEventListener('keydown', e => { if (e.key === 'Escape') dndEnd(false); });
  document.addEventListener('click', e => { if (dnd.suppress) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('dragstart', e => { if (e.target.closest?.('[data-drag]')) e.preventDefault(); });

  // move buttons for both kinds of cards, warning toggles and card activation
  const onClick = e => {
    const mv = e.target.closest('[data-move]');
    if (mv) { e.stopPropagation(); moveBy(mv.closest('[data-drag]'), Number(mv.dataset.move)); }
  };
  $('board').addEventListener('click', e => {
    const wb = e.target.closest('[data-warn]');
    if (wb) {
      const id = wb.closest('.kcard').dataset.node;
      if (!S.warnOpen.delete(id)) S.warnOpen.add(id);
      renderBoard();
      return;
    }
    onClick(e);
    if (e.defaultPrevented || e.target.closest('[data-move]')) return;
    const card = e.target.closest('.kcard');
    if (card) select(card.dataset.node);
  });
  $('board').addEventListener('keydown', e => {
    const card = e.target.closest('.kcard');
    if (card && e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(card.dataset.node); }
  });
  $('detailContent').addEventListener('click', e => {
    onClick(e);
    const go = e.target.closest('[data-goto]');
    if (go) { select(go.dataset.goto, true); return; }
    const sb = e.target.closest('[data-status]');
    if (sb) { setNodeStatus(S.rm.byId[S.selected], sb.dataset.status); return; }
    if (e.target.closest('#completeAction')) toggleDone(S.rm.byId[S.selected]);
  });
}

/* ---------- roadmap loading ---------- */
function showMessage(title, html) {
  S.svg = null;
  document.body.classList.remove('view-kanban');
  $('map').replaceChildren();
  $('map').style.cssText = 'width:100%;height:420px';
  $('mapFrame').style.cssText = '';
  const d = document.createElement('div');
  d.className = 'empty';
  d.innerHTML = `<h2>${esc(title)}</h2><p>${html}</p>`;
  $('map').append(d);
}

/* keep: rebuild in place (language change, live preview) without resetting selection, view or scroll.
   preview: a draft from the editor, never saved or synced. */
async function setRoadmap(rm, { local = false, keep = false, preview = false } = {}) {
  S.L = { ...S.defaults, ...await loadLabels(uiLang(rm)), ...rm.labels };
  S.rm = rm;
  S.isLocal = local;
  S.preview = preview;
  if (local) S.localRm = rm;
  if (!(keep && preview)) loadState(rm);
  clearTimeout(sync.timer); sync.timer = 0;
  setSyncStatus('local');
  if (keep) {
    if (!rm.byId[S.selected]) S.selected = rm.core[0].id;
    if (S.phase !== 'all' && !rm.phaseById[S.phase]) S.phase = 'all';
  } else {
    S.warnOpen = new Set();
    S.selected = rm.core[0].id; S.phase = 'all'; S.search = '';
    $('search').value = '';
  }
  applyChrome(); buildSwitch(); buildMap(); renderDetail();
  const saved = store.get(KEY.view(rm.id));
  setView(keep ? S.view : (saved === 'kanban' || saved === 'map' ? saved : rm.defaultView), false);
  refresh();
  if (!keep) {
    setDrawer(false);
    $('mapViewport').scrollLeft = 0;
    window.scrollTo({ top: 0 });
  }
  const relayout = () => { if (S.rm === rm && S.svg && S.view === 'map') layout(); };
  requestAnimationFrame(relayout);
  document.fonts?.ready.then(relayout);
  if (!preview) pull();
}

/* Builds a roadmap from its JSON text, keeping the text and file name for export. */
function parseRoadmap(text, fileName) {
  const rm = normalize(JSON.parse(text), fileName.replace(/\.json$/i, ''));
  rm.sourceText = text; rm.fileName = fileName;
  return rm;
}

async function openEntry(entry) {
  try {
    const rm = parseRoadmap(await getText(entry.file), entry.file.split('/').pop());
    await setRoadmap(rm);
    store.set(KEY.last, rm.id);
    history.replaceState(null, '', `?r=${encodeURIComponent(entry.id)}`);
  } catch (err) {
    console.error(err);
    showMessage(S.L.loadFail || 'Could not load the roadmap', `<code>${esc(entry.file)}</code><br>${esc(err.message)}`);
  }
}

async function openRoadmapText(text, fileName) {
  await setRoadmap(parseRoadmap(text, fileName), { local: true });
}

async function openLocalFile(file) {
  try {
    await openRoadmapText(await file.text(), file.name);
  } catch (err) {
    alert(`${S.L.loadFail}: ${err.message}`);
  }
}

/* ---------- zip: a small writer (stored, no compression) and a reader that also inflates ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = u8 => { let c = ~0; for (const b of u8) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8); return ~c >>> 0; };
const ZIP_MAX = 8 * 1024 * 1024;

function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = [], d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);   // 0x0800: UTF-8 names
    lh.setUint16(10, time, true); lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true);
    parts.push(lh.buffer, name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(ch.buffer, name);
    offset += 30 + name.length + size;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, central.reduce((n, x) => n + x.byteLength, 0), true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

async function readZip(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
  let e = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 65535); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('not a zip file');
  const out = []; let p = v.getUint32(e + 16, true), total = 0;
  for (let i = 0, n = v.getUint16(e + 10, true); i < n; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('corrupt zip');
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), usize = v.getUint32(p + 24, true);
    const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    if (name.endsWith('/') || name.startsWith('__MACOSX/')) continue;
    if (usize > ZIP_MAX || (total += usize) > ZIP_MAX) throw new Error('zip too large');
    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), raw = u8.subarray(start, start + csize);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else throw new Error('unsupported zip compression');
    if (data.length > ZIP_MAX) throw new Error('zip too large');
    out.push({ name, data });
  }
  return out;
}

/* ---------- export / import: a zip with the roadmap and its progress ---------- */
const progressDoc = rm => ({ roadmap: rm.id, title: rm.meta.title, version: 2, exportedAt: new Date().toISOString(), nodes: S.state.nodes, tasks: S.state.tasks });

function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 300);
}

function exportBundle() {
  const { rm } = S, enc = new TextEncoder(), dir = `${rm.id}/`;
  const source = rm.sourceText;
  download(makeZip([
    { name: dir + (rm.fileName || `${rm.id}.json`), data: enc.encode(source) },
    { name: dir + 'progress.json', data: enc.encode(JSON.stringify(progressDoc(rm), null, 2) + '\n') },
  ]), `${rm.id}.zip`);
}

/* Progress file -> state for this roadmap. Version 2 is { nodes, tasks }; version 1 was { id: true }. */
function progressToState(rm, obj) {
  if (obj.version === 2) return cleanState(rm, obj);
  const st = emptyState(), p = obj.progress || obj;
  for (const id of Object.keys(rm.byId)) if (p[id] === true) st.nodes[id] = 'finished';
  return st;
}

const looksLikeRoadmap = o => o && typeof o === 'object' && Array.isArray(o.nodes) && o.meta && typeof o.meta === 'object';

async function importZip(buf) {
  const dec = new TextDecoder(), files = await readZip(buf);
  const progFile = files.find(f => /(^|\/)progress\.json$/i.test(f.name));
  const rmFile = files.find(f => f !== progFile && /\.json$/i.test(f.name) && !/(^|\/)_section\.json$/i.test(f.name));
  if (!rmFile && !progFile) throw new Error('no roadmap or progress inside the zip');
  let local = false;
  if (rmFile) {
    const text = dec.decode(rmFile.data), raw = JSON.parse(text);
    if (!looksLikeRoadmap(raw)) throw new Error(`${rmFile.name} is not a roadmap`);
    const entry = S.manifest.roadmaps.find(r => r.id === raw.id);
    if (entry) await openEntry(entry);              // already on this server: keep its roadmap, bring the progress
    else { await openRoadmapText(text, rmFile.name.split('/').pop()); local = true; }
  }
  if (progFile) {
    const obj = JSON.parse(dec.decode(progFile.data));
    if (!obj || typeof obj !== 'object') throw new Error('invalid progress file');
    S.state = progressToState(S.rm, obj);
    changed();
  }
  alert(local ? S.L.importOkLocal : S.L.importOk);
}

async function importJson(text) {
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== 'object') throw new Error('invalid format');
  if (looksLikeRoadmap(obj)) {                      // a bare roadmap file: open it like "Open JSON file"
    await openRoadmapText(text, 'roadmap.json');
    return;
  }
  const target = typeof obj.roadmap === 'string' && obj.roadmap !== S.rm.id && S.manifest.roadmaps.find(r => r.id === obj.roadmap);
  if (target) await openEntry(target);              // the progress belongs to another roadmap on this server
  S.state = progressToState(S.rm, obj);
  changed();
  alert(S.L.importOk);
}

async function importBundle(file) {
  try {
    const buf = await file.arrayBuffer(), head = new Uint8Array(buf, 0, 2);
    if (head[0] === 0x50 && head[1] === 0x4B) await importZip(buf);   // "PK"
    else await importJson(new TextDecoder().decode(buf));
  } catch (err) { alert(S.L.importFail + err.message); }
}

/* ---------- boot ---------- */
function wire() {
  $('nextBtn').addEventListener('click', next);
  $('startBtn').addEventListener('click', next);
  $('detailClose').addEventListener('click', () => setDrawer(false));
  $('scrim').addEventListener('click', () => setDrawer(false));
  addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });
  $('search').addEventListener('input', e => { S.search = e.target.value.toLocaleLowerCase().trim(); applyFilters(); });
  $('viewSeg').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
  document.addEventListener('click', e => {
    const act = e.target.closest('[data-act]');
    if (act) {
      ({ export: exportBundle, import: () => $('importFile').click(), open: () => $('openFile').click(), reset: resetProgress, new: () => openEditor(), manage: openManage })[act.dataset.act]?.();
      setSettingsOpen(false);
    } else if (!$('settings').hidden && !e.target.closest('#settings, #settingsBtn')) setSettingsOpen(false);
  });
  $('settingsBtn').addEventListener('click', () => setSettingsOpen($('settings').hidden));
  addEventListener('keydown', e => { if (e.key === 'Escape') setSettingsOpen(false); });
  $('themeSeg').addEventListener('click', e => { const b = e.target.closest('[data-theme-mode]'); if (b) { store.set(THEME_KEY, b.dataset.themeMode); applyTheme(); } });
  $('fontSeg').addEventListener('click', e => { const b = e.target.closest('[data-fs]'); if (b) { store.set(FS_KEY, b.dataset.fs); applyFont(); metricsChanged(); } });
  $('langSel').addEventListener('change', async e => {
    store.set(LANG_KEY, e.target.value);
    if (S.rm) await setRoadmap(S.rm, { local: S.isLocal, keep: true, preview: S.preview });
    else { S.L = { ...S.defaults, ...await loadLabels(uiLang(null)) }; applyI18n(); }
    buildLangSel(); renderManage();
    if (!$('rmPop').hidden) renderPicker();
    if (S.editing) { buildCategorySelect(); $('editTitle').textContent = ed.id ? S.L.edTitleEdit : S.L.edTitleNew; if (ed.mode === 'form') renderForm(); if (!S.rm) await showPreviewHint(); }
  });
  $('skipSel').addEventListener('change', e => { store.set(SKIP_KEY, e.target.value); applyFilters(); renderDetail(); });
  new ResizeObserver(syncToolbarHeight).observe($('toolbar'));
  $('importFile').addEventListener('change', async e => { const f = e.target.files?.[0]; if (f) await importBundle(f); e.target.value = ''; });
  darkQuery.addEventListener('change', applyTheme);
  let frame = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { if (S.rm && S.svg && S.view === 'map') layout(); });
  });
  $('openFile').addEventListener('change', async e => { const f = e.target.files?.[0]; if (f) await openLocalFile(f); e.target.value = ''; });
  $('rmBtn').addEventListener('click', () => setPicker($('rmPop').hidden));
  $('rmPop').addEventListener('click', e => { const it = e.target.closest('[data-open]'); if (it) openById(it.dataset.open); });
  document.addEventListener('click', e => { if (!$('rmPop').hidden && !e.target.closest('#rmPop, #rmBtn')) setPicker(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('rmPop').hidden) { setPicker(false); $('rmBtn').focus(); } });
  addEventListener('resize', () => setPicker(false));
  const manage = $('manageDlg');
  manage.addEventListener('click', e => {
    if (e.target === manage || e.target.closest('[data-close]')) return manage.close();
    const b = e.target.closest('[data-rm]');
    if (b) manageAction(b.dataset.rm, b.dataset.id);
  });
  wireEditor();
  addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
  addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
  addEventListener('drop', e => {
    e.preventDefault(); document.body.classList.remove('dragging');
    const f = [...(e.dataTransfer?.files || [])].find(x => /\.json$/i.test(x.name));
    if (f && !S.editing) openLocalFile(f);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (sync.timer) { clearTimeout(sync.timer); sync.timer = 0; push(true); } }
    else pull();
  });
  addEventListener('online', () => { if (sync.status === 'offline') pull(); });
  wireDnd();
  wireDetailResize();
}

async function init() {
  wire();
  applyTheme();
  applyFont();
  $('skipSel').value = skipSetting();
  try {
    [S.manifest, S.defaults] = await Promise.all([getJson('manifest.json'), getJson('src/labels/pt-BR.json')]);
  } catch (err) {
    console.error(err);
    showMessage('Servidor não encontrado', 'Abra pelo servidor local: <code>python3 tools/roadkit.py serve</code> e acesse <code>http://localhost:8765</code>.<br>(Abrir o <code>index.html</code> direto do disco não funciona: o navegador bloqueia a leitura dos JSONs.)');
    return;
  }
  S.L = langSetting() === 'auto' ? S.defaults : { ...S.defaults, ...await loadLabels(langSetting()) };
  applyI18n();
  buildSwitch();
  const asked = new URLSearchParams(location.search).get('r'), last = store.get(KEY.last), visible = visibleRoadmaps();
  const entry = entryById(asked) || visible.find(r => r.id === last) || visible[0];
  loadRemoteStates().then(updatePickerBtn);
  if (!entry) {
    showMessage(S.L.rmNone, `<button type="button" class="primary" data-act="new">${esc(S.L.newRoadmap)}</button>`);
    return;
  }
  await openEntry(entry);
}

init();
})();
