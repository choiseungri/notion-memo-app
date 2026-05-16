(function initLocalMemoCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LocalMemoCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createLocalMemoCore() {
  'use strict';

  function extractTags(value) {
    const seen = new Set();
    const tags = [];
    const text = String(value || '');
    const pattern = /(^|\s)#([0-9A-Za-z가-힣_-]+)/g;
    let match = pattern.exec(text);

    while (match) {
      const raw = match[2].replace(/^#+|[.,;:!?]+$/g, '');
      const tag = normalizeTag(raw);
      if (tag && !seen.has(tag)) {
        seen.add(tag);
        tags.push(tag);
      }
      match = pattern.exec(text);
    }

    return tags;
  }

  function normalizeTag(value) {
    return String(value || '').trim().replace(/^#/, '').toLowerCase();
  }

  function normalizeTags(value) {
    const items = Array.isArray(value)
      ? value
      : String(value || '').split(/[,\s]+/);
    const seen = new Set();
    const tags = [];

    for (const item of items) {
      const tag = normalizeTag(item);
      if (tag && !seen.has(tag)) {
        seen.add(tag);
        tags.push(tag);
      }
    }

    return tags;
  }

  function filterAndSortMemos(memos, options = {}) {
    const query = String(options.query || '').trim().toLowerCase();
    const includeArchived = Boolean(options.includeArchived);
    return (Array.isArray(memos) ? memos : [])
      .filter((memo) => includeArchived || !memo.archived)
      .filter((memo) => !query || memoSearchText(memo).includes(query))
      .slice()
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        return (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0);
      });
  }

  function memoSearchText(memo) {
    const blockText = (memo.blocks || []).map((block) => {
      const tableText = block.type === 'table' && Array.isArray(block.rows)
        ? block.rows.flat().map((cell) => htmlToPlainText(cell)).join(' ')
        : '';
      return [htmlToPlainText(block.html || ''), htmlToPlainText(block.captionHtml || ''), htmlToPlainText(block.detailHtml || ''), tableText].join(' ');
    }).join(' ');
    const tags = (memo.tags || []).join(' ');
    return `${memo.title || ''} ${blockText} ${tags}`.toLowerCase();
  }

  function parseMarkdownDocument(markdown) {
    const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    let title = '';
    const blocks = [];
    let paragraph = [];

    const flushParagraph = () => {
      const text = paragraph.join('<br>').trim();
      if (text) blocks.push(block('p', text));
      paragraph = [];
    };

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const trimmed = line.trim();
      if (!trimmed) {
        flushParagraph();
        continue;
      }

      const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
      if (heading) {
        flushParagraph();
        const text = escapeHtml(heading[2].trim());
        if (!title && heading[1] === '#') {
          title = htmlToPlainText(text);
        } else {
          blocks.push(block(`h${heading[1].length}`, text));
        }
        continue;
      }

      if (isMarkdownTableStart(lines, lineIndex)) {
        flushParagraph();
        const rows = [parseTableRow(lines[lineIndex])];
        lineIndex += 2;
        while (lineIndex < lines.length && isTableRow(lines[lineIndex])) {
          rows.push(parseTableRow(lines[lineIndex]));
          lineIndex += 1;
        }
        lineIndex -= 1;
        blocks.push(block('table', '', { rows }));
        continue;
      }

      const todo = /^[-*+]\s+\[(x|X| )\]\s+(.+)$/.exec(trimmed);
      if (todo) {
        flushParagraph();
        blocks.push(block('todo', escapeHtml(todo[2].trim()), { checked: todo[1].toLowerCase() === 'x' }));
        continue;
      }

      const bullet = /^[-*+]\s+(.+)$/.exec(trimmed);
      if (bullet) {
        flushParagraph();
        blocks.push(block('bullet', escapeHtml(bullet[1].trim())));
        continue;
      }

      const number = /^\d+\.\s+(.+)$/.exec(trimmed);
      if (number) {
        flushParagraph();
        blocks.push(block('number', escapeHtml(number[1].trim())));
        continue;
      }

      const quote = /^>\s+(.+)$/.exec(trimmed);
      if (quote) {
        flushParagraph();
        blocks.push(block('quote', escapeHtml(quote[1].trim())));
        continue;
      }

      if (/^---+$/.test(trimmed)) {
        flushParagraph();
        blocks.push(block('divider', ''));
        continue;
      }

      paragraph.push(escapeHtml(trimmed));
    }

    flushParagraph();
    return {
      title: title || '가져온 메모',
      blocks: blocks.length ? blocks : [block('p', '')]
    };
  }

  function isMarkdownTableStart(lines, index) {
    return isTableRow(lines[index]) && isTableDivider(lines[index + 1] || '');
  }

  function isTableRow(line) {
    const trimmed = String(line || '').trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.split('|').length >= 3;
  }

  function isTableDivider(line) {
    const cells = parseTableRow(line);
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
  }

  function parseTableRow(line) {
    return String(line || '')
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => escapeHtml(cell.trim()));
  }

  function block(type, html, overrides = {}) {
    return {
      type,
      html,
      detailHtml: '',
      captionHtml: '',
      src: '',
      checked: false,
      open: true,
      indent: 0,
      color: '',
      bg: '',
      ...overrides
    };
  }

  function formatBytes(bytes) {
    const value = Math.max(0, Number(bytes) || 0);
    if (value < 1024) return `${Math.round(value)} B`;
    const units = ['KB', 'MB', 'GB'];
    let size = value / 1024;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    return `${trimNumber(size)} ${units[index]}`;
  }

  function estimateJsonBytes(value) {
    return new Blob([JSON.stringify(value || {})]).size;
  }

  function storageLevel(usage, quota) {
    if (!quota || !usage) return 'normal';
    const ratio = usage / quota;
    if (ratio >= 0.9) return 'danger';
    if (ratio >= 0.75) return 'warn';
    return 'normal';
  }

  function htmlToPlainText(html) {
    return String(html || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function inlineHtmlToMarkdown(html) {
    let output = String(html || '');
    output = output.replace(/<br\s*\/?>/gi, '\n');
    output = output.replace(/<\/?span\b[^>]*>/gi, '');
    output = output.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
    output = output.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
    output = output.replace(/<u\b[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>');
    output = output.replace(/<(s|strike)\b[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~');
    output = output.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_match, text) => `\`${decodeHtml(text).replace(/`/g, '\\`')}\``);
    output = output.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, text) => {
      const label = decodeHtml(text).replace(/\]/g, '\\]');
      return `[${label || href}](${href})`;
    });
    output = output.replace(/<[^>]+>/g, '');
    return decodeHtml(output);
  }

  function decodeHtml(value) {
    return String(value || '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'");
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function trimNumber(value) {
    const fixed = value >= 10 ? value.toFixed(0) : value.toFixed(1);
    return fixed.replace(/\.0$/, '');
  }

  return {
    escapeHtml,
    estimateJsonBytes,
    extractTags,
    filterAndSortMemos,
    formatBytes,
    htmlToPlainText,
    inlineHtmlToMarkdown,
    memoSearchText,
    normalizeTag,
    normalizeTags,
    parseMarkdownDocument,
    storageLevel
  };
});
