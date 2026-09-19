import type { ScreenSpec } from '@/proto/annotate';

export const SPEC: ScreenSpec = {
  screen: 'Google 로그인',
  notes: [
    'Notion PRD: https://app.notion.com/p/benkang/1f683feabad3839b996781bd773ec465',
    'playground 전용 Google 응답 시뮬레이션. 실제 인증 창·API 요청·토큰·회원 생성 없음.',
    '상단 검토 도구에서 신규·온보딩 미완료·기존 회원·인증 취소·실패를 선택한다. 기존 회원은 온보딩을 건너뛴다.',
    '실서비스 연동 시 이메일 미확인(SOCIAL_LOGIN_EMAIL_REQUIRED)·계정 연결 필요(ACCOUNT_LINK_REQUIRED)는 로그인 단계에서 별도로 처리한다. 이 PR은 전체 OAuth 예외 구현을 포함하지 않는다.',
  ],
  entries: [
    {
      n: '1',
      title: '로그인 안내',
      display: ['서비스명과 로그인 목적'],
      policy: ['한국어·영어 UI. MVP 인증 수단은 Google 하나'],
    },
    {
      n: '2',
      title: 'Google 로그인',
      display: ['로그인 버튼. 이 화면의 유일한 주액션이다'],
      behavior: ['처리 중 버튼 잠금. 신규/미완료는 온보딩, 완료 회원은 원래 화면 또는 홈'],
      data: [
        '실서비스 POST /auth/social-login. user.onboardingCompletedAt으로 분기, suggestedNickname은 온보딩 제안값',
      ],
    },
    {
      n: '3',
      title: '인증 실패',
      when: '취소 또는 실패 예시',
      display: ['오류와 다시 시도 안내'],
      behavior: ['다시 누르면 로그인 흐름 재개'],
    },
  ],
};
