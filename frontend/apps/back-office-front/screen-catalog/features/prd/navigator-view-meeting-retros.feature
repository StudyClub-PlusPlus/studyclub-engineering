# PRD: 01-planning/stories/navigator-view-meeting-retros/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다. 연결된 표시 상태는 .meta.ts 가 실행한다.
# PRD §2 화면 3(백오피스 스터디 상세 회고 탭)만 다룬다. 사용자 사이트 화면은 core-front 의 같은 이름 feature.
@planned @ST-040
Feature: ST-040 네비게이터는 반의 회차별 회고 작성 현황을 볼 수 있다. (백오피스 회고 탭)

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

# 실행 카탈로그(표시 상태 일부): study-detail--retro, study-detail--retro-closed-meeting, study-detail--retro-no-ended, study-detail--retro-empty
  @BO-ST-040-S01 @catalog-partial
  Scenario: BO-ST-040-S01 백오피스 스터디 상세 회고 탭
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 반 칩 · 회차 칩을 바꿔 가며 스터디 상세 「회고」 탭을 본다
    Then 출석 옆 「회고」 탭에 사용자 사이트 회고 탭이 캡틴으로 들어간다 — 회차를 고르면 탭 안에서 바뀐다
    And 반이 여럿이면 일정 · 출석 탭과 같은 반 칩으로 한 반씩 본다. 반이 하나면 칩이 없다
    And 「n명 중 m명 작성」 · 작성 현황 · 문항별 👍 많은 순. 작성 버튼이 없고 👍 는 수만 보인다
