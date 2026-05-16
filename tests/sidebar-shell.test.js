const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');

test('single sidebar toggle opens and closes the sidebar', () => {
  assert.match(html, /id="sidebarToggleBtn"/);
  assert.doesNotMatch(html, /id="closeSidebarBtn"/);
  assert.doesNotMatch(html, /id="mobileListBtn"/);
  assert.doesNotMatch(js, /closeSidebarBtn/);
  assert.doesNotMatch(js, /mobileListBtn/);
  assert.match(js, /function toggleSidebar/);
  assert.match(js, /function collapseSidebar/);
  assert.match(js, /function expandSidebar/);
  assert.match(css, /\.sidebar-collapsed\s+\.sidebar/);
  assert.match(css, /\.sidebar-backdrop\s*\{\s*top:\s*58px;/s);
});
