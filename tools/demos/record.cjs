#!/usr/bin/env node
/*
  Regenerates the GIFs and screenshots in docs/media/ by driving the real app in a browser.

    npm i playwright            # anywhere; only this script needs it (and ffmpeg on the PATH)
    ROADKIT_DATA=$(mktemp -d) python3 tools/roadkit.py serve --port 8791 &
    node tools/demos/record.cjs http://127.0.0.1:8791 [hero|criar|ia|fotos]

  It writes to a throwaway data folder, so run the server like above and not on your real instance.
*/
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BASE = process.argv[2] || 'http://127.0.0.1:8791';
const ONLY = process.argv[3];
const OUT = path.resolve(__dirname, '../../docs/media');
const ANSWER = fs.readFileSync(path.join(__dirname, 'rust-ia.json'), 'utf8');
const VIEW = { width: 1600, height: 900 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* A fake cursor, since the video has none: follows the mouse and pulses on click. */
const CURSOR = `(() => {
  const add = () => {
    if (document.getElementById('__cur')) return;
    const c = document.createElement('div'); c.id = '__cur';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 3l14 8-6.5 1.8L9.5 19z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg><i></i>';
    c.style.cssText = 'position:fixed;left:-40px;top:-40px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))';
    const st = document.createElement('style');
    st.textContent = '#__cur i{position:absolute;left:-9px;top:-9px;width:22px;height:22px;border-radius:50%;border:3px solid #4875e4;opacity:0;transform:scale(.4)}#__cur.down i{opacity:.9;transform:scale(1);transition:transform .25s,opacity .25s}#__cur.up i{opacity:0;transform:scale(1.6);transition:transform .3s,opacity .3s}';
    document.documentElement.append(st, c);
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => { c.className = 'down'; }, true);
    addEventListener('mouseup', () => { c.className = 'up'; }, true);
  };
  addEventListener('DOMContentLoaded', add); if (document.readyState !== 'loading') add();
})();`;

/* Every recording starts from the same place: no saved progress and none of the roadmaps the demos create. */
async function reset() {
  const call = (method, p, body) => fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }).catch(() => {});
  await call('PUT', '/api/state/argocd-gitops', { updatedAt: Date.now(), state: { nodes: {}, tasks: {} } });
  for (const id of ['aprender-rust', 'rust-do-zero']) await call('DELETE', '/api/roadmaps/' + id + '?progress=1');
}

async function scene(browser, name, { prefs = {}, url, scheme = 'light' }, play, { fps = 10, width = 960, colors = 112 } = {}) {
  await reset();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rk-'));
  const ctx = await browser.newContext({ viewport: VIEW, colorScheme: scheme, recordVideo: { dir, size: VIEW }, permissions: ['clipboard-read', 'clipboard-write'] });
  const t0 = Date.now();
  await ctx.addInitScript(CURSOR);
  await ctx.addInitScript(p => { for (const [k, v] of Object.entries(p)) localStorage.setItem(k, v); }, { 'roadkit:v1:theme': scheme, 'roadkit:v1:lang': 'pt-BR', 'roadkit:v1:fs': 'normal', ...prefs });
  const page = await ctx.newPage();
  let x = 800, y = 450;
  const h = {
    page,
    async glide(tx, ty, steps = 16) {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        await page.mouse.move(x + (tx - x) * e, y + (ty - y) * e); await sleep(11);
      }
      x = tx; y = ty;
    },
    async center(sel, near = false) {
      const loc = page.locator(sel).first();
      if (!near) await loc.scrollIntoViewIfNeeded();   // a tall column is aimed at where it is, without scrolling
      let b = await loc.boundingBox();
      for (let i = 0; i < 12; i++) {   // the page scrolls smoothly: wait until the box stops moving
        await sleep(60);
        const n = await loc.boundingBox();
        if (Math.abs(n.y - b.y) < 0.5 && Math.abs(n.x - b.x) < 0.5) { b = n; break; }
        b = n;
      }
      return [b.x + b.width / 2, near ? Math.min(b.y + 150, b.y + b.height / 2) : b.y + b.height / 2];   // near: a tall column is hit near its top
    },
    async click(sel, offset = [0, 0]) {
      const [cx, cy] = await h.center(sel);
      await h.glide(cx + offset[0], cy + offset[1]); await sleep(140);
      await page.mouse.down(); await sleep(70); await page.mouse.up(); await sleep(260);
    },
    async type(sel, text, delay = 50) { await h.click(sel); await page.keyboard.type(text, { delay }); await sleep(250); },
    async drag(from, to, toOffset = [0, 0]) {
      const [fx, fy] = await h.center(from), [tx, ty] = await h.center(to, true);
      await h.glide(fx, fy); await sleep(120); await page.mouse.down(); await sleep(120);
      await h.glide(fx + 8, fy + 8, 4); await h.glide(tx + toOffset[0], ty + toOffset[1], 26); await sleep(160); await page.mouse.up(); await sleep(450);
    },
    sleep,
  };
  await page.goto(BASE + url); await page.waitForSelector('.road-node'); await sleep(700);
  const ready = (Date.now() - t0) / 1000;
  await play(h);
  await sleep(1200);
  const video = page.video();
  await ctx.close();
  const src = await video.path();
  fs.mkdirSync(OUT, { recursive: true });
  const gif = path.join(OUT, name + '.gif');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(Math.max(0, ready - 0.3)), '-i', src,
    '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`, '-loop', '0', gif]);
  if (process.env.KEEP_DIR) fs.copyFileSync(src, path.join(process.env.KEEP_DIR, name + '.webm'));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(name + '.gif', (fs.statSync(gif).size / 1024 / 1024).toFixed(2) + ' MB');
}

const scenes = {
  async hero(b) {
    await scene(b, 'visao-geral', { url: '/?r=argocd-gitops' }, async h => {
      await h.sleep(500);
      await h.click('.road-node[data-node="instalar"]');
      await h.sleep(600);
      await h.click('.statusbar [data-status="finished"]');
      await h.sleep(900);
      await h.click('#viewSeg [data-view="kanban"]');
      await h.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await h.sleep(700);
      await h.drag('.kcard[data-node="aplicacao"]', '.kcol[data-col="working"]');
      await h.sleep(500);
      await h.click('#viewSeg [data-view="map"]');
      await h.click('#settingsBtn');
      await h.click('#themeSeg [data-theme-mode="dark"]');
      await h.sleep(900);
    }, { fps: 8, width: 880, colors: 64 });
  },
  async criar(b) {
    await scene(b, 'criar-roadmap', { url: '/?r=argocd-gitops' }, async h => {
      await h.click('.tools [data-act="new"]');
      await h.sleep(600);
      await h.type('#editBody [data-f="title"]', 'Aprender Rust', 32);
      await h.click('[data-do="add-phase"]');
      await h.page.keyboard.type('A base', { delay: 32 });
      await h.type('[data-list="nodes"] .ed-card[data-i="0"] [data-f="title"]', 'Ambiente e cargo', 30);
      await h.sleep(300);
      await h.click('[data-do="add-node"]');
      await h.page.keyboard.type('Posse e empréstimos', { delay: 28 });
      await h.sleep(300);
      await h.click('[data-list="nodes"] .ed-card[data-i="1"] [data-do="add-sub"]');
      await h.page.keyboard.type('Moves e cópias', { delay: 28 });
      await h.sleep(250);
      await h.click('[data-list="nodes"] .ed-card[data-i="2"] [data-do="add-sub"]');
      await h.page.keyboard.type('Clone e Copy', { delay: 28 });
      await h.sleep(250);
      await h.click('[data-list="nodes"] .ed-card[data-i="1"] [data-do="add-sub"]');
      await h.page.keyboard.type('Referências', { delay: 28 });
      await h.sleep(400);
      await h.page.evaluate(() => { const i = document.querySelector('#editBody [data-f="accent"]'); i.value = '#c2410c'; i.dispatchEvent(new Event('input', { bubbles: true })); });
      await h.sleep(1000);
      await h.click('#editSave');
      await h.sleep(1200);
    }, { fps: 8, width: 900, colors: 64 });
  },
  async ia(b) {
    await scene(b, 'criar-com-ia', { url: '/?r=argocd-gitops' }, async h => {
      await h.click('.tools [data-act="new"]');
      await h.sleep(400);
      await h.click('#edAi');
      await h.sleep(400);
      await h.type('#aiGoal', 'Aprender Rust do zero em 6 semanas, umas 5 horas por semana.', 24);
      await h.sleep(800);
      await h.click('#aiCopy');
      await h.sleep(700);
      await h.click('#aiAnswer');
      await h.page.fill('#aiAnswer', ANSWER);
      await h.sleep(900);
      await h.click('#aiUse');
      await h.sleep(1500);
      await h.click('.road-node:has-text("Posse")');
      await h.sleep(1000);
    }, { fps: 8, width: 900, colors: 64 });
  },
  async fotos(b) {
    const ctx = await b.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
    for (const [theme, file, view] of [['light', 'mapa-claro', 'map'], ['dark', 'mapa-escuro', 'map'], ['light', 'kanban', 'kanban']]) {
      await ctx.addInitScript(p => { for (const [k, v] of Object.entries(p)) localStorage.setItem(k, v); }, { 'roadkit:v1:theme': theme, 'roadkit:v1:lang': 'pt-BR', [`roadkit:v1:view:argocd-gitops`]: view });
      const page = await ctx.newPage();
      await page.goto(BASE + '/?r=argocd-gitops'); await page.waitForSelector(view === 'kanban' ? '.kcard' : '.road-node'); await sleep(900);
      if (view === 'map') await page.click('.road-node[data-node="instalar"]');
      await sleep(500);
      await page.screenshot({ path: path.join(OUT, file + '.png') });
      await page.close();
    }
    await ctx.close();
  },
};

(async () => {
  const browser = await chromium.launch();
  for (const [name, fn] of Object.entries(scenes)) if (!ONLY || ONLY === name) await fn(browser);
  await browser.close();
})();
