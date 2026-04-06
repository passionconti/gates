const test = require('node:test');
const assert = require('node:assert/strict');

const {
  persistSelection,
  readSelection,
  clearSelection,
  isValidSelection,
  buildEntryPageUrl,
  persistAuthSession,
  readAuthSession,
  clearAuthSession,
} = require('../public/shared.js');

function createStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test('isValidSelection returns true only when spreadsheet and sheet are both present', () => {
  assert.equal(isValidSelection({ spreadsheetId: 'sheet-1', sheetName: '2026' }), true);
  assert.equal(isValidSelection({ spreadsheetId: '', sheetName: '2026' }), false);
  assert.equal(isValidSelection({ spreadsheetId: 'sheet-1', sheetName: '' }), false);
  assert.equal(isValidSelection(null), false);
});

test('persistSelection stores only the selected spreadsheet and sheet information', () => {
  const storage = createStorage();

  persistSelection(storage, {
    spreadsheetId: 'spreadsheet-123',
    spreadsheetName: '가계부',
    sheetName: '2026-04',
    webViewLink: 'https://docs.google.com/spreadsheets/d/123',
  });

  assert.deepEqual(readSelection(storage), {
    spreadsheetId: 'spreadsheet-123',
    spreadsheetName: '가계부',
    sheetName: '2026-04',
    webViewLink: 'https://docs.google.com/spreadsheets/d/123',
  });
});

test('clearSelection removes saved selection from storage', () => {
  const storage = createStorage();
  persistSelection(storage, {
    spreadsheetId: 'spreadsheet-123',
    spreadsheetName: '가계부',
    sheetName: '2026-04',
    webViewLink: 'https://docs.google.com/spreadsheets/d/123',
  });

  clearSelection(storage);

  assert.equal(readSelection(storage), null);
});

test('buildEntryPageUrl points to the dedicated entry page', () => {
  assert.equal(buildEntryPageUrl(), '/entry.html');
});

test('persistAuthSession stores access token data for the next page', () => {
  const storage = createStorage();

  persistAuthSession(storage, {
    accessToken: 'token-123',
    expiresAt: 1234567890,
  });

  assert.deepEqual(readAuthSession(storage), {
    accessToken: 'token-123',
    expiresAt: 1234567890,
  });
});

test('clearAuthSession removes saved access token data', () => {
  const storage = createStorage();

  persistAuthSession(storage, {
    accessToken: 'token-123',
    expiresAt: 1234567890,
  });
  clearAuthSession(storage);

  assert.equal(readAuthSession(storage), null);
});
