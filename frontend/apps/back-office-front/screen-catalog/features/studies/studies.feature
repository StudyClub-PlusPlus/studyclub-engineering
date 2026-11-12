# PRD 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 전체 완료 기준과 예정 시나리오는 ../prd/*.feature에 있다.
Feature: 스터디 관리

  Background:
    Given 관리자가 인증된 상태로 접속한다 (테스트 인증 쿠키)

  # 실행 상태: study-list--default; 아래 PRD 시나리오의 일부 화면만 검증한다.
  @catalog-partial @relates-BO-ST-022-S01 @relates-BO-ST-022-V01
  Scenario: 스터디 목록
    Given 스터디 목록 페이지에 접속한다
    Then 스터디 표가 보인다

  # 실행 상태: study-detail--applicants; 아래 PRD 시나리오의 일부 화면만 검증한다.
  @catalog-partial @relates-BO-ST-025-S01 @relates-BO-ST-025-V02 @relates-BO-ST-026-S01 @relates-BO-ST-026-V01
  Scenario: 스터디 상세 — 신청자 탭 (study_id:1 ai-paper-study)
    Given /studies/1 에 접속한다
    When "신청자" 탭을 클릭한다
    Then 신청자 탭에 크루 목록이 보인다 (승인 대기 없음 — 신청한 사람은 곧 크루)

  # 실행 상태: study-detail--application-form; 아래 PRD 시나리오의 일부 화면만 검증한다.
  @catalog-partial @relates-BO-ST-023-S01 @relates-BO-ST-023-V06
  Scenario: 스터디 상세 — 신청 폼 탭
    Given /studies/1?tab=form 에 접속한다
    Then 신청 폼의 기본 질문과 추가 질문이 보인다

  # 실행 상태: study-detail--attendance; 아래 PRD 시나리오의 일부 화면만 검증한다.
  @catalog-partial @relates-BO-ST-027-S01 @relates-BO-ST-027-V01
  Scenario: 스터디 상세 — 출석 탭 (study_id:1 ai-paper-study)
    Given /studies/1 에 접속한다
    When "출석" 탭을 클릭한다
    Then 출석부 테이블이 보인다

  # 실행 상태: study-detail--info; 아래 PRD 시나리오의 일부 화면만 검증한다.
  @catalog-partial @relates-BO-ST-004-S01 @relates-BO-ST-004-V01 @relates-BO-ST-003-S01
  Scenario: 스터디 상세 — 정보 탭 (study_id:1 ai-paper-study)
    Given /studies/1 에 접속한다
    When "정보" 탭을 클릭한다
    Then 스터디 메타 정보가 보인다

  # 실행 상태: study-detail--schedule-empty; 아래 PRD 시나리오의 일부 화면만 검증한다.
  @catalog-partial @relates-BO-ST-025-S03 @relates-BO-ST-025-V03
  Scenario: 스터디 상세 — 일정 탭, 스터디 시간 없는 반
    Given /studies/1?tab=schedule 에 접속한다
    Then 「아직 이 반의 스터디 시간이 없습니다.」 안내와 「스터디 시간 정하기」 버튼이 보인다

  # 실행 상태: study-detail--schedule; 아래 PRD 시나리오의 일부 화면만 검증한다.
  @catalog-partial @relates-BO-ST-025-S04 @relates-BO-ST-025-S05
  Scenario: 스터디 상세 — 일정 탭, 킥오프 · 회차 있는 반
    Given 기본반에 킥오프와 지난 정규 회차 3개가 저장돼 있다 (고정 회차 API 응답 · localStorage bo_schedule_time:1)
    And /studies/1?tab=schedule 에 접속한다
    Then 정보 카드와 일정 표가 보인다
    And 킥오프가 0회차로 맨 위에 있고 제목 줄 버튼은 「킥오프 수정」이다
