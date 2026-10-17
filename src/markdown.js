/* Roadkit: a small Markdown renderer for personal notes, with no dependencies.
   Everything the user typed is escaped first; only the tags written here are ever produced, and links
   only keep http(s) addresses. Supports headings, lists, task lists, quotes, code, bold, italic and links.
   Loaded by index.html (window.RoadkitMarkdown) and by the CI tests (module.exports). */
(root => {
'use strict';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const unesc = s => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]));
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : '#'; } catch { return '#'; } };
const TOKEN = /\u0000(\d+)\u0000/g;
const TASK = /^(\s*[-*+]\s+\[)( |x|X)(\]\s+)/;

function inline(text) {
  const kept = [], keep = html => `\u0000${kept.push(html) - 1}\u0000`;
  const link = (label, url) => keep(`<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  let s = text.replace(/`([^`\n]+)`/g, (_, code) => keep(`<code>${esc(code)}</code>`));   // code is literal
  s = esc(s);
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label, url) => link(label, unesc(url)));
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]*[^\s<.,;:!?)'"])/g, (_, pre, url) => pre + link(url, unesc(url)));
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  for (let i = 0; i < 3 && s.includes('\u0000'); i++) s = s.replace(TOKEN, (_, n) => kept[n]);   // a link label may hold code
  return s;
}

function render(src) {
  const lines = String(src ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').split('\n');
  let html = '', para = [], list = null;
  const flushPara = () => { if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para = []; } };
  const flushList = () => { if (list) { html += `<${list.type}${list.task ? ' class="tasks"' : ''}>${list.items.join('')}</${list.type}>`; list = null; } };
  const listOf = type => { flushPara(); if (!list || list.type !== type) { flushList(); list = { type, items: [] }; } return list; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if (/^\s*```/.test(line)) {
      flushPara(); flushList();
      const body = [];
      while (++i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i]);
      html += `<pre><code>${esc(body.join('\n'))}</code></pre>`;
    } else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushPara(); flushList();
      const h = m[1].length + 3;   // the panel already has its own h2 and h3
      html += `<h${h}>${inline(m[2])}</h${h}>`;
    } else if ((m = line.match(/^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/))) {
      const l = listOf('ul'); l.task = true;
      l.items.push(`<li class="task"><label><input type="checkbox" data-line="${i}"${m[1] !== ' ' ? ' checked' : ''}> <span>${inline(m[2])}</span></label></li>`);
    } else if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
      listOf('ul').items.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      listOf('ol').items.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara(); flushList();
      html += `<blockquote>${inline(m[1])}</blockquote>`;
    } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushPara(); flushList();
      html += '<hr>';
    } else if (!line.trim()) {
      flushPara(); flushList();
    } else {
      flushList(); para.push(line);
    }
  }
  flushPara(); flushList();
  return html;
}

/* Ticks or unticks the "- [ ]" on one line of the source (the checkbox's data-line). */
function toggleTask(src, lineNo) {
  const lines = String(src ?? '').split('\n');
  if (!TASK.test(lines[lineNo] || '')) return src;
  lines[lineNo] = lines[lineNo].replace(TASK, (_, a, mark, b) => a + (mark === ' ' ? 'x' : ' ') + b);
  return lines.join('\n');
}

const api = { render, toggleTask };
if (typeof module === 'object' && module.exports) module.exports = api;
else root.RoadkitMarkdown = api;
})(typeof window !== 'undefined' ? window : globalThis);
