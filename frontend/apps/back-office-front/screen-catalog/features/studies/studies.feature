Feature: 스터디 관리

  Background:
    Given 관리자가 인증된 상태로 접속한다 (BO_DEV_BYPASS_AUTH=1)

  Scenario: 스터디 목록
    Given 스터디 목록 페이지에 접속한다
    Then 스터디 카드 목록이 보인다

  Scenario: 스터디 크루 관리 — ai-paper-study
    Given "ai-paper-study" 스터디 상세 페이지에 접속한다
    Then 크루 목록과 출석 테이블이 보인다
