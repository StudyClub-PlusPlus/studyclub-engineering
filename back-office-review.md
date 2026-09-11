# Back-office 코드 리뷰 메모

> 작성일: 2026-09-01  
> 범위: `frontend/apps/back-office-front`, back-office 인증과 연결된 `backend/api`  
> 성격: 현재 구현 상태를 기준으로 한 내부 점검 메모

## 요약

back-office는 대시보드, 스터디·행사 관리 화면, 유저 조회, Google OAuth 게이트를 갖춘 UI 프로토타입이다. 화면 구성과 mock 데이터 기반의 관심사 분리는 비교적 명확하지만, 실제 운영 데이터 변경과 권한 제어는 아직 배포 전 보완이 필요하다.

## 우선순위 이슈

### P1 — 일반 로그인 사용자도 전체 유저 정보를 조회할 수 있음

`/users` 엔드포인트는 인증 여부만 확인하고 역할을 확인하지 않는다. Spring Security도 해당 경로에 대해 `authenticated()`만 적용한다.

- `backend/api/src/main/java/com/studyclub/api/auth/UserController.java:10`
- `backend/api/src/main/java/com/studyclub/api/auth/security/SecurityConfig.java:40`
- `frontend/apps/back-office-front/src/app/api/users/route.ts:10`

현재 STUDENT도 이메일, 이름, 프로필 이미지, 역할, 가입일을 조회할 수 있다. `OPERATOR` 또는 `ADMIN` 권한을 백엔드에서 강제해야 하며, 프론트 메뉴 숨김만으로 해결해서는 안 된다.

### P1 — 토큰이 httpOnly 쿠키와 JSON 응답으로 동시에 노출됨

로그인 BFF는 access token을 httpOnly 쿠키에 저장하면서 access/refresh token을 응답 JSON에도 반환한다.

- `frontend/apps/back-office-front/src/app/api/auth/social/login/route.ts:35`

브라우저 클라이언트가 토큰을 직접 받을 필요가 없다. refresh token은 특히 JSON으로 반환하지 말고 httpOnly, secure 쿠키 또는 서버 측 세션으로 관리해야 한다.

### P1 — 생성·수정·삭제·승인·출석 변경이 실제 저장되지 않음

현재 성공 메시지만 표시하고 실제 API를 호출하지 않는다. 상태는 컴포넌트 메모리에서만 변경되므로 새로고침하면 사라진다.

- `frontend/apps/back-office-front/src/components/StudyCreateDialog.tsx:55`
- `frontend/apps/back-office-front/src/components/EventDialog.tsx:58`
- `frontend/apps/back-office-front/src/components/StudyInfoTab.tsx:48`
- `frontend/apps/back-office-front/src/components/StudyConsole.tsx:70`

백엔드 API가 준비되기 전까지는 성공 문구를 “화면 미리보기” 또는 “저장되지 않음”으로 표시하는 편이 운영자 오해를 줄인다.

### P1 — OAuth state/nonce 검증이 없음

로그인 팝업 메시지를 `data.source`만 확인해 처리하고, `event.origin`이나 실제 popup window를 검증하지 않는다.

- `frontend/apps/back-office-front/src/app/login/page.tsx:51`

OAuth 시작 시 state/nonce를 생성하고 콜백에서 검증해야 로그인 CSRF와 계정 혼동을 방지할 수 있다.

### P2 — `next` 파라미터 외부 리다이렉트 검증 부재

로그인 완료 후 query string의 `next` 값을 검증하지 않고 `router.replace(next)`를 실행한다.

- `frontend/apps/back-office-front/src/app/login/page.tsx:20`
- `frontend/apps/back-office-front/src/app/login/page.tsx:41`

`/`로 시작하는 내부 경로만 허용하고, 외부 URL이나 잘못된 값은 `/`로 대체해야 한다.

### P2 — 스터디 목록 빈 상태의 `colSpan` 오류

스터디 목록은 6개 컬럼을 렌더링하지만 빈 상태 행은 `colSpan={5}`로 되어 있다.

- `frontend/apps/back-office-front/src/components/StudiesTable.tsx:197`

`colSpan={6}`으로 수정해야 한다.

### P2 — 날짜 기반 상태가 빌드 시점에 고정될 가능성

`TODAY`가 모듈 로드 시점에 계산되고, mock 기반 페이지가 정적으로 생성될 수 있다.

- `frontend/apps/back-office-front/src/app/page.tsx:25`
- `frontend/apps/back-office-front/src/components/EventsTable.tsx:21`

실 API 연동 시 요청 시점 계산 또는 명시적인 `dynamic`/revalidate 정책을 적용해야 한다.

## 구조 및 품질 관찰

- 스터디와 행사 페이지는 `@studyclub/mock`을 사용하고, 유저 페이지는 실제 API를 사용한다. 데이터 소스가 혼합되어 있어 사용자가 보는 “운영 데이터”의 일관성이 낮다.
- `middleware`는 쿠키 존재 여부만 확인한다. 만료 여부와 역할 검증은 백엔드가 담당해야 한다.
- 로그아웃 쿠키에 `secure: true`가 명시되어 있지 않다. 운영 HTTPS 환경에서는 secure 쿠키 정책을 명시하는 것이 좋다.
- back-office 전용 테스트 파일은 확인되지 않았다.
- lint/typecheck/build는 코드 오류 이전에 WSL UNC 경로와 Windows npm 실행 환경 충돌로 완료하지 못했다.

## 권장 작업 순서

1. `/users`에 `OPERATOR`/`ADMIN` 권한 가드 추가
2. 로그인 응답에서 access/refresh token 제거 및 httpOnly 쿠키 기반 인증 통일
3. OAuth state/nonce와 내부 경로 검증 추가
4. 스터디·행사·승인·출석 API 연결
5. 빈 상태 UI와 날짜 갱신 문제 수정
6. 인증·권한·BFF·CRUD 흐름 테스트 추가

## 관련 파일

- `frontend/apps/back-office-front/src/middleware.ts`
- `frontend/apps/back-office-front/src/lib/auth.ts`
- `frontend/apps/back-office-front/src/app/api/auth/social/login/route.ts`
- `frontend/apps/back-office-front/src/app/api/users/route.ts`
- `backend/api/src/main/java/com/studyclub/api/auth/UserController.java`
- `backend/api/src/main/java/com/studyclub/api/auth/security/SecurityConfig.java`
