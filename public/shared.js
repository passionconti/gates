(function (global, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.GatesShared = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SELECTION_STORAGE_KEY = "gates:selected-sheet";
  const AUTH_STORAGE_KEY = "gates:auth-session";

  function toTrimmedString(value) {
    return String(value || "").trim();
  }

  function isValidSelection(selection) {
    return Boolean(selection && toTrimmedString(selection.spreadsheetId));
  }

  function sanitizeSelection(selection) {
    if (!isValidSelection(selection)) {
      return null;
    }

    return {
      spreadsheetId: toTrimmedString(selection.spreadsheetId),
      spreadsheetName: toTrimmedString(selection.spreadsheetName),
      webViewLink: toTrimmedString(selection.webViewLink),
    };
  }

  function sanitizeAuthSession(session) {
    if (!session || !toTrimmedString(session.accessToken)) {
      return null;
    }

    const expiresAt = Number(session.expiresAt);

    return {
      accessToken: toTrimmedString(session.accessToken),
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
      name: toTrimmedString(session.name),
      email: toTrimmedString(session.email),
    };
  }

  function readJson(storage, key) {
    if (!storage || typeof storage.getItem !== "function") {
      return null;
    }

    const raw = storage.getItem(key);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function writeJson(storage, key, value) {
    if (!storage || typeof storage.setItem !== "function") {
      return;
    }

    storage.setItem(key, JSON.stringify(value));
  }

  function removeItem(storage, key) {
    if (!storage || typeof storage.removeItem !== "function") {
      return;
    }

    storage.removeItem(key);
  }

  function persistSelection(storage, selection) {
    const sanitized = sanitizeSelection(selection);

    if (!sanitized) {
      throw new Error("유효한 Spreadsheet와 시트 선택 정보가 필요합니다.");
    }

    writeJson(storage, SELECTION_STORAGE_KEY, sanitized);
    return sanitized;
  }

  function readSelection(storage) {
    return sanitizeSelection(readJson(storage, SELECTION_STORAGE_KEY));
  }

  function clearSelection(storage) {
    removeItem(storage, SELECTION_STORAGE_KEY);
  }

  function persistAuthSession(storage, session) {
    const sanitized = sanitizeAuthSession(session);

    if (!sanitized) {
      throw new Error("유효한 액세스 토큰이 필요합니다.");
    }

    writeJson(storage, AUTH_STORAGE_KEY, sanitized);
    return sanitized;
  }

  function readAuthSession(storage) {
    return sanitizeAuthSession(readJson(storage, AUTH_STORAGE_KEY));
  }

  function clearAuthSession(storage) {
    removeItem(storage, AUTH_STORAGE_KEY);
  }

  function buildEntryPageUrl() {
    return "/entry.html";
  }

  return {
    SELECTION_STORAGE_KEY,
    AUTH_STORAGE_KEY,
    isValidSelection,
    persistSelection,
    readSelection,
    clearSelection,
    persistAuthSession,
    readAuthSession,
    clearAuthSession,
    buildEntryPageUrl,
  };
});
