const GOOGLE_DISCOVERY_WAIT_MS = 100;

const form = document.querySelector("#entry-form");
const result = document.querySelector("#result");
const submitButton = document.querySelector("#submit-button");
const configBanner = document.querySelector("#config-banner");
const loginButton = document.querySelector("#login-button");
const logoutButton = document.querySelector("#logout-button");
const refreshButton = document.querySelector("#refresh-button");
const authStatus = document.querySelector("#auth-status");
const spreadsheetSelect = document.querySelector("#spreadsheet-select");
const sheetSelect = document.querySelector("#sheet-select");
const spreadsheetLink = document.querySelector("#spreadsheet-link");

const state = {
  accessToken: null,
  config: null,
  tokenClient: null,
  spreadsheets: [],
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

function setBanner(message) {
  if (!message) {
    configBanner.classList.add("hidden");
    configBanner.textContent = "";
    return;
  }

  configBanner.classList.remove("hidden");
  configBanner.textContent = message;
}

function setLoadingState(active, label = "선택한 Google Sheets에 저장") {
  submitButton.disabled = active || !canSubmit();
  submitButton.textContent = active ? label : "선택한 Google Sheets에 저장";
}

function setSelectOptions(select, placeholder, items) {
  select.innerHTML = "";

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  select.append(placeholderOption);

  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.append(option);
  }
}

function updateSpreadsheetLink() {
  const selectedSpreadsheet = state.spreadsheets.find(
    (spreadsheet) => spreadsheet.id === spreadsheetSelect.value,
  );

  if (!selectedSpreadsheet?.webViewLink) {
    spreadsheetLink.classList.add("hidden");
    spreadsheetLink.href = "#";
    return;
  }

  spreadsheetLink.href = selectedSpreadsheet.webViewLink;
  spreadsheetLink.classList.remove("hidden");
}

function canSubmit() {
  return Boolean(state.accessToken && spreadsheetSelect.value && sheetSelect.value);
}

function updateUiState() {
  const isSignedIn = Boolean(state.accessToken);

  loginButton.disabled = !state.config?.configured;
  logoutButton.classList.toggle("hidden", !isSignedIn);
  refreshButton.disabled = !isSignedIn;
  spreadsheetSelect.disabled = !isSignedIn;
  sheetSelect.disabled = !isSignedIn || !spreadsheetSelect.value;

  authStatus.textContent = isSignedIn
    ? "Google 인증이 완료되었습니다. 편집 가능한 Spreadsheet를 선택해 주세요."
    : "아직 Google 인증이 완료되지 않았습니다.";

  setLoadingState(false);
  updateSpreadsheetLink();
}

function resetSpreadsheetSelection() {
  setSelectOptions(sheetSelect, "먼저 Spreadsheet를 선택해 주세요", []);
  sheetSelect.disabled = true;
  spreadsheetLink.classList.add("hidden");
  spreadsheetLink.href = "#";
}

function getGoogleApiHeaders() {
  return {
    Authorization: `Bearer ${state.accessToken}`,
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

async function waitForGoogleIdentityServices() {
  while (!window.google?.accounts?.oauth2) {
    await new Promise((resolve) => {
      window.setTimeout(resolve, GOOGLE_DISCOVERY_WAIT_MS);
    });
  }
}

async function loadConfig() {
  try {
    const data = await fetchJson("/api/config");
    state.config = data;

    if (!data.configured) {
      setBanner(
        `Google OAuth 설정이 아직 완료되지 않았습니다. 누락된 값: ${data.missingEnvVars.join(", ")}`,
      );
      updateUiState();
      return false;
    }

    setBanner("");
    return true;
  } catch (error) {
    setBanner("설정 상태를 불러오지 못했습니다. 서버가 정상적으로 실행 중인지 확인해 주세요.");
    return false;
  }
}

function initializeGoogleAuth() {
  state.tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: state.config.googleClientId,
    scope: state.config.scopes.join(" "),
    callback: async (response) => {
      if (response.error) {
        setResult("error", "Google 인증 중 오류가 발생했습니다.");
        return;
      }

      state.accessToken = response.access_token;
      clearResult();
      updateUiState();

      try {
        await loadSpreadsheets();
      } catch (error) {
        setResult("error", error.message);
      }
    },
  });
}

function requestGoogleAccessToken() {
  if (!state.tokenClient) {
    setResult("error", "Google 인증 클라이언트가 아직 준비되지 않았습니다.");
    return;
  }

  state.tokenClient.requestAccessToken({
    prompt: state.accessToken ? "" : "consent",
  });
}

function signOut() {
  if (state.accessToken && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(state.accessToken);
  }

  state.accessToken = null;
  state.spreadsheets = [];
  setSelectOptions(spreadsheetSelect, "로그인 후 파일 목록을 불러옵니다", []);
  resetSpreadsheetSelection();
  clearResult();
  updateUiState();
}

async function loadSpreadsheets() {
  clearResult();
  setSelectOptions(spreadsheetSelect, "Spreadsheet 목록을 불러오는 중...", []);
  resetSpreadsheetSelection();

  const params = new URLSearchParams({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    pageSize: "100",
    orderBy: "modifiedTime desc",
    fields: "files(id,name,capabilities/canEdit,webViewLink),nextPageToken",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });

  const data = await fetchJson(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: getGoogleApiHeaders(),
  });

  state.spreadsheets = (data.files || []).filter((file) => file.capabilities?.canEdit);

  if (state.spreadsheets.length === 0) {
    setSelectOptions(
      spreadsheetSelect,
      "편집 가능한 Spreadsheet를 찾지 못했습니다",
      [],
    );
    updateUiState();
    setResult("error", "편집 가능한 Google Spreadsheet를 찾지 못했습니다.");
    return;
  }

  setSelectOptions(
    spreadsheetSelect,
    "업데이트할 Spreadsheet를 선택해 주세요",
    state.spreadsheets.map((spreadsheet) => ({
      value: spreadsheet.id,
      label: spreadsheet.name,
    })),
  );

  updateUiState();
}

async function loadSheetsForSpreadsheet(spreadsheetId) {
  resetSpreadsheetSelection();
  sheetSelect.disabled = true;
  setSelectOptions(sheetSelect, "시트 탭을 불러오는 중...", []);
  updateSpreadsheetLink();

  const data = await fetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets(properties(title,sheetId))`,
    {
      headers: getGoogleApiHeaders(),
    },
  );

  const sheets = (data.sheets || [])
    .map((sheet) => sheet.properties?.title)
    .filter(Boolean);

  if (sheets.length === 0) {
    setSelectOptions(sheetSelect, "사용 가능한 시트 탭이 없습니다", []);
    setResult("error", "선택한 Spreadsheet에서 사용할 시트 탭을 찾지 못했습니다.");
    updateUiState();
    return;
  }

  setSelectOptions(
    sheetSelect,
    "기록할 시트 탭을 선택해 주세요",
    sheets.map((sheetName) => ({
      value: sheetName,
      label: sheetName,
    })),
  );

  sheetSelect.disabled = false;
  updateUiState();
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

loginButton.addEventListener("click", () => {
  requestGoogleAccessToken();
});

logoutButton.addEventListener("click", () => {
  signOut();
});

refreshButton.addEventListener("click", async () => {
  try {
    await loadSpreadsheets();
  } catch (error) {
    setResult("error", error.message);
  }
});

spreadsheetSelect.addEventListener("change", async () => {
  clearResult();

  if (!spreadsheetSelect.value) {
    resetSpreadsheetSelection();
    updateUiState();
    return;
  }

  try {
    await loadSheetsForSpreadsheet(spreadsheetSelect.value);
  } catch (error) {
    resetSpreadsheetSelection();
    setResult("error", error.message);
  }
});

sheetSelect.addEventListener("change", () => {
  updateUiState();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearResult();

  if (!canSubmit()) {
    setResult("error", "로그인 후 Spreadsheet와 시트 탭을 모두 선택해 주세요.");
    return;
  }

  setLoadingState(true, "Google Sheets에 저장 중...");

  try {
    const formData = new FormData(form);
    const values = buildEntryPayload(formData);

    await appendEntry(spreadsheetSelect.value, sheetSelect.value, values);

    form.reset();
    setResult("success", "선택한 Google Spreadsheet에 가계부 항목을 저장했습니다.");
  } catch (error) {
    setResult("error", error.message);
  } finally {
    updateUiState();
  }
});

async function initialize() {
  const hasConfig = await loadConfig();

  if (!hasConfig) {
    return;
  }

  await waitForGoogleIdentityServices();
  initializeGoogleAuth();
  updateUiState();
}

resetSpreadsheetSelection();
updateUiState();
initialize();
