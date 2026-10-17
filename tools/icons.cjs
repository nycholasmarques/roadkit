/*
  Renders the app icons in src/icons/ from src/icons/icon.svg, with a real browser so the PNGs match the SVG.

    npm i playwright        (once; tools/demos/record.cjs uses it too)
    node tools/icons.cjs    (CHROME=/path/to/chrome to use another browser)

  - icon-192.png, icon-512.png: the SVG as it is (rounded corners, transparent outside).
  - maskable-512.png, apple-touch-icon.png: the drawing at 80% on a full square, so Android and iOS can
    cut their own shape without losing anything.
*/
const fs = require('fs');
const path = require('path');
let pw;
try { pw = require('playwright'); } catch { pw = require('playwright-core'); }

const DIR = path.resolve(__dirname, '../src/icons');
const svg = fs.readFileSync(path.join(DIR, 'icon.svg'), 'utf8');
const sized = (s, size) => s.replace('<svg ', `<svg width="${size}" height="${size}" `);
const full = size => `<html><body style="margin:0;background:transparent">${sized(svg, size)}</body></html>`;
/* maskable: a square shape (no rounded corners) and the drawing (#art) shrunk into the safe zone; the road
   still starts below the frame, so it keeps coming in from outside after the system cuts its own shape */
const maskSvg = svg.replace(/(<clipPath id="shape"><rect[^>]*?) rx="\d+"/, '$1').replace('<g id="art">', '<g id="art" transform="translate(256 256) scale(0.8) translate(-256 -256)">');
if (maskSvg === svg || !maskSvg.includes('scale(0.8)')) throw new Error('icon.svg: expected a #shape clip path and a <g id="art">');
const maskable = size => `<html><body style="margin:0">${sized(maskSvg, size)}</body></html>`;

(async () => {
  const browser = await pw.chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const page = await browser.newPage();
  for (const [file, size, html] of [
    ['icon-192.png', 192, full(192)], ['icon-512.png', 512, full(512)],
    ['maskable-512.png', 512, maskable(512)], ['apple-touch-icon.png', 180, maskable(180)],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html);
    await page.screenshot({ path: path.join(DIR, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log('wrote', path.join('src/icons', file));
  }
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
