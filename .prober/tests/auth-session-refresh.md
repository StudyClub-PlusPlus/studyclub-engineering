# 로그인 유지: 사용자 사이트와 백오피스

대상: `core-front`, `back-office-front`. 스테이지의 테스트 계정만 사용한다. 백오피스는 ADMIN 계정으로 확인한다.

access 토큰은 15분, refresh 토큰은 30일이다. 만료 재현은 브라우저에서 해당 앱의 access 쿠키만 삭제해도 가능하다. refresh 쿠키는 `/api/auth` 경로에 그대로 남겨 둔다. 토큰 값이나 실제 회원 정보는 결과·캡처에 기록하지 않는다.

| ID | 절차 | 기대 결과 |
|---|---|---|
| AUTH-SESSION-01 | 사용자 사이트 로그인 → access 만료 → 마이페이지·내 스터디룸으로 이동 | 갱신 후 원래 화면 표시. 로그인 화면을 요구하지 않음 |
| AUTH-SESSION-02 | 백오피스 로그인 → access 만료 → 메뉴 이동·새로고침 | 갱신 후 원래 화면과 검색·탭 쿼리 유지 |
| AUTH-SESSION-03 | 영문 사용자 사이트에서 access 만료 후 보호 화면 진입 | 갱신 성공 시 영문 경로 유지. refresh도 없으면 `/en/login`으로 이동 |
| AUTH-SESSION-04 | access 만료 후 화면 안에서 인증 API 요청 | 갱신 후 원래 요청 한 번 재시도. 성공 응답 표시 |
| AUTH-SESSION-05 | refresh 만료·무효화 후 보호 화면 진입 또는 API 요청 | 재로그인 요청. 무효 토큰의 쿠키 삭제. 무한 이동·재시도 없음 |
| AUTH-SESSION-06 | 갱신 서버에 429·5xx 또는 연결 실패 주입 | refresh 쿠키와 UI 로그인 정보 유지. 로그인 화면으로 보내지 않음 |
| AUTH-SESSION-07 | 화면 이동 중 갱신 장애 → 서버 복구 → 다시 시도 | 새 로그인 없이 원래 화면으로 복귀 |
| AUTH-SESSION-08 | 프록시 환경에서 갱신 성공·실패 | 내부 `localhost` 호스트로 이동하지 않음 |
| AUTH-SESSION-09 | 복귀 주소를 외부 URL·`//외부호스트`·정규화 뒤 외부 주소로 바뀌는 경로로 변경 | 사이트 내부의 안전한 기본 경로만 허용 |
| AUTH-SESSION-10 | 사용자 사이트·백오피스, stage·운영 쿠키를 함께 보유 | 해당 앱·환경의 쿠키만 읽거나 변경 |

로컬 회귀 테스트는 두 앱의 `middleware.test.ts`, `app/api/auth/refresh/route.test.ts`, `lib/http.test.ts`에 있다. 브라우저 검증은 백오피스의 `e2e/auth-session/playwright.config.ts`로 두 앱을 함께 실행한다.
