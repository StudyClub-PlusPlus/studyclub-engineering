# PRD: 01-planning/stories/crew-write-meeting-retro/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다. 연결된 표시 상태는 .meta.ts 가 실행한다.
# 현재 코드 기준: 개발 MSW 회고 목과 고정 시각(2026-10-31T03:00:00Z). 크루 화면은 18번 스터디(끝난 정규 회차 4개).
@planned @ST-039
Feature: ST-039 크루는 미팅이 끝나면 회고를 남기고 같은 반 회고에 공감할 수 있다.

# 실행 카탈로그(표시 상태 일부): my-joined-retro--crew
  @CORE-ST-039-S01 @catalog-partial
  Scenario: CORE-ST-039-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 쓸 수 있는데 안 쓴 회차가 있는 크루로 스터디 일정을 연다
    Then 일정 표에는 회고 열이 없다 — 쓸 수 있는데 안 쓴 회고가 있으면 「회고」 탭 옆 점

  @CORE-ST-039-S02
  Scenario: CORE-ST-039-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 기한 전 안 씀 · 기한 전 씀 · 기한 뒤 회차를 차례로 고른다
    Then 회고 탭 버튼 — 기한 전 안 씀 「회고 작성」 · 기한 전 씀 「내 회고 수정」 · 기한 뒤 「회고 마감」(비활성)

# 실행 카탈로그(표시 상태 일부): my-joined-retro-write--crew
  @CORE-ST-039-S03 @catalog-partial
  Scenario: CORE-ST-039-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 회고 작성을 눌러 세 문항에 글을 적는다
    Then 회고 작성 — 좋았던 점 · 개선할 점(필수) · 소감(선택), 문항마다 500자 · 글자 수

# 실행 카탈로그(표시 상태 일부): my-joined-retro-write--invalid
  @CORE-ST-039-S04 @catalog-partial
  Scenario: CORE-ST-039-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 필수 칸을 비우거나 500자를 넘겨 제출한다
    Then 필수 칸 누락 시 칸별 오류 표시와 제출 차단

  @CORE-ST-039-S05
  Scenario: CORE-ST-039-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 유효한 회고를 제출한다
    Then 제출 뒤 완료 토스트와 회고 탭의 그 회차로 이동

  @CORE-ST-039-S06
  Scenario: CORE-ST-039-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 기한 안에 쓴 회고를 다시 열어 고친다
    Then 기한 안 내 회고 수정 — 쓴 내용 채움, 받은 👍 유지

# 실행 카탈로그(표시 상태 일부): my-joined-retro--crew
  @CORE-ST-039-S07 @catalog-partial
  Scenario: CORE-ST-039-S07 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 끝난 회차와 아직 안 끝난 회차가 섞인 반의 회고 탭을 연다
    Then 회고 탭 회차 고르기 — 끝난 회차만, 처음엔 가장 최근 회차

# 실행 카탈로그(표시 상태 일부): my-joined-retro--crew
  @CORE-ST-039-S08 @catalog-partial
  Scenario: CORE-ST-039-S08 완료 기준 8
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 👍 수가 다른 답이 있는 회차를 연다
    Then 문항별 보기 하나 — 문항마다 답을 👍 많은 순으로

  @CORE-ST-039-S09
  Scenario: CORE-ST-039-S09 완료 기준 9
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 기한 전 · 뒤 회차의 마감 문구와 크루 · 네비게이터의 작성 수 표시를 확인한다
    Then 마감 시각 확인 — 기한 전 「…까지」 · 기한 뒤 「… 마감」 (내 프로필 시간대 · 약칭). 「n명 중 m명 작성」은 네비게이터 · 캡틴만

  @CORE-ST-039-S10
  Scenario: CORE-ST-039-S10 완료 기준 10
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 회고를 쓰기 전에 같은 반 회고를 연다
    Then 쓰기 전에도 같은 반 회고 열람 — 실명

  @CORE-ST-039-S11
  Scenario: CORE-ST-039-S11 완료 기준 11
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 다른 사람 답에 👍 를 누르고 다시 눌러 취소한다
    Then 문항마다 👍 누르기 · 취소, 0 도 표시

  @CORE-ST-039-S12
  Scenario: CORE-ST-039-S12 완료 기준 12
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 내 답의 👍 칸을 확인한다
    Then 내 답의 👍 는 받은 수만 확인

# 실행 카탈로그(표시 상태 일부): my-joined-retro--crew
  @CORE-ST-039-S13 @catalog-partial
  Scenario: CORE-ST-039-S13 완료 기준 13
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 아직 안 쓴 크루로 회고 탭을 연다
    Then 아직 안 썼으면 회고 작성 권유 문구 확인 (안 쓴 사람 이름은 크루에게 보이지 않음)

  @CORE-ST-039-S14
  Scenario: CORE-ST-039-S14 완료 기준 14
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 기한이 지난 회차의 작성 페이지를 연다
    Then 기한이 지난 회차의 작성 · 수정 차단 안내

  @CORE-ST-039-S15
  Scenario: CORE-ST-039-S15 완료 기준 15
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 끝난 미팅이 없는 반의 회고 탭을 연다
    Then 끝난 미팅이 없을 때 안내 문구

# 실행 카탈로그(표시 상태 일부): my-joined-retro--crew
  @CORE-ST-039-V01 @catalog-partial
  Scenario: CORE-ST-039-V01 기본
    Given 대상 화면이 PRD의 「기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 회고 탭 — 가장 최근에 끝난 회차 / 「n명 중 m명 작성」

  @CORE-ST-039-V02
  Scenario: CORE-ST-039-V02 빈 결과
    Given 대상 화면이 PRD의 「빈 결과」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 끝난 회차가 없음 / 「아직 끝난 미팅이 없어요. 미팅이 끝나면 여기서 회고를 남기고 볼 수 있어요.」

  @CORE-ST-039-V03
  Scenario: CORE-ST-039-V03 빈 결과
    Given 대상 화면이 PRD의 「빈 결과」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 그 회차에 쓴 회고 없음 / 「아직 이 회차에 남긴 회고가 없어요.」

# 실행 카탈로그(표시 상태 일부): my-joined-retro-write--invalid
  @CORE-ST-039-V04 @catalog-partial
  Scenario: CORE-ST-039-V04 검증 실패
    Given 대상 화면이 PRD의 「검증 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 작성 폼 칸 아래 / 「좋았던 점을 적어 주세요.」 · 「개선할 점을 적어 주세요.」 · 「500자까지 쓸 수 있어요.」

  @CORE-ST-039-V05
  Scenario: CORE-ST-039-V05 처리 실패
    Given 대상 화면이 PRD의 「처리 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 기한이 지난 뒤 제출 / 「작성 기한이 지나 저장하지 못했어요.」

  @CORE-ST-039-V06
  Scenario: CORE-ST-039-V06 권한 없음
    Given 대상 화면이 PRD의 「권한 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 작성 페이지 — 미팅 전 · 기한 뒤 / 「미팅이 끝나면 회고를 쓸 수 있어요.」 · 「작성 기한이 지나 회고를 쓰거나 고칠 수 없어요.」

  @CORE-ST-039-V07
  Scenario: CORE-ST-039-V07 완료
    Given 대상 화면이 PRD의 「완료」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 제출 · 수정 / 「회고를 남겼어요.」 · 「회고를 고쳤어요.」

  @CORE-ST-039-V08
  Scenario: CORE-ST-039-V08 처리 중
    Given 대상 화면이 PRD의 「처리 중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 회고 탭 · 작성 페이지를 여는 동안 / 「불러오는 중…」

  @CORE-ST-039-V09
  Scenario: CORE-ST-039-V09 조회 실패
    Given 대상 화면이 PRD의 「조회 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 회고 탭 · 작성 페이지 / 「회고를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.」 · 수정할 내 회고를 못 읽으면 빈 폼을 열지 않고 「내 회고를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.」

  @CORE-ST-039-V10
  Scenario: CORE-ST-039-V10 처리 실패
    Given 대상 화면이 PRD의 「처리 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 그 밖의 저장 실패 · 👍 실패 / 「회고를 저장하지 못했어요. 다시 시도해 주세요.」 · 「공감을 반영하지 못했어요. 다시 시도해 주세요.」(👍 는 누르는 즉시 그리고, 실패하면 그 칸만 되돌린다)
