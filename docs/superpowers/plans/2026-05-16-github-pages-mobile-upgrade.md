# GitHub Pages Mobile Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the static memo app for GitHub Pages hosting with stronger data safety, mobile-first controls, metadata organization, Markdown file workflows, and prompt-free URL entry.

**Architecture:** Keep the app as static files with no build step. Add `app-core.js` for pure, Node-testable helpers shared by the browser app and tests, while keeping DOM/editor orchestration in `app.js`.

**Tech Stack:** HTML, CSS, browser DOM APIs, localStorage, File API, Node 22 built-in test runner.

---

### Task 1: Testable Core Helpers

**Files:**
- Create: `app-core.js`
- Create: `tests/app-core.test.js`
- Modify: `index.html`

- [ ] Write Node tests for tag extraction, memo filtering, pinned sort order, Markdown import, and storage formatting.
- [ ] Run `node --test tests/app-core.test.js` and confirm failure because `app-core.js` does not exist.
- [ ] Implement `app-core.js` as a UMD-style helper exposed as `window.LocalMemoCore` and `module.exports`.
- [ ] Include `app-core.js` before `app.js` in `index.html`.
- [ ] Run `node --test tests/app-core.test.js` and confirm pass.

### Task 2: Memo Metadata and Search

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`

- [ ] Normalize each memo with `pinned`, `archived`, and `tags` fields.
- [ ] Add editor metadata controls for pin, archive, and tag entry.
- [ ] Use `LocalMemoCore.filterAndSortMemos()` for the sidebar list.
- [ ] Show pinned notes first and exclude archived notes unless archive view is active.
- [ ] Add search result highlighting in memo titles/previews.

### Task 3: Undo and Storage Safety

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`

- [ ] Add undo state for deleted blocks and removed memos.
- [ ] Replace destructive delete feedback with a toast action button.
- [ ] Add a storage status chip using `navigator.storage.estimate()` when available and a JSON-size fallback.
- [ ] Warn when storage usage is high or a save fails.

### Task 4: Prompt-Free URL Dialogs and Markdown Files

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`

- [ ] Add a URL dialog for link, image, video, and bookmark insertion.
- [ ] Replace all `prompt()` calls with the dialog.
- [ ] Add Markdown file export for the current memo.
- [ ] Add Markdown file import using `LocalMemoCore.parseMarkdownDocument()`.
- [ ] Keep JSON backup/restore unchanged.

### Task 5: Mobile-First Interface

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

- [ ] Add a bottom mobile action bar for new memo, search/list toggle, formatting, export, and more actions.
- [ ] Convert the sidebar into a slide-in panel on small screens with backdrop and body scroll control.
- [ ] Make the topbar compact and wrap-safe for GitHub Pages mobile browsers.
- [ ] Add touch-friendly block spacing and toolbar overflow behavior.

### Task 6: Docs and Verification

**Files:**
- Modify: `README.md`

- [ ] Update README feature list and GitHub Pages deployment notes.
- [ ] Run `node --test tests/app-core.test.js`.
- [ ] Run a local static server and verify desktop/mobile screens in the browser.
- [ ] Check there are no `prompt(` calls left in `app.js`.
