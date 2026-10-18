Feature: 내 스터디 상세 — 일정 및 출석 (navigator-register-sessions, navigator-edit-attendance, crew-apply-presenter)

  Background:
    Given 온보딩을 완료한 회원이 로그인되어 있다

  Scenario: 네비게이터의 일정 화면 접근 (회차 편집 및 추가)
    When /ko/my/joined/11/schedule 페이지에 접속한다
    Then 스터디 정보 카드와 규칙이 표시된다
    And "일정" 제목 옆 회차 개수와 "회차 추가" 버튼이 표시된다
    And 일정 표에서 예정 회차의 일자, 시각, 제목, 발표자를 수정할 수 있다

  Scenario: 크루의 일정 화면 접근 (조회 및 발표 신청)
    When /ko/my/joined/3/schedule 페이지에 접속한다
    Then 스터디 정보 카드와 4줄 접힘 규칙이 표시된다
    And "회차 추가" 버튼이 노출되지 않는다
    And 빈 발표자 칸에 "신청" 버튼이 표시된다

  Scenario: 캡틴의 일정 화면 접근 (회차 편집 및 추가)
    When /ko/my/joined/1/schedule 페이지에 접속한다
    Then 스터디 정보 카드와 규칙이 표시된다
    And "일정" 제목 옆 회차 개수와 "회차 추가" 버튼이 표시된다
    And 일정 표에서 예정 회차의 일자, 시각, 제목, 발표자를 수정할 수 있다

  Scenario: 캡틴의 출석 화면 접근 (출석 격자 및 백오피스 출석부)
    When /ko/my/joined/1/schedule/attendance 페이지에 접속한다
    Then 스터디 정보 카드 바로가기 줄 맨 앞(「디스코드」 왼쪽)에 "백오피스 출석부" 버튼이 표시된다
    And 출석 격자에 닉네임, 디스코드 닉네임, 발표 횟수, 출석률 열이 렌더링된다
    And 표 맨 위 작업 바에서 체크박스로 고른 크루의 출석 상태를 고르면 「적용」 버튼 없이 바로 바뀐다

  Scenario: 네비게이터의 출석 화면 접근 (출석 격자 및 일괄 변경)
    When /ko/my/joined/11/schedule/attendance 페이지에 접속한다
    Then 출석 격자에 닉네임, 디스코드 닉네임, 발표 횟수, 출석률 열이 렌더링된다
    And 표 맨 위 작업 바에서 체크박스로 고른 크루의 출석 상태를 고르면 「적용」 버튼 없이 바로 바뀐다
    And 참여 중단으로 고른 줄은 옅은 빨강으로 바뀌고, 작업 바에 "중단 예정 n명"이 표시된다
    And "백오피스 출석부" 버튼은 노출되지 않는다

  Scenario: 크루의 출석 화면 접근 (읽기 전용)
    When /ko/my/joined/3/schedule/attendance 페이지에 접속한다
    Then 출석 격자가 읽기 전용 상태로 표시된다
    And 출석 제목 옆 「?」를 누르면 발표 표시 설명이 열린다
    And "백오피스 출석부" 버튼과 작업 바가 노출되지 않는다

  Scenario: 모바일 환경에서 출석 화면 접근 (반응형 최적화)
    When 모바일 뷰포트에서 /ko/my/joined/1/schedule/attendance 페이지에 접속한다
    Then 디스코드 닉네임이 닉네임 아래에 작게 표시되고, 역할 칩은 화면에서 숨겨진다
    And 출석 표 맨 위 작업 바에 선택 · 출석 상태 · 참여 중단과 저장 버튼이 배치된다
    And 스터디 정보 카드의 디스코드 및 자료실 버튼이 좌측에, 접기 버튼이 우측에 배치된다
