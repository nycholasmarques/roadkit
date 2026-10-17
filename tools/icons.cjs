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
const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const full = (size, bg = 'transparent') => `<html><body style="margin:0;background:${bg}">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`;
/* maskable: a square background (the gradient, no corners) and the drawing shrunk into the safe zone */
const maskable = size => `<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">` +
  inner.replace('<rect width="512" height="512" rx="116" fill="url(#bg)"/>', '<rect width="512" height="512" fill="url(#bg)"/><g transform="translate(256 256) scale(0.8) translate(-256 -256)">') +
  '</g></svg></body></html>';

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
