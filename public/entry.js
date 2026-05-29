const form = document.querySelector("#entry-form");
const result = document.querySelector("#result");
const submitButton = document.querySelector("#submit-button");
const addRowButton = document.querySelector("#add-row-button");
const entryRows = document.querySelector("#entry-rows");
const targetName = document.querySelector("#target-name");
const spreadsheetLink = document.querySelector("#spreadsheet-link");
const changeTargetLink = document.querySelector("#change-target-link");

const state = {
  nextRowId: 1,
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

  for (const button of entryRows.querySelectorAll(".remove-row-button")) {
    button.disabled = active || entryRows.children.length === 1;
  }
}

function getTodayDateText() {
  const today = new Date();
  const year = String(today.getFullYear());
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function getGoogleApiHeaders() {
  const authSession = GatesShared.readAuthSession(window.sessionStorage);

  if (!authSession?.accessToken) {
    throw new Error("인증 정보가 만료되었습니다. 다시 대상 시트를 골라 주세요.");
  }

  return {
    Authorization: `Bearer ${authSession.accessToken}`,
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || data.message || "요청에 실패했습니다.");
  }

  return data;
}

async function appendToSheet(spreadsheetId, range, rows) {
  return fetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        ...getGoogleApiHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rows }),
    },
  );
}

async function fetchActorProfile() {
  const authSession = GatesShared.readAuthSession(window.sessionStorage);

  try {
    const data = await fetchJson("https://www.googleapis.com/drive/v3/about?fields=user(displayName)", {
      headers: getGoogleApiHeaders(),
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
      headers: getGoogleApiHeaders(),
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
        ...getGoogleApiHeaders(),
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
  const authSession = GatesShared.readAuthSession(window.sessionStorage);

  if (!selection || !authSession?.accessToken) {
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
      <input type="number" name="amount" value="${draft.amount}" inputmode="numeric" min="0" step="1" placeholder="12000" required />
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
  const firstInput = row?.querySelector('input[type="text"], input[type="number"], select');
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

function getRowDraft(row) {
  syncDateField(row);

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
}

function getActiveEntryRow() {
  const focusedRow = document.activeElement?.closest?.('.entry-row');
  if (focusedRow) {
    return focusedRow;
  }

  const rows = entryRows.querySelectorAll('.entry-row');
  return rows.length > 0 ? rows[rows.length - 1] : null;
}

function duplicatePreviousRowFromFocus() {
  const currentRow = getActiveEntryRow();
  if (!currentRow) {
    return false;
  }

  const sourceRow = currentRow.previousElementSibling?.classList.contains('entry-row')
    ? currentRow.previousElementSibling
    : currentRow;

  const duplicatedRow = insertEntryRowAfter(currentRow, getRowDraft(sourceRow));
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
  if (isAddRowShortcut(event)) {
    event.preventDefault();
    const row = addEntryRow();
    focusFirstEditableField(row);
    return;
  }

  if (isDuplicatePreviousRowShortcut(event) && duplicatePreviousRowFromFocus()) {
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

entryRows.addEventListener("change", (event) => {
  const row = event.target.closest(".entry-row");

  if (event.target.matches('[name="type"]')) {
    syncCategoryOptions(row);
  }

  if (event.target.matches('[name="dateDisplay"]')) {
    syncDateField(row, { formatDisplay: true });
  }
});

entryRows.addEventListener("blur", (event) => {
  if (event.target.matches('[name="dateDisplay"]')) {
    syncDateField(event.target.closest('.entry-row'), { formatDisplay: true });
  }
}, true);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearResult();
  setLoadingState(true, "Google Sheets에 저장 중...");

  const selection = ensureSelection();
  if (!selection) {
    return;
  }

  try {
    const saveResult = await appendEntries(selection.spreadsheetId, collectEntryDrafts());
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
    setLoadingState(false);
  }
});

const selection = ensureSelection();
if (selection) {
  populateSelection(selection);
  resetRows();
}
