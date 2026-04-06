const path = require("path");

const dotenv = require("dotenv");
const express = require("express");

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";
const requiredEnvVars = ["GOOGLE_OAUTH_CLIENT_ID"];

function getMissingEnvVars() {
  return requiredEnvVars.filter((key) => !process.env[key]);
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (req, res) => {
  const missingEnvVars = getMissingEnvVars();

  res.json({
    ok: true,
    configured: missingEnvVars.length === 0,
    missingEnvVars,
    googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || null,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ],
  });
});

app.get("/healthz", (req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});
