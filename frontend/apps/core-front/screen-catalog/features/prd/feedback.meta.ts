import type { ApiFixture, ScreenStateDef } from '../../types';

/**
 * ST-035 crew-submit-feedback — 내 문의 목록 · 상세 · 작성 팝업.
 * 문의 API 는 MSW 목에 없어 로컬 백엔드로 새어 나간다 — recipe.api 로 응답을 고정해 백엔드 상태와 상관없이 같은 화면을 찍는다.
 */
const MEMBER = {
  id: 1,
  email: 'crew@test.com',
  nickname: '테스트크루',
  picture: null,
  role: 'MEMBER',
  timeZone: 'Asia/Seoul',
  onboardingCompletedAt: '2026-08-01T00:00:00Z',
};
const STORAGE = [{ key: 'sc_user', value: MEMBER }];

const received = { id: 2, type: 'BUG', title: '출석 버튼이 눌리지 않아요', status: 'RECEIVED', createdAt: '2026-10-30T09:00:00Z' };
const answered = { id: 1, type: 'IDEA', title: '스터디 목록에 정렬이 있으면 좋겠어요', status: 'ANSWERED', createdAt: '2026-10-20T09:00:00Z' };
const pageOf = (items: unknown[]) => ({ items, total: items.length, offset: 0, limit: 20 });
const LIST = '/api/me/feedbacks';
const list = (json: unknown, status = 200): ApiFixture[] => [{ path: LIST, status, json }];
const detail = (id: number, json: unknown, status = 200): ApiFixture[] => [{ path: `${LIST}/${id}`, status, json }];

function state(
  id: string,
  prdScenarios: string[],
  label: string,
  url: string,
  api: ApiFixture[],
  text: string,
  extra: Partial<ScreenStateDef> = {},
): ScreenStateDef {
  return {
    id,
    prdScenarios,
    label,
    pageId: url.includes('/my/feedbacks/') ? 'my-feedback-detail' : 'my-feedbacks',
    rationale: `ST-035 ${label}. 응답은 고정값이다 — 실제 저장 · 회신 알림은 이 캡처의 검증 범위가 아니다.`,
    recipe: { storage: STORAGE, api, render: { url } },
    viewports: ['desktop', 'mobile'],
    assertions: { text: { main: text } },
    screenshot: { fullPage: true },
    ...extra,
  };
}

export const feedbackScreenStates: ScreenStateDef[] = [
  state('my-feedbacks--default', ['CORE-ST-035-S02', 'CORE-ST-035-S03'], '내 문의 — 목록 (접수 · 답변 완료)', '/ko/my/feedbacks',
    list(pageOf([received, answered])), received.title),
  state('my-feedbacks--empty', ['CORE-ST-035-V02'], '내 문의 — 문의 없음', '/ko/my/feedbacks', list(pageOf([])), '접수한 문의가 없습니다.',
    { viewports: ['desktop'] }),
  state('my-feedbacks--error', ['CORE-ST-035-V03'], '내 문의 — 목록 오류', '/ko/my/feedbacks', list({}, 500), '불러오지 못했습니다. 다시 시도해 주세요.',
    { viewports: ['desktop'] }),
  {
    ...state('my-feedbacks--compose', ['CORE-ST-035-S04'], '내 문의 — 문의하기 팝업', '/ko/my/feedbacks', list(pageOf([received])), '문의·오류 신고'),
    recipe: { storage: STORAGE, api: list(pageOf([received])), steps: [{ action: 'click', selector: 'main button:has-text("문의하기")' }], render: { url: '/ko/my/feedbacks' } },
    // 팝업은 main 밖(portal)에 뜬다
    assertions: { visible: ['[role="dialog"]'], text: { '[role="dialog"]': '유형' } },
  },
  state('my-feedback-detail--received', ['CORE-ST-035-S07'], '내 문의 상세 — 답변 전', '/ko/my/feedbacks/2',
    detail(2, { ...received, content: '오늘 출석 버튼을 눌러도 반응이 없습니다.\n휴대폰 사파리에서 그렇습니다.', images: [], reply: null }),
    '답변을 준비하고 있어요'),
  state('my-feedback-detail--answered', ['CORE-ST-035-S07'], '내 문의 상세 — 답변 완료', '/ko/my/feedbacks/1',
    detail(1, {
      ...answered,
      content: '스터디 목록을 시작일 순으로 정렬할 수 있으면 좋겠어요.',
      images: [],
      reply: { content: '좋은 의견 감사합니다. 다음 업데이트에 시작일 정렬을 넣겠습니다.', repliedAt: '2026-10-22T09:00:00Z' },
    }), '다음 업데이트에 시작일 정렬을 넣겠습니다.'),
  state('my-feedback-detail--not-found', ['CORE-ST-035-V07', 'CORE-ST-035-S08'], '내 문의 상세 — 없는 번호', '/ko/my/feedbacks/999',
    detail(999, { errorCode: 'NOT_FOUND', errorMessage: '요청한 리소스를 찾을 수 없습니다.' }, 404), '찾을 수 없는 문의입니다.',
    { viewports: ['desktop'] }),
];
