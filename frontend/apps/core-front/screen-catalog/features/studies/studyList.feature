Feature: 스터디 목록

  Background:
    Given 사용자가 스터디 목록 페이지에 접속한다

  Scenario: 전체 목록 — 비로그인
    Then 스터디 카드들이 그리드로 보인다

  Scenario: 스터디 상세 — 모집 중
    Given "ai-paper-study" 스터디 상세 페이지에 접속한다
    Then 스터디 정보와 신청 버튼이 보인다

  Scenario: 스터디 상세 — 진행 중
    Given "system-design-interview-ongoing" 스터디 상세 페이지에 접속한다
    Then 스터디 정보가 보이고 신청 마감 상태이다
