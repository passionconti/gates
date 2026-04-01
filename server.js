const path = require("path");

const dotenv = require("dotenv");
const express = require("express");
const { google } = require("googleapis");

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const requiredEnvVars = ["GOOGLE_SHEETS_SPREADSHEET_ID", "GOOGLE_SHEETS_SHEET_NAME"];

function getMissingEnvVars() {
  return requiredEnvVars.filter((key) => !process.env[key]);
}

function buildSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

function validateEntry(body) {
  const date = String(body.date || "").trim();
  const category = String(body.category || "").trim();
  const amount = String(body.amount || "").trim();
  const note = String(body.note || "").trim();

  if (!date || !category || !amount) {
    return { ok: false, message: "날짜, 카테고리, 금액은 필수입니다." };
  }

  const parsedAmount = Number(amount.replace(/,/g, ""));

  if (Number.isNaN(parsedAmount)) {
    return { ok: false, message: "금액은 숫자로 입력해 주세요." };
  }

  return {
    ok: true,
    value: {
      date,
      category,
      amount: parsedAmount,
      note,
    },
  };
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (req, res) => {
  const missingEnvVars = getMissingEnvVars();

  res.json({
    ok: true,
    configured: missingEnvVars.length === 0,
    missingEnvVars,
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || null,
  });
});

app.get("/healthz", (req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/api/entries", async (req, res) => {
  const missingEnvVars = getMissingEnvVars();

  if (missingEnvVars.length > 0) {
    return res.status(500).json({
      ok: false,
      message: "Google Sheets 설정이 아직 완료되지 않았습니다.",
      missingEnvVars,
    });
  }

  const validation = validateEntry(req.body);

  if (!validation.ok) {
    return res.status(400).json(validation);
  }

  const { date, category, amount, note } = validation.value;
  const submittedAt = new Date().toISOString();

  try {
    const sheets = buildSheetsClient();

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `${process.env.GOOGLE_SHEETS_SHEET_NAME}!A:E`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[date, category, amount, note, submittedAt]],
      },
    });

    return res.json({
      ok: true,
      message: "Google Spreadsheet에 저장했습니다.",
      entry: { date, category, amount, note, submittedAt },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Google Spreadsheet 업데이트 중 오류가 발생했습니다.",
      detail: error.message,
    });
  }
});

app.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});
