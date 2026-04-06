const form = document.querySelector("#entry-form");
const result = document.querySelector("#result");
const submitButton = document.querySelector("#submit-button");
const targetName = document.querySelector("#target-name");
const targetSheet = document.querySelector("#target-sheet");
const spreadsheetLink = document.querySelector("#spreadsheet-link");
const changeTargetLink = document.querySelector("#change-target-link");

function setResult(type, message) {
  result.className = `result ${type}`;
  result.textContent = message;
  result.classList.remove("hidden");
}

function clearResult() {
  result.className = "result hidden";
  result.textContent = "";
}

function setLoadingState(active, label = "선택한 Google Sheets에 저장") {
  submitButton.disabled = active;
  submitButton.textContent = active ? label : "선택한 Google Sheets에 저장";
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

function buildEntryPayload(formData) {
  const date = String(formData.get("date") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const amountText = String(formData.get("amount") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!date || !category || !amountText) {
    throw new Error("날짜, 카테고리, 금액은 필수입니다.");
  }

  const amount = Number(amountText.replace(/,/g, ""));

  if (Number.isNaN(amount)) {
    throw new Error("금액은 숫자로 입력해 주세요.");
  }

  return [date, category, amount, note, new Date().toISOString()];
}

async function appendEntry(spreadsheetId, sheetName, values) {
  const range = `${sheetName}!A:E`;

  return fetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        ...getGoogleApiHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [values],
      }),
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearResult();
  setLoadingState(true, "Google Sheets에 저장 중...");

  const selection = ensureSelection();

  if (!selection) {
    return;
  }

  try {
    const formData = new FormData(form);
    const values = buildEntryPayload(formData);

    await appendEntry(selection.spreadsheetId, selection.sheetName, values);

    form.reset();
    const dateInput = form.querySelector('input[name="date"]');
    if (dateInput) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
    setResult("success", "선택한 Google Spreadsheet에 가계부 항목을 저장했습니다.");
  } catch (error) {
    setResult("error", error.message);
  } finally {
    setLoadingState(false);
  }
});

const selection = ensureSelection();
if (selection) {
  populateSelection(selection);
  const dateInput = form.querySelector('input[name="date"]');
  if (dateInput) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
}
