const form = document.querySelector("#entry-form");
const result = document.querySelector("#result");
const submitButton = document.querySelector("#submit-button");
const addRowButton = document.querySelector("#add-row-button");
const entryRows = document.querySelector("#entry-rows");
const targetName = document.querySelector("#target-name");
const spreadsheetLink = document.querySelector("#spreadsheet-link");
const changeTargetLink = document.querySelector("#change-target-link");
const confirmModal = document.querySelector("#confirm-modal");
const confirmModalRows = document.querySelector("#confirm-modal-rows");
const confirmModalSummary = document.querySelector("#confirm-modal-summary");
const confirmModalCloseButton = document.querySelector("#confirm-modal-close");
const confirmModalCancelButton = document.querySelector("#confirm-modal-cancel");
const confirmModalSubmitButton = document.querySelector("#confirm-modal-submit");

const GOOGLE_DISCOVERY_WAIT_MS = 100;
const AUTH_REFRESH_BUFFER_MS = 60 * 1000;

const state = {
  nextRowId: 1,
  pendingEntries: null,
  isSaving: false,
  config: null,
  tokenClient: null,
  accessToken: null,
  accessTokenRefreshPromise: null,
  authReadyPromise: null,
};

function setResult(type, message) {
  result.className = `result ${type}`;
  result.textContent = message;
  result.classList.remove("hidden");
}

function clearResult() {
  result.className = "result hidden";
  result.textContent = "";
}

function setLoadingState(active, label = "입력한 항목 전체 저장") {
  submitButton.disabled = active;
  submitButton.textContent = active ? label : "입력한 항목 전체 저장";
  addRowButton.disabled = active;
  confirmModalSubmitButton.disabled = active;
  confirmModalCancelButton.disabled = active;
  confirmModalCloseButton.disabled = active;

  for (const button of entryRows.querySelectorAll(".remove-row-button")) {
    button.disabled = active || entryRows.children.length === 1;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function closeConfirmModal({ force = false } = {}) {
  if (state.isSaving && !force) {
    return;
  }

  state.pendingEntries = null;
  confirmModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function renderConfirmRows(rows) {
  confirmModalRows.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.type)}</td>
          <td>${escapeHtml(row.category)}</td>
          <td>${escapeHtml(row.description)}</td>
          <td>${escapeHtml(row.owner || '-')}</td>
          <td>${escapeHtml(row.paymentMethod || '-')}</td>
          <td class="confirm-amount-cell">${escapeHtml(row.amount)}</td>
          <td>${escapeHtml(row.note)}</td>
        </tr>
      `,
    )
    .join("");
}

function openConfirmModal(selection, entries) {
  const previewRows = GatesEntryHelpers.buildEntryPreviewRows(entries);
  state.pendingEntries = entries;
  renderConfirmRows(previewRows);
  confirmModalSummary.textContent = `${selection.spreadsheetName || selection.spreadsheetId} · ${previewRows.length}건`;
  confirmModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  confirmModalSubmitButton.focus();
}

async function savePendingEntries(selection) {
  if (!state.pendingEntries) {
    return;
  }

  state.isSaving = true;
  setLoadingState(true, "Google Sheets에 저장 중...");

  try {
    const editableSelection = await ensureEditableSelection(selection);
    const saveResult = await appendEntries(editableSelection.spreadsheetId, state.pendingEntries);
    state.isSaving = false;
    closeConfirmModal({ force: true });
    resetRows();
    const actorLabel = saveResult.actor.name;
    const actorSuffix = actorLabel ? ` 입력자: ${actorLabel}.` : "";
    setResult(
      "success",
      `${saveResult.logsCount}건을 logs 시트에 저장했고 ${saveResult.monthlySheetNames.join(", ")} 시트에 반영했습니다.${actorSuffix}`,
    );
  } catch (error) {
    setResult("error", error.message);
  } finally {
    state.isSaving = false;
    setLoadingState(false);
  }
}

function getTodayDateText() {
  const today = new Date();
  const year = String(today.getFullYear());
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

async function loadConfig() {
  const data = await fetchJson("/api/config", {}, { retryOnAuthError: false });

  if (!data.configured) {
    throw new Error(`Google OAuth 설정이 아직 완료되지 않았습니다. 누락된 값: ${data.missingEnvVars.join(", ")}`);
  }

  state.config = data;
  return data;
}

async function waitForGoogleIdentityServices() {
  while (!window.google?.accounts?.oauth2) {
    await new Promise((resolve) => {
      window.setTimeout(resolve, GOOGLE_DISCOVERY_WAIT_MS);
    });
  }
}

function restoreAuthSession() {
  const session = GatesShared.readActiveAuthSession(window.sessionStorage, {
    bufferMs: AUTH_REFRESH_BUFFER_MS,
  });

  state.accessToken = session?.accessToken || null;
}

function persistRefreshedAuthSession(accessToken, expiresIn) {
  const existingSession = GatesShared.readAuthSession(window.sessionStorage);
  const expiresAt = Number.isFinite(Number(expiresIn)) ? Date.now() + Number(expiresIn) * 1000 : existingSession?.expiresAt || null;

  GatesShared.persistAuthSession(window.sessionStorage, {
    accessToken,
    expiresAt,
    name: existingSession?.name || "",
    email: existingSession?.email || "",
  });

  state.accessToken = accessToken;
}

function initializeGoogleAuth() {
  state.tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: state.config.googleClientId,
    scope: state.config.scopes.join(" "),
    callback: () => {},
  });
}

function requestGoogleAccessToken({ prompt = "" } = {}) {
  if (!state.tokenClient) {
    throw new Error("Google 인증 클라이언트가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
  }

  return new Promise((resolve, reject) => {
    state.tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }

      persistRefreshedAuthSession(response.access_token, response.expires_in);
      resolve(response.access_token);
    };

    state.tokenClient.requestAccessToken({ prompt });
  });
}

async function refreshGoogleAccessToken({ allowPrompt = false } = {}) {
  if (state.accessTokenRefreshPromise) {
    return state.accessTokenRefreshPromise;
  }

  state.accessTokenRefreshPromise = (async () => {
    try {
      return await requestGoogleAccessToken({ prompt: "" });
    } catch (error) {
      if (!allowPrompt) {
        throw error;
      }

      return requestGoogleAccessToken({ prompt: "consent" });
    }
  })();

  try {
    return await state.accessTokenRefreshPromise;
  } finally {
    state.accessTokenRefreshPromise = null;
  }
}

async function ensureFreshGoogleAccessToken({ allowPrompt = false, forceRefresh = false } = {}) {
  if (state.authReadyPromise) {
    await state.authReadyPromise;
  }

  if (!forceRefresh) {
    const session = GatesShared.readActiveAuthSession(window.sessionStorage, {
      bufferMs: AUTH_REFRESH_BUFFER_MS,
    });

    if (session?.accessToken) {
      state.accessToken = session.accessToken;
      return session.accessToken;
    }
  }

  return refreshGoogleAccessToken({ allowPrompt });
}

async function getGoogleApiHeaders(options = {}) {
  const accessToken = await ensureFreshGoogleAccessToken(options);

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function isAuthErrorResponse(response, data) {
  if (response.status === 401) {
    return true;
  }

  if (response.status !== 403) {
    return false;
  }

  const message = String(data?.error?.message || data?.message || "").toLowerCase();
  const reason = String(data?.error?.errors?.[0]?.reason || "").toLowerCase();

  return (
    reason.includes("auth") ||
    reason.includes("scope") ||
    message.includes("authentication") ||
    message.includes("credential") ||
    message.includes("scope")
  );
}

async function fetchJson(url, options = {}, { retryOnAuthError = true, allowPromptOnRetry = true } = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);

  if (response.ok) {
    return data || {};
  }

  if (retryOnAuthError && isAuthErrorResponse(response, data)) {
    const headers = {
      ...(options.headers || {}),
      ...(await getGoogleApiHeaders({ allowPrompt: allowPromptOnRetry, forceRefresh: true })),
    };

    return fetchJson(url, { ...options, headers }, { retryOnAuthError: false, allowPromptOnRetry });
  }

  throw new Error(data?.error?.message || data?.message || "요청에 실패했습니다.");
}

async function fetchSpreadsheetAccess(selection) {
  return fetchJson(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(selection.spreadsheetId)}?fields=id,name,capabilities/canEdit,webViewLink&supportsAllDrives=true`,
    {
      headers: await getGoogleApiHeaders({ allowPrompt: true }),
    },
  );
}

async function appendToSheet(spreadsheetId, range, rows) {
  return fetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        ...(await getGoogleApiHeaders({ allowPrompt: true })),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rows }),
    },
  );
}

async function ensureEditableSelection(selection) {
  const spreadsheet = await fetchSpreadsheetAccess(selection);

  if (!spreadsheet.capabilities?.canEdit) {
    GatesShared.clearSelection(window.localStorage);
    throw new Error("선택한 Spreadsheet의 편집 권한이 없어졌습니다. 대상 시트를 다시 골라 주세요.");
  }

  const nextSelection = GatesShared.persistSelection(window.localStorage, {
    spreadsheetId: spreadsheet.id || selection.spreadsheetId,
    spreadsheetName: spreadsheet.name || selection.spreadsheetName,
    webViewLink: spreadsheet.webViewLink || selection.webViewLink,
  });

  populateSelection(nextSelection);
  return nextSelection;
}

async function fetchActorProfile() {
  const authSession = GatesShared.readAuthSession(window.sessionStorage);

  try {
    const data = await fetchJson("https://www.googleapis.com/drive/v3/about?fields=user(displayName)", {
      headers: await getGoogleApiHeaders({ allowPrompt: true }),
    });

    return {
      name: String(data.user?.displayName || authSession?.name || "").trim(),
    };
  } catch (error) {
    return {
      name: String(authSession?.name || "").trim(),
    };
  }
}

async function ensureLogsHeader(spreadsheetId) {
  const data = await fetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent("logs!A1:K1")}`,
    {
      headers: await getGoogleApiHeaders({ allowPrompt: true }),
    },
  );

  const currentHeader = data.values?.[0] || [];
  if (GatesEntryHelpers.isLogsHeaderRowComplete(currentHeader)) {
    return;
  }

  await fetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent("logs!A1:K1")}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        ...(await getGoogleApiHeaders({ allowPrompt: true })),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [[...GatesEntryHelpers.getLogsHeaderRow(), ""]] }),
    },
  );
}

async function appendEntries(spreadsheetId, entries) {
  const actor = await fetchActorProfile();
  const logsRows = GatesEntryHelpers.buildLogsRowsPayload(entries, { actor });
  const monthlyPayloads = GatesEntryHelpers.buildMonthlySheetPayloads(entries);

  await ensureLogsHeader(spreadsheetId);
  await appendToSheet(spreadsheetId, "logs!A:J", logsRows);

  for (const payload of monthlyPayloads) {
    await appendToSheet(spreadsheetId, `${payload.sheetName}!A:H`, payload.rows);
  }

  return {
    logsCount: logsRows.length,
    monthlySheetNames: monthlyPayloads.map((payload) => payload.sheetName),
    actor,
  };
}

function ensureSelection() {
  const selection = GatesShared.readSelection(window.localStorage);

  if (!selection) {
    window.location.replace("/");
    return null;
  }

  return selection;
}

function populateSelection(selection) {
  targetName.textContent = selection.spreadsheetName || selection.spreadsheetId;

  if (selection.webViewLink) {
    spreadsheetLink.href = selection.webViewLink;
    spreadsheetLink.classList.remove("hidden");
  } else {
    spreadsheetLink.href = "#";
    spreadsheetLink.classList.add("hidden");
  }

  changeTargetLink.href = "/";
}

function buildSelectOptions(options, selectedValue) {
  return options
    .map((option) => {
      const selected = option === selectedValue ? " selected" : "";
      return `<option value="${option}"${selected}>${option}</option>`;
    })
    .join("");
}

function syncCategoryOptions(row) {
  const typeSelect = row.querySelector('[name="type"]');
  const categorySelect = row.querySelector('[name="category"]');
  const options = GatesEntryHelpers.getCategoryOptionsForType(typeSelect.value);
  const nextValue = options.includes(categorySelect.value) ? categorySelect.value : options[0];

  categorySelect.innerHTML = buildSelectOptions(options, nextValue);
}

function createRowElement(draft, rowId) {
  const row = document.createElement("tr");
  row.className = "entry-row";
  row.dataset.rowId = String(rowId);
  row.innerHTML = `
    <td data-label="날짜">
      <input type="hidden" name="date" value="${draft.date}" />
      <input
        type="text"
        name="dateDisplay"
        value="${GatesEntryHelpers.formatDesktopDateValue(draft.date)}"
        placeholder="26.04.11"
        inputmode="numeric"
        autocomplete="off"
        required
      />
    </td>
    <td data-label="구분">
      <select name="type" required>
        ${buildSelectOptions(GatesEntryHelpers.ENTRY_TYPE_OPTIONS, draft.type)}
      </select>
    </td>
    <td data-label="카테고리">
      <select name="category" required>
        ${buildSelectOptions(GatesEntryHelpers.getCategoryOptionsForType(draft.type), draft.category)}
      </select>
    </td>
    <td data-label="내용">
      <input type="text" name="description" value="${draft.description}" placeholder="점심 회의" required />
    </td>
    <td data-label="명의">
      <select name="owner">
        ${buildSelectOptions(GatesEntryHelpers.OWNER_OPTIONS, draft.owner)}
      </select>
    </td>
    <td data-label="지출방식">
      <select name="paymentMethod">
        ${buildSelectOptions(GatesEntryHelpers.PAYMENT_METHOD_OPTIONS, draft.paymentMethod)}
      </select>
    </td>
    <td data-label="금액">
      <input type="text" name="amount" value="${GatesEntryHelpers.formatAmountDisplayValue(draft.amount)}" inputmode="numeric" autocomplete="off" placeholder="12,000" required />
    </td>
    <td data-label="비고">
      <input type="text" name="note" value="${draft.note}" placeholder="메모" />
    </td>
    <td data-label="삭제" class="action-cell">
      <button type="button" class="secondary remove-row-button icon-button" aria-label="항목 삭제">
        <span aria-hidden="true">🗑️</span>
      </button>
    </td>
  `;
  return row;
}

function updateRowButtons() {
  const rows = Array.from(entryRows.querySelectorAll(".entry-row"));

  rows.forEach((row, index) => {
    row.dataset.rowIndex = String(index + 1);
    const removeButton = row.querySelector(".remove-row-button");
    if (removeButton) {
      removeButton.disabled = rows.length === 1;
      removeButton.setAttribute("aria-label", `${index + 1}번째 항목 삭제`);
      removeButton.title = `${index + 1}번째 항목 삭제`;
    }
  });
}

function buildEntryRowElement(draft = GatesEntryHelpers.createEmptyEntryDraft(getTodayDateText())) {
  const row = createRowElement(
    GatesEntryHelpers.sanitizeEntryDraft({
      ...GatesEntryHelpers.createEmptyEntryDraft(getTodayDateText()),
      ...draft,
    }),
    state.nextRowId++,
  );
  syncCategoryOptions(row);
  syncDateField(row, { formatDisplay: true });
  syncAmountField(row, { formatDisplay: true });
  return row;
}

function addEntryRow(draft = GatesEntryHelpers.createEmptyEntryDraft(getTodayDateText())) {
  const row = buildEntryRowElement(draft);
  entryRows.append(row);
  updateRowButtons();
  return row;
}

function insertEntryRowAfter(targetRow, draft = GatesEntryHelpers.createEmptyEntryDraft(getTodayDateText())) {
  const row = buildEntryRowElement(draft);
  targetRow?.after(row);
  updateRowButtons();
  return row;
}

function focusFirstEditableField(row) {
  const firstInput = row?.querySelector('input[type="text"], select');
  firstInput?.focus();
  firstInput?.select?.();
}

function isShortcutEvent(event, key, options = {}) {
  if (event.defaultPrevented || event.repeat || event.isComposing) {
    return false;
  }

  if (event.key?.toLowerCase() !== key) {
    return false;
  }

  const {
    allowAlt = false,
    requireAlt = false,
    allowShift = false,
  } = options;

  if (!(event.metaKey || event.ctrlKey)) {
    return false;
  }

  if (requireAlt && !event.altKey) {
    return false;
  }

  if (!allowAlt && event.altKey) {
    return false;
  }

  if (!allowShift && event.shiftKey) {
    return false;
  }

  return true;
}

function isAddRowShortcut(event) {
  return isShortcutEvent(event, 'l');
}

function isDuplicatePreviousRowShortcut(event) {
  return isShortcutEvent(event, 'd');
}

function removeEntryRow(button) {
  const row = button.closest(".entry-row");
  if (!row || entryRows.children.length === 1) {
    return;
  }

  row.remove();
  updateRowButtons();
}

function syncDateField(row, { formatDisplay = false } = {}) {
  const dateValueInput = row.querySelector('[name="date"]');
  const dateDisplayInput = row.querySelector('[name="dateDisplay"]');
  const normalizedDate = GatesEntryHelpers.normalizeDesktopDateValue(dateDisplayInput.value);

  dateValueInput.value = normalizedDate;

  if (formatDisplay && normalizedDate) {
    dateDisplayInput.value = GatesEntryHelpers.formatDesktopDateValue(normalizedDate);
  }
}

function syncAmountField(row, { formatDisplay = false } = {}) {
  const amountInput = row.querySelector('[name="amount"]');
  const normalizedAmount = GatesEntryHelpers.normalizeAmountInputValue(amountInput.value);

  amountInput.value = formatDisplay
    ? GatesEntryHelpers.formatAmountDisplayValue(normalizedAmount)
    : normalizedAmount;
}

function getRowDraft(row) {
  syncDateField(row);
  syncAmountField(row);

  return {
    date: row.querySelector('[name="date"]').value,
    type: row.querySelector('[name="type"]').value,
    category: row.querySelector('[name="category"]').value,
    description: row.querySelector('[name="description"]').value,
    owner: row.querySelector('[name="owner"]').value,
    paymentMethod: row.querySelector('[name="paymentMethod"]').value,
    amount: row.querySelector('[name="amount"]').value,
    note: row.querySelector('[name="note"]').value,
  };
}

function collectEntryDrafts() {
  return Array.from(entryRows.querySelectorAll(".entry-row")).map((row) => getRowDraft(row));
}

function replaceRowDraft(row, draft) {
  const sanitizedDraft = GatesEntryHelpers.sanitizeEntryDraft(draft);

  row.querySelector('[name="date"]').value = sanitizedDraft.date;
  row.querySelector('[name="dateDisplay"]').value = sanitizedDraft.date;
  row.querySelector('[name="type"]').value = sanitizedDraft.type;
  syncCategoryOptions(row);
  row.querySelector('[name="category"]').value = sanitizedDraft.category;
  row.querySelector('[name="description"]').value = sanitizedDraft.description;
  row.querySelector('[name="owner"]').value = sanitizedDraft.owner;
  row.querySelector('[name="paymentMethod"]').value = sanitizedDraft.paymentMethod;
  row.querySelector('[name="amount"]').value = sanitizedDraft.amount;
  row.querySelector('[name="note"]').value = sanitizedDraft.note;
  syncDateField(row, { formatDisplay: true });
  syncAmountField(row, { formatDisplay: true });
}

function getActiveEntryRow() {
  const focusedRow = document.activeElement?.closest?.('.entry-row');
  if (focusedRow) {
    return focusedRow;
  }

  const rows = entryRows.querySelectorAll('.entry-row');
  return rows.length > 0 ? rows[rows.length - 1] : null;
}

function duplicateActiveRowFromFocus() {
  const currentRow = getActiveEntryRow();
  if (!currentRow) {
    return false;
  }

  const duplicatedRow = insertEntryRowAfter(currentRow, getRowDraft(currentRow));
  focusFirstEditableField(duplicatedRow);
  return true;
}

function resetRows() {
  entryRows.innerHTML = "";
  state.nextRowId = 1;
  addEntryRow();
}

addRowButton.addEventListener("click", () => {
  const row = addEntryRow();
  focusFirstEditableField(row);
});

document.addEventListener("keydown", (event) => {
  const isConfirmModalOpen = !confirmModal.classList.contains("hidden");

  if (isConfirmModalOpen && event.key === "Escape") {
    event.preventDefault();
    closeConfirmModal();
    return;
  }

  if (isConfirmModalOpen) {
    return;
  }

  if (isAddRowShortcut(event)) {
    event.preventDefault();
    const row = addEntryRow();
    focusFirstEditableField(row);
    return;
  }

  if (isDuplicatePreviousRowShortcut(event) && duplicateActiveRowFromFocus()) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

entryRows.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-row-button");
  if (!button) {
    return;
  }

  removeEntryRow(button);
});

entryRows.addEventListener("input", (event) => {
  const row = event.target.closest('.entry-row');
  if (!row) {
    return;
  }

  if (event.target.matches('[name="dateDisplay"]')) {
    syncDateField(row, { formatDisplay: true });
  }

  if (event.target.matches('[name="amount"]')) {
    syncAmountField(row, { formatDisplay: true });
  }
});

entryRows.addEventListener("change", (event) => {
  const row = event.target.closest(".entry-row");

  if (event.target.matches('[name="type"]')) {
    syncCategoryOptions(row);
  }

  if (event.target.matches('[name="dateDisplay"]')) {
    syncDateField(row, { formatDisplay: true });
  }

  if (event.target.matches('[name="amount"]')) {
    syncAmountField(row, { formatDisplay: true });
  }
});

entryRows.addEventListener("blur", (event) => {
  if (event.target.matches('[name="dateDisplay"]')) {
    syncDateField(event.target.closest('.entry-row'), { formatDisplay: true });
  }

  if (event.target.matches('[name="amount"]')) {
    syncAmountField(event.target.closest('.entry-row'), { formatDisplay: true });
  }
}, true);

confirmModal.addEventListener("click", (event) => {
  if (event.target.closest('[data-close-confirm-modal]')) {
    closeConfirmModal();
  }
});

confirmModalCloseButton.addEventListener("click", closeConfirmModal);
confirmModalCancelButton.addEventListener("click", closeConfirmModal);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearResult();

  const selection = ensureSelection();
  if (!selection) {
    return;
  }

  try {
    openConfirmModal(selection, collectEntryDrafts());
  } catch (error) {
    setResult("error", error.message);
  }
});

confirmModalSubmitButton.addEventListener("click", async () => {
  clearResult();
  const selection = ensureSelection();
  if (!selection) {
    return;
  }

  await savePendingEntries(selection);
});

async function initializeAuth() {
  restoreAuthSession();
  await loadConfig();
  await waitForGoogleIdentityServices();
  initializeGoogleAuth();
}

async function initializePage() {
  const selection = ensureSelection();
  if (!selection) {
    return;
  }

  populateSelection(selection);
  resetRows();

  state.authReadyPromise = initializeAuth();

  try {
    await state.authReadyPromise;
  } catch (error) {
    setResult("error", error.message);
  }
}

initializePage();
