# ACCOUNT — 회원

로그인한 사람. 프로필·지역·디스코드 연결. 인증 수단은 [ACCOUNT_IDENTITY](./ACCOUNT_IDENTITY.md) 로 분리.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 | 
|---|---|---|---|
| ID | BIGINT PK | N | |
| EMAIL | VARCHAR(255) | N | 대표 이메일. UNIQUE |
| NICKNAME | VARCHAR(100) | N | 화면 표시명 UNIQUE |
| PROFILE_IMG_URL | VARCHAR(512) | Y | |
| JOB_TITLE | VARCHAR(100) | Y | SWE, PM … |
| COUNTRY_CODE | CHAR(2) | Y | ISO 3166-1 alpha-2 (`KR`, `US`, `CA`) |
| CITY | VARCHAR(100) | Y | |
| REGION_GROUP | VARCHAR(20) | Y | 권역 — `KR` / `NA` / `ETC`. 회차 시간대 묶음용 |
| SYSTEM_ROLE | VARCHAR(20) | N | 아래 |
| TIME_ZONE | VARCHAR(64) | Y | IANA (`Asia/Seoul`, `America/Los_Angeles`) |
| DISCORD_ID | VARCHAR(64) | Y | 디스코드 내부 식별자 (snowflake) |
| DISCORD_HANDLE | VARCHAR(64) | Y | 표시용 핸들 |
| ONBOARDING_COMPLETED_AT | DATETIME | Y | 온보딩 완료 시간 |

## 관계
- 1 : N [ACCOUNT_IDENTITY](./ACCOUNT_IDENTITY.md)
- 1 : N [ACCOUNT_CONSENT](./ACCOUNT_CONSENT.md)
- 세션 토큰은 [SESSION](./SESSION.md) (Redis 캐시 — DB 관계 없음)
- 1 : N [STUDY_APPLICATION](./STUDY_APPLICATION.md), [STUDY_PARTICIPANT](./STUDY_PARTICIPANT.md), [STUDY_ATTENDANCE](./STUDY_ATTENDANCE.md), [STUDY_REVIEW](./STUDY_REVIEW.md), [STUDY_BOOKMARK](./STUDY_BOOKMARK.md), [STUDY_PROPOSAL](./STUDY_PROPOSAL.md)

## 상태 — SYSTEM_ROLE

시스템 권한. 스터디 안에서의 역할(반장 등)은 여기가 아니라 [STUDY_PARTICIPANT.PARTICIPANT_ROLE](./STUDY_PARTICIPANT.md#상태--participant_role) 이다.

| 값 | 뜻 |
|---|---|
| `MEMBER` | 기본. 탐색·신청·출석·마이페이지 |
| `ADMIN` | 운영자. 백오피스 전 기능 |

전이는 운영자 수동뿐. 기본값 `MEMBER`.

## 제약
- `UNIQUE(EMAIL)`
- `UNIQUE(NICKNAME)` — 영문 대소문자를 구분하지 않고 중복 방지
- `UNIQUE(DISCORD_ID)` — NULL 허용

## 미확정
- drawio 는 `COUNTRY_CODE`·`TIME_ZONE`·`SYSTEM_ROLE` 이 NUMBER(코드). 여기서는 문자열 코드로 제안.
- 백오피스 접근이 현재는 이메일 허용 목록으로 동작 — `SYSTEM_ROLE=ADMIN` 으로 옮길지.
