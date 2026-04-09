const form = document.querySelector("#entry-form");
const result = document.querySelector("#result");
const submitButton = document.querySelector("#submit-button");
const addRowButton = document.querySelector("#add-row-button");
const entryRows = document.querySelector("#entry-rows");
const targetName = document.querySelector("#target-name");
const targetSheet = document.querySelector("#target-sheet");
const spreadsheetLink = document.querySelector("#spreadsheet-link");
const changeTargetLink = document.querySelector("#change-target-link");

const PAYMENT_METHOD_OPTIONS = ["", "현금", "카드", "계좌이체", "기타"];

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
  return new Date().toISOString().slice(0, 10);
}

function getGoogleApiHeaders() {
  const authSession = GatesShared.readAuthSession(window.sessionStorage);

  if (!authSession?.accessToken) {
    throw new Error("인증 정보가 만료되었습니다. 다시 대상 시트를 선택해 주세요.");
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

async function appendEntries(spreadsheetId, sheetName, rows) {
  const range = `${sheetName}!A:I`;

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
  targetSheet.textContent = selection.sheetName;

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
      const label = option || "선택 안 함";
      return `<option value="${option}"${selected}>${label}</option>`;
    })
    .join("");
}

function createRowElement(draft, rowId) {
  const article = document.createElement("article");
  article.className = "entry-row";
  article.dataset.rowId = String(rowId);
  article.innerHTML = `
    <div class="entry-row-header">
      <h3 class="entry-row-title">항목</h3>
      <button type="button" class="secondary remove-row-button">삭제</button>
    </div>
    <div class="entry-grid">
      <label>
        <span>날짜</span>
        <input type="date" name="date" value="${draft.date}" required />
      </label>
      <label>
        <span>수입/지출</span>
        <select name="type" required>
          ${buildSelectOptions(GatesEntryHelpers.ENTRY_TYPE_OPTIONS, draft.type)}
        </select>
      </label>
      <label>
        <span>카테고리</span>
        <input type="text" name="category" value="${draft.category}" placeholder="예: 식비, 교통, 급여" required />
      </label>
      <label>
        <span>내용</span>
        <input type="text" name="description" value="${draft.description}" placeholder="예: 점심, 택시, 월급" required />
      </label>
      <label>
        <span>명의</span>
        <input type="text" name="owner" value="${draft.owner}" placeholder="예: 본인, 법인카드" />
      </label>
      <label>
        <span>지출방식</span>
        <select name="paymentMethod">
          ${buildSelectOptions(PAYMENT_METHOD_OPTIONS, draft.paymentMethod)}
        </select>
      </label>
      <label>
        <span>금액</span>
        <input type="number" name="amount" value="${draft.amount}" inputmode="numeric" min="0" step="1" placeholder="예: 12000" required />
      </label>
      <label class="entry-grid-note">
        <span>비고</span>
        <input type="text" name="note" value="${draft.note}" placeholder="예: 팀 점심, 교통비 정산" />
      </label>
    </div>
  `;
  return article;
}

function updateRowLabels() {
  const rows = Array.from(entryRows.querySelectorAll(".entry-row"));

  rows.forEach((row, index) => {
    const title = row.querySelector(".entry-row-title");
    if (title) {
      title.textContent = `${index + 1}번째 항목`;
    }

    const removeButton = row.querySelector(".remove-row-button");
    if (removeButton) {
      removeButton.disabled = rows.length === 1;
    }
  });
}

function addEntryRow(draft = GatesEntryHelpers.createEmptyEntryDraft(getTodayDateText())) {
  const row = createRowElement(
    GatesEntryHelpers.sanitizeEntryDraft({
      ...GatesEntryHelpers.createEmptyEntryDraft(getTodayDateText()),
      ...draft,
    }),
    state.nextRowId++,
  );
  entryRows.append(row);
  updateRowLabels();
  return row;
}

function removeEntryRow(button) {
  const row = button.closest(".entry-row");
  if (!row || entryRows.children.length === 1) {
    return;
  }

  row.remove();
  updateRowLabels();
}

function collectEntryDrafts() {
  return Array.from(entryRows.querySelectorAll(".entry-row")).map((row) => ({
    date: row.querySelector('[name="date"]').value,
    type: row.querySelector('[name="type"]').value,
    category: row.querySelector('[name="category"]').value,
    description: row.querySelector('[name="description"]').value,
    owner: row.querySelector('[name="owner"]').value,
    paymentMethod: row.querySelector('[name="paymentMethod"]').value,
    amount: row.querySelector('[name="amount"]').value,
    note: row.querySelector('[name="note"]').value,
  }));
}

function resetRows() {
  entryRows.innerHTML = "";
  state.nextRowId = 1;
  addEntryRow();
}

addRowButton.addEventListener("click", () => {
  addEntryRow();
});

entryRows.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-row-button");
  if (!button) {
    return;
  }

  removeEntryRow(button);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearResult();
  setLoadingState(true, "Google Sheets에 저장 중...");

  const selection = ensureSelection();
  if (!selection) {
    return;
  }

  try {
    const rows = GatesEntryHelpers.buildEntryRowsPayload(collectEntryDrafts());
    await appendEntries(selection.spreadsheetId, selection.sheetName, rows);
    resetRows();
    setResult("success", `${rows.length}건의 가계부 항목을 선택한 Google Spreadsheet에 저장했습니다.`);
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
