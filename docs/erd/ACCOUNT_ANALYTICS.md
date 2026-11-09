# ACCOUNT_ANALYTICS

회원당 한 행에 수집 중단과 외부 삭제 진행을 저장한다. ACCOUNT에는 컬럼을 추가하지 않는다. 계정 삭제 후에도 처리할 수 있도록 외래키·cascade를 두지 않는다.

| 컬럼 | 타입 | 용도 |
|---|---|---|
| ACCOUNT_ID | BIGINT PK | 회원번호. ACCOUNT 행 유무로 탈퇴 판정 |
| ANALYTICS_USER_ID | VARCHAR(100), nullable | 한 번 생성·저장한 HMAC 분석 ID |
| OPTED_OUT_AT | DATETIME(6), nullable | 분석 중단 시각. 탈퇴 시에도 설정 |
| GA_CLIENT_IDS | TEXT, NOT NULL | 등록한 숫자형 브라우저 ID 목록. 중복 제거·최대 128개 |
| GA4_DELETION_STATUS | VARCHAR(20), NOT NULL | NOT_REQUESTED / REQUESTED. 대상 미생성 때만 DONE |
| AMPLITUDE_DELETION_STATUS | VARCHAR(20), NOT NULL | NOT_REQUESTED / REQUESTED / DONE |
| AMPLITUDE_DELETION_IDS | TEXT, nullable | 접수 응답의 내부 ID 목록. 모든 ID 완료 확인에 사용 |
| AMPLITUDE_DELETION_REQUESTED_AT | DATETIME(6), nullable | 해당 요청의 완료 조회 날짜 범위·이전 요청 구분 |
| CREATED_AT | DATETIME(6), NOT NULL | BaseEntity 생성 시각 |
| UPDATED_AT | DATETIME(6), NOT NULL | BaseEntity 수정 시각 |

별도 삭제 작업 테이블·키 버전 컬럼·삭제 요청 번호·다음 실행 시각·탈퇴 플래그는 두지 않는다.

중단 후 90초에 첫 외부 삭제를 시도하고 기존 일일 cleanup에서 실패 재시도·진행 조회한다. ACCOUNT_ID 순서로 나누어 처리한다. HTTP는 DB 트랜잭션 밖에서 실행한다.

GA4가 모든 식별자의 삭제를 접수하고 Amplitude가 완료되면 활성 회원의 식별자와 Amplitude 요청 시각을 비운다. 회원번호·중단 시각·상태는 유지해 다시 로그인해도 분석을 켜지 않는다. 탈퇴 회원은 행을 삭제한다. 이는 로컬 정리 조건이며 GA4 실제 완료 확인과는 다르다. GA4 REQUESTED를 DONE으로 자동 변환하지 않는다.

마이그레이션: V56. API·정책은 [분석 스펙](../../specs/analytics/spec.md), 실행 방법은 [운영 문서](../analytics-privacy.md).
