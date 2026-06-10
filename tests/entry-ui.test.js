const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const entryJs = fs.readFileSync(path.join(projectRoot, 'public/entry.js'), 'utf8');
const entryHtml = fs.readFileSync(path.join(projectRoot, 'public/entry.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(projectRoot, 'public/styles.css'), 'utf8');

test('confirmation modal styles support a scrollable review table and amount alignment', () => {
  assert.match(stylesCss, /\.modal\s*\{/);
  assert.match(stylesCss, /\.modal-card\s*\{[\s\S]*max-height:\s*min\(85vh, 920px\);/);
  assert.match(stylesCss, /\.confirm-table-wrap\s*\{[\s\S]*overflow:\s*auto;/);
  assert.match(stylesCss, /\.confirm-table\s*\{[\s\S]*min-width:\s*880px;/);
  assert.match(stylesCss, /\.confirm-amount-cell\s*\{[\s\S]*text-align:\s*right;/);
});

test('save confirmation modal markup is present with a review table and explicit actions', () => {
  assert.match(entryHtml, /https:\/\/accounts\.google\.com\/gsi\/client/);
  assert.match(entryHtml, /id="confirm-modal"/);
  assert.match(entryHtml, /id="confirm-modal-title"/);
  assert.match(entryHtml, /id="confirm-modal-summary"/);
  assert.match(entryHtml, /id="confirm-modal-rows"/);
  assert.match(entryHtml, /id="confirm-modal-cancel"/);
  assert.match(entryHtml, /id="confirm-modal-submit"/);
});

test('save flow revalidates auth before append and retries through a token refresh path', () => {
  assert.match(entryJs, /async function ensureFreshGoogleAccessToken\(/);
  assert.match(entryJs, /async function refreshGoogleAccessToken\(/);
  assert.match(entryJs, /await ensureEditableSelection\(selection\)/);
  assert.match(entryJs, /isAuthErrorResponse/);
  assert.match(entryJs, /retryOnAuthError/);
});

test('confirm modal close helper blocks dismissal while saving unless forced', () => {
  assert.match(entryJs, /function closeConfirmModal\(\{ force = false \} = \{\}\) \{/);
  assert.match(entryJs, /if \(state\.isSaving && !force\) \{/);
});

test('save flow still builds a confirmation modal before append and includes explicit confirm controls', () => {
  assert.match(entryJs, /buildEntryPreviewRows/);
  assert.match(entryJs, /function openConfirmModal\(/);
  assert.match(entryJs, /confirmModalSummary\.textContent = /);
  assert.match(entryJs, /confirmModalSubmitButton/);
  assert.match(entryJs, /async function savePendingEntries\(/);
  assert.match(entryJs, /state\.isSaving = true;/);
  assert.match(entryJs, /closeConfirmModal\(\{ force: true \}\)/);
  assert.match(entryJs, /form\.addEventListener\("submit", async \(event\) => {[\s\S]*openConfirmModal\(selection, collectEntryDrafts\(\)\)/);
  assert.match(entryJs, /confirmModalSubmitButton\.addEventListener\("click", async \(\) => {[\s\S]*savePendingEntries\(selection\)/);
});

test('select options are rendered without an empty placeholder option', () => {
  assert.doesNotMatch(entryJs, /return \["", \.\.\.options\]/);
  assert.doesNotMatch(entryJs, /선택해 주세요/);
});

test('delete control is rendered as an icon button instead of text', () => {
  assert.match(entryJs, /class="secondary remove-row-button icon-button"/);
  assert.match(entryJs, /aria-label="항목 삭제"/);
  assert.doesNotMatch(entryJs, />삭제</);
});

test('desktop table hides the delete header text while keeping explicit column widths', () => {
  assert.match(entryHtml, /<colgroup>[\s\S]*entry-col-date[\s\S]*entry-col-delete[\s\S]*<\/colgroup>/);
  assert.doesNotMatch(entryHtml, /<th scope="col">삭제<\/th>/);
  assert.match(stylesCss, /\.entry-col-date\s*\{[\s\S]*width:\s*140px;/);
  assert.match(stylesCss, /\.entry-col-description\s*\{[\s\S]*width:\s*180px;/);
  assert.match(stylesCss, /\.entry-col-owner\s*\{[\s\S]*width:\s*118px;/);
  assert.match(stylesCss, /\.entry-col-amount\s*\{[\s\S]*width:\s*136px;/);
  assert.match(stylesCss, /\.entry-col-delete\s*\{[\s\S]*width:\s*56px;/);
  assert.match(stylesCss, /\.entry-table input\[name="amount"\]\s*\{[\s\S]*font-variant-numeric:\s*tabular-nums;/);
  assert.match(stylesCss, /@media \(min-width: 721px\)[\s\S]*\.entry-table-wrap\s*\{[\s\S]*overflow-x:\s*auto;/);
  assert.match(stylesCss, /@media \(min-width: 721px\)[\s\S]*\.entry-table\s*\{[\s\S]*min-width:\s*1120px;/);
});

test('desktop date input uses a custom text-style short-year format instead of native date UI', () => {
  assert.match(entryJs, /name="dateDisplay"/);
  assert.match(entryJs, /placeholder="26\.04\.11"/);
  assert.match(entryJs, /formatDesktopDateValue/);
  assert.match(entryJs, /normalizeDesktopDateValue/);
  assert.doesNotMatch(entryJs, /<input type="date" name="date"/);
});

test('amount field uses text input formatting helpers instead of native number steppers', () => {
  assert.match(entryJs, /<input type="text" name="amount"/);
  assert.match(entryJs, /formatAmountDisplayValue/);
  assert.match(entryJs, /normalizeAmountInputValue/);
  assert.doesNotMatch(entryJs, /<input type="number" name="amount"/);
});
