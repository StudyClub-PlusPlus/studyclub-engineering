import { form, results, study } from './fixtures';
import type { Recipe, ScreenStateDef, ScreenStep } from '../../types';

const detailPath = '/api/admin/studies/20';
const formPath = `${detailPath}/application-form`;
const resultsPath = `${detailPath}/applications`;
const click = (selector: string): ScreenStep => ({ action: 'click', selector });
const save = click('form[aria-label="신청 폼 설계"] button[type="submit"]');
const dialog = '[role="dialog"]';
function state(id: string, scenario: string, label: string, url: string, text: string,
  api: NonNullable<Recipe['api']> = [], steps: ScreenStep[] = []): ScreenStateDef {
  return { id, label, prdScenarios: [scenario], pageId: url.startsWith('/studies/20') ? 'study-detail' : 'study-list',
    rationale: `현재 코드의 ${label} 화면. 전체 행동 완료가 아닌 표시 상태 검증.`,
    recipe: { render: { url }, api, steps }, viewports: ['desktop'],
    assertions: { text: { body: text, ...(url.startsWith('/studies/20') ? { h1: study.title } : {}) } }, screenshot: { fullPage: true } };
}
const formUrl = '/studies/20?tab=form';
const resultsUrl = '/studies/20?tab=results';
export const prdStudyStates: ScreenStateDef[] = [
  state('study-list--create', 'BO-ST-001-V01', '스터디 등록 기본', '/studies?new=1', '스터디 등록'),
  state('study-list--create-invalid', 'BO-ST-001-V02', '스터디 등록 필수값 오류', '/studies?new=1', '제목을 입력하세요.', [], [click(`${dialog} button:has-text("등록"):not(:has-text("프로그램"))`)]),
  state('study-detail--delete-confirm', 'BO-ST-004-V05', '스터디 삭제 확인', '/studies/20', '크루 명단과 출석 기록도 함께 사라지며 되돌릴 수 없습니다.', [], [click('button:has-text("스터디 삭제")')]),
  state('study-detail--edit-invalid', 'BO-ST-004-V02', '스터디 수정 필수값 오류', '/studies/20', '제목을 입력하세요.', [], [
    { action: 'fill', selector: 'role=textbox[name="제목" s]', value: '' }, click('button:has-text("저장")'),
  ]),
  state('study-detail--unpublished', 'BO-ST-003-V04', '미공개 상세 헤더', '/studies/20', '비공개: 사용자 사이트에 안 보임'),
  state('study-detail--closed', 'BO-ST-003-V03', '모집 마감 헤더', '/studies/20', '모집 마감', [{ path: detailPath, json: { ...study, status: 'OPEN', recruitStatus: 'RECRUIT_CLOSED' } }]),
  state('study-detail--next-cohort', 'BO-ST-021-S01', '클럽 다음 기수 입력', '/studies/20', '다음 기수 만들기', [{ path: detailPath, json: { ...study, studyKind: 'CLUB' } }], [click('button:has-text("다음 기수 만들기")')]),
  state('study-detail--publish-confirm', 'BO-ST-020-V04', '스터디 공개 확인', '/studies/20', '공개하시겠습니까?', [], [click('[role="switch"]')]),
  state('study-detail--unpublish-confirm', 'BO-ST-020-V05', '스터디 비공개 확인', '/studies/20', '비공개로 전환하시겠습니까?', [{ path: detailPath, json: { ...study, status: 'OPEN', recruitStatus: 'RECRUITING' } }], [click('[role="switch"]')]),
  state('study-detail--publish-blocked', 'BO-ST-020-V03', '신청 폼 없어 공개 불가', '/studies/20', '신청 폼을 먼저', [{ path: formPath, json: { ...form, questions: [] } }]),
  state('study-detail--application-form-loading', 'BO-ST-023-V01', '신청 폼 로딩', formUrl, '불러오는 중', [{ path: formPath, pending: true }]),
  state('study-detail--application-form-read-error', 'BO-ST-023-V02', '신청 폼 조회 실패', formUrl, '신청 폼을 불러오지 못했습니다.', [{ path: formPath, status: 500, json: {} }]),
  state('study-detail--application-form-empty', 'BO-ST-023-V07', '추가 질문 없는 신청 폼', formUrl, '질문 추가', [{ path: formPath, json: { ...form, questions: [] } }]),
  state('study-detail--application-form-editing', 'BO-ST-023-V08', '신청 질문 편집', formUrl, '필수 응답', [], [click('[aria-label="질문 1 수정"]')]),
  state('study-detail--application-form-invalid', 'BO-ST-023-V09', '신청 질문 검증 실패', formUrl, '질문 제목을 입력해 주세요.', [], [click('button:has-text("질문 추가")'), save]),
  state('study-detail--application-form-saving', 'BO-ST-023-V10', '신청 폼 저장 중', formUrl, '카탈로그 신청 폼', [{ path: formPath, method: 'PUT', pending: true }], [save]),
  state('study-detail--application-form-saved', 'BO-ST-023-V11', '신청 폼 저장 완료', formUrl, '저장되었습니다.', [{ path: formPath, method: 'PUT', json: form }], [save]),
  state('study-detail--application-form-save-error', 'BO-ST-023-V12', '신청 폼 저장 실패', formUrl, '저장하지 못했습니다. 다시 시도해 주세요.', [{ path: formPath, method: 'PUT', status: 500, json: {} }], [save]),
  state('study-detail--application-form-forbidden', 'BO-ST-023-V04', '신청 폼 수정 권한 없음', formUrl, '이 스터디의 신청 폼을 고칠 권한이 없습니다.', [{ path: formPath, method: 'PUT', status: 403, json: {} }], [save]),
  state('study-detail--application-form-locked', 'BO-ST-023-V13', '모집 시작 후 신청 폼 잠금', formUrl, '모집이 시작되어 신청 폼을 수정할 수 없습니다.', [{ path: detailPath, json: { ...study, status: 'OPEN', recruitStatus: 'RECRUITING' } }, { path: formPath, method: 'PUT', status: 409, json: { errorCode: 'LOCKED', errorMessage: '모집이 시작되어 신청 폼을 수정할 수 없습니다.' } }], [save]),
  ...[
    ['loading', '01', '불러오는 중', { pending: true }],
    ['error', '02', '결과를 불러오지 못했습니다.', { status: 500, json: {} }],
    ['forbidden', '04', '이 스터디의 신청 결과를 볼 권한이 없습니다.', { status: 403, json: {} }],
    ['no-questions', '05', '이 스터디는 신청 폼에 추가 질문이 없습니다.', { json: { respondentCount: 0, questions: [], applications: [] } }],
    ['empty', '06', '아직 들어온 신청이 없습니다.', { json: { ...results, respondentCount: 0, applications: [] } }],
    ['summary', '07', '매주 읽은 내용을 나누고 싶습니다.', { json: results }],
    ['individual', '08', '테스트크루', { json: results }],
  ].map(([id, number, text, response]) => state(`study-detail--application-results-${id}`, `BO-ST-024-V${number}`, `신청 결과 ${id}`,
    `${resultsUrl}${id === 'individual' ? '&resultsView=individual' : ''}`, text as string,
    [{ path: resultsPath, ...(response as object) }])),
];
for (const item of prdStudyStates) {
  if (item.id === 'study-detail--application-form-editing') item.assertions!.visible = ['[aria-label="질문 타입"]', '[aria-label="질문 제목"]'];
  if (item.id === 'study-detail--application-form-saving') item.assertions!.disabled = ['form[aria-label="신청 폼 설계"] button[type="submit"]'];
  if (['study-detail--application-form-forbidden', 'study-detail--application-form-locked'].includes(item.id)) item.assertions!.hidden = ['form[aria-label="신청 폼 설계"] button[type="submit"]'];
  if (['study-list--create', 'study-detail--next-cohort', 'study-detail--publish-confirm', 'study-detail--unpublish-confirm'].includes(item.id)) item.assertions!.visible = [dialog];
  if (['study-detail--application-form-empty', 'study-detail--application-results-individual'].includes(item.id)) item.viewports = ['desktop', 'mobile'];
}
