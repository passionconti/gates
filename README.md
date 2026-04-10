# gates

Google 계정으로 로그인한 뒤, 내가 편집 가능한 Google Spreadsheet 목록을 조회하고 원하는 파일/시트 탭을 선택해서 가계부 항목을 추가하는 앱입니다.

현재 저장소에는 두 가지 방식이 들어 있습니다.

- `apps-script/`: Apps Script 웹앱 버전
- 루트의 Node 코드: Google OAuth 기반 브라우저 앱 버전

## 새 Node 앱 기능

- 본인 Google 계정으로 OAuth 인증을 진행합니다.
- 편집 가능한 Google Spreadsheet 목록을 불러옵니다.
- 업데이트할 Spreadsheet 파일과 시트 탭을 선택합니다.
- 여러 건의 가계부 항목을 한 번에 입력해 선택한 시트에 저장합니다.
- 각 항목은 날짜, 수입/지출 구분, 카테고리, 내용, 명의, 지출방식, 금액, 비고를 포함합니다.

## Node 앱 실행 방법

```bash
npm install
cp .env.example .env
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

## Makefile 커맨드

```bash
make install
make serve
make dev
make ngrok
make up
make status
make oauth-origin
make oauth-open
make stop
```

권장 흐름:

1. `make up`
2. 출력된 ngrok URL 확인
3. `make oauth-open`으로 Google Cloud Console 자격 증명 페이지 열기
4. `make oauth-origin` 출력값을 승인된 JavaScript 원본에 붙여 넣기

## 환경변수

`.env` 파일에 아래 값을 넣어 주세요.

```env
PORT=3000
HOST=127.0.0.1
GOOGLE_OAUTH_CLIENT_ID=your_g...here
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

### ngrok으로 임시 공개하기

1. 로컬에서 앱을 실행합니다.
2. 별도 터미널에서 `ngrok http 3000`을 실행합니다.
3. 발급된 `https://...ngrok-free.dev` 주소로 접속합니다.
4. Google Cloud Console의 OAuth 클라이언트 설정에서 `승인된 JavaScript 원본`에 해당 ngrok 주소를 추가합니다.
5. 저장 후 ngrok 주소를 새로고침하고 `Google 로그인`을 다시 시도합니다.

참고:
- ngrok을 같은 컴퓨터에서 실행한다면 `HOST=127.0.0.1` 그대로도 동작합니다.
- ngrok 무료 도메인은 매번 바뀔 수 있으니 주소가 바뀌면 OAuth 원본도 함께 갱신해야 합니다.
- 처음 접속하는 사용자는 ngrok 경고 페이지에서 `Visit Site`를 한 번 눌러야 할 수 있습니다.

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
5. 입력 화면에서 여러 줄의 가계부 항목을 작성합니다.
6. `+ 행 추가` 버튼으로 입력 줄을 늘릴 수 있습니다.
7. 저장 버튼을 누르면 선택한 시트의 `A:I` 열에 다음 순서로 여러 행이 추가됩니다.

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| 날짜 | 수입/지출 | 카테고리 | 내용 | 명의 | 지출방식 | 금액 | 비고 | 저장시각 |

## 서버 API

### `GET /api/config`

프론트엔드가 Google OAuth 클라이언트 ID와 필요한 scope 목록을 읽어갈 수 있도록 설정 정보를 반환합니다.

### `GET /healthz`

서버 헬스 체크용 엔드포인트입니다.

## Apps Script 버전

조직 정책 때문에 OAuth 클라이언트 설정 대신 Apps Script 웹앱이 더 편하면 `apps-script/` 버전을 그대로 사용할 수 있습니다.
