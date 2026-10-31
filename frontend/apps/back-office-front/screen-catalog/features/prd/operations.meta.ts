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
  state('notices--default', 'BO-ST-033-S01', 'notices', '/notices', notice.title),
  state('notices--create', 'BO-ST-033-S02', 'notices', '/notices', '공지 등록', [], [click('button:has-text("공지 등록")')]),
  state('notices--edit', 'BO-ST-033-S02', 'notices', '/notices', '공지 편집', [], [click(`button:has-text("${notice.title}")`)]),
  state('notices--delete', 'BO-ST-033-S03', 'notices', '/notices', '되돌릴 수 없습니다.', [], [click(`button:has-text("${notice.title}")`), click('button:has-text("공지 삭제")')]),
];
for (const item of prdOperationStates) {
  // Modals render in a portal outside main.
  if (item.recipe.steps?.length) item.assertions!.text = { body: Object.values(item.assertions!.text!)[0]! };
  if (item.id === 'user-list--role-menu') item.assertions!.visible = ['[role="listbox"]'];
  else if (item.recipe.steps?.length) item.assertions!.visible = ['[role="dialog"]'];
}
