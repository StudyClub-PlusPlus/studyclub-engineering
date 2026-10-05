# 운영 대시보드 화면·API Spec

> Playground: [운영 콘솔 대시보드](https://playground.studyclub-plusplus.com/proto/console)
> PRD: [캡틴은 스터디클럽 웹사이트의 운영 현황을 볼 수 있다](https://app.notion.com/p/benkang/91583feabad382ac833b81e65dd894f8)
> 작성일: 2026-09-16 · 수정일: 2026-10-04
> 대상: 캡틴용 운영 콘솔. 이 문서는 구현할 화면·집계·API 계약을 정의한다.
> 상태: 구현·리뷰 전. 논의 중인 정책과 변경 조건은 해당 화면과 7절에 기록한다.

## 1. 기준 화면과 용어

![운영 대시보드 기준 화면](./assets/dashboard-reference.png)

이미지는 화면 번호와 배치를 확인하는 참고 자료다. 화면은 구버전이며 수정될 예정. 화면 구현에는 아래 명세를 적용한다. 파란 번호·점선은 표시하지 않는다.

| 화면 번호 | 구성 |
|---|---|
| 1 / 1-1 | 제목 / 집계 기준·갱신 시각 |
| 2-1 | 활성 크루 |
| 2-2 / 2-2-1 | 평균 출석률 / 전주 대비 |
| 2-3 | 크루 1인당 참여 스터디 |
| 2-4 | 커뮤니티 멤버 |
| 3-1 / 3-2 | 진행중 스터디 / 모집중 스터디 |
| 4 | 크루 시간대 분포: KST·ET·PT·미분류 |
| 5 / 5-1 | 최근 12주 출석률 / 12주 평균 |
| 6 / 6-1 | 카테고리별 스터디 수 / 진행중·누적 전환 |

예정 행사(3-3), 외 N개(3-4), 복수 카테고리 안내(6-2)는 표시하지 않는다. 현황 보드는 두 영역으로 구성한다. 행사 API와 행사 mock 데이터는 사용하지 않는다.

| 용어 | 정의 |
|---|---|
| 기수 | `STUDY`. 같은 프로그램의 서로 다른 기수는 각각 1개로 센다 |
| 프로그램 | 기수의 상위 묶음인 `STUDY_PROGRAM` |
| 반 | 기수 안의 `STUDY_GROUP`. 반을 나눠도 기수 수는 늘지 않는다 |
| 참여 명부 | `STUDY_PARTICIPANT`. `STUDY_ID`로 기수, `STUDY_GROUP_ID`로 반에 연결한다 |
| 진행 중 기수 | 저장된 `STUDY.STATUS`가 `ONGOING`인 기수 |
| `asOf` | 서버가 정한 응답의 집계 기준 시각 |
| 조회자 시간대 | 갱신 시각·모집 날짜·주간 집계에 적용하는 시간대. 응답의 `timeZone` 값 |

## 2. 공통 규칙

### 2.1. 조회와 기준 시각

- 페이지 진입·새로고침 때 모든 영역을 조회한다. 기간 필터·자동 갱신·카드별 재시도 버튼은 제공하지 않는다.
- 서버는 한 응답에 같은 `asOf`를 적용한다. 활성 크루·활성 참여 건수·1인당 참여 수는 같은 참여 명부로 계산한다.
- 회차·모집 마감의 실제 시각은 UTC로 저장·전달한다. 브라우저는 시간대만 전달한다.
- API를 따로 조회하면 그 사이에 DB 값이 바뀔 수 있다. 서로 다른 응답의 수치는 조회 시점에 따라 달라질 수 있다. 각 응답 내부의 합계와 산식은 일치해야 한다.
- 프론트는 응답의 수치·목록·마감 문구를 다음 조회까지 유지한다. 기기의 현재 시각으로 집계하거나 모집 상태를 바꾸지 않는다.
- 출석·참여 상태·회원 설정 등 DB 변경은 다음 조회에 반영한다.

### 2.2. 조회자 시간대

1. 프론트는 페이지 진입·새로고침 때 `Intl.DateTimeFormat().resolvedOptions().timeZone`을 읽는다.
2. 감지한 값이 있으면 요약·현황 보드·출석 추세 API에 같은 `timeZone` Query를 전달한다.
3. 감지에 실패하거나 값이 없으면 세 API 모두 `timeZone` Query를 생략한다.
4. Query를 생략하면 서버는 유효한 `ACCOUNT.TIME_ZONE`을 사용한다. 회원 설정도 없거나 유효하지 않으면 `UTC`를 사용한다.
5. 서버는 적용한 시간대를 응답의 `timeZone`으로 반환한다. 프론트는 이 값으로 날짜를 표시한다.

브라우저 시간대가 회원 설정과 다르면 브라우저 시간대를 우선한다. 이 조회는 `ACCOUNT.TIME_ZONE`을 변경하지 않는다. 시간대 변경은 다음 조회에서 다시 감지한다.

명시한 Query가 빈 값이거나 유효하지 않으면 서버는 400 `INVALID_INPUT`을 반환한다. 이 경우 다른 시간대로 대체하지 않는다.

### 2.3. 주간 구간

- 한 주는 조회자 시간대의 **월요일 00:00 이상, 다음 월요일 00:00 미만**이다.
- 서버는 해당 시간대의 주 경계를 구한 뒤 UTC 시각으로 변환한다. 서머타임을 반영하며 고정 168시간으로 나누지 않는다.
- 모든 참여자의 회차를 같은 조회자 시간대로 구분한다. 주간 집계에는 회차의 `SCHEDULED_AT`을 사용한다.
- `weekStart`는 해당 시간대의 월요일 날짜(`YYYY-MM-DD`)다. 프론트는 이를 UTC 시각으로 변환하지 않는다.
- 조회자 시간대에 따라 주간 출석률·12주 평균은 달라질 수 있다. 같은 데이터·`asOf`의 전기간 출석률·회원 수·기수 수·크루 시간대 분포는 달라지지 않는다.
- 조회 중 주가 바뀌어 요약·추세의 기준 주가 다르면 두 API를 함께 다시 조회한다.
- 요약·현황 보드·추세 응답의 `timeZone`이 다르면 전체를 다시 조회한다.

### 2.4. 숫자·로딩·오류

| 값 | 화면 표시 |
|---|---|
| 인원·기수 수 | 정수, 천 단위 구분 기호 |
| 1인당 참여 수 | 소수 한 자리, `개` |
| 출석률 | 정수, `%` |
| 출석률 증감 | 필요한 경우 소수 한 자리, `%p` |
| `0` | 실제 0 |
| `null` | 집계 대상 없음. 각 카드의 빈 상태 적용 |
| 조회 실패 | 수치 대신 ‘정보를 불러오지 못했습니다.’ |

서버는 계산 정밀도를 유지한다. 프론트는 표시할 때만 반올림한다.

- 최초 조회·재조회 모두 같은 실패 표시를 사용한다. 실패한 카드에는 이전 데이터를 표시하지 않는다.
- 실패하지 않은 영역은 유지한다. KPI의 실패 범위는 화면 2를 따른다.
- 카드별 재시도 버튼과 상단 오류 안내는 표시하지 않는다. 페이지를 새로고침하면 모든 영역을 다시 조회한다.
- 권장 로딩 표시: 카드 크기를 유지하는 스켈레톤.
- 권장 접근성: 색과 함께 화살표·텍스트·범례·수치를 제공한다. 차트 툴팁·카테고리 행을 키보드로도 확인할 수 있게 한다.

### 2.5. 권한

`ACCOUNT.SYSTEM_ROLE = ADMIN`인 캡틴만 조회할 수 있다. 서버는 모든 대시보드 API에서 권한을 검사한다. 인증·권한 오류는 [운영 콘솔 로그인 명세](../back-office-login/spec.md)를 따른다.

## 3. 화면별 명세

### 1 / 1-1. 제목과 갱신 시각

| 위치 | 표시 |
|---|---|
| 왼쪽 | ‘대시보드’ |
| 오른쪽 | `전기간 기준 · YYYY-MM-DD HH:mm {시간대 표기} 갱신` |
| 요약 API 요청 실패 | 오른쪽에 `전기간 기준`만 표시 |

갱신 시각은 요약 응답의 `asOf`를 같은 응답의 `timeZone`으로 변환한 값이다. 해당 날짜의 시간대 표기를 붙인다. ‘N분 전’ 형식은 사용하지 않는다.

‘전기간’은 기간 필터가 없다는 뜻이다. 각 카드의 실제 집계 범위는 해당 명세를 따른다.

### 2. KPI 카드 공통

활성 크루 → 평균 출석률 → 크루 1인당 참여 스터디 → 커뮤니티 멤버 순서로 배치한다. 네 카드는 같은 비중으로 제목·수치·보조 문구를 표시한다. 전주 대비는 평균 출석률 카드 안에 표시한다.

요약 API는 다음 묶음별로 성공·실패를 반환한다. 상세 응답 계약은 4.2절을 따른다.

| 실패한 집계 | 오류를 표시할 카드 |
|---|---|
| `participation` | 활성 크루·크루 1인당 참여 스터디 |
| `attendance` | 평균 출석률·전주 대비 |
| `communityMembers` | 커뮤니티 멤버 |
| 요약 요청 전체 | 네 KPI. 별도 요청에 성공한 목록·차트는 유지 |

### 2-1. 활성 크루

| 항목 | 규칙 |
|---|---|
| 표시 | ‘활성 크루’, 인원 수, ‘진행 중 스터디 기준’ |
| 대상 | 진행 중 기수의 `STUDY_PARTICIPANT.STATUS = ACTIVE` 참여자 |
| 중복 제거 | 참여 건수는 `(ACCOUNT_ID, STUDY_ID)`, 회원 수는 `ACCOUNT_ID` 기준 |
| 운영 역할 | 실제 `ACTIVE` 참여자인 캡틴·반장·부반장 포함. 운영 권한만 있는 회원은 제외 |
| 제외 | `PAUSED / WITHDRAWN / COMPLETED / DELETED` 참여 건, 참여 명부가 없는 신청자 |
| 대상 없음 | `0` |
| 클릭 | 운영 콘솔 ‘유저’ 메뉴와 같은 전체 유저 목록. 별도 필터 없음 |

```text
활성참여 = 진행 중 기수의 ACTIVE 참여 명부에서 (ACCOUNT_ID, STUDY_ID)를 중복 제거한 집합
활성크루 = 활성참여에서 ACCOUNT_ID를 중복 제거한 집합
활성크루수 = 활성크루의 회원 수
```

신청 시에는 신청서만 저장한다. 캡틴이 반을 배정할 때 참여 명부를 생성한다. 대시보드는 실제 명부를 조회하며 별도 반 배정 필터를 추가하지 않는다.

진행 중 판정에는 저장된 `STUDY.STATUS = ONGOING`을 사용한다. 첫 미팅 등록에 따른 상태 전환은 스터디 도메인에서 처리한다. 시작일 경과로 진행 상태를 추정하지 않는다.

### 2-2. 평균 출석률

| 항목 | 규칙 |
|---|---|
| 표시 | ‘평균 출석률’, 정수 `%`, ‘전 스터디 · 지각 포함’ |
| 대상 | 웹 DB 전기간의 회원별 소속 반 회차. 진행 중 기수로 제한하지 않음 |
| 참여 상태별 상한 | `ACTIVE / PAUSED / COMPLETED`: `asOf`. `WITHDRAWN / DELETED`: `LEFT_AT` |
| 회차 조건 | `JOINED_AT <= SCHEDULED_AT <= 집계 상한`. 양쪽 경계 포함 |
| 떠난 시각 누락 | `WITHDRAWN / DELETED`인데 `LEFT_AT`이 없으면 해당 참여자의 기록 전체 제외 |
| 출석 점수 | `PRESENT = 1`, `EXCUSED = 1`, `LATE = 0.5`, `ABSENT = 0` |
| 미입력 | 대상 회차의 출석 행이 없어도 분모에 포함. 점수는 0 |
| 분모 0 | API `null`. 화면 ‘—’, ‘집계할 출석 대상이 없습니다.’ |
| 분모가 있고 모두 결석·미입력 | `0%` |

```text
집계 대상 수 = 참여 상태·회차 조건을 만족하는 회원 × 소속 반 회차 수
환산 출석수 = PRESENT 수 + EXCUSED 수 + 0.5 × LATE 수
출석률 = 100 × 환산 출석수 / 집계 대상 수
```

- `EXCUSED`·결석·미입력도 집계 대상 수에 포함한다. 출석 행만 세어 분모를 만들지 않는다.
- 합류 전·집계 상한 이후 회차는 제외한다. 실제 시작·종료나 출석 입력 완료를 조건으로 추가하지 않는다.
- 회원 탈퇴 후에도 보존된 참여 명부의 탈퇴 전 출석·결석을 포함한다. 현재 계정 존재 여부로 출석 대상을 제한하지 않는다.
- 이미 하차한 회원은 기존 `LEFT_AT`을 유지한다. 떠난 이후 회차는 집계 대상에서 제외한다.
- 다른 반 참석은 소속 반에 저장된 `EXCUSED`로 인정한다. 다른 반의 출석 기록을 별도로 더하지 않는다.
- 취소·미개최 회차에 별도 제외 조건을 추가하지 않는다. 위 회차 조건을 만족하면 공통 출석 계산에 포함한다.

서버는 평균 출석률·전주 대비·12주 추세에 `AttendanceRateCalculator.components()`를 공통으로 사용한다. 대상 참여자의 분자와 분모를 각각 합산한다. 반·기수별 출석률을 단순 평균하지 않는다.

계산기의 비율은 0 이상 1 이하다. 서버는 여기에 100을 곱해 API의 백분율 값으로 반환한다. 프론트는 다시 100을 곱하지 않는다. 분모가 0이면 `null`을 유지한다.

주간 집계는 `SCHEDULED_AT`을 조회자 시간대의 주간 구간으로 제한한 뒤 같은 산식을 적용한다. 프론트는 이미 계산된 출석률을 시간대에 맞춰 재계산하지 않는다.

**변경 가능 — 취소·미개최 회차**

- 현재는 위 조건을 만족하는 회차를 집계한다. 취소·미개최를 이유로 별도 제외하지 않는다.
- 출석 스쿼드가 공통 정책에 제외 조건을 추가하면 대시보드에도 같은 조건을 적용한다.
- 변경 시 평균 출석률·전주 대비·12주 추세·12주 평균을 함께 수정한다.
- 공통 정책이 바뀌기 전에는 현재 기준으로 개발한다. 대시보드만 별도 계산 규칙을 추가하지 않는다.

### 2-2-1. 전주 대비 출석률

- 이번 주는 조회자 시간대의 월요일 00:00부터 `asOf`까지다. 비교 대상은 직전 주 전체다.
- `증감(%p) = 이번 주 출석률 − 직전 주 출석률`이다. 두 주 모두 화면 2-2의 참여 기간·출석 점수를 적용한다.
- 화면에는 증감 숫자와 화살표만 표시한다. 상승은 `▲`, 하락은 `▼`와 색으로 구분한다. 차이가 0이면 중립 색상으로 `–0%p`를 표시한다.
- 어느 한 주라도 분모가 0이면 증감을 숨긴다. 빈 주를 건너뛰어 이전 주와 비교하지 않는다.
- 분모가 있고 모두 결석·미입력이면 `0%`로 비교한다. 카드의 큰 수치는 전기간 출석률을 유지한다.

### 2-3. 크루 1인당 참여 스터디

- 제목은 ‘크루 1인당 참여 스터디’, 보조 문구는 ‘진행 중 스터디 기준’이다.
- `화면 2-1의 활성참여 건수 / 활성크루수`로 계산한다. 값은 소수 한 자리와 `개`로 표시한다.
- 다른 기수에서 `ACTIVE`인 회원도 해당 회원의 `PAUSED` 참여 건은 포함하지 않는다.
- 분모가 0이면 API는 `null`을 반환한다. 화면은 ‘—’와 ‘활성 크루가 없습니다.’를 표시한다.

### 2-4. 커뮤니티 멤버

- 조회 시점에 존재하는 `ACCOUNT` 중 `ONBOARDING_COMPLETED_AT IS NOT NULL`인 고유 계정 수를 센다.
- 스터디 참여 여부·참여 상태·운영 역할은 집계에 영향을 주지 않는다. `WITHDRAWN`이어도 계정이 남아 있고 온보딩을 완료했으면 포함한다.
- 온보딩 전 계정·삭제된 계정·별도 탈퇴 이력은 제외한다.
- 제목은 ‘커뮤니티 멤버’, 보조 문구는 ‘온보딩 완료 회원’이다. 대상이 없으면 `0`을 표시한다.
- 클릭하면 운영 콘솔 ‘유저’ 메뉴와 같은 전체 유저 목록으로 이동한다. 별도 필터를 적용하지 않는다. 목록에는 온보딩 미완료 계정도 있을 수 있다.

### 3. 현황 보드 공통

- 진행중·모집중 보드를 동시에 표시한다. 넓은 화면은 같은 너비의 2열, 좁은 화면은 세로로 배치한다.
- 제목 옆에는 전체 대상 건수를 표시한다. 각 목록에는 최대 4건을 표시한다. 0건이어도 영역 높이를 유지한다.
- 상단 오른쪽에 ‘전체 보기’를 표시한다. 하단 ‘외 N개’와 탭 전환은 제공하지 않는다.
- 기수 이름은 `STUDY.TITLE`을 사용한다. 기수 번호를 추정하거나 같은 프로그램의 기수를 합치지 않는다.
- 이름을 클릭하면 `/studies/{studyId}`로 이동한다. 식별자는 `STUDY.ID`다.

| 보드 | 전체 보기 경로 | 목록 필터 |
|---|---|---|
| 진행중 | `/studies?view=ongoing` | 상태 ‘진행 중’ + 모집 전체 |
| 모집중 | `/studies?view=recruitment` | 상태 ‘개설’ + 모집 전체 |

전체 보기는 같은 대상·정렬의 첫 페이지를 연다. 카드에 표시한 항목도 포함한다. 다른 검색·필터는 초기화한다. `view`에 따른 API 요청은 4.4절을 따른다.

위 경로는 실제 서비스용 백오피스 경로다. Playground 경로에는 `/proto/console`을 앞에 붙인다.

### 3-1. 진행중 스터디

- `STUDY.STATUS = ONGOING`인 모든 기수를 표시한다. 참여자가 없어도 포함한다.
- 이름만 표시한다. 출석률·회차 수는 추가하지 않는다.
- 제목 오름차순으로 정렬한다. 제목이 같으면 기수 ID 오름차순으로 정렬한다.
- 대상이 없으면 ‘진행중 스터디가 없습니다.’를 표시한다.

같은 시점에 같은 기수가 두 보드에 동시에 포함되지는 않는다. 같은 프로그램의 서로 다른 기수는 각 보드에 표시할 수 있다.

### 3-2. 모집중 스터디

대상은 `STUDY.STATUS = OPEN`이며 모집 판정이 `RECRUITING / RECRUIT_CLOSED`인 기수다. 마감 후에도 `OPEN`인 동안 포함한다. 별도 일수 제한은 없다. 제목 옆 건수에는 두 모집 상태를 모두 포함한다.

#### 모집 판정

| 항목 | 규칙 |
|---|---|
| 마감 시각 | 해당 기수에서 ID가 가장 큰 `STUDY_RECRUITMENT`의 `RECRUIT_DEADLINE_AT` |
| 정원 | `STUDY.CAPACITY`. `null`이면 인원 제한 없음 |
| 정원을 차지하는 수 | 해당 `STUDY_ID`의 `ACTIVE + PAUSED` 참여 명부 건수. 활성 크루용 중복 제거는 적용하지 않음 |
| `RECRUIT_CLOSED` | 마감 시각이 있고 `asOf >= recruitDeadlineAt`, 또는 정원이 있고 명부 건수가 정원 이상 |
| `RECRUITING` | 위 마감 조건을 만족하지 않음 |
| 임박 | 모집중이며 마감까지 72시간 미만. 정확히 72시간이면 임박 아님 |

정원 계산은 `countByStudyIds()`, 임박 판정은 `Study.isClosingSoon()`의 기준을 사용한다. 서버는 두 판정에 같은 `asOf`를 적용한다.

**논의 중 — 정원 계산 단위**

- 현재는 기수 전체 정원과 `ACTIVE + PAUSED` 참여 명부 건수를 비교한다.
- 모집 회차별 정원과 해당 모집의 신청서 수를 비교하는 설계도 있다. 이 방식으로 전환할지는 스터디 스쿼드가 결정한다.
- 결정 전에는 현재 기준으로 개발한다. 변경안을 미리 적용하지 않는다.
- 공통 모집 정책이 바뀌면 대시보드의 모집 상태·정원 마감 표시·정렬과 전체 목록에 같은 기준을 적용한다.

수동 마감 신호·사유는 사용하지 않는다. 마감 시각이 변경되면 저장된 값으로 판정한다. 대시보드 조회는 DB 상태를 변경하지 않는다. 신청 API는 제출 시점에 공통 모집 규칙으로 신청 가능 여부를 검증한다.

#### 행 표시

이름은 왼쪽에 한 줄로 표시하고 길면 말줄임 처리한다. 마감 정보는 오른쪽에 줄바꿈 없이 정렬한다. 아래 표의 우선순위대로 문구를 선택한다.

| 우선순위 | 조건 | 표시 |
|---|---|---|
| 1 | 마감 시각 경과 | `~MM-DD (마감 경과)` |
| 2 | 마감 시각 미경과 또는 미등록, 정원 도달 | `~MM-DD (정원 마감)`. 날짜가 없으면 `정원 마감` |
| 3 | 모집중, 조회자 시간대에서 오늘 마감 | `~MM-DD (오늘 마감)` |
| 4 | 모집중, 임박 판정 참 | `~MM-DD (D-n · 임박)` |
| 5 | 모집중, 마감 시각 있음, 임박 판정 거짓 | `~MM-DD (D-n)` |
| 6 | 모집중, 마감 시각 없음 | `마감일 미등록` |

- 프론트는 응답의 `timeZone`으로 `MM-DD`와 `D-n`을 표시한다. `D-n`은 마감 날짜에서 `asOf` 날짜를 뺀 달력 날짜 차이다.
- 임박은 주의 색상, 오늘 마감·마감 경과·정원 마감은 경고 색상을 사용한다. 색과 문구를 함께 표시한다.
- 시간대에 따라 날짜·D-day·오늘 마감은 달라질 수 있다. 같은 데이터·`asOf`의 실제 마감·72시간 임박 판정은 달라지지 않는다.
- `RECRUITING`을 먼저, `RECRUIT_CLOSED`를 나중에 표시한다. 각 묶음은 마감 시각 오름차순으로 정렬한다. 마감이 없으면 마지막에 둔다. 동률은 제목·기수 ID 오름차순으로 정렬한다.
- 대상이 없으면 ‘모집중 스터디가 없습니다.’를 표시한다.

### 4. 크루 시간대 분포

화면 2-1의 활성 크루를 각 회원의 조회 시점 `ACCOUNT.TIME_ZONE`으로 분류한다. 회원당 한 번만 센다. 조회자의 시간대·브라우저 감지값·`REGION_GROUP`으로 재분류하지 않는다.

| 저장된 시간대 | 그룹 |
|---|---|
| `Asia/Seoul` | `KST` |
| `America/New_York`, `America/Toronto` | `ET` |
| `America/Vancouver`, `America/Los_Angeles` | `PT` |
| 그 외 값·null·빈 값·유효하지 않은 값 | `UNKNOWN` |

- 제목은 ‘크루 시간대 분포’, 안내는 ‘회원 설정 시간대 기준’이다.
- 도넛·인원·비율을 표시한다. 범례 순서는 ‘KST → ET → PT → 미분류’다.
- `비율 = 그룹 인원 / totalCrew × 100`이다. `UNKNOWN`도 분모에 포함한다. 그룹 인원 합은 응답의 `totalCrew`와 같아야 한다.
- 각 그룹의 비율은 독립적으로 반올림한다. 표시 비율의 합이 100%와 달라도 값을 보정하지 않는다. 원본 인원 합은 `totalCrew`와 일치해야 한다.
- `UNKNOWN`이 0명이면 해당 조각·범례를 숨긴다.
- 활성 크루가 없으면 모든 그룹의 인원은 0, 비율은 `null`이다. 차트·범례 대신 ‘활성 크루가 없습니다.’를 표시한다.
- 계정이 삭제되고 참여 명부가 `DELETED`인 회원은 제외한다. 미분류에도 포함하지 않는다.
- 회원이 시간대를 변경하면 DB 저장 후 다음 조회에 반영한다. 저장값은 이 조회에서 변경하지 않는다.

KST·ET·PT는 차트 그룹 코드다. 실제 날짜 계산에는 IANA 시간대를 사용한다. 조회자 시간대의 대체 규칙은 이 분류에 적용하지 않는다.

### 5 / 5-1. 평균 출석률 추세와 12주 평균

- 조회자 시간대의 이번 주를 포함한 최근 12주를 날짜 오름차순으로 표시한다.
- 이번 주는 `asOf`까지, 나머지 주는 해당 주 전체를 집계한다. 회차의 귀속 주는 `SCHEDULED_AT`으로 정한다.
- 각 주에 화면 2-2의 공통 출석 계산을 적용한다. 입력 시각·실제 시작 시각으로 귀속 주를 바꾸지 않는다.
- 분모가 0인 주는 `null`로 둔다. 해당 주를 가로질러 선을 연결하지 않는다.
- 분모가 있고 모두 결석·미입력이면 `0%` 점을 표시한다. 값이 한 주뿐이면 점 하나를 표시한다.
- 모든 주가 `null`이면 ‘집계할 출석 대상이 없습니다.’를 표시한다.
- 툴팁에는 주 시작일·`timeZone`·출석률·환산 출석수·집계 대상 수를 표시한다. 환산 출석수의 0.5 단위를 유지한다.

`12주 평균 = null이 아닌 주별 출석률의 합 / 해당 주 수`

서버는 반올림 전 주별 비율에 같은 가중치를 적용한다. `0%`인 주도 포함한다. 인원·기록 수로 가중하지 않는다.

화면은 정수 `%`로 ‘평균 N%’ 라벨과 기준선을 표시한다. 별도 큰 카드는 추가하지 않는다. 모든 주가 `null`이면 평균도 `null`이며 기준선·라벨을 숨긴다.

### 6 / 6-1. 카테고리별 스터디 수

| 항목 | 규칙 |
|---|---|
| 기본 범위 | ‘진행중’. 새로고침하면 기본값 적용 |
| 진행중 | `STUDY.STATUS = ONGOING` |
| 누적 | 조회 시점의 `OPEN / ONGOING / ENDED / CLOSED`. `DRAFT` 제외 |
| 집계 단위 | `STUDY.CATEGORY` 하나에 기수당 1개. `STUDY.ID`로 중복 제거 |
| 표시 | 카테고리 이름·개수·가로 막대. 선택 범위에서 0개인 카테고리는 숨김 |
| 정렬 | 개수 내림차순. 동률은 카테고리 코드 오름차순 |
| 막대 길이 | 선택 범위의 최대 개수를 100%로 계산 |
| 빈 상태 | ‘해당하는 스터디가 없습니다.’ |

각 범위의 카테고리 합계는 고유 기수 수와 같아야 한다. 누적은 현재 공개된 기수 전체다. 공개 취소로 `DRAFT`가 되면 다음 조회부터 제외한다.

행 전체를 클릭하면 다음 필터를 적용한 목록의 첫 페이지로 이동한다. 카테고리는 표시 이름이 아닌 코드로 전달한다.

| 범위 | 백오피스 경로 | 필터 |
|---|---|---|
| 진행중 | `/studies?view=ongoing&category={categoryCode}` | 해당 카테고리 + 진행 중 + 공개 |
| 누적 | `/studies?view=cumulative&category={categoryCode}` | 해당 카테고리 + 상태 전체 + 공개 |

공개는 `STUDY.STATUS != DRAFT`다. 누적 조회에 여러 상태를 배열로 전달하지 않는다. 모집·종류는 전체로 설정한다. 검색어·신청 폼 유무 등 나머지 조건은 해제한다.

프론트는 적용된 필터를 목록 화면에 표시한다. 사용자는 이동 후 필터를 변경할 수 있다. API 요청·정렬·페이지 규칙은 4.4절을 따른다.

## 4. API 계약

### 4.1. 공통 계약

현황 보드는 전용 API를 사용한다. 전체 보기·카테고리 목록은 `/api/admin/studies`를 사용한다. 두 API는 대상 선정·모집 판정·정렬 로직을 공유한다.

| Method | Path | 화면·용도 |
|---|---|---|
| GET | `/api/admin/stats/summary` | 1-1, 2: KPI·주간 비교 |
| GET | `/api/admin/stats/study-board` | 3-1, 3-2: 보드별 미리보기 |
| GET | `/api/admin/studies` | 전체 보기·카테고리별 목록 |
| GET | `/api/admin/stats/crew-timezones` | 4: 활성 크루 시간대 분포 |
| GET | `/api/admin/stats/attendance-trend` | 5, 5-1: 12주 추세·평균 |
| GET | `/api/admin/stats/studies-by-category` | 6: 진행중·누적 개수 |

- 모든 API는 `Authorization: Bearer <JWT>` 인증과 `@RequireAdmin` 검사를 적용한다.
- Path Parameter·Request Body는 없다. Query는 각 API 표를 따른다.
- 성공 응답에는 `success`·`data` 래퍼를 추가하지 않는다. enum은 대문자를 사용한다.
- `asOf`·`recruitDeadlineAt` 등 시각은 UTC ISO 8601로 전달한다.
- 요약·현황 보드·추세 API는 선택 Query `timeZone`을 받고 적용한 값을 반환한다.
- `timeZone`에는 유효한 IANA 시간대 ID 또는 `UTC`를 허용한다. 온보딩 선택지로 제한하지 않는다. 생략·오류 처리는 2.2절을 따른다.
- 시간대별 결과를 캐시하면 적용한 시간대를 캐시 키에 포함한다.
- 프론트 주소의 `view`는 목록 필터를 선택하는 값이다. `/api/admin/studies`에 그대로 전달하지 않는다.

예시의 날짜·수치는 설명용이다. 시간대가 있는 예시는 `timeZone=America%2FNew_York` 요청 기준이다.

| HTTP | errorCode | 조건 |
|---|---|---|
| 400 | `INVALID_INPUT` | 지원하지 않는 Query 값·형식·범위 |
| 401 | `UNAUTHORIZED` | 미로그인, 무효·만료 토큰, 토큰에 해당하는 계정 없음 |
| 403 | `FORBIDDEN` | 로그인한 계정에 ADMIN 권한 없음 |
| 500 | `INTERNAL_ERROR` | API가 사용할 수 있는 집계 응답을 반환하지 못함 |

빈 집계·목록은 200으로 반환한다. 조회 실패를 0이나 빈 데이터로 대체하지 않는다. 요약의 부분 성공은 4.2절을 따른다. 나머지 집계 API는 일부 데이터 집계가 실패해도 요청 전체를 실패 처리한다.

카드의 조회 실패 문구는 2.4절을 사용한다. 401·403은 공통 로그인·권한 처리를 따른다.

**403 응답**

```json
{
  "errorCode": "FORBIDDEN",
  "errorMessage": "권한이 없습니다."
}
```

### 4.2. GET /api/admin/stats/summary

네 KPI와 이번 주·직전 주 비교를 반환한다.

| Query | 타입 | 필수 | 조건 |
|---|---|---|---|
| timeZone | String | N | 2.2절의 시간대 규칙 |

| 집계 묶음 | 함께 반환할 필드 |
|---|---|
| `participation` | `activeCrew`, `activeEnrollments`, `studiesPerCrew` |
| `attendance` | `attendanceRate`, `attendanceComparison` |
| `communityMembers` | `communityMembers` |

- 일부 집계가 실패하면 200으로 성공 데이터와 `errors`를 반환한다.
- 실패한 묶음의 데이터 필드는 생략한다. `errors`에는 실패한 묶음만 넣는다.
- 성공한 묶음은 모든 필드를 반환한다. 값이 0이거나 분모가 없어 `null`이면 성공이다.
- 전체 집계가 성공하면 `errors={}`다. 전체 집계가 실패하면 공통 500을 반환한다.
- 입력·인증·권한 오류는 부분 성공으로 처리하지 않는다.
- 모든 200 응답에 `asOf`, `timeZone`, `errors`를 포함한다.
- 오류 정보와 데이터 필드가 불일치하면 프론트는 정상 값으로 보정하지 않는다.

**200 응답: 전체 성공**

```json
{
  "asOf": "2026-09-16T03:00:00Z",
  "timeZone": "America/New_York",
  "activeCrew": 2,
  "activeEnrollments": 3,
  "studiesPerCrew": 1.5,
  "communityMembers": 10,
  "attendanceRate": 75.0,
  "attendanceComparison": {
    "currentWeekStart": "2026-09-14",
    "previousWeekStart": "2026-09-07",
    "currentRate": 65.0,
    "previousRate": 85.0,
    "deltaPercentagePoints": -20.0
  },
  "errors": {}
}
```

**200 응답: 출석 집계 실패**

```json
{
  "asOf": "2026-09-16T03:00:00Z",
  "timeZone": "America/New_York",
  "activeCrew": 2,
  "activeEnrollments": 3,
  "studiesPerCrew": 1.5,
  "communityMembers": 10,
  "errors": {
    "attendance": {
      "errorCode": "INTERNAL_ERROR",
      "errorMessage": "출석 정보를 불러오지 못했습니다."
    }
  }
}
```

아래 NULL 허용 여부는 성공한 묶음에 적용한다.

| 필드 | 타입 | NULL | 의미·소스 |
|---|---|---|---|
| asOf | ISO 8601 datetime | N | 서버의 집계 기준 시각 |
| timeZone | String | N | 요청 Query 또는 생략 시 회원 설정 → UTC로 결정한 최종 적용 시간대. 주간 집계와 갱신 시각 표시에 사용 |
| activeCrew | Long | N | 2-1의 고유 ACCOUNT_ID 수 |
| activeEnrollments | Long | N | 2-1의 고유 (ACCOUNT_ID, STUDY_ID) 수. 분모와 일치하는 범위 확인용 |
| studiesPerCrew | Double | Y | activeEnrollments / activeCrew. 분모 0이면 null |
| communityMembers | Long | N | 현재 존재하는 ACCOUNT 중 ONBOARDING_COMPLETED_AT이 있는 고유 계정 수. 삭제된 계정·별도 탈퇴 이력 제외 |
| attendanceRate | Double | Y | 2-2의 전기간 출석률, 0 이상 100 이하. 분모 0이면 null |
| attendanceComparison | Object | N | 비교 구간은 데이터가 없어도 제공 |
| attendanceComparison.currentWeekStart | Date | N | 응답 timeZone 기준 이번 주 월요일 날짜 |
| attendanceComparison.previousWeekStart | Date | N | 같은 timeZone 기준 직전 주 월요일 날짜 |
| attendanceComparison.currentRate | Double | Y | 2-2 규칙으로 계산한 이번 주 asOf까지 출석률, 0 이상 100 이하. 분모 0이면 null |
| attendanceComparison.previousRate | Double | Y | 2-2 규칙으로 계산한 직전 주 전체 출석률, 0 이상 100 이하. 분모 0이면 null |
| attendanceComparison.deltaPercentagePoints | Double | Y | currentRate − previousRate. 둘 중 하나가 null이면 null |
| errors | Object | N | 집계 실패 정보. 키는 participation / attendance / communityMembers 중 실패한 묶음만 포함. 전부 성공하면 {} |
| errors.{집계 묶음}.errorCode | String | N | 해당 묶음의 집계 실패 코드. INTERNAL_ERROR |
| errors.{집계 묶음}.errorMessage | String | N | 사용자에게 공개 가능한 실패 설명. 내부 예외·쿼리 등은 포함하지 않음 |

### 4.3. GET /api/admin/stats/study-board

조건에 맞는 전체 기수 수와 첫 최대 4건을 반환한다. `ONGOING`은 화면 3-1, `RECRUITMENT`는 화면 3-2를 따른다.

| Query | 타입 | 필수 | 조건 |
|---|---|---|---|
| view | Enum | Y | `ONGOING / RECRUITMENT` |
| limit | Integer | N | 기본 4. 1 이상 4 이하. 대시보드는 4 사용 |
| timeZone | String | N | 2.2절의 시간대 규칙 |

서버는 화면 3-1·3-2의 정렬을 적용한 뒤 목록을 자른다. `offset`은 요청받지 않고 0으로 고정한다. `view` 누락·지원하지 않는 값·잘못된 `limit`은 400이다.

**200 응답: 모집 보드**

```json
{
  "asOf": "2026-09-16T03:00:00Z",
  "timeZone": "America/New_York",
  "view": "RECRUITMENT",
  "total": 2,
  "offset": 0,
  "limit": 4,
  "items": [
    {
      "studyId": 103,
      "programId": 10,
      "title": "시스템 디자인 3기",
      "recruitStatus": "RECRUITING",
      "recruitDeadlineAt": "2026-09-18T14:59:00Z",
      "deadlineBadge": "CLOSING_SOON"
    },
    {
      "studyId": 104,
      "programId": 11,
      "title": "데이터 분석 1기",
      "recruitStatus": "RECRUIT_CLOSED",
      "recruitDeadlineAt": "2026-09-15T14:59:00Z",
      "deadlineBadge": "DEADLINE_PASSED"
    }
  ]
}
```

| 필드 | 타입 | NULL | 의미·소스 |
|---|---|---|---|
| asOf / timeZone | Datetime / String | N | 공통 규칙 |
| view | Enum | N | `ONGOING` / `RECRUITMENT` 화면 구분. DB 상태값 아님 |
| total | Long | N | 보드 대상의 고유 기수 수, limit 적용 전 |
| offset | Integer | N | 고정 0. 전체 보기의 다음 페이지를 이 API로 조회하지 않음 |
| limit | Integer | N | 적용한 미리보기 최대 개수. items의 실제 개수와 다를 수 있음 |
| items | Array | N | 0개 이상 limit개 이하, 위 정렬 적용. 없으면 [] |
| items[].studyId | Long | N | 기수 ID인 STUDY.ID. 상세 화면 이동에 사용 |
| items[].programId | Long | N | 상위 프로그램 ID인 STUDY.PROGRAM_ID. 기수를 합쳐 집계하는 키로 사용하지 않음 |
| items[].title | String | N | 등록된 기수 제목 STUDY.TITLE |
| items[].recruitStatus | Enum | Y | 화면 3-2의 모집 판정: `RECRUITING / RECRUIT_CLOSED`. ONGOING이면 null |
| items[].recruitDeadlineAt | Datetime | Y | ID가 가장 큰 모집 회차의 RECRUIT_DEADLINE_AT. 미등록 또는 ONGOING이면 null |
| items[].deadlineBadge | Enum | Y | 아래 표의 기본 표시 코드. ONGOING이면 null |

서버는 아래 우선순위로 `deadlineBadge`를 선택한다. `TODAY` 코드는 반환하지 않는다.

| 우선순위 | 조건 | 코드 |
|---|---|---|
| 1 | 마감 시각 경과 | `DEADLINE_PASSED` |
| 2 | 정원 도달 | `CAPACITY_FULL` |
| 3 | 마감 시각 없음 | `DEADLINE_MISSING` |
| 4 | 마감까지 72시간 미만 | `CLOSING_SOON` |
| 5 | 그 외 | `NORMAL` |

- `ONGOING` 응답은 모집 상태·마감 시각·표시 코드를 `null`로 반환한다. 프론트는 이 필드를 숨긴다.
- 대상이 없으면 `total=0, items=[]`다.
- 서버는 같은 `asOf`로 `recruitStatus`와 `deadlineBadge`를 계산한다.
- 프론트는 응답의 `timeZone`으로 날짜·D-day를 표시한다. `daysUntilDeadline`은 반환하지 않는다.
- 모집중이고 마감 날짜가 `asOf` 날짜와 같으면 ‘오늘 마감’을 표시한다. 마감 경과·정원 마감 문구는 유지한다.
- 같은 데이터·기준 시각이면 보드와 전체 목록의 `total`이 같아야 한다. 보드의 항목·순서는 전체 목록의 첫 최대 4건과 같아야 한다.

### 4.4. GET /api/admin/studies

기존 관리자 목록의 필드와 페이지 응답을 유지한다. 공개·모집 필터, 정렬, `items[].recruitStatus`를 추가한다.

| Query | 타입 | 허용값·기본값 |
|---|---|---|
| category | Enum | `StudyCategory` 코드. 생략 시 전체 |
| studyKind | Enum | `STUDY / CLUB`. 생략 시 전체 |
| status | Enum | `DRAFT / OPEN / ONGOING / ENDED / CLOSED` 중 하나. 생략 시 전체 |
| studyId | Long | 특정 `STUDY.ID`. 생략 시 제한 없음 |
| visibility | Enum | `PUBLIC / PRIVATE`. 생략 시 전체 |
| recruitStatus | Enum | `RECRUITING / RECRUIT_CLOSED`. 생략 시 모집 조건 없음 |
| sort | Enum | `ID_DESC / TITLE_ASC / RECRUITMENT`. 기본 `ID_DESC` |
| offset | Integer | 기본 0. 0 이상 |
| limit | Integer | 기본 20. 1 이상 100 이하 |

- `PUBLIC`은 `STATUS != DRAFT`, `PRIVATE`는 `STATUS = DRAFT`다.
- `recruitStatus`를 지정하면 `OPEN`인 기수에 화면 3-2의 모집 판정을 적용한다.
- `ID_DESC`는 기수 ID 내림차순이다. `TITLE_ASC`는 제목·기수 ID 오름차순이다.
- `RECRUITMENT`는 화면 3-2의 정렬이다. `status=OPEN`과 함께 요청해야 한다. 다른 상태 또는 상태 생략은 400이다.
- 서버는 요청마다 하나의 기준 시각으로 모집 필터·정렬을 계산한다.
- 서버는 필터 → 정렬 → 페이지 추출 순서로 처리한다. `total`은 페이지 추출 전의 전체 건수다.
- 전달한 필터는 모두 적용한다. 유효한 조건끼리 충돌하면 `200, total=0, items=[]`를 반환한다.
- 지원하지 않는 enum·빈 필터·잘못된 숫자 형식·페이지 범위는 400 `INVALID_INPUT`이다.
- 끝을 넘는 `offset`은 200과 `items=[]`를 반환한다. 실제 `total`은 유지한다.

#### 프론트 주소와 요청 연결

다음 표의 Query에 `offset=0&limit=20`을 추가해 첫 페이지를 조회한다. 화면의 ‘전체’는 해당 Query를 생략한다.

| 프론트 주소의 진입 조건 | 목록 API Query |
|---|---|
| `view=ongoing` | `status=ONGOING&sort=TITLE_ASC` |
| `view=recruitment` | `status=OPEN&sort=RECRUITMENT` |
| `view=ongoing&category={code}` | `category={code}&status=ONGOING&visibility=PUBLIC&sort=TITLE_ASC` |
| `view=cumulative&category={code}` | `category={code}&visibility=PUBLIC&sort=ID_DESC` |

- 진입 시 나머지 검색·종류·신청 폼 조건을 초기화한다. 적용한 필터를 화면에 선택된 상태로 표시한다.
- 페이지를 넘기면 필터·정렬을 유지한다. 필터를 바꾸면 `offset`을 0으로 초기화한다.
- 상태를 `OPEN` 이외로 바꾸면 `RECRUITMENT` 정렬을 `ID_DESC`로 변경한다.
- 백오피스 프론트는 `/api/admin/studies`를 호출한다. 응답 타입·행 변환에 관리자 목록 계약을 적용한다.

#### 응답

`BackofficeStudyListResponse`의 항목 필드를 유지한다. `items`는 현재 페이지, `total`은 전체 건수, `offset / limit`은 적용한 페이지 값이다.

추가 필드 `items[].recruitStatus`는 nullable enum이다. `OPEN`이면 `RECRUITING / RECRUIT_CLOSED`, 다른 상태이면 `null`이다. 보드 전용 필드인 `view / asOf / timeZone / deadlineBadge`는 추가하지 않는다.

아래는 `status=OPEN&sort=RECRUITMENT&offset=0&limit=20` 응답이다. 4.3절 모집 보드 예시와 같은 데이터·기준 시각을 사용한다.

```json
{
  "items": [
    {
      "studyId": 103,
      "title": "시스템 디자인 3기",
      "status": "OPEN",
      "category": "SOFTWARE",
      "studyKind": "STUDY",
      "recruitmentCapacity": 20,
      "recruitmentStartAt": "2026-09-01T00:00:00Z",
      "recruitDeadlineAt": "2026-09-18T14:59:00Z",
      "startAt": null,
      "timezone": "KST",
      "hasApplicationForm": true,
      "recruitStatus": "RECRUITING"
    },
    {
      "studyId": 104,
      "title": "데이터 분석 1기",
      "status": "OPEN",
      "category": "DATA",
      "studyKind": "STUDY",
      "recruitmentCapacity": 10,
      "recruitmentStartAt": "2026-09-01T00:00:00Z",
      "recruitDeadlineAt": "2026-09-15T14:59:00Z",
      "startAt": null,
      "timezone": "KST",
      "hasApplicationForm": true,
      "recruitStatus": "RECRUIT_CLOSED"
    }
  ],
  "total": 2,
  "offset": 0,
  "limit": 20
}
```

### 4.5. GET /api/admin/stats/crew-timezones

화면 4의 인원·비율을 반환한다. Query는 없다. 조회자의 시간대는 분류에 영향을 주지 않는다.

**200 응답**

```json
{
  "asOf": "2026-09-16T03:00:00Z",
  "totalCrew": 2,
  "timeZoneGroups": [
    {"code": "KST", "count": 1, "percentage": 50.0},
    {"code": "ET", "count": 1, "percentage": 50.0},
    {"code": "PT", "count": 0, "percentage": 0.0},
    {"code": "UNKNOWN", "count": 0, "percentage": 0.0}
  ]
}
```

| 필드 | 타입 | NULL | 의미·소스 |
|---|---|---|---|
| asOf | Datetime | N | 공통 규칙 |
| totalCrew | Long | N | 이 API 기준 시점의 2-1 활성 크루 수 |
| timeZoneGroups | Array | N | `KST / ET / PT / UNKNOWN` 네 항목을 이 순서로 항상 반환. 미분류가 0명이면 프론트에서 해당 차트 조각·범례를 숨김 |
| timeZoneGroups[].code | Enum | N | 각 크루의 조회 시점 ACCOUNT.TIME_ZONE을 화면 4의 분류표로 분류한 그룹 코드 |
| timeZoneGroups[].count | Long | N | 해당 그룹의 고유 활성 회원 수. 합계 = totalCrew |
| timeZoneGroups[].percentage | Double | Y | count / totalCrew × 100. 미분류도 분모에 포함. totalCrew 0이면 null |

대상이 없어도 네 그룹을 반환한다. 각 `count`는 0, `percentage`는 `null`이다. 그룹별 부분 성공은 제공하지 않는다.

### 4.6. GET /api/admin/stats/attendance-trend

화면 5의 12주 출석률·동일 가중치 평균을 반환한다.

| Query | 타입 | 필수 | 조건 |
|---|---|---|---|
| weeks | Integer | N | 기본 12. 12만 허용 |
| timeZone | String | N | 2.2절의 시간대 규칙 |

**200 응답**

```json
{
  "asOf": "2026-09-16T03:00:00Z",
  "timeZone": "America/New_York",
  "averageRate": 75.0,
  "points": [
    {"weekStart": "2026-06-29", "isCurrentWeek": false, "weightedAttended": 0, "eligibleCount": 0, "rate": null},
    {"weekStart": "2026-07-06", "isCurrentWeek": false, "weightedAttended": 0, "eligibleCount": 0, "rate": null},
    {"weekStart": "2026-07-13", "isCurrentWeek": false, "weightedAttended": 0, "eligibleCount": 0, "rate": null},
    {"weekStart": "2026-07-20", "isCurrentWeek": false, "weightedAttended": 0, "eligibleCount": 0, "rate": null},
    {"weekStart": "2026-07-27", "isCurrentWeek": false, "weightedAttended": 0, "eligibleCount": 0, "rate": null},
    {"weekStart": "2026-08-03", "isCurrentWeek": false, "weightedAttended": 0, "eligibleCount": 0, "rate": null},
    {"weekStart": "2026-08-10", "isCurrentWeek": false, "weightedAttended": 0, "eligibleCount": 0, "rate": null},
    {"weekStart": "2026-08-17", "isCurrentWeek": false, "weightedAttended": 0, "eligibleCount": 0, "rate": null},
    {"weekStart": "2026-08-24", "isCurrentWeek": false, "weightedAttended": 0, "eligibleCount": 0, "rate": null},
    {"weekStart": "2026-08-31", "isCurrentWeek": false, "weightedAttended": 0, "eligibleCount": 0, "rate": null},
    {"weekStart": "2026-09-07", "isCurrentWeek": false, "weightedAttended": 8.5, "eligibleCount": 10, "rate": 85.0},
    {"weekStart": "2026-09-14", "isCurrentWeek": true, "weightedAttended": 6.5, "eligibleCount": 10, "rate": 65.0}
  ]
}
```

| 필드 | 타입 | NULL | 의미·소스 |
|---|---|---|---|
| asOf / timeZone | Datetime / String | N | 공통 규칙 |
| averageRate | Double | Y | points의 null이 아닌 rate의 동일 가중치 산술평균. 분모가 있는 주가 0개면 null |
| points | Array | N | 정확히 12개. 날짜 오름차순, 빈 주도 포함 |
| points[].weekStart | Date | N | 응답 timeZone 기준 각 주의 월요일 날짜. 회차 SCHEDULED_AT을 이 시간대로 변환해 귀속 주를 정함 |
| points[].isCurrentWeek | Boolean | N | asOf가 속한 주인지. 마지막 점만 true |
| points[].weightedAttended | Double | N | 2-2의 대상 중 PRESENT 수 + EXCUSED 수 + 0.5 × LATE 수. 0.5 단위를 유지 |
| points[].eligibleCount | Long | N | 2-2의 회원 × 회차 집계 대상 수. EXCUSED·미입력·ABSENT 포함 |
| points[].rate | Double | Y | 100 × weightedAttended / eligibleCount. 분모 0이면 null |

데이터가 없어도 12개 점을 반환한다. 빈 주는 `weightedAttended=0, eligibleCount=0, rate=null`이다. 일부 주의 실패를 `null`로 바꾸지 않는다. `weeks`가 12가 아니면 400이다.

### 4.7. GET /api/admin/stats/studies-by-category

화면 6의 진행중·누적 개수를 함께 반환한다. Query는 없다. 범위를 전환할 때 API를 다시 호출하지 않는다.

**200 응답**

```json
{
  "asOf": "2026-09-16T03:00:00Z",
  "categories": [
    {"code": "AI_ML", "ongoingCount": 2, "totalCount": 2},
    {"code": "SOFTWARE", "ongoingCount": 1, "totalCount": 2},
    {"code": "DATA", "ongoingCount": 0, "totalCount": 1}
  ]
}
```

| 필드 | 타입 | NULL | 의미·소스 |
|---|---|---|---|
| asOf | Datetime | N | 공통 규칙 |
| categories | Array | N | 카테고리별 집계. 없으면 [] |
| categories[].code | String | N | `STUDY.CATEGORY`의 StudyCategory 코드. 화면 라벨·목록 필터에 사용 |
| categories[].ongoingCount | Long | N | 해당 카테고리에서 상태가 `ONGOING`인 고유 `STUDY.ID` 수 |
| categories[].totalCount | Long | N | 해당 카테고리에서 상태가 `OPEN / ONGOING / ENDED / CLOSED`인 고유 `STUDY.ID` 수 |

두 범위 모두 0인 카테고리는 생략할 수 있다. 두 범위 모두 대상이 없으면 `categories=[]`다. 일부 카테고리의 실패를 0으로 바꾸지 않는다. 프론트는 선택 범위에 따라 정렬·막대·숨김을 적용한다.

## 5. 검증 기준

| 검증 대상 | 확인할 결과 |
|---|---|
| 권한·입력 | 미로그인·계정 없음 401, 일반 회원 403, 잘못된 Query 400 |
| 집계 단위 | 회원은 `ACCOUNT_ID`, 참여는 `(ACCOUNT_ID, STUDY_ID)`, 기수는 `STUDY.ID`로 중복 제거 |
| 진행 상태·명부 | `ONGOING`·실제 `ACTIVE` 명부만 활성 집계. 신청만 한 회원과 시작일만 지난 `OPEN` 기수는 제외 |
| 출석 참여 기간 | `JOINED_AT`·집계 상한 경계 포함. 탈퇴·하차 전 기록 보존. `LEFT_AT` 누락 시 해당 참여자 제외 |
| 출석 점수·빈 값 | 모두 `EXCUSED`면 100%. 결석·미입력만 있으면 0%. 분모 0이면 `null` |
| 공통 계산 | 같은 대상·시각이면 기존 출석 계산과 분자·분모 일치. 백분율 변환은 서버에서 한 번만 수행 |
| 시간대 선택 | 브라우저 우선. 감지 실패는 회원 설정 → UTC. 명시한 무효 값은 대체하지 않고 400 |
| 주간 경계 | 월요일 경계·서머타임 반영. `weekStart` 날짜를 UTC로 재해석하지 않음 |
| 조회 중 기준 변경 | 기준 주가 다르면 요약·추세 재조회. 응답 시간대가 다르면 전체 재조회 |
| 주간 비교·평균 | 직전 주 고정. 분모 0이면 증감 숨김. 12주 평균은 유효 주별 동일 가중치 |
| 시간대 분포 | 회원당 한 그룹. 인원 합계 = `totalCrew`. 비율은 개별 반올림하며 표시 합계를 보정하지 않음. 누락값은 `UNKNOWN`. 탈퇴 회원 제외 |
| 모집 경계 | 마감 시각과 같으면 마감. 정원과 같으면 마감. 72시간 미만만 임박 |
| 모집 표시 | 시각 경과 → 정원 마감 → 오늘 마감 → 임박 순서 적용. 마감 `null` 처리 확인 |
| 보드·목록 일치 | 같은 데이터·시각이면 보드 total·첫 4건이 전체 목록과 일치. 마감된 `OPEN` 기수 포함 |
| 목록 필터·페이지 | 주소에 맞는 필터 선택. 필터 → 정렬 → 페이지 추출. 끝을 넘는 offset에도 실제 total 유지 |
| 카테고리 | 단일 카테고리 합계 = 고유 기수 수. 누적에서 `DRAFT` 제외. 행 클릭 후 목록 total 일치 |
| 부분 실패 | 실패한 묶음의 필드 생략·errors 반환. 정상 영역 유지. 실패를 0·null로 대체하지 않음 |
| 빈 화면·로딩·클릭 | 카드별 빈 문구, 갱신 시각 누락, 전체 유저 목록·기수 상세·전체 보기 연결 확인 |
| 화면 구성 | KPI 4개·보드 2개 유지. 예정 행사·외 N개·복수 카테고리 안내 없음 |

## 6. 구현 참고

- [공통 출석 계산기](https://github.com/StudyClub-PlusPlus/studyclub-engineering/blob/a38aa64bdece9175c46acbea34222130621abd28/backend/api/src/main/java/com/studyclub/api/attendance/AttendanceRateCalculator.java) · [출석 조회 서비스](https://github.com/StudyClub-PlusPlus/studyclub-engineering/blob/a38aa64bdece9175c46acbea34222130621abd28/backend/api/src/main/java/com/studyclub/api/attendance/AttendanceService.java)
- [참여 명부](https://github.com/StudyClub-PlusPlus/studyclub-engineering/blob/a38aa64bdece9175c46acbea34222130621abd28/backend/domain/src/main/java/com/studyclub/domain/participant/StudyParticipant.java) · [신청 저장 흐름](https://github.com/StudyClub-PlusPlus/studyclub-engineering/blob/b755928d4f13a7d2508dfce3e2c0829473b979dd/backend/api/src/main/java/com/studyclub/api/application/StudyApplicationService.java)
- [모집 판정](https://github.com/StudyClub-PlusPlus/studyclub-engineering/blob/976e425b04db21e184252d77347e096d00459dd5/backend/domain/src/main/java/com/studyclub/domain/study/Study.java) · [정원용 참여 명부 집계](https://github.com/StudyClub-PlusPlus/studyclub-engineering/blob/976e425b04db21e184252d77347e096d00459dd5/backend/domain/src/main/java/com/studyclub/domain/participant/StudyParticipantRepository.java)
- [관리자 목록 요청](https://github.com/StudyClub-PlusPlus/studyclub-engineering/blob/a38aa64bdece9175c46acbea34222130621abd28/backend/api/src/main/java/com/studyclub/api/study/AdminStudyController.java) · [목록 응답](https://github.com/StudyClub-PlusPlus/studyclub-engineering/blob/a38aa64bdece9175c46acbea34222130621abd28/backend/api/src/main/java/com/studyclub/api/study/BackofficeStudyListResponse.java)
- [카테고리 코드](../../backend/domain/src/main/java/com/studyclub/domain/study/StudyCategory.java) · [회원 정보](../../backend/domain/src/main/java/com/studyclub/domain/account/Account.java)
- [공통 오류 코드](../../backend/common/src/main/java/com/studyclub/common/error/ErrorCode.java) · [스펙 작성 가이드](../../docs/backend-development-guide/spec-driven-development.md)

## 7. 논의 중인 항목과 변경 조건

| 항목 | 상태 | 현재 적용 기준 | 변경 조건·반영 범위 |
|---|---|---|---|
| 모집 정원 계산 단위 | 논의 중 | 화면 3-2의 기수 정원·참여 명부 기준 | 스터디 스쿼드가 공통 모집 정책을 변경하면 모집 보드·전체 목록에 함께 반영 |
| 취소·미개최 회차 | 공통 정책 변경 시 반영 | 화면 2-2의 참여 기간·회차 조건. 별도 취소 제외 조건 없음 | 출석 스쿼드가 공통 제외 조건을 추가하면 모든 출석 지표에 함께 반영 |

두 항목 모두 현재 명세로 개발할 수 있다. 정책 변경이 확정되면 해당 화면 규칙·API 계약·검증 기준을 함께 갱신한다. 구현·연동 완료 여부는 개발 리뷰에서 확인한다.
