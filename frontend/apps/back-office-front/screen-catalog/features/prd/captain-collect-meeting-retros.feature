# PRD: 01-planning/stories/captain-collect-meeting-retros/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다. 연결된 표시 상태는 .meta.ts 가 실행한다.
# 현재 코드 기준: GET /api/admin/retros 는 아직 서버에 없다(BE #128). 카탈로그는 recipe.api 고정 응답으로 화면만 찍는다.
@planned @ST-041
Feature: ST-041 캡틴은 백오피스에서 스터디 미팅 회고를 모아 볼 수 있다.

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

# 실행 카탈로그(표시 상태 일부): retros--default
  @BO-ST-041-S01 @catalog-partial
  Scenario: BO-ST-041-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 회고 모아보기를 열어 문항과 최신순 · 공감순을 바꾼다
    Then 문항별 보기(기본) — 고른 문항(기본 개선할 점)의 답을 세로 목록으로, 스터디 · 반 · 회차 · 날짜 · 참여자 · 작성 시각 · 👍 수와 함께. 최신순 · 공감순

# 실행 카탈로그(표시 상태 일부): retros--table
  @BO-ST-041-S02 @catalog-partial
  Scenario: BO-ST-041-S02 완료 기준 1-1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 표 보기로 바꿔 줄을 확인한다
    Then 표 보기 — 진행 중인 스터디의 끝난 회차 회고 표 — 스터디 · 참여자 · 반 · 회차 · 문항 셋 · 작성일

# 실행 카탈로그(표시 상태 일부): retros--default
  @BO-ST-041-S03 @catalog-partial
  Scenario: BO-ST-041-S03 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 스터디 · 회차를 고르고 참여자 이름을 검색한다
    Then 스터디 · 회차 · 참여자 이름으로 좁히기와 건수 확인

# 실행 카탈로그(표시 상태 일부): retros--table
  @BO-ST-041-S04 @catalog-partial
  Scenario: BO-ST-041-S04 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 표 보기에서 문항 칩을 끄고 켜고 줄 순서를 바꾼다
    Then 표 보기 — 보일 문항 열(좋았던 점 · 개선할 점 · 소감) 켜고 끄기, 최신순 · 공감순 줄 순서

# 실행 카탈로그(표시 상태 일부): retros--default
  @BO-ST-041-S05 @catalog-partial
  Scenario: BO-ST-041-S05 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 기한 지난 회차와 기한 전 회차가 섞인 조건에서 요약을 본다
    Then 작성률과 문항별 건수(좋았던 점 · 개선할 점 · 소감) 확인

# 실행 카탈로그(표시 상태 일부): retros--table
  @BO-ST-041-S06 @catalog-partial
  Scenario: BO-ST-041-S06 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 긴 답과 👍 수가 다른 답을 표에서 본다
    Then 문항 칸의 전문과 👍 수 확인

# 실행 카탈로그(표시 상태 일부): retros--table
  @BO-ST-041-S07 @catalog-partial
  Scenario: BO-ST-041-S07 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 좁은 화면에서 표를 가로로 민다
    Then 가로 스크롤 중 스터디 · 참여자 열 고정 · 표 위 가로 스크롤바

  @BO-ST-041-S08
  Scenario: BO-ST-041-S08 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 조건을 좁힌 뒤 CSV 를 내려받는다
    Then 좁힌 조건 그대로 CSV 내려받기

# 실행 카탈로그(표시 상태 일부): retros--empty, retros--table-empty
  @BO-ST-041-S09 @catalog-partial
  Scenario: BO-ST-041-S09 완료 기준 8
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 줄이 없게 좁힌다
    Then 조건에 맞는 줄이 없을 때 안내 문구

# 실행 카탈로그(표시 상태 일부): retros--default
  @BO-ST-041-V01 @catalog-partial
  Scenario: BO-ST-041-V01 기본
    Given 대상 화면이 PRD의 「기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 전체 스터디 · 문항별 · 개선할 점 · 최신순 / 「총 n건」

# 실행 카탈로그(표시 상태 일부): retros--table
  @BO-ST-041-V02 @catalog-partial
  Scenario: BO-ST-041-V02 표 보기
    Given 대상 화면이 PRD의 「표 보기」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 전체 스터디 · 문항 셋 · 최신순 / 「총 n건」

# 실행 카탈로그(표시 상태 일부): retros--loading
  @BO-ST-041-V03 @catalog-partial
  Scenario: BO-ST-041-V03 로딩
    Given 대상 화면이 PRD의 「로딩」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 목록 · 표 자리 / —

# 실행 카탈로그(표시 상태 일부): retros--empty
  @BO-ST-041-V04 @catalog-partial
  Scenario: BO-ST-041-V04 빈 결과 (문항별)
    Given 대상 화면이 PRD의 「빈 결과 (문항별)」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 좁힌 조건에 그 문항 답 없음 / 「조건에 맞는 의견이 없어요.」

# 실행 카탈로그(표시 상태 일부): retros--table-empty
  @BO-ST-041-V05 @catalog-partial
  Scenario: BO-ST-041-V05 빈 결과 (표)
    Given 대상 화면이 PRD의 「빈 결과 (표)」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 좁힌 조건에 줄 없음 / 「조건에 맞는 회고가 없어요.」

# 실행 카탈로그(표시 상태 일부): retros--error
  @BO-ST-041-V06 @catalog-partial
  Scenario: BO-ST-041-V06 조회 실패
    Given 대상 화면이 PRD의 「조회 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 목록을 못 읽음 / 「회고를 불러오지 못했습니다.」 · 「다시 시도」. 0건으로 보이지 않게 「총 n건」은 숨긴다
