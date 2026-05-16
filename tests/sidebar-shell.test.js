const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');

test('desktop sidebar has close and reopen controls', () => {
  assert.match(html, /id="sidebarToggleBtn"/);
  assert.match(html, /id="closeSidebarBtn"/);
  assert.match(js, /function toggleSidebar/);
  assert.match(js, /function collapseSidebar/);
  assert.match(css, /\.sidebar-collapsed\s+\.sidebar/);
});
