Feature: 스터디 관리

  Background:
    Given 관리자가 인증된 상태로 접속한다 (BO_DEV_BYPASS_AUTH=1)

  Scenario: 스터디 목록
    Given 스터디 목록 페이지에 접속한다
    Then 스터디 카드 목록이 보인다

  Scenario: 스터디 상세 — 신청자 탭 (study_id:1 ai-paper-study)
    Given /studies/1 에 접속한다
    Then 신청자 탭이 기본으로 열리고 크루 목록이 보인다

  Scenario: 스터디 상세 — 출석 탭 (study_id:1 ai-paper-study)
    Given /studies/1 에 접속한다
    When "출석" 탭을 클릭한다
    Then 출석부 테이블이 보인다

  Scenario: 스터디 상세 — 정보 탭 (study_id:1 ai-paper-study)
    Given /studies/1 에 접속한다
    When "정보" 탭을 클릭한다
    Then 스터디 메타 정보가 보인다
