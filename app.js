(() => {
  'use strict';

  const STORAGE_KEY = 'local-notion-memo.v1';
  const SAVE_DELAY = 350;
  const MAX_SEARCH_PREVIEW = 80;
  const core = window.LocalMemoCore;

  const els = {
    root: document.documentElement,
    app: document.getElementById('app'),
    sidebarToggleBtn: document.getElementById('sidebarToggleBtn'),
    tabs: document.getElementById('tabs'),
    newTabBtn: document.getElementById('newTabBtn'),
    copyTextBtn: document.getElementById('copyTextBtn'),
    copyMarkdownBtn: document.getElementById('copyMarkdownBtn'),
    exportMarkdownBtn: document.getElementById('exportMarkdownBtn'),
    importMarkdownInput: document.getElementById('importMarkdownInput'),
    backupBtn: document.getElementById('backupBtn'),
    restoreInput: document.getElementById('restoreInput'),
    helpBtn: document.getElementById('helpBtn'),
    themeBtn: document.getElementById('themeBtn'),
    searchInput: document.getElementById('searchInput'),
    archiveFilterBtn: document.getElementById('archiveFilterBtn'),
    storageStatus: document.getElementById('storageStatus'),
    memoList: document.getElementById('memoList'),
    pinMemoBtn: document.getElementById('pinMemoBtn'),
    archiveMemoBtn: document.getElementById('archiveMemoBtn'),
    deleteMemoBtn: document.getElementById('deleteMemoBtn'),
    tagInput: document.getElementById('tagInput'),
    memoTitle: document.getElementById('memoTitle'),
    editor: document.getElementById('editor'),
    slashMenu: document.getElementById('slashMenu'),
    selectionToolbar: document.getElementById('selectionToolbar'),
    toast: document.getElementById('toast'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    mobileNewBtn: document.getElementById('mobileNewBtn'),
    mobileFormatBtn: document.getElementById('mobileFormatBtn'),
    mobileExportBtn: document.getElementById('mobileExportBtn'),
    mobileMoreBtn: document.getElementById('mobileMoreBtn'),
    mobileMenuDialog: document.getElementById('mobileMenuDialog'),
    mobileCopyTextBtn: document.getElementById('mobileCopyTextBtn'),
    mobileCopyMarkdownBtn: document.getElementById('mobileCopyMarkdownBtn'),
    mobileImportMarkdownBtn: document.getElementById('mobileImportMarkdownBtn'),
    mobileBackupBtn: document.getElementById('mobileBackupBtn'),
    mobileThemeBtn: document.getElementById('mobileThemeBtn'),
    mobileHelpBtn: document.getElementById('mobileHelpBtn'),
    urlDialog: document.getElementById('urlDialog'),
    urlForm: document.getElementById('urlForm'),
    urlDialogTitle: document.getElementById('urlDialogTitle'),
    urlDialogHint: document.getElementById('urlDialogHint'),
    urlInput: document.getElementById('urlInput'),
    helpDialog: document.getElementById('helpDialog'),
    textColorSelect: document.getElementById('textColorSelect'),
    bgColorSelect: document.getElementById('bgColorSelect')
  };

  const colorMap = {
    gray: '#6b7280',
    red: '#ef4444',
    orange: '#f97316',
    yellow: '#ca8a04',
    green: '#16a34a',
    blue: '#2563eb',
    purple: '#7c3aed',
    pink: '#db2777'
  };

  const bgMap = {
    gray: '#f3f4f6',
    red: '#fee2e2',
    orange: '#ffedd5',
    yellow: '#fef3c7',
    green: '#dcfce7',
    blue: '#dbeafe',
    purple: '#ede9fe',
    pink: '#fce7f3'
  };

  const colorAliases = {
    gray: ['gray', 'grey', '회색'],
    red: ['red', '빨강', '빨간색'],
    orange: ['orange', '주황', '주황색'],
    yellow: ['yellow', '노랑', '노란색'],
    green: ['green', '초록', '녹색'],
    blue: ['blue', '파랑', '파란색'],
    purple: ['purple', '보라', '보라색'],
    pink: ['pink', '분홍', '핑크']
  };

  const slashState = {
    open: false,
    query: '',
    selectedIndex: 0,
    blockId: null,
    field: 'html',
    target: null,
    matches: []
  };

  let state = loadState();
  let saveTimer = null;
  let toastTimer = null;
  let savedSelection = null;
  let editorWideSelection = false;
  let lastSoftBreak = null;
  let showArchived = false;
  let undoSnapshot = null;
  let pendingUrlRequest = null;

  const commands = buildCommands();

  document.addEventListener('selectionchange', handleSelectionChange);

  els.sidebarToggleBtn.addEventListener('click', toggleSidebar);
  els.newTabBtn.addEventListener('click', () => addMemo());
  els.copyTextBtn.addEventListener('click', () => copyCurrent('text'));
  els.copyMarkdownBtn.addEventListener('click', () => copyCurrent('markdown'));
  els.exportMarkdownBtn.addEventListener('click', downloadCurrentMarkdown);
  els.importMarkdownInput.addEventListener('change', importMarkdownFile);
  els.backupBtn.addEventListener('click', downloadBackup);
  els.restoreInput.addEventListener('change', restoreBackup);
  els.helpBtn.addEventListener('click', () => els.helpDialog.showModal());
  els.themeBtn.addEventListener('click', cycleTheme);

  els.searchInput.addEventListener('input', () => renderMemoList());
  els.archiveFilterBtn.addEventListener('click', () => {
    showArchived = !showArchived;
    renderMemoList();
    renderMemoMeta();
  });

  els.pinMemoBtn.addEventListener('click', () => toggleActiveMemoFlag('pinned'));
  els.archiveMemoBtn.addEventListener('click', () => toggleActiveMemoFlag('archived'));
  els.deleteMemoBtn.addEventListener('click', () => deleteActiveMemo());
  els.tagInput.addEventListener('change', () => updateActiveTags());
  els.tagInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      updateActiveTags();
      els.editor.focus();
    }
  });

  els.tabs.addEventListener('click', (event) => {
    const closeButton = event.target.closest('[data-close-tab]');
    if (closeButton) {
      event.stopPropagation();
      removeMemo(closeButton.dataset.closeTab);
      return;
    }

    const tab = event.target.closest('[data-tab-id]');
    if (tab) selectMemo(tab.dataset.tabId);
  });

  els.memoList.addEventListener('click', (event) => {
    const item = event.target.closest('[data-memo-id]');
    if (item) selectMemo(item.dataset.memoId);
  });

  els.memoTitle.addEventListener('input', () => {
    const memo = activeMemo();
    memo.title = els.memoTitle.value.trimStart();
    touchMemo(memo);
    renderTabs();
    renderMemoList();
    scheduleSave();
  });

  els.memoTitle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const memo = activeMemo();
      if (!memo.blocks.length) memo.blocks.push(createBlock());
      renderEditor(memo.blocks[0].id);
    }
  });

  els.editor.addEventListener('input', handleEditorInput);
  els.editor.addEventListener('keydown', handleEditorKeydown);
  els.editor.addEventListener('click', handleEditorClick);
  els.editor.addEventListener('paste', handlePaste);
  els.editor.addEventListener('copy', handleEditorCopy);

  els.sidebarBackdrop.addEventListener('click', closeSidebarPanel);
  els.mobileNewBtn.addEventListener('click', () => addMemo());
  els.mobileFormatBtn.addEventListener('click', toggleMobileToolbar);
  els.mobileExportBtn.addEventListener('click', downloadCurrentMarkdown);
  els.mobileMoreBtn.addEventListener('click', () => els.mobileMenuDialog.showModal());
  els.mobileCopyTextBtn.addEventListener('click', () => {
    els.mobileMenuDialog.close();
    copyCurrent('text');
  });
  els.mobileCopyMarkdownBtn.addEventListener('click', () => {
    els.mobileMenuDialog.close();
    copyCurrent('markdown');
  });
  els.mobileImportMarkdownBtn.addEventListener('click', () => {
    els.mobileMenuDialog.close();
    els.importMarkdownInput.click();
  });
  els.mobileBackupBtn.addEventListener('click', () => {
    els.mobileMenuDialog.close();
    downloadBackup();
  });
  els.mobileThemeBtn.addEventListener('click', () => {
    els.mobileMenuDialog.close();
    cycleTheme();
  });
  els.mobileHelpBtn.addEventListener('click', () => {
    els.mobileMenuDialog.close();
    els.helpDialog.showModal();
  });

  els.urlForm.addEventListener('submit', handleUrlDialogSubmit);
  els.urlDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    resolveUrlDialog('');
  });

  document.querySelectorAll('[data-inline]').forEach((button) => {
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => applyInlineCommand(button.dataset.inline));
  });

  if (els.selectionToolbar) {
    els.selectionToolbar.querySelectorAll('[data-floating-inline]').forEach((button) => {
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => applyInlineCommand(button.dataset.floatingInline));
    });

    const fontFamilySelect = els.selectionToolbar.querySelector('[data-floating-font-family]');
    const fontSizeSelect = els.selectionToolbar.querySelector('[data-floating-font-size]');
    const floatingTextColor = els.selectionToolbar.querySelector('[data-floating-text-color]');
    const floatingBgColor = els.selectionToolbar.querySelector('[data-floating-bg-color]');

    [fontFamilySelect, fontSizeSelect, floatingTextColor, floatingBgColor].filter(Boolean).forEach((select) => {
      select.addEventListener('mousedown', rememberSelectionBeforeControl);
    });

    fontFamilySelect?.addEventListener('change', () => {
      applyFontFamily(fontFamilySelect.value);
      fontFamilySelect.value = '';
    });
    fontSizeSelect?.addEventListener('change', () => {
      applyFontSize(fontSizeSelect.value);
      fontSizeSelect.value = '';
    });
    floatingTextColor?.addEventListener('change', () => {
      applyTextColor(floatingTextColor.value);
      floatingTextColor.value = '';
    });
    floatingBgColor?.addEventListener('change', () => {
      applyBgColor(floatingBgColor.value);
      floatingBgColor.value = '';
    });
  }

  els.textColorSelect.addEventListener('mousedown', rememberSelectionBeforeControl);
  els.bgColorSelect.addEventListener('mousedown', rememberSelectionBeforeControl);
  els.textColorSelect.addEventListener('change', () => {
    applyTextColor(els.textColorSelect.value);
    els.textColorSelect.value = '';
  });
  els.bgColorSelect.addEventListener('change', () => {
    applyBgColor(els.bgColorSelect.value);
    els.bgColorSelect.value = '';
  });

  document.addEventListener('click', (event) => {
    if (!els.slashMenu.contains(event.target) && !els.editor.contains(event.target)) {
      closeSlashMenu();
    }
    if (els.selectionToolbar && !els.selectionToolbar.contains(event.target) && !els.editor.contains(event.target)) {
      hideSelectionToolbar();
    }
  });

  window.addEventListener('beforeunload', () => persistState(true));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  window.addEventListener('resize', handleViewportChange);

  normalizeState();
  applyTheme();
  updateSidebarToggleState();
  renderAll();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.memos)) return createDefaultState();
      return parsed;
    } catch (error) {
      console.warn('Could not load saved memo state:', error);
      return createDefaultState();
    }
  }

  function createDefaultState() {
    const firstMemo = createMemo('새 메모');
    return {
      version: 1,
      theme: 'system',
      activeId: firstMemo.id,
      memos: [firstMemo]
    };
  }

  function createMemo(title = '새 메모') {
    const now = Date.now();
    return {
      id: uid(),
      title,
      createdAt: now,
      updatedAt: now,
      pinned: false,
      archived: false,
      tags: [],
      blocks: [createBlock('p')]
    };
  }

  function createBlock(type = 'p', overrides = {}) {
    return {
      id: uid(),
      type,
      html: '',
      detailHtml: '',
      captionHtml: '',
      src: '',
      checked: false,
      open: true,
      rows: [],
      color: '',
      bg: '',
      indent: 0,
      createdAt: Date.now(),
      ...overrides
    };
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  }

  function normalizeState() {
    if (!state || !Array.isArray(state.memos)) state = createDefaultState();
    if (!state.theme) state.theme = 'system';
    state.memos = state.memos.filter(Boolean);
    if (state.memos.length === 0) state.memos.push(createMemo('새 메모'));

    for (const memo of state.memos) {
      memo.id = memo.id || uid();
      memo.title = typeof memo.title === 'string' ? memo.title : '제목 없음';
      memo.createdAt = Number(memo.createdAt) || Date.now();
      memo.updatedAt = Number(memo.updatedAt) || memo.createdAt;
      memo.pinned = Boolean(memo.pinned);
      memo.archived = Boolean(memo.archived);
      memo.tags = core.normalizeTags(memo.tags || []);
      memo.blocks = Array.isArray(memo.blocks) && memo.blocks.length ? memo.blocks : [createBlock()];
      memo.blocks = memo.blocks.map((block) => ({
        ...createBlock(block.type || 'p'),
        ...block,
        id: block.id || uid(),
        type: supportedBlockType(block.type || 'p'),
        html: clearLegacyPromptHtml(sanitizeInlineHtml(block.html || '')),
        detailHtml: sanitizeInlineHtml(block.detailHtml || ''),
        captionHtml: sanitizeInlineHtml(block.captionHtml || ''),
        src: safeUrl(block.src || ''),
        rows: normalizeTableRows(block.rows),
        indent: clamp(Number(block.indent) || 0, 0, 6),
        color: colorMap[block.color] ? block.color : '',
        bg: bgMap[block.bg] ? block.bg : ''
      }));
    }

    if (!state.activeId || !state.memos.some((memo) => memo.id === state.activeId)) {
      state.activeId = state.memos[0].id;
    }
  }

  function supportedBlockType(type) {
    const supported = new Set(['p', 'h1', 'h2', 'h3', 'bullet', 'number', 'todo', 'toggle', 'quote', 'code', 'divider', 'image', 'video', 'bookmark', 'table']);
    return supported.has(type) ? type : 'p';
  }

  function normalizeTableRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const width = Math.max(1, ...rows.map((row) => Array.isArray(row) ? row.length : 0));
    return rows.map((row) => {
      const cells = Array.isArray(row) ? row : [];
      return Array.from({ length: width }, (_item, index) => sanitizeInlineHtml(cells[index] || ''));
    });
  }

  function clearLegacyPromptHtml(html) {
    const legacy = '여기에 입력하거나 <strong>/</strong> 를 눌러 명령어를 실행하세요.';
    return String(html || '').trim() === legacy ? '' : html;
  }

  function activeMemo() {
    return state.memos.find((memo) => memo.id === state.activeId) || state.memos[0];
  }

  function blockById(id) {
    return activeMemo().blocks.find((block) => block.id === id);
  }

  function blockIndex(id) {
    return activeMemo().blocks.findIndex((block) => block.id === id);
  }

  function renderAll(focusBlockId = null, focusField = 'html') {
    renderTabs();
    renderMemoList();
    renderMemoMeta();
    renderEditor(focusBlockId, focusField);
    updateStorageStatus();
  }

  function renderTabs() {
    const activeId = state.activeId;
    els.tabs.innerHTML = state.memos.map((memo) => {
      const title = displayTitle(memo);
      return `
        <button class="tab" role="tab" aria-selected="${memo.id === activeId}" data-tab-id="${escapeAttr(memo.id)}" title="${escapeAttr(title)}">
          <span class="tab-title">${escapeHtml(title)}</span>
          <span class="tab-close" data-close-tab="${escapeAttr(memo.id)}" role="button" aria-label="${escapeAttr(title)} 닫기">×</span>
        </button>
      `;
    }).join('');
  }

  function renderMemoList() {
    const query = (els.searchInput.value || '').trim();
    let memos = core.filterAndSortMemos(state.memos, { query, includeArchived: showArchived });
    if (showArchived) memos = memos.filter((memo) => memo.archived);
    els.archiveFilterBtn.setAttribute('aria-pressed', String(showArchived));
    els.archiveFilterBtn.textContent = showArchived ? '전체 메모' : '보관함';

    els.memoList.innerHTML = memos.map((memo) => {
      const title = displayTitle(memo);
      const preview = memoPreview(memo);
      const date = new Intl.DateTimeFormat('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(memo.updatedAt));
      const badges = [
        memo.pinned ? '<span class="memo-badge">핀</span>' : '',
        memo.archived ? '<span class="memo-badge">보관</span>' : ''
      ].join('');
      const tags = memo.tags?.length ? `<span class="memo-tags">${memo.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join('')}</span>` : '';
      return `
        <button class="memo-item ${memo.id === state.activeId ? 'active' : ''}" data-memo-id="${escapeAttr(memo.id)}" title="${escapeAttr(title)}">
          <span class="memo-item-title">${badges}${highlightText(title, query)}</span>
          <span class="memo-item-meta">${escapeHtml(date)} · ${highlightText(preview, query)}</span>
          ${tags}
        </button>
      `;
    }).join('') || '<div class="memo-item"><span class="memo-item-title">검색 결과 없음</span></div>';
  }

  function renderMemoMeta() {
    const memo = activeMemo();
    if (!memo) return;
    els.pinMemoBtn.setAttribute('aria-pressed', String(Boolean(memo.pinned)));
    els.pinMemoBtn.textContent = memo.pinned ? '핀 해제' : '핀';
    els.archiveMemoBtn.setAttribute('aria-pressed', String(Boolean(memo.archived)));
    els.archiveMemoBtn.textContent = memo.archived ? '보관 해제' : '보관';
    if (document.activeElement !== els.tagInput) {
      els.tagInput.value = (memo.tags || []).join(', ');
    }
  }

  function highlightText(value, query) {
    const text = String(value || '');
    const needle = String(query || '').trim();
    if (!needle) return escapeHtml(text);
    const index = text.toLowerCase().indexOf(needle.toLowerCase());
    if (index < 0) return escapeHtml(text);
    return [
      escapeHtml(text.slice(0, index)),
      '<mark>',
      escapeHtml(text.slice(index, index + needle.length)),
      '</mark>',
      escapeHtml(text.slice(index + needle.length))
    ].join('');
  }

  function renderEditor(focusBlockId = null, focusField = 'html') {
    const memo = activeMemo();
    els.memoTitle.value = memo.title || '';

    let numberCounter = 0;
    let inNumberList = false;

    els.editor.innerHTML = memo.blocks.map((block) => {
      if (block.type === 'number') {
        numberCounter = inNumberList ? numberCounter + 1 : 1;
        inNumberList = true;
      } else {
        inNumberList = false;
        numberCounter = 0;
      }
      return renderBlock(block, numberCounter);
    }).join('');

    if (focusBlockId) focusBlock(focusBlockId, focusField);
  }

  function renderBlock(block, number) {
    const typeClass = block.type === 'p' ? 'block-p' : `block-${block.type}`;
    const colorClass = block.color ? `block-text-${block.color}` : '';
    const bgClass = block.bg ? `block-bg-${block.bg}` : '';
    const extraClass = [
      block.type === 'todo' && block.checked ? 'todo-checked' : '',
      block.type === 'toggle' && block.open ? 'is-open' : ''
    ].filter(Boolean).join(' ');
    const indentStyle = block.indent ? `style="margin-left: ${block.indent * 28}px"` : '';
    const handle = renderBlockHandle(block);
    let body = '';

    switch (block.type) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'p':
        body = `
          <div class="content-wrap" ${indentStyle}>
            <div class="block-content" contenteditable="true" data-field="html">${sanitizeInlineHtml(block.html)}</div>
          </div>`;
        break;
      case 'bullet':
        body = `
          <div class="content-wrap" ${indentStyle}>
            <div class="marker-row">
              <span class="block-marker">•</span>
              <div class="block-content" contenteditable="true" data-field="html">${sanitizeInlineHtml(block.html)}</div>
            </div>
          </div>`;
        break;
      case 'number':
        body = `
          <div class="content-wrap" ${indentStyle}>
            <div class="marker-row">
              <span class="block-marker">${number}.</span>
              <div class="block-content" contenteditable="true" data-field="html">${sanitizeInlineHtml(block.html)}</div>
            </div>
          </div>`;
        break;
      case 'todo':
        body = `
          <div class="content-wrap" ${indentStyle}>
            <div class="marker-row">
              <input class="todo-checkbox" type="checkbox" data-action="toggle-check" ${block.checked ? 'checked' : ''} aria-label="체크박스" />
              <div class="block-content" contenteditable="true" data-field="html">${sanitizeInlineHtml(block.html)}</div>
            </div>
          </div>`;
        break;
      case 'toggle':
        body = `
          <div class="content-wrap" ${indentStyle}>
            <div class="toggle-row">
              <button class="toggle-button" type="button" data-action="toggle-open" aria-label="토글 열기/닫기"><span class="triangle">▶</span></button>
              <div class="toggle-title" contenteditable="true" data-field="html">${sanitizeInlineHtml(block.html)}</div>
            </div>
            <div class="toggle-body" contenteditable="true" data-field="detailHtml">${sanitizeInlineHtml(block.detailHtml)}</div>
          </div>`;
        break;
      case 'quote':
        body = `
          <div class="content-wrap" ${indentStyle}>
            <div class="block-content" contenteditable="true" data-field="html">${sanitizeInlineHtml(block.html)}</div>
          </div>`;
        break;
      case 'code':
        body = `
          <div class="content-wrap" ${indentStyle}>
            <div class="code-content" contenteditable="true" data-field="html" spellcheck="false">${escapeHtml(htmlToPlainText(block.html))}</div>
          </div>`;
        break;
      case 'divider':
        body = '<div class="content-wrap" ' + indentStyle + '><hr /></div>';
        break;
      case 'image':
        body = renderImageBlock(block, indentStyle);
        break;
      case 'video':
        body = renderVideoBlock(block, indentStyle);
        break;
      case 'bookmark':
        body = renderBookmarkBlock(block, indentStyle);
        break;
      case 'table':
        body = renderTableBlock(block, indentStyle);
        break;
      default:
        body = `
          <div class="content-wrap" ${indentStyle}>
            <div class="block-content" contenteditable="true" data-field="html">${sanitizeInlineHtml(block.html)}</div>
          </div>`;
    }

    return `<section class="block ${typeClass} ${colorClass} ${bgClass} ${extraClass}" data-block-id="${escapeAttr(block.id)}" data-type="${escapeAttr(block.type)}">${handle}${body}</section>`;
  }

  function renderBlockHandle(block) {
    return `
      <div class="block-handle" title="블록 메뉴">⋮⋮
        <div class="handle-menu" role="menu">
          <button class="handle-action" type="button" data-action="move-up">↑</button>
          <button class="handle-action" type="button" data-action="move-down">↓</button>
          <button class="handle-action" type="button" data-action="duplicate">복제</button>
          <button class="handle-action" type="button" data-action="delete">삭제</button>
        </div>
      </div>`;
  }

  function renderImageBlock(block, indentStyle) {
    const src = safeUrl(block.src);
    const image = src ? `<img src="${escapeAttr(src)}" alt="${escapeAttr(htmlToPlainText(block.captionHtml) || '삽입한 이미지')}" loading="lazy" />` : '<div class="bookmark-card">이미지 URL이 없습니다.</div>';
    return `
      <div class="content-wrap" ${indentStyle}>
        <div class="media-block">
          ${image}
          <div class="caption-content" contenteditable="true" data-field="captionHtml">${sanitizeInlineHtml(block.captionHtml)}</div>
        </div>
      </div>`;
  }

  function renderVideoBlock(block, indentStyle) {
    const src = safeUrl(block.src);
    const embed = toEmbedUrl(src);
    let media = '<div class="bookmark-card">영상 URL이 없습니다.</div>';
    if (embed.type === 'video') {
      media = `<video controls src="${escapeAttr(embed.url)}"></video>`;
    } else if (embed.url) {
      media = `<iframe src="${escapeAttr(embed.url)}" title="삽입한 영상" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>`;
    }
    return `
      <div class="content-wrap" ${indentStyle}>
        <div class="media-block">
          ${media}
          <div class="caption-content" contenteditable="true" data-field="captionHtml">${sanitizeInlineHtml(block.captionHtml)}</div>
        </div>
      </div>`;
  }

  function renderBookmarkBlock(block, indentStyle) {
    const src = safeUrl(block.src);
    const title = sanitizeInlineHtml(block.html || '북마크');
    return `
      <div class="content-wrap" ${indentStyle}>
        <div class="media-block">
          <div class="bookmark-card">
            <div class="caption-content" contenteditable="true" data-field="html">${title}</div>
            <a class="bookmark-url" href="${escapeAttr(src || '#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(src || 'URL 없음')}</a>
          </div>
        </div>
      </div>`;
  }

  function renderTableBlock(block, indentStyle) {
    const rows = normalizeTableRows(block.rows).length ? normalizeTableRows(block.rows) : defaultTableRows();
    block.rows = rows;
    const tableRows = rows.map((row, rowIndex) => {
      const cells = row.map((cell, colIndex) => {
        const tag = rowIndex === 0 ? 'th' : 'td';
        return `<${tag}><div class="table-cell" contenteditable="true" data-table-cell data-row="${rowIndex}" data-col="${colIndex}">${sanitizeInlineHtml(cell)}</div></${tag}>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `
      <div class="content-wrap" ${indentStyle}>
        <div class="table-block-wrap">
          <div class="table-actions" aria-label="표 작업">
            <button type="button" data-action="table-add-row">행 추가</button>
            <button type="button" data-action="table-add-col">열 추가</button>
          </div>
          <div class="table-scroll">
            <table class="memo-table">${tableRows}</table>
          </div>
        </div>
      </div>`;
  }

  function defaultTableRows() {
    return [
      ['제목', '상태', '메모'],
      ['', '', ''],
      ['', '', '']
    ];
  }

  function handleEditorInput(event) {
    lastSoftBreak = null;
    const tableCell = event.target.closest('[data-table-cell]');
    if (tableCell) {
      const blockEl = tableCell.closest('[data-block-id]');
      const block = blockEl ? blockById(blockEl.dataset.blockId) : null;
      if (!block || block.type !== 'table') return;
      const row = Number(tableCell.dataset.row);
      const col = Number(tableCell.dataset.col);
      if (!Array.isArray(block.rows[row])) block.rows[row] = [];
      block.rows[row][col] = sanitizeInlineHtml(tableCell.innerHTML);
      touchMemo(activeMemo());
      scheduleSave();
      renderTabs();
      renderMemoList();
      return;
    }

    const target = event.target.closest('[contenteditable][data-field]');
    if (!target) return;
    const blockEl = target.closest('[data-block-id]');
    const block = blockById(blockEl.dataset.blockId);
    if (!block) return;

    const field = target.dataset.field;
    if (block.type === 'code' && field === 'html') {
      block[field] = escapeHtml(target.innerText.replace(/\u00a0/g, ' '));
    } else {
      block[field] = sanitizeInlineHtml(target.innerHTML);
    }

    touchMemo(activeMemo());

    if (field === 'html') {
      const text = target.textContent.trim();
      if (text === '[]') {
        transformBlock(block.id, 'todo', { html: '' });
        return;
      }
      if (text === '---') {
        transformBlock(block.id, 'divider', { html: '' });
        return;
      }
    }

    maybeOpenSlashMenu(target, block.id, field);
    scheduleSave();
    renderTabs();
    renderMemoList();
  }

  function handleEditorKeydown(event) {
    const target = event.target.closest('[contenteditable][data-field]');

    if (slashState.open) {
      if (handleSlashKeydown(event)) return;
    }

    if (target && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      selectWholeEditor();
      return;
    }

    if (target && isFormattingShortcut(event)) {
      event.preventDefault();
      handleFormattingShortcut(event);
      return;
    }

    if (!target) return;

    const blockEl = target.closest('[data-block-id]');
    const block = blockById(blockEl.dataset.blockId);
    if (!block) return;

    if (event.key !== 'Enter' && !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
      lastSoftBreak = null;
    }

    if (event.key === 'Escape') {
      closeSlashMenu();
      hideSelectionToolbar();
      return;
    }

    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (handleArrowNavigation(event, block, target)) return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      block.indent = clamp((Number(block.indent) || 0) + (event.shiftKey ? -1 : 1), 0, 6);
      touchMemo(activeMemo());
      renderEditor(block.id, target.dataset.field);
      scheduleSave();
      return;
    }

    if (event.key === ' ' && target.dataset.field === 'html' && isPlainMarkerCandidate(target)) {
      const marker = target.textContent.trim();
      const converted = convertMarkdownShortcut(block.id, marker);
      if (converted) {
        event.preventDefault();
        return;
      }
    }

    if (event.key === 'Enter' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (block.type === 'code' || target.dataset.field === 'detailHtml') return;
      event.preventDefault();
      handleEnter(block, target);
      return;
    }

    if (event.key === 'Backspace' && target.dataset.field === 'html' && target.textContent.trim() === '' && isCaretAtStart(target)) {
      event.preventDefault();
      handleBackspaceOnEmptyBlock(block);
    }
  }

  function handleEditorClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const blockEl = actionEl.closest('[data-block-id]');
    const block = blockEl ? blockById(blockEl.dataset.blockId) : null;
    if (!block) return;

    const action = actionEl.dataset.action;
    if (action === 'toggle-check') {
      block.checked = actionEl.checked;
      touchMemo(activeMemo());
      renderEditor(block.id);
      scheduleSave();
    }
    if (action === 'toggle-open') {
      block.open = !block.open;
      touchMemo(activeMemo());
      renderEditor(block.id, 'html');
      scheduleSave();
    }
    if (action === 'duplicate') duplicateBlock(block.id);
    if (action === 'delete') deleteBlock(block.id);
    if (action === 'move-up') moveBlock(block.id, -1);
    if (action === 'move-down') moveBlock(block.id, 1);
    if (action === 'table-add-row') addTableRow(block.id);
    if (action === 'table-add-col') addTableColumn(block.id);
  }

  function handlePaste(event) {
    const target = event.target.closest('[contenteditable]');
    if (!target) return;
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const items = Array.from(clipboard.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    const html = clipboard.getData('text/html');
    const markdown = clipboard.getData('text/markdown');
    const plain = clipboard.getData('text/plain');

    if (!imageItem && !html && !markdown && !plain) return;

    event.preventDefault();
    const block = blockFromEditable(target);

    if (imageItem) {
      insertImageFileFromClipboard(imageItem, target);
      return;
    }

    if (block?.type === 'code') {
      insertPlainTextAtSelection(target, plain || htmlToPlainText(html) || markdown);
      syncEditableAfterPaste(target);
      return;
    }

    const pasted = html ? sanitizePastedHtml(html) : markdownToPasteParts(markdown || plain);
    if (pasted.html) {
      insertHtmlAtSelection(target, pasted.html);
    } else if (plain || markdown) {
      insertPlainTextAtSelection(target, plain || markdown);
    }

    syncEditableAfterPaste(target);
    const imageBlocks = insertPastedImageBlocks(target, pasted.images);
    if (imageBlocks.length) {
      touchMemo(activeMemo());
      renderAll(imageBlocks[0].id, 'captionHtml');
      scheduleSave();
    }
  }

  function insertImageFileFromClipboard(imageItem, target) {
    const file = imageItem.getAsFile();
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const imageBlocks = insertPastedImageBlocks(target, [{
        src: reader.result,
        alt: file.name || 'pasted image'
      }]);
      if (!imageBlocks.length) return;
      touchMemo(activeMemo());
      renderAll(imageBlocks[0].id, 'captionHtml');
      scheduleSave();
      showToast('?대?吏瑜???釉붾줉?쇰줈 遺숈뿬?ｌ뿀?듬땲??');
    };
    reader.readAsDataURL(file);
  }

  function sanitizePastedHtml(html) {
    const source = document.createElement('div');
    const output = document.createElement('div');
    const images = [];
    source.innerHTML = String(html || '');
    Array.from(source.childNodes).forEach((node) => appendSanitizedPasteNode(node, output, images));
    trimPastedEdgeBreaks(output);
    return {
      html: normalizePastedBreaks(output.innerHTML),
      images
    };
  }

  function appendSanitizedPasteNode(node, parent, images) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.textContent || ''));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'meta' || tag === 'link') return;
    if (tag === 'br') {
      appendBreak(parent);
      return;
    }
    if (tag === 'img') {
      addPastedImage(node, images);
      return;
    }

    const isBlock = isPasteBlockElement(tag);
    if (isBlock) appendBreak(parent);

    let container = parent;
    for (const wrapperTag of pasteWrapperTags(node)) {
      const wrapper = document.createElement(wrapperTag);
      if (wrapperTag === 'a') {
        const href = safeUrl(node.getAttribute('href') || '');
        if (!href) continue;
        wrapper.setAttribute('href', href);
        wrapper.setAttribute('target', '_blank');
        wrapper.setAttribute('rel', 'noopener noreferrer');
      }
      container.appendChild(wrapper);
      container = wrapper;
    }

    const pastedStyle = core.normalizePastedStyle(node.getAttribute('style') || '');
    if (pastedStyle) {
      const span = document.createElement('span');
      span.setAttribute('style', pastedStyle);
      container.appendChild(span);
      container = span;
    }

    Array.from(node.childNodes).forEach((child) => appendSanitizedPasteNode(child, container, images));
    if (isBlock) appendBreak(parent);
  }

  function pasteWrapperTags(element) {
    const tag = element.tagName.toLowerCase();
    const style = element.getAttribute('style') || '';
    const wrappers = [];
    const add = (value) => {
      if (!wrappers.includes(value)) wrappers.push(value);
    };

    if (tag === 'strong' || tag === 'b' || hasPasteBold(style)) add('strong');
    if (tag === 'em' || tag === 'i' || hasPasteItalic(style)) add('em');
    if (tag === 'u' || hasPasteUnderline(style)) add('u');
    if (tag === 's' || tag === 'strike' || tag === 'del' || hasPasteStrike(style)) add('s');
    if (tag === 'code') add('code');
    if (tag === 'a') add('a');
    return wrappers;
  }

  function hasPasteBold(style) {
    const value = pasteStyleValue(style, 'font-weight').toLowerCase();
    if (!value) return false;
    if (value === 'bold' || value === 'bolder') return true;
    const weight = Number(value);
    return Number.isFinite(weight) && weight >= 600;
  }

  function hasPasteItalic(style) {
    return /italic|oblique/i.test(pasteStyleValue(style, 'font-style'));
  }

  function hasPasteUnderline(style) {
    return /underline/i.test(pasteStyleValue(style, 'text-decoration') || pasteStyleValue(style, 'text-decoration-line'));
  }

  function hasPasteStrike(style) {
    return /line-through/i.test(pasteStyleValue(style, 'text-decoration') || pasteStyleValue(style, 'text-decoration-line'));
  }

  function pasteStyleValue(style, property) {
    const declarations = String(style || '').split(';');
    for (const declaration of declarations) {
      const colonIndex = declaration.indexOf(':');
      if (colonIndex < 0) continue;
      const name = declaration.slice(0, colonIndex).trim().toLowerCase();
      if (name === property) return declaration.slice(colonIndex + 1).trim();
    }
    return '';
  }

  function isPasteBlockElement(tag) {
    return new Set(['address', 'article', 'aside', 'blockquote', 'div', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'li', 'main', 'ol', 'p', 'pre', 'section', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul']).has(tag);
  }

  function appendBreak(parent) {
    const last = parent.lastChild;
    if (!last) return;
    if (last.nodeType === Node.ELEMENT_NODE && last.tagName === 'BR') return;
    parent.appendChild(document.createElement('br'));
  }

  function normalizePastedBreaks(html) {
    return String(html || '')
      .replace(/(?:<br>\s*){3,}/gi, '<br><br>')
      .replace(/^(?:\s*<br>\s*)+/gi, '')
      .replace(/(?:\s*<br>\s*)+$/gi, '');
  }

  function trimPastedEdgeBreaks(element) {
    const trim = (node) => {
      while (node.firstChild && node.firstChild.nodeType === Node.ELEMENT_NODE && node.firstChild.tagName === 'BR') {
        node.firstChild.remove();
      }
      while (node.lastChild && node.lastChild.nodeType === Node.ELEMENT_NODE && node.lastChild.tagName === 'BR') {
        node.lastChild.remove();
      }
    };
    trim(element);
    element.querySelectorAll('span,strong,em,u,s,code,a').forEach(trim);
  }

  function addPastedImage(image, images) {
    const src = image.getAttribute('src') || '';
    if (!core.isSafePastedImageSource(src)) return;
    images.push({
      src: safeUrl(src),
      alt: image.getAttribute('alt') || image.getAttribute('title') || ''
    });
  }

  function markdownToPasteParts(text) {
    const images = [];
    const withoutImages = String(text || '').replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
      if (!core.isSafePastedImageSource(src)) return match;
      images.push({ src: safeUrl(src), alt });
      return alt || '';
    });
    return {
      html: markdownInlineToPasteHtml(withoutImages),
      images
    };
  }

  function markdownInlineToPasteHtml(text) {
    let html = escapeHtml(String(text || ''));
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label, href) => {
      const url = safeUrl(href);
      return url ? `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
    });
    return html.replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
  }

  function insertHtmlAtSelection(target, html) {
    if (!html) return false;
    target.focus();
    const selection = window.getSelection();
    const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
    if (!range || !target.contains(range.commonAncestorContainer)) {
      target.insertAdjacentHTML('beforeend', html);
      return true;
    }

    range.deleteContents();
    const template = document.createElement('template');
    template.innerHTML = html;
    const fragment = template.content;
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);
    if (lastNode) {
      const nextRange = document.createRange();
      nextRange.setStartAfter(lastNode);
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
    }
    return true;
  }

  function insertPlainTextAtSelection(target, text) {
    return insertHtmlAtSelection(target, escapeHtml(text).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>'));
  }

  function blockFromEditable(target) {
    const blockEl = target.closest('[data-block-id]');
    return blockEl ? blockById(blockEl.dataset.blockId) : null;
  }

  function syncEditableAfterPaste(target) {
    const tableCell = target.closest('[data-table-cell]');
    if (tableCell) {
      const blockEl = tableCell.closest('[data-block-id]');
      const block = blockEl ? blockById(blockEl.dataset.blockId) : null;
      if (!block || block.type !== 'table') return null;
      const row = Number(tableCell.dataset.row);
      const col = Number(tableCell.dataset.col);
      if (!Array.isArray(block.rows[row])) block.rows[row] = [];
      block.rows[row][col] = sanitizeInlineHtml(tableCell.innerHTML);
      touchMemo(activeMemo());
      scheduleSave();
      renderTabs();
      renderMemoList();
      return block;
    }

    const block = blockFromEditable(target);
    if (!block) return null;
    syncFieldToBlock(block, target);
    touchMemo(activeMemo());
    scheduleSave();
    renderTabs();
    renderMemoList();
    return block;
  }

  function insertPastedImageBlocks(target, images) {
    const block = blockFromEditable(target);
    const index = block ? blockIndex(block.id) : -1;
    if (index < 0) return [];
    const imageBlocks = images
      .filter((image) => core.isSafePastedImageSource(image.src))
      .map((image) => createBlock('image', {
        src: safeUrl(image.src),
        captionHtml: escapeHtml(image.alt || '')
      }));
    if (!imageBlocks.length) return [];
    activeMemo().blocks.splice(index + 1, 0, ...imageBlocks);
    return imageBlocks;
  }

  function isFormattingShortcut(event) {
    const mod = event.metaKey || event.ctrlKey;
    if (!mod) return false;
    const key = event.key.toLowerCase();
    return key === 'b' || key === 'i' || key === 'u' || key === 'k' || key === 'e' || (key === 's' && event.shiftKey);
  }

  function handleFormattingShortcut(event) {
    const key = event.key.toLowerCase();
    if (key === 'b') applyInlineCommand('bold');
    if (key === 'i') applyInlineCommand('italic');
    if (key === 'u') applyInlineCommand('underline');
    if (key === 'k') applyInlineCommand('link');
    if (key === 'e') applyInlineCommand('code');
    if (key === 's' && event.shiftKey) applyInlineCommand('strikeThrough');
  }

  function convertMarkdownShortcut(blockId, marker) {
    const map = {
      '#': 'h1',
      '##': 'h2',
      '###': 'h3',
      '-': 'bullet',
      '*': 'bullet',
      '+': 'bullet',
      '1.': 'number',
      'a.': 'number',
      'i.': 'number',
      '[]': 'todo',
      '>': 'toggle',
      '```': 'code',
      '---': 'divider'
    };
    const type = map[marker];
    if (!type) return false;
    transformBlock(blockId, type, { html: '' });
    return true;
  }

  function transformBlock(blockId, type, overrides = {}) {
    const block = blockById(blockId);
    if (!block) return;
    block.type = type;
    if (typeof overrides.html !== 'undefined') block.html = overrides.html;
    if (type === 'divider') block.html = '';
    if (type === 'todo') block.checked = false;
    if (type === 'toggle') block.open = true;
    if (type === 'table') {
      block.html = '';
      block.rows = defaultTableRows();
    }
    touchMemo(activeMemo());
    renderAll(block.id, preferredFocusField(type));
    scheduleSave();
  }

  function preferredFocusField(type) {
    if (type === 'divider') return 'html';
    if (type === 'table') return 'table';
    if (type === 'image' || type === 'video') return 'captionHtml';
    return 'html';
  }

  function handleEnter(block, target) {
    const sameSoftBreak = lastSoftBreak
      && lastSoftBreak.blockId === block.id
      && lastSoftBreak.field === target.dataset.field
      && hasSoftLineBreakBeforeCaret(target);

    if (sameSoftBreak) {
      removeSoftLineBreakBeforeCaret(target);
      syncFieldToBlock(block, target);
      lastSoftBreak = null;
      createBlockAfterDoubleEnter(block, target);
      return;
    }

    insertSoftLineBreak(target);
    syncFieldToBlock(block, target);
    lastSoftBreak = {
      blockId: block.id,
      field: target.dataset.field,
      createdAt: Date.now()
    };
    touchMemo(activeMemo());
    scheduleSave();
  }

  function createBlockAfterDoubleEnter(block, target) {
    const memo = activeMemo();
    const index = blockIndex(block.id);
    const isEmpty = target.textContent.trim() === '';

    if (isEmpty && ['h1', 'h2', 'h3', 'bullet', 'number', 'todo', 'toggle', 'quote'].includes(block.type)) {
      block.type = 'p';
      block.checked = false;
      block.open = true;
      touchMemo(memo);
      renderAll(block.id);
      scheduleSave();
      return;
    }

    const repeatedType = ['bullet', 'number', 'todo'].includes(block.type) ? block.type : 'p';
    const next = createBlock(repeatedType, { indent: block.indent || 0 });
    memo.blocks.splice(index + 1, 0, next);
    touchMemo(memo);
    renderAll(next.id, preferredFocusField(next.type));
    scheduleSave();
  }

  function syncFieldToBlock(block, target) {
    const field = target.dataset.field;
    if (!field) return;
    if (block.type === 'code' && field === 'html') block[field] = escapeHtml(target.innerText.replace(/\u00a0/g, ' '));
    else block[field] = sanitizeInlineHtml(target.innerHTML);
  }

  function insertSoftLineBreak(target) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!target.contains(range.commonAncestorContainer)) return;
    document.execCommand('insertLineBreak', false, null);
  }

  function hasSoftLineBreakBeforeCaret(target) {
    const before = previousSignificantNodeBeforeCaret(target);
    if (before && before.nodeType === Node.ELEMENT_NODE && before.tagName === 'BR') return true;
    return textBeforeCaret(target).endsWith('\n');
  }

  function removeSoftLineBreakBeforeCaret(target) {
    const selection = window.getSelection();
    const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;

    if (range && range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
      const textNode = range.startContainer;
      if (textNode.data[range.startOffset - 1] === '\n') {
        textNode.deleteData(range.startOffset - 1, 1);
        const nextRange = document.createRange();
        nextRange.setStart(textNode, range.startOffset - 1);
        nextRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(nextRange);
        return;
      }
    }

    const before = previousSignificantNodeBeforeCaret(target);
    if (before && before.nodeType === Node.TEXT_NODE && before.data.endsWith('\n')) {
      before.deleteData(before.data.length - 1, 1);
      const nextRange = document.createRange();
      nextRange.setStart(before, before.data.length);
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      return;
    }

    if (before && before.nodeType === Node.ELEMENT_NODE && before.tagName === 'BR') {
      const parent = before.parentNode;
      const index = Array.prototype.indexOf.call(parent.childNodes, before);
      before.remove();
      const possibleFiller = parent.childNodes[index];
      if (possibleFiller && possibleFiller.nodeType === Node.ELEMENT_NODE && possibleFiller.tagName === 'BR' && index >= parent.childNodes.length - 1) {
        possibleFiller.remove();
      }
      const nextRange = document.createRange();
      nextRange.setStart(parent, Math.min(index, parent.childNodes.length));
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
    }
  }

  function previousSignificantNodeBeforeCaret(target) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    if (!target.contains(range.startContainer)) return null;
    let node = range.startContainer;
    let offset = range.startOffset;

    if (node.nodeType === Node.TEXT_NODE) {
      if (offset > 0) return node;
      return previousLeafNode(node, target);
    }

    if (offset > 0) {
      let candidate = node.childNodes[offset - 1];
      while (candidate && candidate.lastChild) candidate = candidate.lastChild;
      return candidate;
    }

    return previousLeafNode(node, target);
  }

  function previousLeafNode(node, root) {
    let current = node;
    while (current && current !== root) {
      if (current.previousSibling) {
        current = current.previousSibling;
        while (current.lastChild) current = current.lastChild;
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  function handleBackspaceOnEmptyBlock(block) {
    const memo = activeMemo();
    const index = blockIndex(block.id);

    if (block.type !== 'p') {
      block.type = 'p';
      block.checked = false;
      block.open = true;
      touchMemo(memo);
      renderAll(block.id);
      scheduleSave();
      return;
    }

    if (memo.blocks.length <= 1) return;
    const previous = memo.blocks[Math.max(0, index - 1)];
    memo.blocks.splice(index, 1);
    touchMemo(memo);
    renderAll(previous.id, preferredFocusField(previous.type));
    scheduleSave();
  }

  function duplicateBlock(blockId) {
    const memo = activeMemo();
    const index = blockIndex(blockId);
    if (index < 0) return;
    const copy = JSON.parse(JSON.stringify(memo.blocks[index]));
    copy.id = uid();
    copy.createdAt = Date.now();
    memo.blocks.splice(index + 1, 0, copy);
    touchMemo(memo);
    renderAll(copy.id, preferredFocusField(copy.type));
    scheduleSave();
  }

  function deleteBlock(blockId) {
    const memo = activeMemo();
    const index = blockIndex(blockId);
    if (index < 0) return;
    const deleted = cloneData(memo.blocks[index]);
    if (memo.blocks.length === 1) {
      memo.blocks[0] = createBlock('p');
      touchMemo(memo);
      renderAll(memo.blocks[0].id);
      scheduleSave();
      showUndoToast('블록을 비웠습니다.', () => {
        memo.blocks[0] = deleted;
        touchMemo(memo);
        renderAll(deleted.id, preferredFocusField(deleted.type));
        scheduleSave();
      });
      return;
    }
    const nextFocus = memo.blocks[index + 1] || memo.blocks[index - 1];
    memo.blocks.splice(index, 1);
    touchMemo(memo);
    renderAll(nextFocus.id, preferredFocusField(nextFocus.type));
    scheduleSave();
    showUndoToast('블록을 삭제했습니다.', () => {
      memo.blocks.splice(index, 0, deleted);
      touchMemo(memo);
      renderAll(deleted.id, preferredFocusField(deleted.type));
      scheduleSave();
    });
  }

  function moveBlock(blockId, delta) {
    const memo = activeMemo();
    const index = blockIndex(blockId);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= memo.blocks.length) return;
    const [block] = memo.blocks.splice(index, 1);
    memo.blocks.splice(nextIndex, 0, block);
    touchMemo(memo);
    renderAll(block.id, preferredFocusField(block.type));
    scheduleSave();
  }

  function addTableRow(blockId) {
    const block = blockById(blockId);
    if (!block || block.type !== 'table') return;
    const rows = normalizeTableRows(block.rows);
    const width = Math.max(1, rows[0]?.length || 3);
    rows.push(Array.from({ length: width }, () => ''));
    block.rows = rows;
    touchMemo(activeMemo());
    renderAll(block.id);
    scheduleSave();
  }

  function addTableColumn(blockId) {
    const block = blockById(blockId);
    if (!block || block.type !== 'table') return;
    const rows = normalizeTableRows(block.rows);
    const nextRows = (rows.length ? rows : defaultTableRows()).map((row) => [...row, '']);
    block.rows = nextRows;
    touchMemo(activeMemo());
    renderAll(block.id);
    scheduleSave();
  }

  function addMemo() {
    const memo = createMemo('새 메모');
    memo.blocks = [createBlock('p')];
    state.memos.push(memo);
    state.activeId = memo.id;
    renderAll(memo.blocks[0].id);
    scheduleSave();
    showToast('새 메모를 만들었습니다.');
  }

  function removeMemo(memoId) {
    const memo = state.memos.find((item) => item.id === memoId);
    const title = memo ? displayTitle(memo) : '메모';
    const removed = memo ? cloneData(memo) : null;
    if (state.memos.length === 1) {
      state.memos[0] = createMemo('새 메모');
      state.activeId = state.memos[0].id;
      renderAll(state.memos[0].blocks[0].id);
      scheduleSave();
      showUndoToast('마지막 메모를 비우고 새 메모를 만들었습니다.', () => {
        if (!removed) return;
        state.memos[0] = removed;
        state.activeId = removed.id;
        renderAll();
        scheduleSave();
      });
      return;
    }

    const index = state.memos.findIndex((item) => item.id === memoId);
    if (index < 0) return;
    state.memos.splice(index, 1);
    if (state.activeId === memoId) {
      state.activeId = (state.memos[index] || state.memos[index - 1] || state.memos[0]).id;
    }
    renderAll();
    scheduleSave();
    showUndoToast(`“${title}” 탭을 닫았습니다.`, () => {
      if (!removed) return;
      state.memos.splice(index, 0, removed);
      state.activeId = removed.id;
      renderAll();
      scheduleSave();
    });
  }

  function selectMemo(memoId) {
    if (state.activeId === memoId) return;
    state.activeId = memoId;
    renderAll();
    closeSidebarPanel();
    scheduleSave();
  }

  function touchMemo(memo) {
    memo.updatedAt = Date.now();
  }

  function toggleActiveMemoFlag(flag) {
    const memo = activeMemo();
    memo[flag] = !memo[flag];
    touchMemo(memo);
    if (flag === 'archived' && memo.archived) showArchived = false;
    renderAll();
    scheduleSave();
    showToast(flag === 'pinned'
      ? (memo.pinned ? '메모를 상단에 고정했습니다.' : '메모 고정을 해제했습니다.')
      : (memo.archived ? '메모를 보관했습니다.' : '메모를 보관함에서 꺼냈습니다.'));
  }

  function updateActiveTags() {
    const memo = activeMemo();
    memo.tags = core.normalizeTags(els.tagInput.value);
    touchMemo(memo);
    renderMemoList();
    renderMemoMeta();
    scheduleSave();
    showToast(memo.tags.length ? '태그를 저장했습니다.' : '태그를 비웠습니다.');
  }

  function deleteActiveMemo() {
    const memo = activeMemo();
    if (!memo) return;
    removeMemo(memo.id);
  }

  function toggleSidebar() {
    if (isMobileSidebar()) {
      if (els.app.classList.contains('sidebar-open')) closeSidebarPanel();
      else openSidebarPanel();
      return;
    }

    if (els.app.classList.contains('sidebar-collapsed')) expandSidebar();
    else collapseSidebar();
  }

  function collapseSidebar() {
    closeSidebarPanel();
    els.app.classList.add('sidebar-collapsed');
    updateSidebarToggleState();
  }

  function expandSidebar() {
    els.app.classList.remove('sidebar-collapsed');
    updateSidebarToggleState();
  }

  function openSidebarPanel() {
    els.app.classList.remove('sidebar-collapsed');
    els.app.classList.add('sidebar-open');
    els.sidebarBackdrop.hidden = false;
    document.body.classList.add('no-scroll');
    updateSidebarToggleState();
    requestAnimationFrame(() => els.searchInput.focus());
  }

  function closeSidebarPanel() {
    els.app.classList.remove('sidebar-open');
    els.sidebarBackdrop.hidden = true;
    document.body.classList.remove('no-scroll');
    updateSidebarToggleState();
  }

  function handleViewportChange() {
    if (!isMobileSidebar()) closeSidebarPanel();
    updateSidebarToggleState();
  }

  function isMobileSidebar() {
    return window.matchMedia('(max-width: 640px)').matches;
  }

  function updateSidebarToggleState() {
    const collapsed = els.app.classList.contains('sidebar-collapsed');
    const open = els.app.classList.contains('sidebar-open');
    const active = isMobileSidebar() ? open : !collapsed;
    els.sidebarToggleBtn.setAttribute('aria-pressed', String(active));
    els.sidebarToggleBtn.title = active ? '사이드패널 닫기' : '사이드패널 열기';
    els.sidebarToggleBtn.setAttribute('aria-label', els.sidebarToggleBtn.title);
  }

  function toggleMobileToolbar() {
    els.app.classList.toggle('mobile-toolbar-open');
    if (els.app.classList.contains('mobile-toolbar-open')) {
      document.querySelector('.editor-toolbar')?.scrollIntoView({ block: 'nearest' });
    }
  }

  function maybeOpenSlashMenu(target, blockId, field) {
    if (field !== 'html') {
      closeSlashMenu();
      return;
    }

    const before = textBeforeCaret(target);
    const match = before.match(/(?:^|\s)\/([^\n]*)$/);
    if (!match) {
      closeSlashMenu();
      return;
    }

    const query = match[1].trimStart();
    slashState.query = query;
    slashState.blockId = blockId;
    slashState.field = field;
    slashState.target = target;
    slashState.selectedIndex = 0;
    slashState.matches = matchCommands(query);

    if (slashState.matches.length === 0) {
      closeSlashMenu();
      return;
    }

    renderSlashMenu();
    positionSlashMenu(target);
    slashState.open = true;
    els.slashMenu.classList.add('open');
  }

  function matchCommands(query) {
    const normalizedQuery = normalizeCommandText(query);
    if (!normalizedQuery) return commands;
    return commands.filter((command) => {
      return command.search.some((term) => term.includes(normalizedQuery));
    });
  }

  function renderSlashMenu() {
    const groups = [];
    for (const command of slashState.matches) {
      let group = groups.find((item) => item.name === command.group);
      if (!group) {
        group = { name: command.group, items: [] };
        groups.push(group);
      }
      group.items.push(command);
    }

    let itemIndex = -1;
    els.slashMenu.innerHTML = groups.map((group) => {
      const items = group.items.map((command) => {
        itemIndex += 1;
        return `
          <button class="command-item ${itemIndex === slashState.selectedIndex ? 'active' : ''}" type="button" role="option" data-command-id="${escapeAttr(command.id)}" aria-selected="${itemIndex === slashState.selectedIndex}">
            <span class="command-icon">${escapeHtml(command.icon)}</span>
            <span>
              <span class="command-name">${escapeHtml(command.label)}</span>
              <span class="command-desc">${escapeHtml(command.description)}</span>
            </span>
          </button>`;
      }).join('');
      return `<div class="command-group-label">${escapeHtml(group.name)}</div>${items}`;
    }).join('');

    els.slashMenu.querySelectorAll('[data-command-id]').forEach((button) => {
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => {
        const command = commands.find((item) => item.id === button.dataset.commandId);
        if (command) executeSlashCommand(command);
      });
    });
  }

  function positionSlashMenu(target) {
    const rect = target.getBoundingClientRect();
    const menuHeight = Math.min(els.slashMenu.scrollHeight || 520, window.innerHeight - 24);
    const belowTop = rect.bottom + 8;
    const aboveTop = rect.top - menuHeight - 8;
    const hasRoomBelow = belowTop + Math.min(menuHeight, 360) <= window.innerHeight - 12;
    const top = hasRoomBelow ? belowTop : Math.max(12, aboveTop);
    const left = Math.min(rect.left, window.innerWidth - 432);
    els.slashMenu.style.top = `${Math.max(12, top)}px`;
    els.slashMenu.style.left = `${Math.max(12, left)}px`;
    els.slashMenu.style.maxHeight = `${Math.max(260, window.innerHeight - Math.max(12, top) - 12)}px`;
  }

  function handleSlashKeydown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      slashState.selectedIndex = (slashState.selectedIndex + 1) % slashState.matches.length;
      renderSlashMenu();
      return true;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      slashState.selectedIndex = (slashState.selectedIndex - 1 + slashState.matches.length) % slashState.matches.length;
      renderSlashMenu();
      return true;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const command = slashState.matches[slashState.selectedIndex];
      if (command) executeSlashCommand(command);
      return true;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSlashMenu();
      return true;
    }
    return false;
  }

  async function executeSlashCommand(command) {
    const block = blockById(slashState.blockId);
    const target = slashState.target;
    if (!block || !target) return closeSlashMenu();

    removeSlashTokenFromBlock(block, target, slashState.query);
    closeSlashMenu();

    if (command.kind === 'type') {
      block.type = command.type;
      if (command.type === 'divider') block.html = '';
      if (command.type === 'todo') block.checked = false;
      if (command.type === 'toggle') block.open = true;
      if (command.type === 'table') {
        block.html = '';
        block.rows = defaultTableRows();
      }
      touchMemo(activeMemo());
      renderAll(block.id, preferredFocusField(block.type));
      scheduleSave();
      return;
    }

    if (command.kind === 'color') {
      block.color = command.color;
      touchMemo(activeMemo());
      renderAll(block.id);
      scheduleSave();
      return;
    }

    if (command.kind === 'background') {
      block.bg = command.color;
      touchMemo(activeMemo());
      renderAll(block.id);
      scheduleSave();
      return;
    }

    if (command.kind === 'resetColor') {
      block.color = '';
      block.bg = '';
      touchMemo(activeMemo());
      renderAll(block.id);
      scheduleSave();
      return;
    }

    if (command.kind === 'image') {
      const url = await requestUrl({
        title: '이미지 URL',
        hint: 'https로 시작하는 이미지 주소를 입력하세요. 클립보드 이미지는 편집기에 바로 붙여넣을 수도 있습니다.'
      });
      if (!url) {
        renderAll(block.id);
        return;
      }
      block.type = 'image';
      block.src = safeUrl(url);
      block.captionHtml = block.html || '';
      block.html = '';
      touchMemo(activeMemo());
      renderAll(block.id, 'captionHtml');
      scheduleSave();
      return;
    }

    if (command.kind === 'video') {
      const url = await requestUrl({
        title: '동영상 URL',
        hint: 'YouTube, Vimeo, mp4/webm 또는 임베드 URL을 입력하세요.'
      });
      if (!url) {
        renderAll(block.id);
        return;
      }
      block.type = 'video';
      block.src = safeUrl(url);
      block.captionHtml = block.html || '';
      block.html = '';
      touchMemo(activeMemo());
      renderAll(block.id, 'captionHtml');
      scheduleSave();
      return;
    }

    if (command.kind === 'bookmark') {
      const url = await requestUrl({
        title: '북마크 URL',
        hint: '저장할 웹 페이지 주소를 입력하세요.'
      });
      if (!url) {
        renderAll(block.id);
        return;
      }
      const cleanUrl = safeUrl(url);
      block.type = 'bookmark';
      block.src = cleanUrl;
      block.html = block.html || escapeHtml(hostFromUrl(cleanUrl) || '북마크');
      touchMemo(activeMemo());
      renderAll(block.id, 'html');
      scheduleSave();
      return;
    }

    if (command.kind === 'duplicate') {
      renderAll(block.id);
      duplicateBlock(block.id);
      return;
    }

    if (command.kind === 'delete') {
      deleteBlock(block.id);
      return;
    }
  }

  function removeSlashTokenFromBlock(block, target, query) {
    const text = target.textContent || '';
    const slashIndex = text.lastIndexOf('/');
    if (slashIndex >= 0) {
      const nextText = text.slice(0, slashIndex).trimEnd();
      block.html = escapeHtml(nextText);
    } else {
      block.html = sanitizeInlineHtml(target.innerHTML).replace(/\/?[^/]*$/, '');
    }
  }

  function closeSlashMenu() {
    slashState.open = false;
    slashState.query = '';
    slashState.matches = [];
    els.slashMenu.classList.remove('open');
    els.slashMenu.innerHTML = '';
  }

  function requestUrl({ title, hint }) {
    return new Promise((resolve) => {
      pendingUrlRequest = { resolve };
      els.urlDialogTitle.textContent = title;
      els.urlDialogHint.textContent = hint;
      els.urlInput.value = '';
      els.urlDialog.showModal();
      requestAnimationFrame(() => els.urlInput.focus());
    });
  }

  function handleUrlDialogSubmit(event) {
    event.preventDefault();
    const submitter = event.submitter;
    if (!submitter || submitter.value === 'cancel') {
      resolveUrlDialog('');
      return;
    }

    const url = safeUrl(els.urlInput.value);
    if (!url) {
      showToast('http 또는 https URL을 입력하세요.');
      els.urlInput.focus();
      return;
    }
    resolveUrlDialog(url);
  }

  function resolveUrlDialog(value) {
    const request = pendingUrlRequest;
    pendingUrlRequest = null;
    if (els.urlDialog.open) els.urlDialog.close();
    if (request) request.resolve(value);
  }

  function buildCommands() {
    const base = [
      command('text', '기본', '¶', '텍스트', '일반 문단으로 전환', ['text', '텍스트', '문단', 'paragraph', 'p', 'turn text'], { kind: 'type', type: 'p' }),
      command('h1', '기본', 'H1', '제목 1', '큰 제목 블록', ['h1', 'heading1', '제목1', '큰제목', 'turnh1', 'turn heading 1'], { kind: 'type', type: 'h1' }),
      command('h2', '기본', 'H2', '제목 2', '중간 제목 블록', ['h2', 'heading2', '제목2', '소제목', 'turnh2', 'turn heading 2'], { kind: 'type', type: 'h2' }),
      command('h3', '기본', 'H3', '제목 3', '작은 제목 블록', ['h3', 'heading3', '제목3', 'turnh3', 'turn heading 3'], { kind: 'type', type: 'h3' }),
      command('bullet', '기본', '•', '글머리 목록', '불릿 리스트', ['bullet', 'bulleted', '글머리', '불릿', '목록', 'turnbullet'], { kind: 'type', type: 'bullet' }),
      command('number', '기본', '1.', '번호 목록', '순서 있는 리스트', ['num', 'number', 'numbered', '번호', '숫자', '순서', 'turnnumber'], { kind: 'type', type: 'number' }),
      command('todo', '기본', '☑', '체크박스', '할 일 리스트', ['todo', 'to-do', 'checkbox', 'check', '체크', '체크박스', '할일', '투두', 'turntodo'], { kind: 'type', type: 'todo' }),
      command('toggle', '기본', '▸', '토글', '접고 펼치는 토글 블록', ['toggle', '토글', '접기', '펼치기', 'turntoggle'], { kind: 'type', type: 'toggle' }),
      command('quote', '기본', '❝', '인용', '인용문 블록', ['quote', '인용', '인용문', 'blockquote', 'turnquote'], { kind: 'type', type: 'quote' }),
      command('code', '기본', '{}', '코드', '코드 블록', ['code', '코드', '코드블록', 'snippet', 'turncode'], { kind: 'type', type: 'code' }),
      command('divider', '기본', '—', '구분선', '가로 구분선', ['div', 'divider', 'hr', '구분선', '라인', '선'], { kind: 'type', type: 'divider' }),
      command('table', '기본', '표', '표', 'Markdown 호환 표 블록', ['table', '표', '테이블', 'markdown table', 'turntable'], { kind: 'type', type: 'table' }),
      command('image', '미디어', '🖼', '이미지', '이미지 URL 또는 붙여넣기', ['image', 'img', 'picture', '이미지', '사진', '그림'], { kind: 'image' }),
      command('video', '미디어', '▶', '동영상', 'YouTube, Vimeo, 파일 URL 삽입', ['video', 'youtube', 'vimeo', 'embed', '동영상', '영상', '유튜브', '임베드'], { kind: 'video' }),
      command('bookmark', '미디어', '🔗', '북마크', 'URL 카드 만들기', ['bookmark', 'book', 'web', 'link', 'url', '북마크', '웹', '링크'], { kind: 'bookmark' }),
      command('duplicate', '작업', '⧉', '복제', '현재 블록 복제', ['duplicate', 'copy', '복제', '복사'], { kind: 'duplicate' }),
      command('delete', '작업', '⌫', '삭제', '현재 블록 삭제', ['delete', 'remove', 'del', '삭제', '지우기'], { kind: 'delete' }),
      command('default-color', '색', '⌧', '기본 색상', '블록 글자색과 배경색 제거', ['default', '기본', '기본색', '색제거', 'color default'], { kind: 'resetColor' })
    ];

    const colorCommands = Object.entries(colorAliases).flatMap(([color, aliases]) => {
      return [
        command(`color-${color}`, '색', '●', `${aliases[2] || color} 글자색`, '블록 글자색 변경', [...aliases, `${color} color`, `${aliases[2] || color} 글자색`, 'color'], { kind: 'color', color }),
        command(`bg-${color}`, '색', '▰', `${aliases[2] || color} 배경`, '블록 배경색 변경', aliases.flatMap((alias) => [`${alias} background`, `${alias} bg`, `${alias} 배경`, `${alias} 하이라이트`]), { kind: 'background', color })
      ];
    });

    return [...base, ...colorCommands];
  }

  function command(id, group, icon, label, description, aliases, payload) {
    const search = [id, label, description, ...aliases].map(normalizeCommandText);
    return { id, group, icon, label, description, aliases, search, ...payload };
  }

  function normalizeCommandText(value) {
    return String(value || '').toLowerCase().replace(/^\//, '').replace(/\s+/g, ' ').trim();
  }

  function focusBlock(blockId, field = 'html', position = 'end') {
    requestAnimationFrame(() => {
      const selector = `[data-block-id="${cssEscape(blockId)}"] [data-field="${cssEscape(field)}"]`;
      const target = els.editor.querySelector(selector) || els.editor.querySelector(`[data-block-id="${cssEscape(blockId)}"] [contenteditable]`);
      if (target) {
        target.focus({ preventScroll: false });
        if (position === 'start') placeCaretAtStart(target);
        else placeCaretAtEnd(target);
      }
    });
  }

  function placeCaretAtStart(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function placeCaretAtEnd(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function isCaretAtStart(element) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    if (!element.contains(range.startContainer)) return false;
    const preRange = range.cloneRange();
    preRange.selectNodeContents(element);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length === 0;
  }

  function isPlainMarkerCandidate(element) {
    const text = element.textContent;
    if (!text) return false;
    if (!isCaretAtEnd(element)) return false;
    if (element.querySelector('*')) return false;
    return true;
  }

  function isCaretAtEnd(element) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    if (!element.contains(range.endContainer)) return false;
    const postRange = range.cloneRange();
    postRange.selectNodeContents(element);
    postRange.setStart(range.endContainer, range.endOffset);
    return postRange.toString().length === 0;
  }

  function textBeforeCaret(element) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return element.textContent || '';
    const range = selection.getRangeAt(0).cloneRange();
    if (!element.contains(range.endContainer)) return element.textContent || '';
    range.selectNodeContents(element);
    range.setEnd(selection.getRangeAt(0).endContainer, selection.getRangeAt(0).endOffset);
    return range.toString();
  }

  function handleArrowNavigation(event, block, target) {
    const memo = activeMemo();
    const index = blockIndex(block.id);
    if (index < 0 || !isEditableNavigationTarget(target)) return false;

    if (event.key === 'ArrowUp') {
      if (!isCaretOnFirstVisualLine(target)) return false;
      const previous = memo.blocks[index - 1];
      if (!previous) return false;
      event.preventDefault();
      focusBlock(previous.id, preferredFocusField(previous.type), 'end');
      return true;
    }

    if (event.key === 'ArrowDown') {
      if (!isCaretOnLastVisualLine(target)) return false;
      const next = memo.blocks[index + 1];
      if (!next) return false;
      event.preventDefault();
      focusBlock(next.id, preferredFocusField(next.type), 'start');
      return true;
    }

    return false;
  }

  function isEditableNavigationTarget(target) {
    return target && target.isContentEditable && target.dataset.field !== 'detailHtml';
  }

  function isCaretOnFirstVisualLine(element) {
    if (isCaretAtStart(element) || element.textContent.trim() === '') return true;
    const caret = caretClientRect();
    if (!caret) return false;
    const rect = element.getBoundingClientRect();
    const lineHeight = getLineHeight(element);
    return caret.top <= rect.top + lineHeight * 0.75;
  }

  function isCaretOnLastVisualLine(element) {
    if (isCaretAtEnd(element) || element.textContent.trim() === '') return true;
    const caret = caretClientRect();
    if (!caret) return false;
    const rect = element.getBoundingClientRect();
    const lineHeight = getLineHeight(element);
    return caret.bottom >= rect.bottom - lineHeight * 0.75;
  }

  function caretClientRect() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
    const range = selection.getRangeAt(0).cloneRange();
    let rect = range.getBoundingClientRect();
    if (rect && (rect.width || rect.height)) return rect;

    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    range.insertNode(marker);
    rect = marker.getBoundingClientRect();
    const parent = marker.parentNode;
    const next = marker.nextSibling;
    marker.remove();

    const restoreRange = document.createRange();
    if (next && parent) restoreRange.setStartBefore(next);
    else if (parent) restoreRange.setStart(parent, parent.childNodes.length);
    else return rect;
    restoreRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(restoreRange);
    return rect;
  }

  function getLineHeight(element) {
    const style = window.getComputedStyle(element);
    const parsed = parseFloat(style.lineHeight);
    if (Number.isFinite(parsed)) return parsed;
    const fontSize = parseFloat(style.fontSize);
    return Number.isFinite(fontSize) ? fontSize * 1.4 : 22;
  }

  function selectWholeEditor() {
    const range = document.createRange();
    range.selectNodeContents(els.editor);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    editorWideSelection = true;
    hideSelectionToolbar();
  }

  function handleEditorCopy(event) {
    if (!editorWideSelection) return;
    event.preventDefault();
    const memo = activeMemo();
    event.clipboardData.setData('text/plain', memoToPlainText(memo));
    event.clipboardData.setData('text/markdown', memoToMarkdown(memo));
    showToast('현재 메모 전체를 복사했습니다.');
  }

  function handleSelectionChange() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      hideSelectionToolbar();
      editorWideSelection = false;
      return;
    }

    const range = selection.getRangeAt(0);
    const inEditor = rangeIntersectsEditor(range);
    if (!inEditor) {
      hideSelectionToolbar();
      editorWideSelection = false;
      return;
    }

    savedSelection = range.cloneRange();
    if (selection.isCollapsed) {
      hideSelectionToolbar();
      editorWideSelection = false;
      return;
    }

    if (editorWideSelection && range.commonAncestorContainer === els.editor) {
      hideSelectionToolbar();
      return;
    }

    editorWideSelection = false;
    positionSelectionToolbar(range);
  }

  function rangeIntersectsEditor(range) {
    return nodeInsideEditor(range.startContainer) || nodeInsideEditor(range.endContainer) || nodeInsideEditor(range.commonAncestorContainer);
  }

  function nodeInsideEditor(node) {
    if (!node) return false;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return Boolean(element && els.editor.contains(element));
  }

  function positionSelectionToolbar(range) {
    if (!els.selectionToolbar) return;
    const rect = firstUsefulRect(range);
    if (!rect) {
      hideSelectionToolbar();
      return;
    }

    els.selectionToolbar.hidden = false;
    const toolbarRect = els.selectionToolbar.getBoundingClientRect();
    const top = rect.top - toolbarRect.height - 8;
    const fallbackTop = rect.bottom + 8;
    const left = rect.left + (rect.width / 2) - (toolbarRect.width / 2);
    els.selectionToolbar.style.top = `${Math.max(8, top > 8 ? top : fallbackTop)}px`;
    els.selectionToolbar.style.left = `${clamp(left, 8, window.innerWidth - toolbarRect.width - 8)}px`;
  }

  function firstUsefulRect(range) {
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width || rect.height);
    if (rects.length) return rects[0];
    const rect = range.getBoundingClientRect();
    return rect && (rect.width || rect.height) ? rect : null;
  }

  function hideSelectionToolbar() {
    if (!els.selectionToolbar) return;
    els.selectionToolbar.hidden = true;
  }

  function rememberSelectionBeforeControl() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount && els.editor.contains(selection.anchorNode)) {
      savedSelection = selection.getRangeAt(0).cloneRange();
    }
  }

  function restoreSavedSelection() {
    if (!savedSelection) return false;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedSelection);
    return true;
  }

  async function applyInlineCommand(commandName) {
    if (commandName === 'link') rememberSelectionBeforeControl();
    restoreSavedSelection();
    if (commandName === 'link') {
      const url = await requestUrl({
        title: '링크 URL',
        hint: '선택한 텍스트에 연결할 주소를 입력하세요.'
      });
      if (!url) return;
      restoreSavedSelection();
      document.execCommand('createLink', false, safeUrl(url));
      setCreatedLinksSafe();
    } else if (commandName === 'code') {
      wrapSelectionWithCode();
    } else {
      document.execCommand(commandName, false, null);
    }
    normalizeGeneratedFontTags();
    syncDomToState();
    scheduleSave();
  }

  function applyFontFamily(fontFamily) {
    restoreSavedSelection();
    if (!fontFamily) document.execCommand('removeFormat', false, null);
    else document.execCommand('fontName', false, fontFamily);
    normalizeGeneratedFontTags();
    syncDomToState();
    scheduleSave();
  }

  function applyFontSize(size) {
    restoreSavedSelection();
    if (!size) document.execCommand('removeFormat', false, null);
    else document.execCommand('fontSize', false, size);
    normalizeGeneratedFontTags();
    syncDomToState();
    scheduleSave();
  }

  function applyTextColor(color) {
    restoreSavedSelection();
    if (!color) document.execCommand('removeFormat', false, null);
    else document.execCommand('foreColor', false, color);
    normalizeGeneratedFontTags();
    syncDomToState();
    scheduleSave();
  }

  function applyBgColor(color) {
    restoreSavedSelection();
    if (!color) document.execCommand('removeFormat', false, null);
    else document.execCommand('hiliteColor', false, color);
    normalizeGeneratedFontTags();
    syncDomToState();
    scheduleSave();
  }

  function normalizeGeneratedFontTags() {
    els.editor.querySelectorAll('font').forEach((font) => {
      font.replaceWith(fontElementToSpan(font));
    });
  }

  function fontElementToSpan(font) {
    const span = document.createElement('span');
    const styles = [];
    const color = font.getAttribute('color');
    const face = font.getAttribute('face');
    const size = font.getAttribute('size');
    if (color && (/^#[0-9a-f]{3,8}$/i.test(color) || /^rgba?\([0-9.,\s]+\)$/i.test(color))) styles.push(`color:${color}`);
    const family = normalizeFontFamily(face);
    if (family) styles.push(`font-family:${family}`);
    const fontSize = legacyFontSizeToCss(size);
    if (fontSize) styles.push(`font-size:${fontSize}`);
    const style = sanitizeStyle(styles.join(';'));
    if (style) span.setAttribute('style', style);
    while (font.firstChild) span.appendChild(font.firstChild);
    return span;
  }

  function wrapSelectionWithCode() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const text = range.toString();
    if (!text) return;
    const code = document.createElement('code');
    code.textContent = text;
    range.deleteContents();
    range.insertNode(code);
    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(code);
    selection.addRange(newRange);
  }

  function setCreatedLinksSafe() {
    els.editor.querySelectorAll('a').forEach((link) => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
  }

  function syncDomToState() {
    els.editor.querySelectorAll('[data-block-id]').forEach((blockEl) => {
      const block = blockById(blockEl.dataset.blockId);
      if (!block) return;
      if (block.type === 'table') {
        syncTableBlockFromElement(block, blockEl);
        return;
      }
      blockEl.querySelectorAll('[contenteditable][data-field]').forEach((fieldEl) => {
        const field = fieldEl.dataset.field;
        if (block.type === 'code' && field === 'html') block[field] = escapeHtml(fieldEl.innerText.replace(/\u00a0/g, ' '));
        else block[field] = sanitizeInlineHtml(fieldEl.innerHTML);
      });
    });
    touchMemo(activeMemo());
    renderTabs();
    renderMemoList();
  }

  function syncTableBlockFromElement(block, blockEl) {
    const rows = [];
    blockEl.querySelectorAll('[data-table-cell]').forEach((cell) => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      if (!Array.isArray(rows[row])) rows[row] = [];
      rows[row][col] = sanitizeInlineHtml(cell.innerHTML);
    });
    block.rows = normalizeTableRows(rows);
  }

  function copyCurrent(mode) {
    const memo = activeMemo();
    const text = mode === 'markdown' ? memoToMarkdown(memo) : memoToPlainText(memo);
    copyToClipboard(text).then(() => {
      showToast(mode === 'markdown' ? '현재 메모를 Markdown으로 복사했습니다.' : '현재 메모를 일반 텍스트로 복사했습니다.');
    }).catch(() => {
      showToast('클립보드 복사에 실패했습니다. 브라우저 권한을 확인하세요.');
    });
  }

  function downloadCurrentMarkdown() {
    persistState(true);
    const memo = activeMemo();
    const blob = new Blob([memoToMarkdown(memo)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFilename(displayTitle(memo)) || 'memo'}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Markdown 파일을 저장했습니다.');
  }

  function importMarkdownFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = core.parseMarkdownDocument(reader.result);
        const memo = createMemo(parsed.title);
        memo.blocks = parsed.blocks.map((block) => createBlock(block.type, block));
        memo.tags = core.extractTags(reader.result);
        state.memos.push(memo);
        state.activeId = memo.id;
        renderAll(memo.blocks[0]?.id || null);
        scheduleSave();
        showToast('Markdown 파일을 새 메모로 가져왔습니다.');
      } catch (error) {
        console.error(error);
        showToast('Markdown 파일을 가져오지 못했습니다.');
      }
    };
    reader.readAsText(file);
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  function memoToPlainText(memo) {
    const lines = [];
    if (memo.title.trim()) lines.push(memo.title.trim(), '');
    let numberCounter = 0;
    let inNumberList = false;

    for (const block of memo.blocks) {
      if (block.type === 'number') {
        numberCounter = inNumberList ? numberCounter + 1 : 1;
        inNumberList = true;
      } else {
        inNumberList = false;
        numberCounter = 0;
      }
      const indent = '  '.repeat(block.indent || 0);
      const text = htmlToPlainText(block.html).trim();
      const caption = htmlToPlainText(block.captionHtml).trim();
      const detail = htmlToPlainText(block.detailHtml).trim();

      switch (block.type) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'p':
          if (text) lines.push(indent + text);
          break;
        case 'bullet':
          lines.push(indent + '• ' + text);
          break;
        case 'number':
          lines.push(indent + `${numberCounter}. ${text}`);
          break;
        case 'todo':
          lines.push(indent + `${block.checked ? '☑' : '☐'} ${text}`);
          break;
        case 'toggle':
          lines.push(indent + `▸ ${text}`);
          if (detail) lines.push(indent + '  ' + detail.replace(/\n/g, `\n${indent}  `));
          break;
        case 'quote':
          lines.push(indent + `“${text}”`);
          break;
        case 'code':
          lines.push(indent + htmlToPlainText(block.html));
          break;
        case 'divider':
          lines.push(indent + '────────');
          break;
        case 'image':
          lines.push(indent + `[이미지] ${caption || block.src}`);
          break;
        case 'video':
          lines.push(indent + `[동영상] ${caption || block.src}`);
          break;
        case 'bookmark':
          lines.push(indent + `${text || '북마크'} ${block.src}`.trim());
          break;
        case 'table':
          lines.push(...tableRowsToPlainText(block.rows, indent));
          break;
      }
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  }

  function memoToMarkdown(memo) {
    const lines = [];
    if (memo.title.trim()) lines.push(`# ${escapeMarkdownText(memo.title.trim())}`, '');
    let numberCounter = 0;
    let inNumberList = false;

    for (const block of memo.blocks) {
      if (block.type === 'number') {
        numberCounter = inNumberList ? numberCounter + 1 : 1;
        inNumberList = true;
      } else {
        inNumberList = false;
        numberCounter = 0;
      }
      const indent = '  '.repeat(block.indent || 0);
      const md = decorateMarkdown(inlineHtmlToMarkdown(block.html).trim(), block);
      const caption = inlineHtmlToMarkdown(block.captionHtml).trim();
      const detail = inlineHtmlToMarkdown(block.detailHtml).trim();

      switch (block.type) {
        case 'h1':
          lines.push(indent + `# ${md}`);
          break;
        case 'h2':
          lines.push(indent + `## ${md}`);
          break;
        case 'h3':
          lines.push(indent + `### ${md}`);
          break;
        case 'p':
          if (md) lines.push(indent + md);
          break;
        case 'bullet':
          lines.push(indent + `- ${md}`);
          break;
        case 'number':
          lines.push(indent + `${numberCounter}. ${md}`);
          break;
        case 'todo':
          lines.push(indent + `- [${block.checked ? 'x' : ' '}] ${md}`);
          break;
        case 'toggle':
          lines.push(indent + `> ${md || '토글'}`);
          if (detail) lines.push(indent + '> ', ...detail.split('\n').map((line) => indent + `> ${line}`));
          break;
        case 'quote':
          lines.push(...(md || '').split('\n').map((line) => indent + `> ${line}`));
          break;
        case 'code':
          lines.push(indent + '```', htmlToPlainText(block.html), indent + '```');
          break;
        case 'divider':
          lines.push(indent + '---');
          break;
        case 'image':
          lines.push(indent + `![${escapeMarkdownLinkText(caption || 'image')}](${block.src})`);
          break;
        case 'video':
          lines.push(indent + `[${escapeMarkdownLinkText(caption || 'video')}](${block.src})`);
          break;
        case 'bookmark':
          lines.push(indent + `[${escapeMarkdownLinkText(md || hostFromUrl(block.src) || 'bookmark')}](${block.src})`);
          break;
        case 'table':
          lines.push(...tableRowsToMarkdown(block.rows, indent));
          break;
      }
    }
    return lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trimEnd();
  }

  function decorateMarkdown(content, block) {
    return content;
  }

  function inlineHtmlToMarkdown(html) {
    const container = document.createElement('div');
    container.innerHTML = sanitizeInlineHtml(html || '');

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const tag = node.tagName.toLowerCase();
      const children = Array.from(node.childNodes).map(walk).join('');

      if (tag === 'br') return '\n';
      if (tag === 'strong' || tag === 'b') return `**${children}**`;
      if (tag === 'em' || tag === 'i') return `*${children}*`;
      if (tag === 'u') return `<u>${children}</u>`;
      if (tag === 's' || tag === 'strike') return `~~${children}~~`;
      if (tag === 'code') return '`' + node.textContent.replace(/`/g, '\\`') + '`';
      if (tag === 'a') {
        const href = safeUrl(node.getAttribute('href') || '');
        return href ? `[${children || href}](${href})` : children;
      }
      if (tag === 'span') {
        return children;
      }
      return children;
    };

    return Array.from(container.childNodes).map(walk).join('').replace(/\u00a0/g, ' ');
  }

  function tableRowsToMarkdown(rows, indent = '') {
    const normalized = normalizeTableRows(rows);
    if (!normalized.length) return [];
    const plainRows = normalized.map((row) => row.map((cell) => inlineHtmlToMarkdown(cell).replace(/\n/g, '<br>').trim()));
    const width = Math.max(1, ...plainRows.map((row) => row.length));
    const paddedRows = plainRows.map((row) => Array.from({ length: width }, (_item, index) => escapeMarkdownTableCell(row[index] || '')));
    const header = paddedRows[0];
    const body = paddedRows.slice(1);
    return [
      indent + `| ${header.join(' | ')} |`,
      indent + `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
      ...body.map((row) => indent + `| ${row.join(' | ')} |`)
    ];
  }

  function tableRowsToPlainText(rows, indent = '') {
    const normalized = normalizeTableRows(rows);
    if (!normalized.length) return [];
    return normalized.map((row) => indent + row.map((cell) => htmlToPlainText(cell)).join('\t'));
  }

  function escapeMarkdownTableCell(value) {
    return String(value || '').replace(/\|/g, '\\|');
  }

  function htmlToPlainText(html) {
    const container = document.createElement('div');
    container.innerHTML = sanitizeInlineHtml(html || '');
    return (container.innerText || container.textContent || '').replace(/\u00a0/g, ' ');
  }

  function blockToSearchText(block) {
    const tableText = block.type === 'table'
      ? normalizeTableRows(block.rows).flat().map((cell) => htmlToPlainText(cell)).join(' ')
      : '';
    return [htmlToPlainText(block.html), htmlToPlainText(block.detailHtml), htmlToPlainText(block.captionHtml), tableText, block.src || ''].join(' ');
  }

  function memoPreview(memo) {
    const text = memo.blocks.map(blockToSearchText).join(' ').replace(/\s+/g, ' ').trim();
    return text ? text.slice(0, MAX_SEARCH_PREVIEW) : '내용 없음';
  }

  function displayTitle(memo) {
    const title = (memo.title || '').trim();
    if (title) return title;
    const firstText = memo.blocks.map(blockToSearchText).find((text) => text.trim());
    return firstText ? firstText.trim().slice(0, 36) : '제목 없음';
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persistState(false), SAVE_DELAY);
  }

  async function updateStorageStatus() {
    if (!els.storageStatus) return;
    try {
      const fallbackUsage = core.estimateJsonBytes(state);
      let usage = fallbackUsage;
      let quota = 0;
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        usage = Number(estimate.usage) || fallbackUsage;
        quota = Number(estimate.quota) || 0;
      }
      const level = core.storageLevel(usage, quota);
      els.storageStatus.dataset.level = level;
      els.storageStatus.textContent = quota
        ? `${core.formatBytes(usage)} / ${core.formatBytes(quota)}`
        : `${core.formatBytes(usage)} 저장됨`;
    } catch (_error) {
      els.storageStatus.dataset.level = 'warn';
      els.storageStatus.textContent = `${core.formatBytes(core.estimateJsonBytes(state))} 저장됨`;
    }
  }

  function persistState(immediate) {
    if (saveTimer && immediate) clearTimeout(saveTimer);
    normalizeState();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateStorageStatus();
    } catch (error) {
      console.error('Could not save memo state:', error);
      if (els.storageStatus) {
        els.storageStatus.dataset.level = 'danger';
        els.storageStatus.textContent = '저장 실패';
      }
      showToast('저장 공간이 부족하거나 브라우저 저장소 접근이 제한되었습니다.');
    }
  }

  function downloadBackup() {
    persistState(true);
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `local-memo-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('백업 파일을 다운로드했습니다.');
  }

  function restoreBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = JSON.parse(reader.result);
        if (!next || !Array.isArray(next.memos)) throw new Error('Invalid backup');
        state = next;
        normalizeState();
        persistState(true);
        renderAll();
        showToast('백업에서 복원했습니다.');
      } catch (error) {
        console.error(error);
        showToast('복원할 수 없는 백업 파일입니다.');
      }
    };
    reader.readAsText(file);
  }

  function cycleTheme() {
    const order = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(state.theme) + 1) % order.length];
    state.theme = next;
    applyTheme();
    scheduleSave();
    showToast(next === 'system' ? '시스템 테마를 사용합니다.' : next === 'dark' ? '다크 테마를 사용합니다.' : '라이트 테마를 사용합니다.');
  }

  function applyTheme() {
    const theme = state.theme || 'system';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const actual = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
    els.root.dataset.theme = actual;
    els.themeBtn.textContent = theme === 'system' ? '◐' : theme === 'dark' ? '☾' : '☼';
    els.themeBtn.title = `테마: ${theme}`;
  }

  function showToast(message, options = {}) {
    clearTimeout(toastTimer);
    els.toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    if (options.actionLabel && typeof options.onAction === 'function') {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = options.actionLabel;
      button.addEventListener('click', () => {
        clearTimeout(toastTimer);
        els.toast.classList.remove('show');
        options.onAction();
      }, { once: true });
      els.toast.appendChild(button);
    }
    els.toast.classList.add('show');
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), options.duration || 3200);
  }

  function showUndoToast(message, restore) {
    undoSnapshot = restore;
    showToast(message, {
      actionLabel: '되돌리기',
      duration: 6000,
      onAction: () => {
        const restoreSnapshot = undoSnapshot;
        undoSnapshot = null;
        if (restoreSnapshot) restoreSnapshot();
        showToast('삭제를 되돌렸습니다.');
      }
    });
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(raw)) return raw;
    try {
      const url = new URL(raw, window.location.href);
      if (['http:', 'https:', 'blob:'].includes(url.protocol)) return url.href;
    } catch (_error) {
      return '';
    }
    return '';
  }

  function toEmbedUrl(src) {
    const url = safeUrl(src);
    if (!url) return { type: 'iframe', url: '' };
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') {
        const id = parsed.pathname.split('/').filter(Boolean)[0];
        return { type: 'iframe', url: `https://www.youtube.com/embed/${id}` };
      }
      if (host.endsWith('youtube.com')) {
        const id = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
        if (id) return { type: 'iframe', url: `https://www.youtube.com/embed/${id}` };
      }
      if (host.endsWith('vimeo.com')) {
        const id = parsed.pathname.split('/').filter(Boolean).pop();
        if (id) return { type: 'iframe', url: `https://player.vimeo.com/video/${id}` };
      }
      if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(parsed.pathname)) return { type: 'video', url };
      return { type: 'iframe', url };
    } catch (_error) {
      return { type: 'iframe', url: '' };
    }
  }

  function hostFromUrl(src) {
    try {
      return new URL(src).hostname.replace(/^www\./, '');
    } catch (_error) {
      return '';
    }
  }

  function sanitizeInlineHtml(html) {
    const container = document.createElement('div');
    container.innerHTML = String(html || '');
    const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'CODE', 'A', 'SPAN', 'BR']);

    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.tagName === 'FONT') {
            const span = fontElementToSpan(child);
            child.replaceWith(span);
            sanitizeElement(span);
            walk(span);
            return;
          }
          if (!allowed.has(child.tagName)) {
            walk(child);
            const fragment = document.createDocumentFragment();
            while (child.firstChild) fragment.appendChild(child.firstChild);
            child.replaceWith(fragment);
          } else {
            sanitizeElement(child);
            walk(child);
          }
        } else if (child.nodeType !== Node.TEXT_NODE) {
          child.remove();
        }
      });
    };

    walk(container);
    return container.innerHTML;
  }

  function sanitizeElement(element) {
    const originalHref = element.getAttribute('href') || '';
    const originalStyle = element.getAttribute('style') || '';
    Array.from(element.attributes).forEach((attr) => element.removeAttribute(attr.name));
    const tag = element.tagName;
    if (tag === 'A') {
      const href = safeUrl(originalHref);
      if (href) {
        element.setAttribute('href', href);
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer');
      }
    }
    if (tag === 'SPAN') {
      const style = sanitizeStyle(originalStyle);
      if (style) element.setAttribute('style', style);
    }
  }

  function sanitizeStyle(style) {
    const allowed = [];
    const declarations = String(style || '').split(';');
    for (const declaration of declarations) {
      const colonIndex = declaration.indexOf(':');
      if (colonIndex < 0) continue;
      const propertyRaw = declaration.slice(0, colonIndex);
      const valueRaw = declaration.slice(colonIndex + 1);
      if (!propertyRaw || !valueRaw) continue;
      const property = propertyRaw.trim().toLowerCase();
      const value = valueRaw.trim();
      if (['color', 'background-color'].includes(property) && (/^#[0-9a-f]{3,8}$/i.test(value) || /^rgba?\([0-9.,\s]+\)$/i.test(value))) {
        allowed.push(`${property}:${value}`);
        continue;
      }
      if (property === 'font-family') {
        const family = normalizeFontFamily(value);
        if (family) allowed.push(`font-family:${family}`);
        continue;
      }
      if (property === 'font-size') {
        const normalizedSize = normalizeFontSize(value);
        if (normalizedSize) allowed.push(`font-size:${normalizedSize}`);
      }
    }
    return allowed.join(';');
  }

  function normalizeFontFamily(value) {
    const normalized = String(value || '').replace(/["']/g, '').toLowerCase().trim();
    if (!normalized) return '';
    if (normalized.includes('mono')) return 'monospace';
    if (normalized.includes('serif') && !normalized.includes('sans')) return 'serif';
    if (normalized.includes('sans') || normalized.includes('arial') || normalized.includes('helvetica')) return 'sans-serif';
    return '';
  }

  function normalizeFontSize(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (/^(0\.75|0\.875|1|1\.125|1\.25|1\.5|1\.75|2)(rem|em)$/.test(raw)) return raw;
    if (/^([8-9]|[1-2][0-9]|3[0-2])px$/.test(raw)) return raw;
    if (/^(75|80|90|100|110|120|125|150|175|200)%$/.test(raw)) return raw;
    return '';
  }

  function legacyFontSizeToCss(size) {
    const map = {
      1: '0.75em',
      2: '0.875em',
      3: '1em',
      4: '1.25em',
      5: '1.5em',
      6: '1.75em',
      7: '2em'
    };
    return map[String(size || '').trim()] || '';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function escapeMarkdownText(value) {
    return String(value || '').replace(/([\\`*_{}\[\]()#+\-.!>])/g, '\\$1');
  }

  function escapeMarkdownLinkText(value) {
    return String(value || '').replace(/\]/g, '\\]');
  }

  function safeFilename(value) {
    return String(value || '')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 80);
  }

  function clamp(number, min, max) {
    return Math.max(min, Math.min(max, number));
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }
})();
