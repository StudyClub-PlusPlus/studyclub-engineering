Feature: 스터디 신청 폼 (crew-submit-application)

  Background:
    Given 모집 중인 스터디(study_id=3) 상세 페이지가 열려 있다

  Scenario: 비로그인 사용자의 신청 시도
    When 비로그인 사용자가 신청하기 버튼을 클릭한다
    Then 로그인 페이지(/ko/login?next=...)로 리다이렉트된다

  Scenario: 디스코드 미연동 사용자의 신청 시도
    Given 로그인되어 있으나 디스코드가 연동되지 않은 사용자
    When 신청하기 버튼을 클릭한다
    Then 디스코드 연동 모달(ApplyDiscordGate)이 노출된다
    When "디스코드 연동하기"를 클릭하여 연동을 완료한다
    Then 신청 폼(ApplyDialog)으로 자동으로 이동한다

  Scenario: 디스코드 미연동 게이트 취소
    Given 로그인되어 있으나 디스코드가 연동되지 않은 사용자
    When 신청하기 버튼을 클릭하고 연동 모달에서 "취소"를 누른다
    Then 모달이 닫히고 상세 페이지에 머문다

  Scenario: 신청 폼 렌더링 및 동적 질문 확인
    Given 디스코드가 연동된 로그인 사용자
    When 신청하기 버튼을 클릭하여 신청 폼을 연다
    Then 디스코드 별명, 참여 가능한 요일 등 플랫폼 기본 질문이 보인다
    And 지원 사유, 하고 싶은 말, 참여 가능 시간 등 추가 질문이 보인다

  Scenario: 필수 질문 미입력 시 유효성 검증
    Given 신청 폼이 열려 있다
    When 필수 질문을 선택하지 않고 "신청" 버튼을 누른다
    Then 인라인 에러 알림이 노출되고 제출되지 않는다

  Scenario: 객관식 기타(allowOther) 선택 후 텍스트 미입력 검증
    Given 신청 폼이 열려 있다
    When 객관식 질문에서 "기타:"를 선택하고 내용을 입력하지 않은 채 제출한다
    Then "기타 내용을 입력해 주세요" 에러가 노출된다

  Scenario: 정상 제출 및 완료 모달 확인
    Given 신청 폼의 모든 필수 항목을 올바르게 작성했다
    When "신청" 버튼을 클릭한다
    Then "스터디 신청 완료" 모달이 노출된다
    When "내 스터디 보러 가기" 버튼을 누른다
    Then /ko/my?open=3 경로로 이동한다

  Scenario: 이미 신청한 스터디의 재접속
    Given 이미 신청을 완료한 스터디 상세 페이지에 접속한다
    Then CTA 버튼이 "신청 완료" 상태로 표시된다

  Scenario: 스터디 신청 모달창 화면 (study_id=6)
    Given 로그인 및 디스코드 연동된 크루가 study_id=6 상세 페이지에 접속한다
    When "신청하기" 버튼을 클릭한다
    Then 스터디 신청 모달창(ApplyDialog)이 화면 중앙에 오픈되고 기본 문항과 추가 질문이 렌더링된다
