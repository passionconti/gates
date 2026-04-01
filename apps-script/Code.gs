const REQUIRED_FIELDS = ["date", "category", "amount"];

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("지출 입력")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitEntry(formData) {
  const config = getConfig_();
  const entry = normalizeEntry_(formData || {});
  const sheet = SpreadsheetApp.openById(config.spreadsheetId).getSheetByName(
    config.sheetName,
  );

  if (!sheet) {
    throw new Error("지정한 시트 탭을 찾을 수 없습니다.");
  }

  sheet.appendRow([
    entry.date,
    entry.category,
    entry.amount,
    entry.note,
    new Date(),
  ]);

  return {
    ok: true,
    message: "Google Spreadsheet에 저장했습니다.",
    entry,
  };
}

function setupSheet() {
  const config = getConfig_();
  const sheet = SpreadsheetApp.openById(config.spreadsheetId).getSheetByName(
    config.sheetName,
  );

  if (!sheet) {
    throw new Error("지정한 시트 탭을 찾을 수 없습니다.");
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["날짜", "카테고리", "금액", "비고", "저장시각"]);
  }
}

function saveConfig(spreadsheetId, sheetName) {
  if (!spreadsheetId || !sheetName) {
    throw new Error("spreadsheetId와 sheetName은 필수입니다.");
  }

  const properties = PropertiesService.getScriptProperties();

  properties.setProperties({
    SPREADSHEET_ID: spreadsheetId.trim(),
    SHEET_NAME: sheetName.trim(),
  });

  return {
    ok: true,
    message: "스크립트 설정을 저장했습니다.",
  };
}

function getConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty("SPREADSHEET_ID");
  const sheetName = properties.getProperty("SHEET_NAME");

  if (!spreadsheetId || !sheetName) {
    throw new Error(
      "스크립트 속성에 SPREADSHEET_ID와 SHEET_NAME을 먼저 설정해 주세요.",
    );
  }

  return { spreadsheetId, sheetName };
}

function normalizeEntry_(formData) {
  const date = String(formData.date || "").trim();
  const category = String(formData.category || "").trim();
  const amountText = String(formData.amount || "").trim();
  const note = String(formData.note || "").trim();

  for (const field of REQUIRED_FIELDS) {
    if (!String(formData[field] || "").trim()) {
      throw new Error("날짜, 카테고리, 금액은 필수입니다.");
    }
  }

  const amount = Number(amountText.replace(/,/g, ""));

  if (Number.isNaN(amount)) {
    throw new Error("금액은 숫자로 입력해 주세요.");
  }

  return {
    date,
    category,
    amount,
    note,
  };
}
