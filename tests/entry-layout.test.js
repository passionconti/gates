const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const entryHtml = fs.readFileSync(path.join(projectRoot, 'public/entry.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(projectRoot, 'public/styles.css'), 'utf8');

test('entry page keeps semantic table markup for ledger rows', () => {
  assert.match(entryHtml, /<table class="entry-table">/);
  assert.match(entryHtml, /<thead>/);
  assert.match(entryHtml, /<tbody id="entry-rows"><\/tbody>/);
});

test('desktop layout shows a real table header and table rows', () => {
  assert.match(stylesCss, /@media \(min-width: 721px\)[\s\S]*\.entry-table thead\s*\{[\s\S]*display:\s*table-header-group;/);
  assert.match(stylesCss, /@media \(min-width: 721px\)[\s\S]*\.entry-table tbody\s*\{[\s\S]*display:\s*table-row-group;/);
  assert.match(stylesCss, /@media \(min-width: 721px\)[\s\S]*\.entry-table \.entry-row\s*\{[\s\S]*display:\s*table-row;/);
  assert.match(stylesCss, /@media \(min-width: 721px\)[\s\S]*\.entry-table tbody td::before\s*\{[\s\S]*content:\s*none;/);
  assert.match(stylesCss, /@media \(min-width: 721px\)[\s\S]*\.entry-table input\[name="dateDisplay"\]\s*\{[\s\S]*min-width:\s*112px;/);
});

test('mobile layout keeps the current card-style rows', () => {
  assert.match(stylesCss, /\.entry-table thead\s*\{[\s\S]*display:\s*none;/);
  assert.match(stylesCss, /\.entry-table tbody\s*\{[\s\S]*display:\s*grid;/);
  assert.match(stylesCss, /\.entry-table \.entry-row\s*\{[\s\S]*display:\s*grid;/);
  assert.match(stylesCss, /\.entry-table tbody td::before\s*\{[\s\S]*content:\s*attr\(data-label\);/);
});
