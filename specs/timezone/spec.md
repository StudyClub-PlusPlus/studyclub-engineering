# 시간대 확장 — 공통 API·저장 계약

> 상태: **스펙작성중**
> 생성일: 2026-11-24
> 기획: [전 세계 시간대 확장 PRD](../../01-planning/stories/timezone-expansion/PRD.md) · 정책 [POL-0006](../../01-planning/_registry/policies/POL-0006-timezone.md) · Playground 반영 PR [#527](https://github.com/StudyClub-PlusPlus/studyclub-engineering/pull/527)
>
> ERD: [ACCOUNT](../../docs/erd/ACCOUNT.md) · [STUDY](../../docs/erd/STUDY.md) · [STUDY_RECRUITMENT](../../docs/erd/STUDY_RECRUITMENT.md) · [STUDY_GROUP](../../docs/erd/STUDY_GROUP.md)

가로 관심사 스펙이다. **온보딩·프로필·스터디·회차·행사·대시보드** 등 세로 도메인 스펙은 본 문서를 정본으로 삼고, 엔드포인트별 diff 는 각 `specs/{domain}/spec.md` 에 반영한다.

## 1. 범위

### 다루는 것

- 회원·운영자 **프로필 IANA** 저장·검증 확대
- **모집 시간대** (`unset` · `all` · `selected` + IANA 목록) 저장·조회·목록 필터
- 백오피스 **표시 시간대**(헤더) 서버 저장·API
- **회원 시간대 후보** 집계 API (모집·헤더 선택기 기본 목록)
- **서버 포맷 시각** (`FormattedInstant`) — 약칭·로컬 날짜·시각·오프셋을 응답에 포함 (화면이 재계산하지 않는다)
- beta `STUDY.TIMEZONE` enum(`KST`/`PST`/`BOTH`) → 모집 시간대 모델 이관
- 배포 전 데이터 이관 규칙 (PRD §4)

### 다루지 않는 것

- Playground 전용 localStorage·시드 JSON ([확장 PRD §8](../../01-planning/stories/timezone-expansion/PRD.md))
- 반/회차 UTC 보존·DST 상세 알고리즘 — [study-meeting/spec.md](../study-meeting/spec.md) · [회차 등록 PRD §8](../../01-planning/stories/navigator-register-sessions/PRD.md#8-시간대) (본 스펙은 표시·입력 **기준 시간대**만 통일)
- 행사 도메인 세부 — [event-registration/spec.md](../event-registration/spec.md) (행사 `timeZone`·신청 사본은 그 스펙, **포맷 타입**만 본 문서 공유). `EventLimits` 4지역 해제는 **다룸** (§11).

---

## 2. 값의 구분 (요약)

| 값 | 저장 위치 | 용도 | PRD |
|---|---|---|---|
| 회원 프로필 시간대 | `ACCOUNT.TIME_ZONE` | 크루 화면 시각 표시 기본 | §1 · §5 |
| 운영자 표시 시간대 | `ACCOUNT.ADMIN_DISPLAY_TIME_ZONE` | 백오피스 헤더·조회·마감 날짜 입력 해석 | §1 · §5 · §6 |
| 모집 시간대 | `STUDY_RECRUITMENT` (+ 자식 `STUDY_RECRUITMENT_ZONE`) | 모집 안내·사이트 필터 | §4 |
| 반 기준 시간대 | `STUDY_GROUP.TIMEZONE` | 회차 입력·반복 | §5 |
| 행사 기준 | `CLUB_EVENT.TIME_ZONE` | 행사 일정 입력 | §5 |
| 실제 순간 | 각종 `*_AT` (UTC) | 마감·일정 판정 | §6 |

모집 범위로 신청 차단·반 자동 편성은 하지 않는다 (POL-0006).

---

## 3. 공통 타입

### 3.1. IANA 시간대 문자열

- 형식: **명명된 IANA 지역 ID** (`Asia/Seoul`, `America/Los_Angeles` …). **Deprecated ID 는 저장 전 canonical ID 로 정규화**한다.
- 검증: `ZoneId.of(value)` 성공 + `value.length() ≤ 64` + **오프셋만 있는 ID 는 거부**한다 (`+09:00`, `UTC+09:00`, `GMT+9` 등). 서울과 도쿄를 구분할 수 있어야 한다.
- 고정 4개 화이트리스트는 **폐기**한다.
- 같은 오프셋의 다른 ID 를 합쳐 저장하지 않는다.

온보딩·`PATCH /api/me` · 행사·반 설정은 동일 검증기를 쓴다.

### 3.2. `RecruitmentTimeZones`

```json
{
  "mode": "selected",
  "zones": ["Asia/Seoul", "America/Los_Angeles"]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| mode | `unset` \| `all` \| `selected` | PRD §4 |
| zones | `string[]` | `selected` 일 때만 1개 이상 유효 IANA, 중복 없음. `unset`·`all` 은 항상 `[]` |

판정:

- `unset` — 모집 시간대 미정. `all`·`selected` 로 자동 승격하지 않는다. 사이트 카드·필터 요약에는 **`미정`** 으로 표시한다.
- `all` — 전 지역 모집. **어떤 지역 필터를 골라도** 목록에 포함된다 (`selected` 의 OR 와 함께).
- `selected` — `zones` 중 **하나라도** 일치하면 목록 필터 통과 (OR).

**사이트 목록 필터 예** (`recruitmentZone=America/Los_Angeles`):

- 노출: `mode=selected` 이고 `zones` 에 LA 가 있는 스터디 + `mode=all` + `mode=unset` 전부.
- 미노출: `selected` 인데 LA 가 없고 `all`·`unset` 도 아닌 스터디.

**필터 드롭다운 후보** (PRD §4):

- 출처: **공개** 스터디 전체(종료 포함, 비공개·DRAFT 제외)의 `selected` zones 만 모아 distinct.
- `mode=all` · `mode=unset` 은 후보 **항목을 추가하지 않는다** (선택 시 위 OR 규칙으로만 포함).
- `한국+LA` 스터디는 후보에 **한국** · **LA** 두 줄로 각각 뜬다 (조합 옵션 없음).

목록·상세 응답에 **항상** 이 객체를 넣는다 (`study` 스펙). 사이트 카드·필터 라벨용 `recruitmentTimeZoneLabel` 은 서버가 내려준다 (예: `한국 · LA`).

### 3.3. `FormattedInstant`

조회자(또는 명시 `displayTimeZone`) 기준으로 서버가 포맷한 시각. **구조화된 UI**에 쓰는 곳은 raw UTC + IANA 대신 이 타입을 우선한다.

```json
{
  "instant": "2026-09-15T14:59:59Z",
  "displayTimeZone": "Asia/Seoul",
  "localDate": "2026-09-16",
  "localTime": "23:59",
  "clock24": true,
  "abbreviation": "KST",
  "offsetLabel": "UTC+09:00"
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|---|---|---|---|---|
| instant | String (ISO-8601 UTC) | N | 저장 순간 | DB `DATETIME` |
| displayTimeZone | String | N | 포맷에 쓴 IANA | 요청·프로필·헤더 규칙 |
| localDate | String (`YYYY-MM-DD`) | N | 해당 지역 달력 날짜 | 계산 |
| localTime | String (`HH:mm`) | N | 24시간제 | 계산 |
| clock24 | Boolean | N | 항상 `true` | 고정 |
| abbreviation | String | Y | 해당 `localDate` 의 약칭 (KST·EDT·PST…). 규칙 없으면 null | 계산: TZDB + [약칭 표](#35-약칭-규칙) |
| offsetLabel | String | N | `UTC+09:00` 형태 (약칭 없을 때 보조) | 계산 |

선택 필드 (마감 등):

| 필드 | 설명 |
|---|---|
| `dDay` | Integer | Y | `localDate` 기준 오늘과의 일수 차. **마감 판정에는 쓰지 않는다** (PRD §6). 마감 후 null |

서버 구현은 `java.time` + **`backend/common`** 의 `TimeZoneFormatService`(약칭 표 §3.5 포함) 하나로 통일한다. 브라우저 `Intl` 과 1:1 일치를 요구하지 않으나, 통합 테스트는 PRD §9 시나리오(한국·LA·토론토 마감 동시성)로 고정한다.

### 3.4. `DisplayTimeZoneContext` (요청 해석 결과)

내부·메타 응답용. API 마다 `displayTimeZone` 단일 필드로도 충분하면 생략 가능.

| 맥락 | `displayTimeZone` 결정 순서 |
|---|---|
| 크루 사이트 조회 | `ACCOUNT.TIME_ZONE` → 클라이언트가 보낸 유효 `timeZone` Query → `Asia/Seoul` |
| 백오피스 조회·기록 포맷·**마감일·진행일 저장** | 요청의 `displayTimeZone` Query(= **현재 화면 헤더와 동기**) → `ADMIN_DISPLAY_TIME_ZONE` → `TIME_ZONE` → `Asia/Seoul`. 다른 기기에서 저장된 헤더가 **이 탭에 보이는 헤더보다 앞서면 안 된다** (PRD §6). |
| 백오피스 대시보드 집계 | Query `timeZone`(헤더) **우선**. **프로필로 덮어쓰지 않는다** (PRD §7, 기존 dashboard §2.2 대체) |
| 크루 사이트 **회차 표** 조회·기존 회차 수정 (캡틴·네비게이터) | 표에서 사용자가 고른 **임시 표시 시간대** → 프로필 → 기기 → `Asia/Seoul`. 프로필이 서울이어도 표에서 토론토를 고르면 조회·수정은 토론토 기준. |
| 회차 **신규** 입력·반복 | `STUDY_GROUP.TIMEZONE` (study-meeting). 표에서 고른 임시 값은 쓰지 않는다. |
| 행사 입력 | `CLUB_EVENT.TIME_ZONE` |

---

## 3.5. 약칭 규칙

Playground `time-zone-rules` · POL §날짜·시간과 정합:

| IANA (예) | 약칭 (해당 날짜 DST 반영) |
|---|---|
| `Asia/Seoul` | `KST` |
| `America/New_York` | `EST` / `EDT` |
| `America/Toronto` | `EST` / `EDT` |
| `America/Los_Angeles` | `PST` / `PDT` |
| `America/Vancouver` | 전환 **전**: 당시 TZDB 약칭(`PST`/`PDT`). **2026-03-08 이후** 일정: 겨울에도 시계를 되돌리지 않는 정책에 따라 연중 `UTC−7` 로 계산하고 **`PCT`** 로 표시 (POL-0006 · 기존 beta 호환). 예: 2026-11-05 LA 19:00 `PST` → 밴쿠버 회원에게 20:00 `PCT`. |
| 그 외 | TZDB short name 가능 시 사용, 없으면 `offsetLabel` 만 |

약칭 상수·밴쿠버 전환 규칙의 코드 정본: **`backend/common`** (§11).

모집 카드 **표기 라벨** (필터 UI): `Asia/Seoul` → `한국`, `America/Los_Angeles` → `미국 · LA` (PRD §4). API 필드명 `recruitmentZoneShortLabel`.

---

## 4. 스키마 변경 (제안)

### 4.1. `ACCOUNT`

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| `TIME_ZONE` | VARCHAR(64) | Y | **모든 유효 IANA**. ERD 문구 「넷만」 삭제 |
| `ADMIN_DISPLAY_TIME_ZONE` | VARCHAR(64) | Y | 운영자(`SYSTEM_ROLE=ADMIN`) 표시 기준. null 이면 §3.4 백오피스 fallback |

### 4.2. `STUDY_RECRUITMENT` (모집 회차당)

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| `RECRUITMENT_TZ_MODE` | VARCHAR(16) | N | `unset` · `all` · `selected`. 기본 `unset` |
| *(자식)* | | | |

### 4.3. `STUDY_RECRUITMENT_ZONE` (신규)

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| `ID` | BIGINT PK | N | |
| `STUDY_RECRUITMENT_ID` | BIGINT | N | FK 인덱스 (논리 FK) |
| `TIME_ZONE` | VARCHAR(64) | N | IANA. `mode=selected` 일 때만 1행 이상 |
| | | | `UNIQUE(STUDY_RECRUITMENT_ID, TIME_ZONE)` |

`STUDY.TIMEZONE` (`KST`/`PST`/`BOTH`) 컬럼은 이관 후 **읽기 전용·폐기 예정** — 신규 쓰기는 `STUDY_RECRUITMENT` 만.

### 4.4. 데이터 이관 (배포 배치)

| 기존 `STUDY.TIMEZONE` | 이관 결과 (`최신` 모집 회차) |
|---|---|
| `KST` | `mode=selected`, `zones=[Asia/Seoul]` |
| `PST` | `mode=selected`, `zones=[America/Los_Angeles]` |
| `BOTH` / `both` | `mode=selected`, `zones=[Asia/Seoul, America/Los_Angeles]` |
| `NULL` | `mode=unset`, `zones=[]` |
| 이미 IANA 로 저장된 밴쿠버 등 (해당 없음 — enum 만) | — |

이미 IANA 문자열이 다른 컬럼에 있으면 변경하지 않는다 (PRD §4).

확인 전 `unset`·빈 프로필을 `Asia/Seoul`·`all` 로 일괄 변환하지 않는다.

### 4.5. 레거시 모집 마감 (PRD §8 ① — **확정: A안**, 2026-11-24)

날짜 칸만 고르던 시절에 저장된 `STUDY_RECRUITMENT.RECRUIT_DEADLINE_AT` 는 **입력 당시 시간대 메타데이터가 없다.**

**A안 — UTC 는 절대 바꾸지 않는다.**

- 마감 **판정**(`recruitStatus` · `canApply` · 정원과 함께하는 서버 최종 판정)은 **저장된 UTC 순간만** 본다. 이관·확장 배치 SQL 로 `RECRUIT_DEADLINE_AT` 를 재계산·덮어쓰지 않는다.
- **표시**(`FormattedInstant` · D-day · 백오피스 날짜 칸)만 현재 규칙(헤더 → 프로필 → 서울)으로 UTC 를 해석한다. 달력에 보이는 날짜가 예전과 1일 어색해질 수 있어도 **신청 가능 여부는 동일**해야 한다.
- 의심 행은 운영에서 개별 확인·수동 PATCH 로만 고친다 — 일괄 가정(「전부 KST 로 넣었다」) 마이그레이션은 하지 않는다.

신규·수정 입력은 §6 · PRD §6(헤더 23:59:59 → UTC) 을 따른다.

---

## 5. 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|---|---|---|---|---|
| GET | `/api/admin/member-time-zones` | 회원 보유 IANA 후보 (선택기·집계) | ADMIN | 스펙작성중 |
| GET | `/api/admin/me/display-time-zone` | 운영자 표시 시간대 조회 | ADMIN | 스펙작성중 |
| PATCH | `/api/admin/me/display-time-zone` | 운영자 표시 시간대 저장 | ADMIN | 스펙작성중 |

도메인 기존 API 변경 요약:

| 도메인 | 변경 |
|---|---|
| 온보딩·`PATCH /api/me` | `timeZone` 검증 → §3.1 |
| `GET/POST/PATCH` 스터디 admin·site | `recruitmentTimeZones` · `FormattedInstant` 필드. `timezone` enum 필터 폐기 → `recruitmentZone` Query |
| 대시보드 stats | `timeZone` Query = 헤더 우선. `crew-timezones` → §10 · [dashboard §4.5](../dashboard/spec.md) 5칸 규칙 |
| 회차·행사·알림 등 | 응답에 `FormattedInstant` 적용 (후속 PR에서 필드 추가) |

---

## 6. GET `/api/admin/member-time-zones`

온보딩 완료·탈퇴하지 않은 **전체 계정**에서 `TIME_ZONE` 별 인원을 집계한다 (PRD §3). 헤더·모집 선택기 **기본 후보**가 이 API 를 페이지 **진입·새로고침** 때 부른다.

### Query

없음.

### Response — 200

```json
{
  "asOf": "2026-11-24T12:00:00Z",
  "items": [
    { "timeZone": "Asia/Seoul", "memberCount": 128 },
    { "timeZone": "America/Los_Angeles", "memberCount": 34 }
  ]
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|---|---|---|---|---|
| asOf | String | N | 집계 기준 시각 | `now()` |
| items | Array | N | `memberCount > 0` 만 내림차순, 동률 IANA 오름차순 | 계산 |
| items[].timeZone | String | N | IANA | `ACCOUNT.TIME_ZONE` distinct |
| items[].memberCount | Integer | N | 해당 시간대 계정 수 (1인 1표) | 계산 |

- 집계 대상: `ONBOARDING_COMPLETED_AT IS NOT NULL` · 탈퇴/삭제 제외 정책은 [user-leave](../user-leave/spec.md) 와 동일.
- `TIME_ZONE` 이 null·무효인 계정은 **items 에 넣지 않는다** (미설정은 별도 API 없음 — 선택기는 전체 IANA 검색으로 보완).
- **캐시**: 서버 메모리 또는 Redis, TTL 60s. `ACCOUNT.TIME_ZONE` 갱신·온보딩 완료·탈퇴 시 **캐시 무효화** (domain event 또는 `@CacheEvict`).
- 조회 실패 시 503 — 프론트는 PRD §3: 이전 후보 유지·재시도. 첫 실패에도 전체 IANA 검색은 가능.

### Error

| 상태 | errorCode | 조건 |
|---|---|---|
| 401 | UNAUTHORIZED | 미로그인 |
| 403 | FORBIDDEN | ADMIN 아님 |

### 프론트

- `back-office-front` 공통 헤더 · `RecruitmentTimeZoneField` 대응 컴포넌트

---

## 7. GET · PATCH `/api/admin/me/display-time-zone`

운영자별 백오피스 **헤더 표시 시간대** (3-a 서버 저장).

### GET — 200

```json
{
  "timeZone": "America/Toronto",
  "profileTimeZone": "Asia/Seoul",
  "effectiveDisplayTimeZone": "America/Toronto"
}
```

| 필드 | 설명 | 소스 |
|---|---|---|
| timeZone | 저장된 헤더 값. null 가능 | `ADMIN_DISPLAY_TIME_ZONE` |
| profileTimeZone | 회원 프로필 | `TIME_ZONE` |
| effectiveDisplayTimeZone | §3.4 백오피스 fallback 적용 결과 | 계산 |

헤더 기본값 우선순위 (UI): 이 브라우저에 저장된 유효 `timeZone` → `profileTimeZone` → 기기 감지 → `Asia/Seoul`. **서버는 `timeZone` 만 영구 저장**; 기기 감지는 클라이언트 초기 PATCH 제안용.

### PATCH — Body

```json
{ "timeZone": "America/Toronto" }
```

| 필드 | 필수 | 검증 |
|---|---|---|
| timeZone | Y | §3.1. 빈 문자열 불가 |

**200** — GET 과 동일 shape.

| 상태 | errorCode | 조건 |
|---|---|---|
| 400 | INVALID_INPUT | 무효 IANA |
| 401 / 403 | | 공통 |

프로필 `TIME_ZONE` 은 변경하지 않는다.

스터디 등록·수정에서 `recruitDeadline` · `startAt` 를 보낼 때는 **같은 요청**에 `displayTimeZone` Query(헤더 값)를 넣는다. 서버는 §3.4 백오피스 저장 행 순서로 날짜를 UTC 로 환산한다.

---

## 8. 도메인별 반영 인덱스

구현·리뷰 시 아래 스펙 절을 갱신한다 (본 PR: `profile-edit` · `study` · `dashboard` 요약 반영).

| 스펙 | 갱신 내용 |
|---|---|
| [user-onboarding](../user-onboarding/spec.md) | `@ValidTimeZone` → §3.1 |
| [profile-edit](../profile-edit/spec.md) | 시간대 넷 제한 삭제 → §3.1 · 선택기 UX PRD §2 |
| [study](../study/spec.md) | `STUDY.TIMEZONE` enum 폐기, `recruitmentTimeZones`, 목록 `recruitmentZone` 필터, `FormattedInstant` |
| [study-recruit-status](../study-recruit-status/spec.md) | 마감 `FormattedInstant` · UTC 판정 유지 |
| [dashboard](../dashboard/spec.md) | §2.2 헤더 Query 우선 · §4.5 IANA 분포 |
| [study-meeting](../study-meeting/spec.md) | 회차 표 임시 표시 시간대(조회·수정) vs 신규 입력(반 기준) — §3.4 |
| [study-group](../study-group/spec.md) | `STUDY_GROUP.TIMEZONE` IANA 전체 |
| [event](../event/spec.md) · [event-registration](../event-registration/spec.md) | 행사 응답에 `FormattedInstant`; **본 확장**에서 `EventLimits.TIME_ZONES` 4개 → §3.1 전 IANA (기존 event 구현 PR 과 분리) |
| [event-mail](../event-mail/spec.md) | 메일 변수에 서버 포맷 시각 |

---

## 9. 퍼널·계측

해당 없음 — 기존 화면의 시간대 선택·헤더 변경 이벤트가 있으면 [analytics/spec.md](../analytics/spec.md) 에만 추가하고 본 스펙은 API 계약만 다룬다.

---

## 10. 검증 (PRD §9 → 통합)

- `member-time-zones`: 프로필 변경 후 캐시 무효화 → 다음 GET 반영
- 모집 OR 필터: `한국+LA` 스터디가 양쪽 필터에 노출
- 마감: 동일 UTC 에서 한국·LA·토론토 `canApply` 동일, `dDay` 만 다를 수 있음
- 헤더 PATCH 후 저장 UTC 동일 (마감 미수정 시)
- `crew-timezones` 5칸: 합계 = 지역 수 + (`unset` 있으면 1). **≤5** → 전부·`other` 없음 (지역 4 + `unset` = 5칸). **>5·unset 있음** → 상위 3 + `other` + `unset` (지역 5 + `unset` → `other`에 2지역). **>5·unset 없음** → 상위 4 + `other` (지역 6 → `other`에 2지역)

---

## 11. 확정·미확정

- ~~PRD §8 ①~~ → **§4.5 A안 확정** (레거시 마감 UTC 비변경)
- ~~PRD §8 ②~~ → **`backend/common`** 에 약칭 표·`TimeZoneFormatService` (§3.3 · §3.5)
- ~~행사 `EventLimits`~~ → **시간대 확장 구현 범위**에 IANA 전체 포함. 과거 event PR 과 **별도 PR** 로 맞춘다 (§8 인덱스).

---

## 부록 A. beta 대비 breaking 요약

| 영역 | beta | 확장 후 |
|---|---|---|
| 프로필 시간대 | 4 IANA | 전 IANA |
| `STUDY.TIMEZONE` | KST/PST/BOTH | `recruitmentTimeZones` |
| 목록 `timezone` Query | enum | `recruitmentZone` (단일 IANA) |
| 대시보드 `timeZone` | 프로필 > Query | Query(헤더) > fallback |
| 시각 표시 | UTC + 클라이언트 | `FormattedInstant` (서버) |