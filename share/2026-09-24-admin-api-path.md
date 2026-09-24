---
상태: 결정됨
물어볼 사람: — (권한 정책 확인은 기획)
---

# 백오피스 API 는 `/api/admin`, 관객이 둘이면 엔드포인트도 둘

## 한 줄 요약

백오피스 화면이 부르는 API 를 `/api/admin/...` 으로 가르고, 같은 일을 사용자 사이트에서도
한다면 **사이트용 엔드포인트를 따로** 만든다. 한 경로를 두 관객이 나눠 쓰지 않는다.

## 왜 — 지금 뭐가 문제였나

백오피스용 엔드포인트가 사용자 API 와 한 컨트롤러에 섞여 있었다. 권한은 메서드마다 붙는
애너테이션·가드 호출에만 걸려 있어서, 하나를 빠뜨리면 조용히 새는 구조였다.

경로를 가르다 구멍이 하나 더 드러났다 — **신청 폼 저장이 백오피스에만 있었다.**
백오피스는 캡틴만 들어갈 수 있는데(POL-0001), 자기 스터디 신청 폼은 네비게이터도 고쳐야 한다.
그대로 두면 네비게이터는 자기 폼을 영영 못 고친다.

## 정해진 것

1. **백오피스가 부르는 API 는 `/api/admin` 아래 둔다.** 리소스 경로는 그대로 이어 쓴다 —
   `/api/admin/studies/{studyId}/applications`
2. **컨트롤러도 관객으로 나눈다.** 공개 GET 과 운영 PUT 을 한 컨트롤러에 두지 않는다
3. **`/api/admin` 은 기본이 인증**이다. 공개로 열 일이 생기면 `/api` 쪽에 따로 만든다
4. **파일 이름은 `Admin*`** — `BackOffice*` 는 화면 이름이라 쓰지 않는다
5. **관객이 둘이면 엔드포인트도 둘.** 핸들러 본문은 공유하되 권한 게이트는 각자 건다

신청 폼이 그 예다.

| 경로 | 누가 | 판정 |
|---|---|---|
| `PUT /api/studies/{id}/application-form` | 그 스터디 네비게이터 **또는** 캡틴 | 스터디 범위 |
| `PUT /api/admin/studies/{id}/application-form` | 캡틴만 | 사이트 범위 |

권한 판정은 `StudyCaptainGuard` 한 곳에 모았다 — `assertCaptain`(캡틴만) /
`assertCaptainOrNavigator`(스터디 범위).

## 영향 — 누가 무엇을 다시 해야 하나

- **프론트(백오피스)** — 호출 경로에 `/api/admin` 접두가 붙는다. 기존 `/back-office/...` 는 없어진다
- **프론트(사용자 사이트)** — 네비게이터용 신청 폼 저장 화면을 붙일 수 있다 (`PUT /api/studies/{id}/application-form`)
- **백엔드** — 새 엔드포인트는 관객부터 정하고 경로를 고른다. 규약: [`docs/backend-development-guide/api/endpoint-convention.md`](../docs/backend-development-guide/api/endpoint-convention.md)

## 아직 안 정해진 것 (기획 확인 필요)

- 네비게이터가 **신청자 목록**도 사이트에서 봐야 하나. 지금은 백오피스(캡틴)에만 있다
- 선언적 권한(JWT authorities + `hasRole("ADMIN")`)으로 올리는 건 별도 작업으로 미뤘다.
  지금은 경로 분리 + 가드 호출로 막는다
- POL-0001 이 없애기로 한 `CO_LEADER` 가 코드에 아직 남아 있다 — 제거는 별도 이슈
