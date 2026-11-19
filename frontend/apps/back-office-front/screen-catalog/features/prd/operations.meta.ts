import { notice, pageOf } from './fixtures';
import type { Recipe, ScreenStateDef, ScreenStep } from '../../types';

const click = (selector: string): ScreenStep => ({ action: 'click', selector });
function state(id: string, scenario: string, pageId: string, url: string, text: string,
  api: NonNullable<Recipe['api']> = [], steps: ScreenStep[] = []): ScreenStateDef {
  return { id, label: text, pageId, prdScenarios: [scenario],
    rationale: 'PRD 연결 화면의 현재 코드 표시 상태. CRUD 서버 동작은 이 캡처의 검증 범위가 아니다.',
    recipe: { render: { url }, api, steps }, viewports: ['desktop'], assertions: { text: { main: text } }, screenshot: { fullPage: true } };
}
const notification = { id: 1, eventType: 'USER_REGISTERED', recipientType: 'EMAIL', recipientValue: 'c***@example.com',
  status: 'FAILED', templateId: 1, sentAt: null, createdAt: '2026-10-01T00:00:00Z', canResend: true };
const notifications = '/api/admin/notifications';
// ST-036 문의·오류 신고 — 응답 모양은 src/features/feedbacks/response-schema.ts
const feedbacks = '/api/admin/feedbacks';
const feedbackRow = { id: 1, createdAt: '2026-10-30T09:00:00Z', type: 'BUG', title: '출석 버튼이 눌리지 않아요',
  submitter: { nickname: '테스트크루' }, status: 'NEW', doneBy: null };
const feedbackRows = [feedbackRow, { id: 2, createdAt: '2026-10-20T09:00:00Z', type: 'IDEA', title: '스터디 목록에 정렬이 있으면 좋겠어요',
  submitter: { nickname: '테스트크루2' }, status: 'DONE', doneBy: { nickname: '테스트캡틴' } }];
const feedbackDetail = { ...feedbackRow, selectableStatuses: ['NEW', 'SEEN', 'DONE'],
  content: '아이폰 사파리에서 오늘 출석 버튼을 눌러도 반응이 없습니다.\n데스크톱에서는 됩니다.', images: [],
  browser: 'Safari 18 · iOS 18', viewport: { width: 390, height: 844 }, reply: null, adminMemo: null };
const feedbackReplied = { ...feedbackDetail, status: 'DONE', doneBy: { nickname: '테스트캡틴' },
  reply: { content: '확인했습니다. 다음 배포에서 고쳤습니다.', repliedAt: '2026-10-31T01:00:00Z' }, adminMemo: '사파리에서만 재현' };
export const prdOperationStates: ScreenStateDef[] = [
  state('user-list--default', 'BO-ST-028-V01', 'user-list', '/users', '테스트캡틴'),
  state('user-list--empty', 'BO-ST-028-V03', 'user-list', '/users?q=nobody', '조건에 맞는 유저가 없습니다.', [{ path: '/api/admin/users', json: pageOf([]) }]),
  state('user-list--role-menu', 'BO-ST-029-V03', 'user-list', '/users', '테스트크루', [], [click('button[aria-haspopup="listbox"]')]),
  state('notifications--empty', 'BO-ST-032-V02', 'notifications', '/notifications', '아직 알림 발송 이력이 없습니다.', [{ path: notifications, json: pageOf([]) }]),
  state('notifications--filter-empty', 'BO-ST-032-V03', 'notifications', '/notifications?status=FAILED', '선택한 조건의 발송 이력이 없습니다.', [{ path: notifications, json: pageOf([]) }]),
  state('notifications--error', 'BO-ST-032-V04', 'notifications', '/notifications', '발송 이력을 불러오지 못했습니다.', [{ path: notifications, status: 500, json: {} }]),
  state('notifications--failed', 'BO-ST-032-S01', 'notifications', '/notifications?status=FAILED', 'c***@example.com', [{ path: notifications, json: pageOf([notification]) }]),
  state('notifications--resend-confirm', 'BO-ST-032-S02', 'notifications', '/notifications?status=FAILED', '전체 재발송', [{ path: notifications, json: pageOf([notification]) }], [click('button:has-text("전체 재발송")')]),
  state('notification-templates--default', 'BO-ST-030-S01', 'notification-templates', '/notification-templates', '[StudyClub] 가입을 환영합니다'),
  state('notification-templates--create', 'BO-ST-030-S02', 'notification-templates', '/notification-templates', '템플릿 추가', [], [click('button:has-text("템플릿 추가")')]),
  state('notification-templates--edit', 'BO-ST-030-S02', 'notification-templates', '/notification-templates', '템플릿 수정', [], [click('td button:has-text("회원가입")')]),
  state('notification-templates--preview', 'BO-ST-030-S02', 'notification-templates', '/notification-templates', '미리보기', [], [click('td button:has-text("회원가입")'), click('[role="tab"]:has-text("미리보기")')]),
  state('notification-templates--delete', 'BO-ST-030-S03', 'notification-templates', '/notification-templates', '지난 발송 이력은 남습니다.', [], [click('td button:has-text("회원가입")'), click('button:has-text("템플릿 삭제")')]),
  state('feedbacks--default', 'BO-ST-036-S01', 'feedbacks', '/feedbacks', feedbackRow.title, [{ path: feedbacks, json: pageOf(feedbackRows) }]),
  state('feedbacks--empty', 'BO-ST-036-V02', 'feedbacks', '/feedbacks', '접수된 문의·오류 신고가 없습니다.', [{ path: feedbacks, json: pageOf([]) }]),
  state('feedbacks--filter-empty', 'BO-ST-036-V03', 'feedbacks', '/feedbacks?type=BUG', '조건에 맞는 문의·오류 신고가 없습니다.', [{ path: feedbacks, json: pageOf([]) }]),
  state('feedbacks--error', 'BO-ST-036-V04', 'feedbacks', '/feedbacks', '불러오지 못했습니다. 다시 시도해 주세요.', [{ path: feedbacks, status: 500, json: {} }]),
  state('feedback-detail--default', 'BO-ST-036-S01', 'feedback-detail', '/feedbacks/1', '데스크톱에서는 됩니다.', [{ path: `${feedbacks}/1`, json: feedbackDetail }]),
  state('feedback-detail--replied', 'BO-ST-036-S03', 'feedback-detail', '/feedbacks/1', '다음 배포에서 고쳤습니다.', [{ path: `${feedbacks}/1`, json: feedbackReplied }]),
  state('feedback-detail--status-menu', 'BO-ST-036-S02', 'feedback-detail', '/feedbacks/1', '확인', [{ path: `${feedbacks}/1`, json: feedbackDetail }], [click('button[aria-haspopup="listbox"]')]),
  state('feedback-detail--not-found', 'BO-ST-036-V08', 'feedback-detail', '/feedbacks/999', '삭제되었거나 없는 문의·오류 신고입니다.', [{ path: `${feedbacks}/999`, status: 404, json: { errorCode: 'NOT_FOUND', errorMessage: '찾을 수 없습니다' } }]),
  state('notices--default', 'BO-ST-033-S01', 'notices', '/notices', notice.title),
  state('notices--create', 'BO-ST-033-S02', 'notices', '/notices', '공지 등록', [], [click('button:has-text("공지 등록")')]),
  state('notices--edit', 'BO-ST-033-S02', 'notices', '/notices', '공지 편집', [], [click(`button:has-text("${notice.title}")`)]),
  state('notices--delete', 'BO-ST-033-S03', 'notices', '/notices', '되돌릴 수 없습니다.', [], [click(`button:has-text("${notice.title}")`), click('button:has-text("공지 삭제")')]),
];
for (const item of prdOperationStates) {
  // Modals render in a portal outside main.
  if (item.recipe.steps?.length) item.assertions!.text = { body: Object.values(item.assertions!.text!)[0]! };
  if (item.id === 'user-list--role-menu' || item.id === 'feedback-detail--status-menu') item.assertions!.visible = ['[role="listbox"]'];
  else if (item.recipe.steps?.length) item.assertions!.visible = ['[role="dialog"]'];
}
