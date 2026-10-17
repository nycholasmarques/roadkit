#!/usr/bin/env node
/*
  Regenerates the GIFs and screenshots in docs/media/ by driving the real app in a browser.

    npm i playwright            # anywhere; only this script needs it (and ffmpeg on the PATH, which makes the GIFs)
    export ROADKIT_DATA=$(mktemp -d)
    python3 tools/roadkit.py serve --port 8791 &
    node tools/demos/record.cjs http://127.0.0.1:8791 [scene]       # CHROME=/path/to/chrome to use another browser

  Scenes: hero criar ia hoje projetos notas busca fotos stats foco temas celular (none given: all of them).
  Every scene starts from the same believable state: some progress in three example roadmaps, a project under way,
  notes, two reviews due and months of activity history. The history is written straight into ROADKIT_DATA (the
  server only derives it from changes), so run the server and this script with the same throwaway folder, never
  against your real instance.
*/
let pw;
try { pw = require('playwright'); } catch { pw = require('playwright-core'); }
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BASE = process.argv[2] || 'http://127.0.0.1:8791';
const ONLY = process.argv[3];
const DATA = process.env.ROADKIT_DATA;
const OUT = path.resolve(__dirname, '../../docs/media');
const ANSWER = fs.readFileSync(path.join(__dirname, 'rust-ia.json'), 'utf8');
const VIEW = { width: 1600, height: 900 };
const PHONE = { width: 390, height: 844 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DAY = 864e5;
const dayOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

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

const call = (method, p, body) => fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }).catch(() => {});

const NOTE_INSTALAR = `Instalei com os manifests oficiais, no namespace \`argocd\`.

\`\`\`
kubectl port-forward svc/argocd-server -n argocd 8080:443
\`\`\`

- [x] Trocar a senha inicial do admin
- [ ] Testar o login pelo \`argocd\` CLI
- [ ] Ler sobre o modo de alta disponibilidade

> A senha inicial fica no secret \`argocd-initial-admin-secret\`.`;

/* Months of activity, the same on every run: a pseudo-random but fixed walk, quieter on weekends. */
function history(span, chance, seed, finished) {
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const days = {}, now = Date.now();
  for (let i = span; i >= 1; i--) {
    const ms = now - i * DAY, weekend = [0, 6].includes(new Date(ms).getDay());
    if (rand() < chance * (weekend ? 0.55 : 1)) {
      const t = { moves: [1, 1, 2, 3, 4, 6][Math.floor(rand() * 6)] };
      if (rand() < 0.3) t.focus = [25, 25, 50][Math.floor(rand() * 3)];
      days[dayOf(ms)] = t;
    }
  }
  const topics = {};
  let end = now - 3 * DAY;
  for (const [id, took] of [...finished].reverse()) {
    const start = end - (took - 1) * DAY;
    topics[id] = { started: dayOf(start), finished: dayOf(end), touched: end };
    const d = days[dayOf(end)] ||= { moves: 0 };
    d.moves += 1; d.done = (d.done || 0) + 1;
    end = start - (4 + Math.floor(rand() * 10)) * DAY;
  }
  return { v: 1, days, months: {}, topics };
}

/* Every scene starts here: the progress, notes, reviews and history described at the top. */
async function seed() {
  for (const id of ['aprender-rust', 'rust-do-zero']) await call('DELETE', '/api/roadmaps/' + id + '?progress=1');
  const now = Date.now();
  const allTasks = (id, list, st = 'finished') => Object.fromEntries(list.map(t => [`${id}/${t}`, st]));
  await call('PUT', '/api/state/argocd-gitops', { updatedAt: now, state: {
    nodes: { gitops: 'finished', cluster: 'finished', instalar: 'working' },
    tasks: { ...allTasks('cluster', ['ferramentas', 'criar', 'nos', 'namespace']), ...allTasks('instalar', ['namespace', 'manifests', 'acesso']) },
    projects: { 'ola-gitops': { status: 'working', req: { manifestos: true } } }, dates: {} } });
  await call('PUT', '/api/state/estudar-sql', { updatedAt: now, state: {
    nodes: { ambiente: 'finished', select: 'finished', agregacao: 'working' }, tasks: {},
    projects: { 'consultas-biblioteca': { status: 'working', req: { carregar: true, perguntas: true } } }, dates: {} } });
  await call('PUT', '/api/state/projeto-paralelo', { updatedAt: now, state: { nodes: { entrevistas: 'finished', pagina: 'review' }, tasks: {}, projects: {}, dates: {} } });
  await call('PUT', '/api/notes/argocd-gitops', { updatedAt: now, notes: { 'node:instalar': NOTE_INSTALAR, roadmap: 'Cluster local com kind. Repositório de testes: `gitops-lab`.' } });
  await call('PUT', '/api/notes/estudar-sql', { updatedAt: now, notes: { 'node:select': '`ORDER BY` vem depois do `LIMIT` só na cabeça: na consulta, é antes.' } });
  await call('PUT', '/api/review', { updatedAt: now, on: true, skip: [], items: {
    'argocd-gitops:gitops': { due: dayOf(now - DAY), step: 1 }, 'estudar-sql:ambiente': { due: dayOf(now), step: 0 } } });
  if (!DATA) return;
  const dir = path.join(DATA, 'activity');
  fs.mkdirSync(dir, { recursive: true });
  const write = (id, act, touched) => {
    for (const [k, ago] of Object.entries(touched)) act.topics[k] = { ...(act.topics[k] || {}), touched: now - ago, started: act.topics[k]?.started || dayOf(now - ago) };
    fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(act, null, 2));
  };
  const argo = history(150, 0.4, 11, [['gitops', 2], ['cluster', 5]]);
  argo.topics.instalar = { focus: 125, sessions: 5 };
  write('argocd-gitops', argo, { instalar: 40 * 60e3, 'project:ola-gitops': 26 * 3600e3 });
  write('estudar-sql', history(240, 0.45, 7, [['ambiente', 3], ['select', 9]]), { agregacao: 3 * 3600e3, 'project:consultas-biblioteca': 5 * 3600e3 });
  write('projeto-paralelo', history(70, 0.5, 3, [['entrevistas', 6]]), { pagina: 2 * DAY });
}

async function context(browser, { scheme = 'light', prefs = {}, view = VIEW, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, colorScheme: scheme,
    locale: 'pt-BR', serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(p => { for (const [k, v] of Object.entries(p)) localStorage.setItem(k, v); },
    { 'roadkit:v1:theme': scheme, 'roadkit:v1:lang': 'pt-BR', 'roadkit:v1:fs': 'normal', 'roadkit:v1:focus': 'on', ...prefs });
  return ctx;
}

async function open(page, url, sel = '.road-node') { await page.goto(BASE + url); await page.waitForSelector(sel); await sleep(900); }

async function scene(browser, name, { prefs = {}, url, scheme = 'light' }, play, { fps = 8, width = 880, colors = 64 } = {}) {
  await seed();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rk-'));
  const ctx = await context(browser, { scheme, prefs });
  await ctx.addInitScript(CURSOR);
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
    async key(k, wait = 500) { await page.keyboard.press(k); await sleep(wait); },
    sleep,
  };
  await open(page, url);
  /* the frames come from Chromium's screencast (only when something changes), each with its time, and ffmpeg
     turns them into the GIF; no video encoder from the test runner is needed */
  const cdp = await ctx.newCDPSession(page), frames = [];
  cdp.on('Page.screencastFrame', f => {
    const file = path.join(dir, `${String(frames.length).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: VIEW.width, maxHeight: VIEW.height });
  await sleep(300);
  await play(h);
  await sleep(1200);
  await cdp.send('Page.stopScreencast');
  await ctx.close();
  const list = frames.map((fr, i) => `file '${fr.file}'\nduration ${((frames[i + 1]?.t ?? fr.t + 1.2) - fr.t).toFixed(3)}`).join('\n') + `\nfile '${frames.at(-1).file}'\n`;
  fs.writeFileSync(path.join(dir, 'frames.txt'), list);
  fs.mkdirSync(OUT, { recursive: true });
  const gif = path.join(OUT, name + '.gif');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'frames.txt'),
    '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`, '-loop', '0', gif]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(name + '.gif', (fs.statSync(gif).size / 1024 / 1024).toFixed(2) + ' MB');
}

/* A still: open a page with the seeded state, set it up, take the picture. */
async function still(browser, file, { url, scheme = 'light', prefs = {}, view = VIEW, mobile = false, sel = '.road-node' }, setup = async () => {}, shot = {}) {
  await seed();
  const ctx = await context(browser, { scheme, prefs, view, mobile });
  const page = await ctx.newPage();
  await open(page, url, sel);
  await setup(page);
  await sleep(500);
  const buf = await page.screenshot({ ...(file ? { path: path.join(OUT, file + '.png') } : {}), ...shot });
  await ctx.close();
  if (file) console.log(file + '.png');
  return buf;
}

/* Several pictures side by side on one canvas, each with a caption (themes, phone screens). */
async function collage(browser, file, items, { columns, width, phone = false }) {
  const ctx = await browser.newContext({ viewport: { width, height: 400 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const cells = items.map(({ img, label, dark }) => `<figure class="${dark ? 'dk' : ''}"><img src="data:image/png;base64,${img.toString('base64')}"><figcaption>${label}</figcaption></figure>`).join('');
  await page.setContent(`<style>body{margin:0;padding:28px;background:#eef1f6;font:600 15px system-ui,sans-serif;color:#2b3445}
    .g{display:grid;grid-template-columns:repeat(${columns},1fr);gap:22px}figure{margin:0;text-align:center}
    img{width:100%;display:block;border-radius:${phone ? 26 : 12}px;border:${phone ? '7px solid #1b2230' : '1px solid #d4dae4'};box-shadow:0 14px 34px rgba(20,30,50,.16)}
    figcaption{margin-top:10px}</style><div class="g">${cells}</div>`);
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, file + '.png'), fullPage: true });
  await ctx.close();
  console.log(file + '.png');
}

const scenes = {
  async hero(b) {
    await scene(b, 'visao-geral', { url: '/?r=argocd-gitops' }, async h => {
      await h.sleep(400);
      await h.click('.road-node[data-node="instalar"]');
      await h.sleep(500);
      await h.click('.statusbar [data-status="finished"]');
      await h.sleep(700);
      await h.click('#viewSeg [data-view="kanban"]');
      await h.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await h.sleep(500);
      await h.drag('.kcard[data-node="aplicacao"]', '.kcol[data-col="working"]');
      await h.click('#viewSeg [data-view="map"]');
      await h.click('#settingsBtn');
      await h.click('#themeSeg [data-theme-mode="dark"]');
      await h.key('Escape', 300);
      await h.click('#todayBtn');
      await h.sleep(1400);
    });
  },
  async hoje(b) {
    await scene(b, 'hoje', { url: '/?r=estudar-sql' }, async h => {
      await h.click('#todayBtn');
      await h.sleep(1300);
      await h.click('.td-rev [data-rev="ok"]');
      await h.sleep(1200);
      await h.click('#today .td-list .td-item');
      await h.sleep(1200);
    });
  },
  async projetos(b) {
    await scene(b, 'projetos', { url: '/?r=estudar-sql' }, async h => {
      await h.click('#viewSeg [data-view="projects"]');
      await h.sleep(800);
      await h.click('.pj-card[data-project="consultas-biblioteca"]');
      await h.sleep(700);
      await h.click('#detailContent [data-req="consultas"]');
      await h.sleep(500);
      await h.click('#detailContent .stretch-item');
      await h.sleep(900);
      await h.click('#detailContent [data-pdone]');
      await h.sleep(1200);
    });
  },
  async notas(b) {
    await scene(b, 'notas', { url: '/?r=argocd-gitops' }, async h => {
      await h.click('.road-node[data-node="aplicacao"]');
      await h.sleep(500);
      await h.page.locator('#detailContent .note-text').scrollIntoViewIfNeeded();
      await h.type('#detailContent .note-text', 'Repo de testes: `gitops-lab`\n\n- [x] Criar o Application\n- [ ] Ver o drift voltar sozinho', 26);
      await h.sleep(700);
      await h.click('#detailContent [data-note-mode="view"]');
      await h.sleep(600);
      await h.click('#detailContent .note-view li.task:last-child input');
      await h.sleep(800);
      await h.key('Escape', 300);
      await h.click('.tools [data-act="notes"]');
      await h.sleep(1600);
    });
  },
  async busca(b) {
    await scene(b, 'busca', { url: '/?r=argocd-gitops' }, async h => {
      await h.sleep(300);
      await h.key('Control+k', 400);
      await h.page.keyboard.type('kstmz', { delay: 160 });
      await h.sleep(1200);
      await h.key('Enter', 1200);
      await h.key('Escape', 300);
      await h.key('h', 1300);
      await h.key('Escape', 400);
      await h.key('?', 1500);
    });
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
    for (const [scheme, file] of [['light', 'mapa-claro'], ['dark', 'mapa-escuro']]) {
      await still(b, file, { url: '/?r=argocd-gitops', scheme }, async p => { await p.click('.road-node[data-node="instalar"]'); });
    }
    await still(b, 'kanban', { url: '/?r=argocd-gitops', prefs: { 'roadkit:v1:view:argocd-gitops': 'kanban' }, sel: '.kcard' });
    await still(b, 'hoje', { url: '/?r=estudar-sql' }, async p => { await p.click('#todayBtn'); await p.waitForSelector('.td-rev'); await sleep(400); });
    await still(b, 'projetos', { url: '/?r=estudar-sql', prefs: { 'roadkit:v1:view:estudar-sql': 'projects' }, sel: '.pj-card' }, async p => { await p.click('.pj-card[data-project="consultas-biblioteca"]'); });
    await still(b, 'notas', { url: '/?r=argocd-gitops' }, async p => {
      await p.click('.road-node[data-node="instalar"]');
      await p.evaluate(() => { const n = document.querySelector('#detailContent .note'); document.getElementById('detail').scrollTop = n.offsetTop - 90; });
    });
  },
  async stats(b) {
    for (const [scheme, file] of [['light', 'estatisticas'], ['dark', 'estatisticas-escuro']]) {
      await still(b, file, { url: '/?r=estudar-sql', scheme }, async p => { await p.click('aside [data-act="stats"]'); await p.waitForSelector('.st-cards'); await sleep(500); }, { fullPage: false });
    }
  },
  async foco(b) {
    await still(b, 'foco', { url: '/?r=argocd-gitops', prefs: { 'roadkit:v1:focus-run': JSON.stringify({ phase: 'focus', rm: 'argocd-gitops', rmTitle: 'GitOps com Argo CD', key: 'instalar', title: 'Instalar o Argo CD', mins: 25, start: Date.now() - 7 * 60e3 - 12e3, paused: 0, pausedMs: 0 }) } },
      async p => { await p.click('.road-node[data-node="instalar"]'); await p.waitForSelector('#focusClock'); await sleep(600); });
  },
  async temas(b) {
    const palettes = [['light', 'light', 'Claro'], ['light', 'mist', 'Névoa'], ['light', 'paper', 'Papel'], ['dark', 'night', 'Noite'], ['dark', 'graphite', 'Grafite'], ['dark', 'plum', 'Ameixa'], ['dark', 'black', 'Breu']];
    const items = [];
    for (const [scheme, pal, label] of palettes) {
      const img = await still(b, null, { url: '/?r=argocd-gitops', scheme, prefs: { [`roadkit:v1:palette-${scheme}`]: pal } },
        async p => { await p.click('.road-node[data-node="instalar"]'); }, { clip: { x: 0, y: 0, width: 1150, height: 660 } });
      items.push({ img, label, dark: scheme === 'dark' });
    }
    await collage(b, 'temas', items, { columns: 4, width: 1800 });
  },
  async celular(b) {
    const items = [];
    items.push({ label: 'Mapa', img: await still(b, null, { url: '/?r=estudar-sql', view: PHONE, mobile: true }) });
    items.push({ label: 'Hoje', img: await still(b, null, { url: '/?r=estudar-sql', view: PHONE, mobile: true }, async p => { await p.click('#todayBtn'); await p.waitForSelector('.td-rev'); }) });
    items.push({ label: 'Projetos', img: await still(b, null, { url: '/?r=estudar-sql', view: PHONE, mobile: true, prefs: { 'roadkit:v1:view:estudar-sql': 'projects' }, sel: '.pj-card' }) });
    items.push({ label: 'Estatísticas', img: await still(b, null, { url: '/?r=estudar-sql', view: PHONE, mobile: true }, async p => { await p.click('#statsLink'); await p.waitForSelector('.st-cards'); await sleep(300); await p.evaluate(() => scrollTo(0, 0)); }) });
    await collage(b, 'celular', items, { columns: 4, width: 1700, phone: true });
  },
};

(async () => {
  if (!DATA) console.warn('ROADKIT_DATA is not set: the activity history (statistics, Today) will be empty.');
  const browser = await pw.chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  for (const [name, fn] of Object.entries(scenes)) if (!ONLY || ONLY.split(',').includes(name)) await fn(browser);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
