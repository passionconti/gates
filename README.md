# gates

Google 계정으로 로그인한 뒤, 내가 편집 가능한 Google Spreadsheet 목록을 조회하고 원하는 파일/시트 탭을 선택해서 가계부 항목을 추가하는 앱입니다.

현재 저장소에는 두 가지 방식이 들어 있습니다.

- `apps-script/`: Apps Script 웹앱 버전
- 루트의 Node 코드: Google OAuth 기반 브라우저 앱 버전

## 새 Node 앱 기능

- 본인 Google 계정으로 OAuth 인증을 진행합니다.
- 편집 가능한 Google Spreadsheet 목록을 불러옵니다.
- 업데이트할 Spreadsheet 파일과 시트 탭을 선택합니다.
- 날짜, 카테고리, 금액, 비고를 선택한 시트에 한 줄씩 추가합니다.

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
GOOGLE_OAUTH_CLIENT_ID=your_google_oauth_client_id_here
```

## Google OAuth 설정

이 앱은 브라우저에서 Google Identity Services를 사용해 액세스 토큰을 받아 Drive API와 Sheets API를 직접 호출합니다.

### 사전 준비

1. Google Cloud Console에서 프로젝트를 하나 준비합니다.
2. `Google Sheets API`와 `Google Drive API`를 활성화합니다.
3. `OAuth 동의 화면`을 설정합니다.
4. `사용자 인증 정보`에서 `OAuth 클라이언트 ID`를 만듭니다.
5. 애플리케이션 유형은 `웹 애플리케이션`을 선택합니다.
6. 승인된 JavaScript 원본에 로컬 주소를 추가합니다.

예시:

- `http://localhost:3000`
- `http://127.0.0.1:3000`

배포 환경이 있다면 해당 URL도 같은 OAuth 클라이언트에 추가해야 합니다.

### 필요한 권한

앱은 아래 권한을 요청합니다.

- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/drive.metadata.readonly`

첫 번째 권한은 선택한 시트에 행을 추가할 때 필요하고, 두 번째 권한은 편집 가능한 Spreadsheet 목록을 보여줄 때 필요합니다.

## 사용 흐름

1. 앱을 열고 `Google 로그인` 버튼을 누릅니다.
2. 본인 계정으로 인증을 완료합니다.
3. 목록에서 편집 가능한 Spreadsheet 파일을 선택합니다.
4. 그 안에서 기록할 시트 탭을 선택합니다.
5. 날짜, 카테고리, 금액, 비고를 입력합니다.
6. 저장 버튼을 누르면 선택한 시트의 `A:E` 열에 다음 순서로 추가됩니다.

| A | B | C | D | E |
|---|---|---|---|---|
| 날짜 | 카테고리 | 금액 | 비고 | 저장시각 |

## 서버 API

### `GET /api/config`

프론트엔드가 Google OAuth 클라이언트 ID와 필요한 scope 목록을 읽어갈 수 있도록 설정 정보를 반환합니다.

### `GET /healthz`

서버 헬스 체크용 엔드포인트입니다.

## Apps Script 버전

조직 정책 때문에 OAuth 클라이언트 설정 대신 Apps Script 웹앱이 더 편하면 `apps-script/` 버전을 그대로 사용할 수 있습니다.

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

### 처음 한 번 실행

Apps Script 편집기에서 아래 함수를 한 번 실행하세요.

```text
setupSheet
```

이 함수는 시트가 비어 있으면 헤더 행 `날짜 / 카테고리 / 금액 / 비고 / 저장시각`을 만들어 줍니다.
