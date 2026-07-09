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
  assert.match(entryHtml, /id="entry-editor-section"/);
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
  assert.match(stylesCss, /\.panel-wide\s*\{[\s\S]*width:\s*min\(100%, 1520px\);/);
  assert.match(stylesCss, /\.entry-col-date\s*\{[\s\S]*width:\s*140px;/);
  assert.match(stylesCss, /\.entry-col-description\s*\{[\s\S]*width:\s*196px;/);
  assert.match(stylesCss, /\.entry-col-owner\s*\{[\s\S]*width:\s*118px;/);
  assert.match(stylesCss, /\.entry-col-amount\s*\{[\s\S]*width:\s*208px;/);
  assert.match(stylesCss, /\.entry-col-note\s*\{[\s\S]*width:\s*148px;/);
  assert.match(stylesCss, /\.entry-col-delete\s*\{[\s\S]*width:\s*56px;/);
  assert.match(stylesCss, /\.entry-table input\[name="amount"\]\s*\{[\s\S]*font-variant-numeric:\s*tabular-nums;/);
  assert.match(stylesCss, /@media \(min-width: 721px\)[\s\S]*\.entry-table-wrap\s*\{[\s\S]*overflow-x:\s*auto;/);
  assert.match(stylesCss, /@media \(min-width: 721px\)[\s\S]*\.entry-table\s*\{[\s\S]*min-width:\s*1320px;/);
  assert.match(stylesCss, /@media \(min-width: 721px\)[\s\S]*\.amount-input-wrap\s*\{[\s\S]*minmax\(152px, 1fr\) 44px;/);
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

test('amount row and page markup include a calculator trigger plus a separate floating calculator window', () => {
  assert.match(entryJs, /calculator-toggle-button/);
  assert.match(entryJs, /class="calculator-trigger-icon"/);
  assert.match(entryHtml, /id="calculator-window"/);
  assert.match(entryHtml, /aria-modal="true"/);
  assert.match(entryHtml, /id="calculator-row-context"/);
  assert.match(entryHtml, />입력항목<\/div>/);
  assert.match(entryHtml, /id="calculator-announcements"/);
  assert.match(entryHtml, /id="calculator-display"/);
  assert.match(entryHtml, /id="calculator-apply-button"/);
  assert.match(entryHtml, /data-calculator-key="="/);
  assert.match(entryJs, /function applyCalculatorResultToAmount\(/);
  assert.match(entryJs, /calculatorWindow\.classList\.remove\('hidden'\)/);
});

test('calculator window styles render as a polished viewport-level floating popup instead of an in-table popover', () => {
  assert.match(stylesCss, /\.amount-input-wrap\s*\{/);
  assert.match(stylesCss, /\.calculator-trigger-icon\s*\{/);
  assert.match(stylesCss, /\.calculator-window\s*\{[\s\S]*position:\s*fixed;[\s\S]*transform:\s*translate\(-50%, -50%\);[\s\S]*box-shadow:/);
  assert.match(stylesCss, /\.calculator-row-context\s*\{/);
  assert.match(stylesCss, /\.entry-table \.entry-row\.calculator-active\s*\{/);
  assert.match(stylesCss, /#calculator-display\s*\{[\s\S]*text-align:\s*right;/);
  assert.match(stylesCss, /@media \(max-width: 720px\)[\s\S]*\.calculator-window\s*\{[\s\S]*width:\s*calc\(100vw - 24px\);/);
});

test('calculator window logic opens independently from the table layout, highlights the active row, and tracks its context', () => {
  assert.match(entryJs, /const calculatorWindow = document\.querySelector\("#calculator-window"\);/);
  assert.match(entryJs, /const calculatorDisplay = document\.querySelector\("#calculator-display"\);/);
  assert.match(entryJs, /const calculatorRowContext = document\.querySelector\("#calculator-row-context"\);/);
  assert.match(entryJs, /const calculatorAnnouncements = document\.querySelector\("#calculator-announcements"\);/);
  assert.match(entryJs, /function announceCalculatorMessage\(/);
  assert.match(entryJs, /function getCalculatorContextLabel\(row\) \{/);
  assert.match(entryJs, /const descriptionValue = row\?\.querySelector\('\[name="description"\]'\)\?\.value\?\.trim\(\);/);
  assert.match(entryJs, /if \(descriptionValue\) \{/);
  assert.match(entryJs, /return `입력항목 \$\{row\?\.dataset\.rowIndex \|\| '\?'\}`;/);
  assert.match(entryJs, /function getCalculatorFocusableElements\(/);
  assert.match(entryJs, /function isOpenCalculatorShortcut\(event\) \{/);
  assert.match(entryJs, /isShortcutEvent\(event, 'c', \{ allowShift: true \}\) && event\.shiftKey/);
  assert.match(entryJs, /row\.classList\.add\('calculator-active'\)/);
  assert.match(entryJs, /activeRow\?\.classList\.remove\('calculator-active'\)/);
  assert.match(entryJs, /calculatorDisplay\.value = amountValue \|\| '0';/);
  assert.match(entryJs, /calculatorRowContext\.textContent = getCalculatorContextLabel\(row\);/);
  assert.match(entryJs, /event\.target\.matches\('\[name="description"\]'\) && state\.activeCalculatorRowId === row\.dataset\.rowId/);
  assert.match(entryJs, /calculatorRowContext\.textContent = getCalculatorContextLabel\(activeRow\);/);
  assert.match(entryJs, /announceCalculatorMessage\(`\$\{formattedAmount\}원 계산값이 금액 필드에 적용되었습니다\.`\)/);
  assert.match(entryJs, /closeCalculator\(\{ restoreFocus: false, clearStatus: false \}\)/);
  assert.match(entryJs, /if \(activeCalculatorRow && event\.key === 'Tab'\)/);
  assert.match(entryJs, /if \(isOpenCalculatorShortcut\(event\)\) \{/);
  assert.match(entryJs, /state\.activeCalculatorRowId = row\.dataset\.rowId;/);
  assert.match(entryJs, /calculatorWindow\.addEventListener\("click", \(event\) => \{/);
  assert.match(entryJs, /document\.addEventListener\('click', \(event\) => \{/);
});
