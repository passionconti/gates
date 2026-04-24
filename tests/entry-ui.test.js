const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const entryJs = fs.readFileSync(path.join(projectRoot, 'public/entry.js'), 'utf8');
const entryHtml = fs.readFileSync(path.join(projectRoot, 'public/entry.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(projectRoot, 'public/styles.css'), 'utf8');

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
  assert.match(stylesCss, /\.entry-col-date\s*\{[\s\S]*width:\s*128px;/);
  assert.match(stylesCss, /\.entry-col-description\s*\{[\s\S]*width:\s*180px;/);
  assert.match(stylesCss, /\.entry-col-amount\s*\{[\s\S]*width:\s*132px;/);
  assert.match(stylesCss, /\.entry-col-owner\s*\{[\s\S]*width:\s*118px;/);
  assert.match(stylesCss, /\.entry-col-delete\s*\{[\s\S]*width:\s*56px;/);
  assert.match(stylesCss, /@media \(min-width: 721px\)[\s\S]*\.entry-table\s*\{[\s\S]*min-width:\s*1064px;/);
});

test('desktop date input uses a custom text-style short-year format instead of native date UI', () => {
  assert.match(entryJs, /name="dateDisplay"/);
  assert.match(entryJs, /placeholder="26\.04\.11"/);
  assert.match(entryJs, /formatDesktopDateValue/);
  assert.match(entryJs, /normalizeDesktopDateValue/);
  assert.doesNotMatch(entryJs, /<input type="date" name="date"/);
});

test('add row behavior reuses the previous row defaults and supports the cmd+i shortcut', () => {
  assert.match(entryJs, /createNextEntryDraft/);
  assert.match(entryJs, /handleAddRow/);
  assert.match(entryJs, /GatesEntryHelpers\.createNextEntryDraft\(previousDraft, getTodayDateText\(\)\)/);
  assert.match(entryJs, /window\.addEventListener\("keydown"/);
  assert.match(entryJs, /event\.metaKey/);
  assert.match(entryJs, /event\.key\.toLowerCase\(\) === "i"/);
});

test('newly added rows focus the date field immediately', () => {
  assert.match(entryJs, /const dateDisplayInput = row\.querySelector\('\[name="dateDisplay"\]'\);/);
  assert.match(entryJs, /dateDisplayInput\.focus\(\)/);
  assert.match(entryJs, /dateDisplayInput\.select\(\)/);
});

test('amount input is rendered as a text field with comma-formatting support', () => {
  assert.match(entryJs, /name="amount"/);
  assert.match(entryJs, /type="text"/);
  assert.match(entryJs, /placeholder="12,000"/);
  assert.match(entryJs, /formatAmountDisplayValue/);
  assert.match(entryJs, /normalizeAmountInputValue/);
  assert.match(entryJs, /syncAmountField/);
  assert.doesNotMatch(entryJs, /type="number" name="amount"/);
});
