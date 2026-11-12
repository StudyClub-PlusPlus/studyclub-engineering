# PRD 연결 정본: docs/frontend-development-guide/core-e2e-prd-map.md
# 설명용 명세. 실제 실행 범위는 .meta.ts의 assertions·steps이며 전체 행동 완료를 뜻하지 않는다.
Feature: 안내 화면 (로그인 없이)

  Scenario: 소개
    Given 사용자가 소개 페이지에 접속한다
    Then 커뮤니티 소개와 숫자 · 스터디/행사 바로가기가 보인다

  Scenario: 이용 가이드
    Given 사용자가 이용 가이드에 접속한다
    Then 가입부터 참여까지의 흐름이 보인다

  Scenario: 행사 목록과 상세
    Given 사용자가 행사 목록에 접속한다
    Then 행사가 최신순 행으로 보인다
    When 예정된 행사를 누른다
    Then 행사 제목 · 일시 · 장소 · 소개가 보인다

  Scenario: 공지 목록 — 빈 상태
    Given 등록된 공지가 없다
    When 사용자가 공지 목록에 접속한다
    Then 공지가 없다는 안내가 보인다

  Scenario: 약관 · 처리방침
    Given 사용자가 이용약관 또는 개인정보 처리방침에 접속한다
    Then 문서 본문이 보인다
