# gates

웹페이지에서 `날짜`, `카테고리`, `금액`, `비고`를 입력하면 지정한 Google Spreadsheet에 한 줄씩 추가하는 간단한 앱입니다.

현재 저장소에는 두 가지 방식이 들어 있습니다.

- `apps-script/`: 서비스 계정 키 없이 바로 쓸 수 있는 Google Apps Script 웹앱
- 루트의 Node 코드: Express와 Google Sheets API를 쓰는 서버 버전

## 기능

- 입력 폼으로 날짜, 카테고리, 금액, 비고를 받을 수 있습니다.
- 서버에서 Google Sheets API를 호출해 스프레드시트에 행을 추가합니다.
- 환경변수가 빠져 있으면 화면과 API에서 설정 누락 상태를 알려줍니다.

## 가장 쉬운 방법: Google Apps Script 버전

조직 정책 때문에 서비스 계정 키 생성이 막혀 있다면 `apps-script/` 방식이 가장 간단합니다.

### 파일 구성

- `apps-script/Code.gs`: 시트에 행을 추가하는 서버 코드
- `apps-script/Index.html`: 웹 입력 폼
- `apps-script/appsscript.json`: Apps Script 설정

### 설정 방법

1. Google Spreadsheet를 하나 만듭니다.
2. 메뉴에서 `확장 프로그램` > `Apps Script`를 엽니다.
3. 기본으로 생성된 `Code.gs` 내용을 지우고 `apps-script/Code.gs` 내용을 붙여 넣습니다.
4. `Index.html` 파일을 새로 만들고 `apps-script/Index.html` 내용을 붙여 넣습니다.
5. `프로젝트 설정` 또는 `스크립트 속성`에서 아래 값을 설정합니다.

```text
SPREADSHEET_ID=대상_스프레드시트_ID
SHEET_NAME=기록할_시트_탭_이름
```

스프레드시트 ID는 URL의 `/d/`와 `/edit` 사이 문자열입니다.

### 처음 한 번 실행

Apps Script 편집기에서 아래 함수를 한 번 실행하세요.

```text
setupSheet
```

이 함수는 시트가 비어 있으면 헤더 행 `날짜 / 카테고리 / 금액 / 비고 / 저장시각`을 만들어 줍니다.

### 웹앱으로 배포

1. 우측 상단 `배포` > `새 배포`를 누릅니다.
2. 유형은 `웹 앱`을 선택합니다.
3. 실행 사용자는 `나`로 둡니다.
4. 접근 권한은 용도에 맞게 선택합니다.
5. `배포`를 누르고 웹앱 URL을 복사합니다.

### 동작 방식

웹앱에서 제출하면 Apps Script가 같은 Google 계정 권한으로 스프레드시트에 한 줄을 추가합니다. 이 방식은 서비스 계정 프라이빗 키가 필요 없습니다.

## Node 앱 실행 방법

```bash
npm install
cp .env.example .env
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

## 환경변수

`.env` 파일에 아래 값을 넣어 주세요.

```env
PORT=3000
HOST=127.0.0.1
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SHEETS_SHEET_NAME=Sheet1
```

로컬에서는 `gcloud auth application-default login` 또는 Google Cloud 런타임 자격증명이 필요합니다.

## Cloud Run 배포 방식

이 Node 앱은 이제 서비스 계정 프라이빗 키 없이 ADC(Application Default Credentials) 방식으로 동작합니다. Cloud Run에 배포하면 런타임 서비스 계정 권한으로 Google Sheets API를 호출합니다.

### 사전 준비

1. Google Cloud 프로젝트에서 `Cloud Run API`와 `Google Sheets API`를 활성화합니다.
2. Cloud Run에서 사용할 서비스 계정을 정합니다.
3. 그 서비스 계정 이메일을 대상 스프레드시트에 `편집자`로 공유합니다.
4. 배포 시 환경변수 `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SHEETS_SHEET_NAME`를 설정합니다.

### 배포 예시

```bash
gcloud run deploy gates \
  --source . \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --service-account YOUR_SERVICE_ACCOUNT_EMAIL \
  --set-env-vars GOOGLE_SHEETS_SPREADSHEET_ID=YOUR_SPREADSHEET_ID,GOOGLE_SHEETS_SHEET_NAME=Sheet1
```

`asia-northeast3`는 서울 리전입니다. 다른 리전을 쓰고 싶으면 바꿔도 됩니다.

### 동작 원리

- 앱은 [server.js](/Users/contpassion/dev/gates/server.js#L1)에서 `google.auth.GoogleAuth`를 사용합니다.
- Cloud Run은 기본적으로 `PORT` 환경변수를 주입하므로 별도 포트 설정 없이 동작합니다.
- 컨테이너는 [Dockerfile](/Users/contpassion/dev/gates/Dockerfile#L1) 기준으로 빌드됩니다.

### 확인 포인트

- 배포 후 `GET /healthz`는 200을 반환해야 합니다.
- 입력 페이지에서 저장이 실패하면 Cloud Run 로그에서 Sheets 권한 오류 여부를 먼저 확인하세요.
- 가장 흔한 원인은 스프레드시트가 런타임 서비스 계정과 공유되지 않은 경우입니다.

## Google Sheets 설정 방법

1. Google Sheets API를 활성화합니다.
2. Cloud Run 런타임 서비스 계정 이메일을 대상 스프레드시트에 편집자로 공유합니다.
3. 스프레드시트 ID를 URL에서 복사해서 `GOOGLE_SHEETS_SPREADSHEET_ID`에 넣습니다.
4. 데이터를 쓸 시트 탭 이름을 `GOOGLE_SHEETS_SHEET_NAME`에 넣습니다.

앱은 기본적으로 아래 순서로 열을 추가합니다.

| A | B | C | D | E |
|---|---|---|---|---|
| 날짜 | 카테고리 | 금액 | 비고 | 저장시각 |

## API

### `GET /api/config`

Google Sheets 설정 여부를 반환합니다.

### `POST /api/entries`

아래 JSON을 보내면 한 줄을 추가합니다.

```json
{
  "date": "2026-04-01",
  "category": "식비",
  "amount": "12000",
  "note": "점심"
}
```
