// Tests for src/markdown.js, the renderer of personal notes: run with `node tools/markdown.test.cjs`.
// The main thing it guards is that nothing the user typed ever becomes HTML or a script link.
const assert = require('node:assert/strict');
const { render, toggleTask } = require('../src/markdown.js');

const cases = [
  // escaping: tags, attributes and script links stay text
  ['<script>alert(1)</script>', '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'],
  ['<img src=x onerror=alert(1)>', '<p>&lt;img src=x onerror=alert(1)&gt;</p>'],
  ['[click](javascript:alert(1))', '<p><a href="#" target="_blank" rel="noopener noreferrer">click</a>)</p>'],
  ['[click](javascript:void)', '<p><a href="#" target="_blank" rel="noopener noreferrer">click</a></p>'],
  ['[x](https://a.com/"onmouseover="alert(1))', '<p><a href="https://a.com/%22onmouseover=%22alert(1" target="_blank" rel="noopener noreferrer">x</a>)</p>'],
  ['`<b>` and **<i>**', '<p><code>&lt;b&gt;</code> and <strong>&lt;i&gt;</strong></p>'],
  ['```\n<div>"</div>\n```', '<pre><code>&lt;div&gt;&quot;&lt;/div&gt;</code></pre>'],
  // formatting
  ['# Title', '<h4>Title</h4>'],
  ['**bold**, *it*, _it_ and ~~old~~', '<p><strong>bold</strong>, <em>it</em>, <em>it</em> and <del>old</del></p>'],
  ['snake_case_name stays', '<p>snake_case_name stays</p>'],
  ['- a\n- b', '<ul><li>a</li><li>b</li></ul>'],
  ['1. a\n2. b', '<ol><li>a</li><li>b</li></ol>'],
  ['- [ ] todo\n- [x] done', '<ul class="tasks"><li class="task"><label><input type="checkbox" data-line="0"> <span>todo</span></label></li><li class="task"><label><input type="checkbox" data-line="1" checked> <span>done</span></label></li></ul>'],
  ['> quote', '<blockquote>quote</blockquote>'],
  ['see https://example.com/a_b_c.', '<p>see <a href="https://example.com/a_b_c" target="_blank" rel="noopener noreferrer">https://example.com/a_b_c</a>.</p>'],
  ['line one\nline two\n\nnew paragraph', '<p>line one<br>line two</p><p>new paragraph</p>'],
];

for (const [src, want] of cases) assert.equal(render(src), want, `render(${JSON.stringify(src)})`);
assert.equal(toggleTask('- [ ] a\n- [x] b', 0), '- [x] a\n- [x] b');
assert.equal(toggleTask('- [ ] a\n- [x] b', 1), '- [ ] a\n- [ ] b');
assert.equal(toggleTask('plain', 0), 'plain');
console.log(`markdown: ${cases.length + 3} checks ok`);
