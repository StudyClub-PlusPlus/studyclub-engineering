Feature: 로그인

  Scenario: 로그인 페이지 — 기본
    Given 사용자가 로그인 페이지에 접속한다
    Then Google 로그인 버튼이 보인다

  Scenario: 마이페이지 — 로그인 상태 (북마크 있음)
    Given 사용자가 로컬스토리지에 북마크 데이터를 가지고 있다
    And 마이페이지에 접속한다
    Then 북마크한 스터디 목록이 보인다
