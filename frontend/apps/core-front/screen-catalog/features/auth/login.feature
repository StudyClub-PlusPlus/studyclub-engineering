# PRD 연결 정본: docs/frontend-development-guide/core-e2e-prd-map.md
# 설명용 명세. 실제 실행 범위는 .meta.ts의 assertions·steps이며 전체 행동 완료를 뜻하지 않는다.
Feature: 로그인

  Scenario: 로그인 페이지 — 기본
    Given 사용자가 로그인 페이지에 접속한다
    Then Google 로그인 버튼이 보인다

  Scenario: 마이페이지 — 내 정보
    Given 로그인한 회원이 마이페이지에 접속한다
    Then 사진 · 닉네임 · 이메일 · 시간대 · 디스코드 · 마케팅 수신이 보인다
    And 스터디 목록은 보이지 않는다 — 참여는 내 스터디룸, 찜은 찜한 스터디가 맡는다
    And 카드 아래에 "회원 탈퇴" 링크가 있다

  Scenario: 찜한 스터디
    Given 로그인한 회원이 하트로 스터디를 담아 두었다
    When 프로필 메뉴의 "찜한 스터디"로 들어간다
    Then 담은 스터디가 카드로 보이고 하트를 누르면 빠진다
    And 담은 것이 없으면 "찜한 스터디가 없습니다" 안내가 보인다

  Scenario: 회원 탈퇴
    Given 로그인한 회원이 마이페이지의 "회원 탈퇴"로 들어간다
    Then 안내 두 줄과 탈퇴 사유(선택) · 탈퇴 버튼이 보인다
