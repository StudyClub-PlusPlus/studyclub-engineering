Feature: 내 스터디 상세 — 일정 및 출석 (navigator-register-sessions, navigator-edit-attendance, crew-apply-presenter)

  Background:
    Given 온보딩을 완료한 회원이 로그인되어 있다

  Scenario: 네비게이터의 일정 화면 접근 (회차 편집 및 추가)
    When /ko/my/joined/11/schedule 페이지에 접속한다
    Then 스터디 정보 카드와 규칙이 표시된다
    And 회차 개수와 "회차 추가" 버튼이 표시된다
    And 일정 표에서 예정 회차의 일자, 시각, 제목, 발표자를 수정할 수 있다

  Scenario: 크루의 일정 화면 접근 (조회 및 발표 신청)
    When /ko/my/joined/3/schedule 페이지에 접속한다
    Then 스터디 정보 카드와 4줄 접힘 규칙이 표시된다
    And "회차 추가" 버튼이 노출되지 않는다
    And 빈 발표자 칸에 "신청" 버튼이 표시된다

  Scenario: 캡틴의 출석 화면 접근 (출석 격자 및 백오피스 이동)
    When /ko/my/joined/1/schedule/attendance 페이지에 접속한다
    Then 상단에 "백오피스 출석 (전체 참여자)" 링크 버튼이 표시된다
    And 출석 격자와 발표 횟수, 출석률 열이 렌더링된다
    And 하단 작업 바에서 체크박스로 선택한 크루에게 출석 일괄 적용이 가능하다

  Scenario: 크루의 출석 화면 접근 (읽기 전용)
    When /ko/my/joined/3/schedule/attendance 페이지에 접속한다
    Then 출석 격자가 읽기 전용 상태로 표시된다
    And "백오피스 출석" 및 하단 작업 바가 노출되지 않는다
