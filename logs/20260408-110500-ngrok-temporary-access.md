# ngrok temporary access

- branch: feature/ngrok-temporary-access
- scope: gates 로컬 서비스를 ngrok으로 외부에서 임시 접근 가능하게 테스트
- verified:
  - local health check at http://127.0.0.1:3000/healthz
  - ngrok tunnel creation after authtoken setup
  - external access to the app landing page through the issued ngrok URL
- note:
  - Google OAuth 웹 앱은 ngrok URL을 승인된 JavaScript 원본에 추가해야 로그인 가능
