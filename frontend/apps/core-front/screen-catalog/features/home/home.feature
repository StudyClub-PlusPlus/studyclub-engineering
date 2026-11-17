# PRD 연결 정본: docs/frontend-development-guide/core-e2e-prd-map.md
# 설명용 명세. 실제 실행 범위는 .meta.ts의 assertions·steps이며 전체 행동 완료를 뜻하지 않는다.
Feature: 홈 랜딩

  Background:
    Given 사용자가 홈 페이지에 접속한다

  Scenario: 기본 홈 — 비로그인
    Then 스터디 카드 목록이 보인다
    And 이벤트 섹션이 보인다
    And 커뮤니티 통계가 보인다

  Scenario: 기본 홈 — 모바일
    Then 모바일 레이아웃으로 렌더된다
