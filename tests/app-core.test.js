const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('../app-core.js');

test('extractTags returns unique normalized Korean and English tags', () => {
  assert.deepEqual(
    core.extractTags('회의 #프로젝트 #Project #project #일정-관리, 끝'),
    ['프로젝트', 'project', '일정-관리']
  );
});

test('filterAndSortMemos hides archived notes, searches tags, and pins first', () => {
  const memos = [
    memo('1', '일반 메모', '내용', { updatedAt: 20 }),
    memo('2', '핀 메모', '중요', { pinned: true, tags: ['work'], updatedAt: 10 }),
    memo('3', '보관 메모', 'work', { archived: true, tags: ['work'], updatedAt: 30 })
  ];

  assert.deepEqual(
    core.filterAndSortMemos(memos, { query: 'work', includeArchived: false }).map((item) => item.id),
    ['2']
  );

  assert.deepEqual(
    core.filterAndSortMemos(memos, { query: '', includeArchived: false }).map((item) => item.id),
    ['2', '1']
  );

  assert.deepEqual(
    core.filterAndSortMemos(memos, { query: 'work', includeArchived: true }).map((item) => item.id),
    ['2', '3']
  );
});

test('parseMarkdownDocument converts headings, lists, todos, quotes, and paragraphs', () => {
  const parsed = core.parseMarkdownDocument(`# 제목

본문 첫 줄
- 항목
- [x] 완료
> 인용
---`);

  assert.equal(parsed.title, '제목');
  assert.deepEqual(
    parsed.blocks.map((block) => [block.type, block.html, block.checked]),
    [
      ['p', '본문 첫 줄', false],
      ['bullet', '항목', false],
      ['todo', '완료', true],
      ['quote', '인용', false],
      ['divider', '', false]
    ]
  );
});

test('parseMarkdownDocument converts markdown tables into table blocks', () => {
  const parsed = core.parseMarkdownDocument(`# 표 메모

| 이름 | 상태 |
| --- | --- |
| 모바일 | 완료 |
| 마크다운 | 수정 |`);

  assert.equal(parsed.blocks.length, 1);
  assert.equal(parsed.blocks[0].type, 'table');
  assert.deepEqual(parsed.blocks[0].rows, [
    ['이름', '상태'],
    ['모바일', '완료'],
    ['마크다운', '수정']
  ]);
});

test('inlineHtmlToMarkdown strips styled spans but keeps semantic inline markdown', () => {
  const html = '<span style="background-color:rgb(220, 252, 231)">안되<span style="color:#ca8a04">면<br>ㅇㄴ</span></span>';
  assert.equal(core.inlineHtmlToMarkdown(html), '안되면\nㅇㄴ');
  assert.equal(core.inlineHtmlToMarkdown('<strong>굵게</strong> <em>기울임</em>'), '**굵게** *기울임*');
});

test('normalizePastedStyle keeps only safe pasted text color', () => {
  assert.equal(
    core.normalizePastedStyle('color: rgb(202, 138, 4); font-size: 42px; background-image: url(javascript:alert(1));'),
    'color:rgb(202, 138, 4)'
  );
  assert.equal(core.normalizePastedStyle('color: expression(alert(1)); background-color: #dcfce7'), '');
  assert.equal(core.normalizePastedStyle('COLOR: #ca8a04; position: fixed'), 'color:#ca8a04');
});

test('isSafePastedImageSource allows embeddable images and rejects scriptable sources', () => {
  assert.equal(core.isSafePastedImageSource('https://example.com/image.png'), true);
  assert.equal(core.isSafePastedImageSource('data:image/png;base64,abc123'), true);
  assert.equal(core.isSafePastedImageSource('javascript:alert(1)'), false);
  assert.equal(core.isSafePastedImageSource('data:text/html,<script>alert(1)</script>'), false);
});

test('formatBytes uses readable storage units', () => {
  assert.equal(core.formatBytes(0), '0 B');
  assert.equal(core.formatBytes(1536), '1.5 KB');
  assert.equal(core.formatBytes(1048576), '1 MB');
});

function memo(id, title, html, overrides = {}) {
  return {
    id,
    title,
    updatedAt: overrides.updatedAt || 0,
    pinned: Boolean(overrides.pinned),
    archived: Boolean(overrides.archived),
    tags: overrides.tags || [],
    blocks: [{ type: 'p', html }]
  };
}
