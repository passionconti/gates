const GOOGLE_DISCOVERY_WAIT_MS = 100;

const loginButton = document.querySelector("#login-button");
const logoutButton = document.querySelector("#logout-button");
const refreshButton = document.querySelector("#refresh-button");
const authStatus = document.querySelector("#auth-status");
const configBanner = document.querySelector("#config-banner");
const result = document.querySelector("#result");
const selectionForm = document.querySelector("#selection-form");
const continueButton = document.querySelector("#continue-button");
const spreadsheetSelect = document.querySelector("#spreadsheet-select");
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

function getSelectedSpreadsheet() {
  return state.spreadsheets.find((spreadsheet) => spreadsheet.id === spreadsheetSelect.value) || null;
}

function updateSpreadsheetLink() {
  const selectedSpreadsheet = getSelectedSpreadsheet();

  if (!selectedSpreadsheet?.webViewLink) {
    spreadsheetLink.classList.add("hidden");
    spreadsheetLink.href = "#";
    return;
  }

  spreadsheetLink.href = selectedSpreadsheet.webViewLink;
  spreadsheetLink.classList.remove("hidden");
}

function canContinue() {
  return Boolean(state.accessToken && spreadsheetSelect.value);
}

function updateUiState() {
  const isSignedIn = Boolean(state.accessToken);

  loginButton.disabled = !state.config?.configured;
  logoutButton.classList.toggle("hidden", !isSignedIn);
  refreshButton.disabled = !isSignedIn;
  spreadsheetSelect.disabled = !isSignedIn;
  continueButton.disabled = !canContinue();

  authStatus.textContent = isSignedIn
    ? "Google 인증이 완료되었습니다. 저장할 Spreadsheet를 선택해 주세요."
    : "아직 Google 인증이 완료되지 않았습니다.";

  updateSpreadsheetLink();
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

function saveAuthSession(accessToken, expiresIn) {
  const expiresAt = Number.isFinite(Number(expiresIn)) ? Date.now() + Number(expiresIn) * 1000 : null;

  GatesShared.persistAuthSession(window.sessionStorage, {
    accessToken,
    expiresAt,
  });
}

function restoreAuthSession() {
  const session = GatesShared.readAuthSession(window.sessionStorage);

  if (!session?.accessToken) {
    return;
  }

  if (session.expiresAt && session.expiresAt <= Date.now()) {
    GatesShared.clearAuthSession(window.sessionStorage);
    return;
  }

  state.accessToken = session.accessToken;
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
      saveAuthSession(response.access_token, response.expires_in);
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
  GatesShared.clearAuthSession(window.sessionStorage);
  GatesShared.clearSelection(window.localStorage);
  setSelectOptions(spreadsheetSelect, "로그인 후 파일 목록을 불러옵니다", []);
  clearResult();
  updateUiState();
}

async function loadSpreadsheets() {
  clearResult();
  setSelectOptions(spreadsheetSelect, "Spreadsheet 목록을 불러오는 중...", []);

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
    setSelectOptions(spreadsheetSelect, "편집 가능한 Spreadsheet를 찾지 못했습니다", []);
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
  restorePreviousSelection();
}

function restorePreviousSelection() {
  const savedSelection = GatesShared.readSelection(window.localStorage);

  if (!savedSelection?.spreadsheetId) {
    return;
  }

  const exists = state.spreadsheets.some((spreadsheet) => spreadsheet.id === savedSelection.spreadsheetId);

  if (!exists) {
    GatesShared.clearSelection(window.localStorage);
    return;
  }

  spreadsheetSelect.value = savedSelection.spreadsheetId;
  updateUiState();
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
    updateUiState();
    return;
  }
  updateUiState();
});

selectionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearResult();

  if (!canContinue()) {
    setResult("error", "Google 인증 후 저장할 Spreadsheet를 선택해 주세요.");
    return;
  }

  const selectedSpreadsheet = getSelectedSpreadsheet();

  GatesShared.persistSelection(window.localStorage, {
    spreadsheetId: spreadsheetSelect.value,
    spreadsheetName: selectedSpreadsheet?.name || "",
    webViewLink: selectedSpreadsheet?.webViewLink || "",
  });

  window.location.href = GatesShared.buildEntryPageUrl();
});

async function initialize() {
  setSelectOptions(spreadsheetSelect, "로그인 후 파일 목록을 불러옵니다", []);
  restoreAuthSession();
  updateUiState();

  const hasConfig = await loadConfig();

  if (!hasConfig) {
    return;
  }

  await waitForGoogleIdentityServices();
  initializeGoogleAuth();
  updateUiState();

  if (state.accessToken) {
    try {
      await loadSpreadsheets();
    } catch (error) {
      setResult("error", error.message);
    }
  }
}

initialize();
