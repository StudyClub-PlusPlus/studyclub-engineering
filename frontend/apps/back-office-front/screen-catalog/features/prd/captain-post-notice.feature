# PRD: 01-planning/stories/captain-post-notice/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다.
@planned @ST-033
Feature: ST-033 캡틴은 스터디클럽 웹사이트에 공지를 올릴 수 있다.

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

# 실행 카탈로그(표시 상태 일부): notices--default
  @BO-ST-033-S01 @AC-1 @AC-2 @AC-3 @AC-7 @catalog-partial
  Scenario: BO-ST-033-S01 공지 목록 검색 정렬
    When 사이드바 공지로 들어가 제목 검색·정렬·페이지 이동을 한다
    Then 운영 콘솔 사이드바 「공지」 — 대시보드 · 스터디 · 행사 · 유저 · **공지** · 알림 순
    And 공지 목록 — 제목 · 작성자 · 게시일 · 마지막 수정. 제목 검색, 20개씩
    And 정렬 — 컬럼 이름을 누르면 오름차순, 다시 누르면 내림차순. 기본은 게시일 내림차순
    And 작성자 — 등록한 캡틴. 운영 콘솔에만 표시

# 실행 카탈로그(표시 상태 일부): notices--create, notices--edit
  @BO-ST-033-S02 @AC-4 @AC-5 @AC-8 @catalog-partial
  Scenario: BO-ST-033-S02 공지 등록과 편집
    When 공지를 등록·수정한 뒤 사용자 사이트를 연다
    Then 공지 등록 — 제목 · 본문(서식 없는 글, 줄바꿈 유지). 등록 즉시 사이트 공지에 게시
    And 공지 편집 — 목록에서 제목을 누르면 값이 채워진 팝업. 저장 즉시 사이트에 반영
    And 사용자 사이트에 바로 보인다 — 열람 화면은 [crew-view-notices](../crew-view-notices/PRD.md)

# 실행 카탈로그(표시 상태 일부): notices--delete
  @BO-ST-033-S03 @AC-6 @catalog-partial
  Scenario: BO-ST-033-S03 공지 삭제
    When 편집 팝업에서 삭제를 확인한 뒤 사이트와 콘솔 목록을 조회한다
    Then 공지 삭제 — 편집 팝업 안, 확인 단계 후 삭제. 사이트·콘솔 목록에서 빠짐. 되돌리기 없음(소프트 삭제)

