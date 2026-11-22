# PRD 연결 정본: docs/frontend-development-guide/core-e2e-prd-map.md
# 설명용 명세. 실제 실행 범위는 .meta.ts의 assertions·steps이며 전체 행동 완료를 뜻하지 않는다.
Feature: 온보딩

  Scenario: 닉네임 · 약관 동의
    Given 처음 로그인한 회원이 온보딩에 들어온다
    Then 환영 문구와 닉네임 · 시간대 · 약관 동의 폼이 보인다

  Scenario: 디스코드 연동 단계
    Given 가입을 마친 회원이 디스코드 연동 단계에 들어온다
    Then "지금 연결" 버튼과 "스터디 신청할 때 하기" 버튼이 보인다
