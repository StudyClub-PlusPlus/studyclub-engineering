# 인증 근거: docs/frontend-development-guide/auth-flow.md (캡틴 전용 Story PRD 없음)
Feature: 백오피스 로그인

  @catalog-partial @screen-login--default
  Scenario: 로그인 페이지 — 기본
    Given 관리자가 로그인 페이지에 접속한다
    Then 로그인 폼이 보인다

  # 현재 .meta.ts 실행 상태 없음
  @planned
  Scenario: 미인증 접근 — 대시보드 리다이렉트
    Given 미인증 사용자가 대시보드에 접속한다
    Then 로그인 페이지로 리다이렉트된다
