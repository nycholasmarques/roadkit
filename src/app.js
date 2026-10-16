/* Roadkit: generic UI. Everything shown comes from a roadmap JSON (see docs/SCHEMA.md). */
(() => {
'use strict';

const PALETTE = ['#3a68d1', '#d8a436', '#8854ba', '#168450', '#ce6e4c', '#2a9aa8'];
const NS = 'http://www.w3.org/2000/svg';
const KEY = {
  state: id => `roadkit:v2:state:${id}`,
  progress: id => `roadkit:v1:progress:${id}`, // legacy, read once to migrate
  view: id => `roadkit:v1:view:${id}`,
  last: 'roadkit:v1:last',
};
const G = { spineX: 420, nodeW: 290, optX: 800, optW: 255, top: 110, gap: 56, msGap: 40, optGap: 14, mapW: 1135, msW: 210 };
const NARROW_BELOW = 860;   // map viewport width (px) under which the compact vertical layout is used
const MAX_SCALE = 1.4;      // the wide layout is scaled to fit the viewport, up to this factor
const STATUSES = ['todo', 'working', 'review', 'finished'];
const FONT_SCALE = { small: 0.95, normal: 1.1, large: 1.25, xlarge: 1.4 };
const FS_KEY = 'roadkit:v1:fs', SKIP_KEY = 'roadkit:v1:skip';
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
};
async function getJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

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
const THEME_KEY = 'roadkit:v1:theme';
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
      links: normLinks(r.links), optional: !!r.optional, anchor: str(r.anchor),
      tasks: normTasks(r.tasks),
    };
    n.status = STATUSES.includes(r.status) ? r.status : deriveStatus(n.tasks.map(t => t.status));
    n.hay = [n.title, n.summary, ...n.topics, ...n.tasks.map(t => t.title)].join(' ').toLocaleLowerCase();
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
    defaultView: meta.defaultView === 'kanban' ? 'kanban' : 'map',
    phases, hasPhases, nodes, core, byId, phaseById, warn,
  };
}

/* ---------- state: node and task statuses (only the user's changes are stored) ---------- */
const taskKey = (n, t) => `${n.id}/${t.id}`;
const nodeStatus = n => S.state.nodes[n.id] ?? n.status;
const taskStatus = (n, t) => S.state.tasks[taskKey(n, t)] ?? t.status;
const isDone = n => nodeStatus(n) === 'finished';
const finishedTasks = n => n.tasks.filter(t => taskStatus(n, t) === 'finished').length;
const phaseDone = ph => ph.nodes.length > 0 && ph.nodes.every(isDone);

function loadState(rm) {
  const st = { nodes: {}, tasks: {} };
  let saved = null;
  try { saved = JSON.parse(store.get(KEY.state(rm.id)) || 'null'); } catch { /* corrupt entry */ }
  if (saved && typeof saved === 'object') {
    for (const [id, v] of Object.entries(saved.nodes || {})) if (rm.byId[id] && STATUSES.includes(v)) st.nodes[id] = v;
    for (const n of rm.nodes) for (const t of n.tasks) { const v = saved.tasks?.[taskKey(n, t)]; if (STATUSES.includes(v)) st.tasks[taskKey(n, t)] = v; }
  } else {
    try {
      const old = JSON.parse(store.get(KEY.progress(rm.id)) || '{}') || {};
      for (const id of Object.keys(rm.byId)) if (old[id] === true) st.nodes[id] = 'finished';
    } catch { /* ignore */ }
  }
  S.state = st;
}

const saveState = () => store.set(KEY.state(S.rm.id), JSON.stringify(S.state));

const deriveNode = n => deriveStatus(n.tasks.map(t => taskStatus(n, t)));

function setTaskStatus(n, t, st) {
  if (taskStatus(n, t) === st) return;
  S.state.tasks[taskKey(n, t)] = st;
  S.state.nodes[n.id] = deriveNode(n);
  changed();
}

/* Moving a node to finished or todo applies to all its tasks; leaving finished reopens them too. */
function setNodeStatus(n, st) {
  const prev = nodeStatus(n);
  if (prev === st) return;
  S.state.nodes[n.id] = st;
  if (n.tasks.length && (st === 'finished' || st === 'todo' || prev === 'finished')) n.tasks.forEach(t => { S.state.tasks[taskKey(n, t)] = st; });
  changed();
}

const toggleDone = n => setNodeStatus(n, isDone(n) ? 'todo' : 'finished');

function changed() {
  saveState();
  refresh(); renderBoard(); renderDetail();
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
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = L[el.dataset.i18nTitle] ?? ''; });
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
function metaText(n) {
  return [n.time, n.optional ? S.L.optionalTag : '', n.tasks.length ? `${finishedTasks(n)}/${n.tasks.length}` : ''].filter(Boolean).join(' | ');
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
    el.className = 'road-node' + (n.optional ? ' optional-node' : '');
    el.dataset.node = n.id;
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    const num = n.optional ? '+' : String(n.num).padStart(2, '0');
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
  lg.innerHTML = `<div class="heading">${esc(L.legendTitle)}</div><div class="legend-item"><span class="swatch"></span> ${esc(L.legendMain)}</div><div class="legend-item"><span class="swatch green"></span> ${esc(L.legendDone)}</div>${rm.nodes.some(n => n.optional) ? `<div class="legend-item"><span class="swatch opt"></span> ${esc(L.legendOptional)}</div>` : ''}<div class="hint">${esc(L.legendHint)}</div>`;
  map.append(lg); S.legendEl = lg;
}

function geometry() {
  const vw = $('mapViewport').clientWidth || G.mapW;
  if (vw < NARROW_BELOW) return { narrow: true, mapW: Math.max(280, vw), scale: 1 };
  return { narrow: false, mapW: G.mapW, scale: Math.min(MAX_SCALE, vw / G.mapW) };
}

/* Wide: central spine with phase flags on the left and optional branches on the right,
   drawn in a fixed design space and scaled to fit. Narrow: one column timeline, with the
   line on the left, phase headers above their topics and optional topics nested below. */
function layout() {
  const { rm } = S, map = $('map'), svg = S.svg;
  if (!svg || S.view === 'kanban') return;
  const geo = S.geo = geometry(), nw = geo.narrow;
  const nodeX = nw ? 44 : G.spineX, nodeW = nw ? geo.mapW - nodeX - 16 : G.nodeW, optW = nw ? nodeW - 22 : G.optW;
  const gap = nw ? 30 : G.gap, msGap = nw ? 22 : G.msGap, lineX = nw ? 24 : nodeX + nodeW / 2;
  const shown = rm.phases.filter(p => p.nodes.length);
  svg.replaceChildren();
  S.links = [];

  // widths first, because card heights depend on them
  rm.nodes.forEach(n => { n.el.style.width = nw ? (n.optional ? optW : nodeW) + 'px' : ''; });
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
      const opts = rm.nodes.filter(o => o.optional && o.anchor === n.id);
      const hs = opts.map(o => o.el.offsetHeight);
      let slot = h;
      if (nw) {
        let oy = y + h + 10;
        opts.forEach((o, i) => {
          Object.assign(o, { x: nodeX + 22, y: oy, h: hs[i] });
          o.el.style.left = o.x + 'px'; o.el.style.top = oy + 'px';
          const px = nodeX + 10, ey = oy + hs[i] / 2;
          addLine(`M${px} ${y + h} L${px} ${ey} L${o.x} ${ey}`, true, n, o);
          oy += hs[i] + 10;
        });
        if (opts.length) slot = oy - 10 - y;
      } else {
        const total = hs.reduce((a, b) => a + b, 0) + G.optGap * Math.max(0, opts.length - 1);
        let oy = total <= h ? y + (h - total) / 2 : y;
        opts.forEach((o, i) => {
          Object.assign(o, { x: G.optX, y: oy, h: hs[i] });
          o.el.style.left = o.x + 'px'; o.el.style.top = oy + 'px';
          const sx = n.x + nodeW, sy = y + h / 2, ex = o.x, ey = oy + hs[i] / 2, mx = sx + (ex - sx) / 2;
          addLine(`M${sx} ${sy} L${mx} ${sy} L${mx} ${ey} L${ex} ${ey}`, true, n, o);
          oy += hs[i] + G.optGap;
        });
        slot = Math.max(h, total);
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
  const qty = rm.core.filter(isDone).length;
  $('progressText').textContent = `${qty} / ${rm.core.length}`;
  $('barFill').style.width = (qty / rm.core.length * 100) + '%';
}

function applyFilters() {
  refresh();
  renderBoard();
}

/* ---------- skipped-topic warning ---------- */
/* A topic that moved past "todo" while earlier main topics are not finished is a skipped topic. */
function pendingBefore(n) {
  if (n.optional || nodeStatus(n) === 'todo') return [];
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
        `<div class="kc-top">${rm.hasPhases && ph.title ? `<span class="kc-phase">${esc(ph.title)}</span>` : ''}${n.optional ? `<span class="kc-opt">${esc(L.optionalTag)}</span>` : ''}${miss ? `<button type="button" class="kc-warn${open ? ' on' : ''}" data-warn aria-expanded="${open}" aria-label="${esc(L.skipWarnLabel)}" title="${esc(L.skipWarnLabel)}">${ICON.warn}</button>` : ''}</div>` +
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
  if (persist && S.rm) store.set(KEY.view(S.rm.id), S.view);
  if (S.view === 'kanban') renderBoard();
  else if (S.svg) layout();
}

/* ---------- details panel, with the per-card task kanban ---------- */
function renderDetail() {
  const { rm, L } = S, box = $('detailContent'), n = rm.byId[S.selected];
  if (!n) {
    box.className = 'detail-placeholder';
    box.innerHTML = `${rm.meta.icon ? `<span class="big">${esc(rm.meta.icon)}</span>` : ''}<strong>${esc(L.placeholderTitle)}</strong><br>${esc(L.placeholderText)}`;
    return;
  }
  const ph = rm.phaseById[n.phase], st = nodeStatus(n), done = st === 'finished', miss = skipInfo(n);
  const kicker = n.optional ? L.optionalKicker : [n.time, ph.title].filter(Boolean).join(' | ');
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
}

function select(id, scroll = false) {
  S.selected = id;
  refresh(); renderDetail();
  document.querySelectorAll('.kcard').forEach(c => c.classList.toggle('selected', c.dataset.node === id));
  if (scroll && S.view === 'map') {
    const n = S.rm.byId[id], s = S.geo.scale;
    window.scrollTo({ top: Math.max(0, $('mapFrame').getBoundingClientRect().top + window.scrollY + n.y * s - (window.innerWidth < 800 ? 100 : toolbarHeight() + 90)), behavior: 'smooth' });
    const view = $('mapViewport');
    view.scrollTo({ left: Math.max(0, n.x * s - (view.clientWidth - n.el.offsetWidth * s) / 2), behavior: 'smooth' });
  }
  setDrawer(true);
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

async function setRoadmap(rm, { local = false } = {}) {
  S.L = { ...S.defaults, ...await loadLabels(rm.meta.language), ...rm.labels };
  S.rm = rm;
  if (local) S.localRm = rm;
  loadState(rm);
  S.warnOpen = new Set();
  S.selected = rm.core[0].id; S.phase = 'all'; S.search = '';
  $('search').value = '';
  applyChrome(); buildSwitch(); buildMap(); renderDetail();
  const saved = store.get(KEY.view(rm.id));
  setView(saved === 'kanban' || saved === 'map' ? saved : rm.defaultView, false);
  refresh();
  setDrawer(false);
  $('mapViewport').scrollLeft = 0;
  window.scrollTo({ top: 0 });
  const relayout = () => { if (S.rm === rm && S.svg && S.view === 'map') layout(); };
  requestAnimationFrame(relayout);
  document.fonts?.ready.then(relayout);
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
  const blob = new Blob([JSON.stringify({ roadmap: rm.id, title: rm.meta.title, version: 2, exportedAt: new Date().toISOString(), nodes: S.state.nodes, tasks: S.state.tasks }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `${rm.id}-progress.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 300);
}

async function importProgress(file) {
  try {
    const obj = JSON.parse(await file.text());
    if (!obj || typeof obj !== 'object') throw new Error('invalid format');
    const st = { nodes: {}, tasks: {} };
    if (obj.version === 2) {
      for (const [id, v] of Object.entries(obj.nodes || {})) if (S.rm.byId[id] && STATUSES.includes(v)) st.nodes[id] = v;
      for (const n of S.rm.nodes) for (const t of n.tasks) { const v = obj.tasks?.[taskKey(n, t)]; if (STATUSES.includes(v)) st.tasks[taskKey(n, t)] = v; }
    } else {
      const p = obj.progress || obj;   // version 1: { id: true }
      for (const id of Object.keys(S.rm.byId)) if (p[id] === true) st.nodes[id] = 'finished';
    }
    S.state = st;
    changed();
    alert(S.L.importOk);
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
      ({ export: exportProgress, import: () => $('importFile').click(), open: () => $('openFile').click(), reset: resetProgress })[act.dataset.act]?.();
      setSettingsOpen(false);
    } else if (!$('settings').hidden && !e.target.closest('#settings, #settingsBtn')) setSettingsOpen(false);
  });
  $('settingsBtn').addEventListener('click', () => setSettingsOpen($('settings').hidden));
  addEventListener('keydown', e => { if (e.key === 'Escape') setSettingsOpen(false); });
  $('themeSeg').addEventListener('click', e => { const b = e.target.closest('[data-theme-mode]'); if (b) { store.set(THEME_KEY, b.dataset.themeMode); applyTheme(); } });
  $('fontSeg').addEventListener('click', e => { const b = e.target.closest('[data-fs]'); if (b) { store.set(FS_KEY, b.dataset.fs); applyFont(); metricsChanged(); } });
  $('skipSel').addEventListener('change', e => { store.set(SKIP_KEY, e.target.value); applyFilters(); renderDetail(); });
  new ResizeObserver(syncToolbarHeight).observe($('toolbar'));
  $('importFile').addEventListener('change', async e => { const f = e.target.files?.[0]; if (f) await importProgress(f); e.target.value = ''; });
  darkQuery.addEventListener('change', applyTheme);
  let frame = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { if (S.rm && S.svg && S.view === 'map') layout(); });
  });
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
  wireDnd();
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
