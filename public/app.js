const form = document.querySelector("#entry-form");
const result = document.querySelector("#result");
const submitButton = document.querySelector("#submit-button");
const configBanner = document.querySelector("#config-banner");

function setResult(type, message) {
  result.className = `result ${type}`;
  result.textContent = message;
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const data = await response.json();

    if (!data.configured) {
      configBanner.classList.remove("hidden");
      configBanner.textContent =
        "Google Sheets 연결이 아직 설정되지 않았습니다. .env 파일에 스프레드시트 ID, 시트 이름, 서비스 계정 정보를 넣어 주세요.";
    }
  } catch (error) {
    configBanner.classList.remove("hidden");
    configBanner.textContent =
      "설정 상태를 불러오지 못했습니다. 서버가 정상적으로 실행 중인지 확인해 주세요.";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  submitButton.disabled = true;
  submitButton.textContent = "저장 중...";
  result.classList.add("hidden");

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch("/api/entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "저장에 실패했습니다.");
    }

    setResult("success", data.message);
    form.reset();
  } catch (error) {
    setResult("error", error.message);
  } finally {
    result.classList.remove("hidden");
    submitButton.disabled = false;
    submitButton.textContent = "Google Sheets에 저장";
  }
});

loadConfig();
