import type { ScreenSpec } from '@/proto/annotate';

/** 의견 — 사이트에서 들어온 문의·오류 신고를 캡틴이 확인한다. */
export const SPEC: ScreenSpec = {
  screen: '의견 (운영 콘솔)',
  chip: '의견',
  scope: 'feedback-admin',
  notes: [
    '사용자 사이트의 「문의·오류 신고」가 여기로 쌓인다. 프로토는 이 브라우저에서 보낸 것도 함께 보인다',
    '사이드바 「의견」 — 공지 아래, 알림 위',
    '미구현 — 테이블·API 가 없다. 지금은 화면 상태로만 처리한다',
  ],
  entries: [
    {
      n: '1',
      title: '거르는 칸',
      display: ['유형 · 처리 상태. 오른쪽 끝에 걸린 건수'],
      behavior: ['고르면 목록이 바로 줄고 1페이지로 간다'],
    },
    {
      n: '2',
      title: '의견 목록',
      display: ['접수 시각 · 유형(뱃지) · 제목 · 제출자 · 처리 상태. 20건씩'],
      behavior: ['접수 시각 내림차순 고정', '제목을 누르면 상세', '미확인은 굵게'],
      policy: [
        '제목은 한 줄로 자른다(최소 180px)',
        '비로그인 제출자는 「비회원」',
        '없으면 「접수된 의견이 없습니다」, 걸러서 없으면 「조건에 맞는 의견이 없습니다」',
      ],
      data: ['`GET /api/admin/feedbacks` — 미구현. 캡틴 전용'],
    },
    {
      n: '3',
      title: '처리 상태',
      display: ['상세 오른쪽 위 드롭다운 — 미확인 · 확인 · 완료'],
      behavior: ['고르면 바로 저장된다'],
      data: ['`PATCH /api/admin/feedbacks/{id}` — 미구현'],
    },
    {
      n: '4',
      title: '자동 수집 정보',
      display: ['페이지 · 브라우저·OS · 화면 크기'],
      policy: ['보낸 사람이 입력한 값이 아니다 — 보낼 때 함께 실려 온다'],
    },
    {
      n: '5',
      title: '운영 메모',
      display: ['여러 줄 입력 · 메모 저장'],
      policy: ['**내부용** — 보낸 사람에게 보이지 않는다'],
      data: ['`PATCH /api/admin/feedbacks/{id}` — 미구현'],
    },
  ],
};
