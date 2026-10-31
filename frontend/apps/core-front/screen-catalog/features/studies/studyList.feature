# PRD 연결 정본: docs/frontend-development-guide/core-e2e-prd-map.md
# 설명용 명세. 실제 실행 범위는 .meta.ts의 assertions·steps이며 전체 행동 완료를 뜻하지 않는다.
Feature: 스터디 목록

  Background:
    Given 사용자가 스터디 목록 페이지에 접속한다

  Scenario: 전체 목록 — 비로그인
    Then 스터디 카드들이 그리드로 보인다

  Scenario: 스터디 상세 — 모집 중 (recruitStatus=RECRUITING)
    Given study_id=1 (ai-paper-study, status=OPEN) 스터디 상세 페이지에 접속한다
    Then 스터디 정보와 신청하기 버튼이 보인다
    # spec: study-application — 신청하기는 OPEN 기수의 상세에서만 제공

  Scenario: 스터디 상세 — 진행 중 (status=ONGOING, recruitStatus=null)
    Given study_id=19 (system-design-interview-ongoing, status=ONGOING) 스터디 상세 페이지에 접속한다
    Then 스터디 정보가 보이고 신청하기 버튼이 없다
    # spec: study-recruit-status — status != OPEN 이면 recruitStatus=null → 신청 불가

  Scenario: 스터디 상세 — 존재하지 않는 ID
    Given study_id=9999 스터디 상세 페이지에 접속한다
    Then 찾을 수 없음 안내가 보인다
    # spec: study/spec — 404: NOT_FOUND (studyId 없음 또는 STATUS=DRAFT)
