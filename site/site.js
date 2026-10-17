/* Roadkit's landing page: language (the browser's, or the one you pick), light or dark, copy buttons and the
   example roadmaps from examples.json. No libraries, nothing sent anywhere. */
(() => {
  'use strict';
  const T = window.SITE_TEXT, $ = id => document.getElementById(id);
  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
  let lang = store.get('roadkit-site:lang') || ((navigator.language || '').toLowerCase().startsWith('pt') ? 'pt-BR' : 'en');
  if (!T[lang]) lang = 'en';
  let examples = [];

  function applyLang() {
    const L = T[lang];
    document.documentElement.lang = lang;
    document.title = L.title;
    document.querySelectorAll('[data-t]').forEach(el => { if (L[el.dataset.t]) el.textContent = L[el.dataset.t]; });
    document.querySelectorAll('[data-t-aria]').forEach(el => el.setAttribute('aria-label', L[el.dataset.tAria] || ''));
    document.querySelectorAll('[data-t-href]').forEach(el => { el.href = L[el.dataset.tHref]; });
    $('langBtn').textContent = L.langBtn;
    $('langBtn').setAttribute('aria-label', L.langName);
    $('heroImg').alt = L.heroAlt;
    renderExamples();
  }

  /* The examples in the page's language first; each opens in the demo (app/?r=<id>). */
  function renderExamples() {
    const L = T[lang], box = $('examples');
    if (!box) return;
    const mine = examples.filter(e => (e.language || 'pt-BR') === lang);
    box.innerHTML = (mine.length ? mine : examples).map(e => `<article class="card ex-card"><span class="ico" aria-hidden="true">${esc(e.icon || '▦')}</span>` +
      `<h3>${esc(e.title)}</h3><p>${esc(e.description)}</p>` +
      `<p class="ex-meta">${esc(fmt(L.exTopics, { n: e.topics }))}${e.projects ? ` · ${esc(fmt(L.exProjects, { n: e.projects }))}` : ''}</p>` +
      `<a class="btn small" href="app/?r=${encodeURIComponent(e.id)}">${esc(L.exOpen)} →</a></article>`).join('');
  }

  $('langBtn').addEventListener('click', () => { lang = lang === 'en' ? 'pt-BR' : 'en'; store.set('roadkit-site:lang', lang); applyLang(); });

  const dark = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const paintTheme = () => {
    // the hero screenshot follows the page, not only the system
    const src = dark() ? 'media/mapa-escuro.png' : 'media/mapa-claro.png';
    if (!$('heroImg').src.endsWith(src)) $('heroImg').src = src;
    document.querySelector('.hero-shot source')?.remove();
  };
  $('themeBtn').addEventListener('click', () => {
    const next = dark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('roadkit-site:theme', next);
    paintTheme();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintTheme);

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    try {
      await navigator.clipboard.writeText($(b.dataset.copy).textContent);
      b.textContent = T[lang].copied;
      setTimeout(() => { b.textContent = T[lang].copy; }, 1600);
    } catch { /* no clipboard: the text is right there to select */ }
  });

  fetch('examples.json').then(r => r.json()).then(list => { examples = Array.isArray(list) ? list : []; renderExamples(); }).catch(() => {});
  paintTheme();
  applyLang();
})();
