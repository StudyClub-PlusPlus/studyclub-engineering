import type { ScreenSpec } from '@/proto/annotate';

export const SPEC: ScreenSpec = {
  prd: 'crew-google-login-onboarding',
  scope: 'login',
  screen: 'Google 로그인',
  notes: [
    '미리보기에서는 실제 Google 인증이나 회원 생성을 하지 않는다.',
    '상단에서 신규·가입 미완료·기존 회원·인증 취소·실패 상태를 선택한다. 가입을 마친 회원은 온보딩을 건너뛴다.',
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
        '실서비스 POST /auth/social-login. account.onboardingCompletedAt으로 분기, suggestedNickname은 온보딩 제안값',
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
