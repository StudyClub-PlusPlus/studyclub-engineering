import { z } from 'zod';

import type { ApiStudyDetail, StudyCreatePayload, StudyUpdatePayload } from '@/features/studies/types';

/** create = 등록(프로그램을 고른다) · edit = 정보 탭(읽기 전용) · next = 클럽의 「다음 기수 만들기」(프로그램이 정해져 있다) */
export type FormMode = 'create' | 'edit' | 'next';

export type StudyKind = 'STUDY' | 'CLUB';

export const KIND_LABEL: Record<StudyKind, string> = { STUDY: '스터디', CLUB: '클럽' };

/**
 * 카드 제목 권장 길이 = **말줄임이 나지 않는 최대 글자수**.
 *
 * 근거: 카드 제목 영역 315px · 24px extrabold · 2줄 clamp 조건에서
 * 무작위 한글 제목 5,000건을 렌더해 측정 → 25자부터 3줄로 넘어가 말줄임 발생,
 * 24자까지는 초과 0건. 어절이 길수록(띄어쓰기가 적을수록) 먼저 넘친다.
 */
export const TITLE_RECOMMENDED = 24;
/** Backend request limits; recommendation lengths above are visual guidance. */
export const TITLE_MAX_LENGTH = 60;
export const SUMMARY_MAX_LENGTH = 255;
export const URL_MAX_LENGTH = 2048;
/** 카드 한 줄 소개가 줄바꿈 없이 한 줄로 유지되는 최대 글자수. */
export const SUMMARY_RECOMMENDED = 25;

const studyFields = z.object({
  programMode: z.enum(['new', 'existing']),
  programId: z.string(),
  kind: z.enum(['STUDY', 'CLUB']),
  programTitle: z.string(),
  title: z.string(),
  summary: z.string(),
  description: z.string(),
  category: z.string(),
  deadline: z.string(),
  capacity: z.string(),
  unlimited: z.boolean(),
  schedule: z.string(),
  timezone: z.enum(['', 'KST', 'PST', 'BOTH']),
  startAt: z.string(),
  discordUrl: z.string(),
  driveUrl: z.string(),
  thumbnailUrl: z.string(),
  thumbnailFileId: z.number().nullable(),
});

export type StudyFormValues = z.infer<typeof studyFields>;

export const EMPTY_FORM: StudyFormValues = {
  programMode: 'new',
  programId: '',
  kind: 'STUDY',
  programTitle: '',
  title: '',
  summary: '',
  description: '',
  category: '',
  deadline: '',
  capacity: '',
  unlimited: true,
  schedule: '',
  timezone: '',
  startAt: '',
  discordUrl: '',
  driveUrl: '',
  thumbnailUrl: '',
  thumbnailFileId: null,
};

/**
 * 날짜는 **KST 벽시계**로 읽고 쓴다. UTC 로 자르면 한국 오전 9시 이전 값이 하루 앞당겨 보인다.
 * 운영 콘솔은 한국 운영진이 쓰므로 기준을 KST 하나로 둔다.
 */
function toKstDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

/** 마감일은 그날 끝까지 받는다 — 「10월 1일 마감」이면 10월 1일에도 신청할 수 있어야 한다. */
function deadlineToIso(date: string): string {
  return new Date(`${date}T23:59:59+09:00`).toISOString();
}

function startDateToIso(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}

/** 기존 스터디를 폼 값으로 되돌린다. 화면에 보이는 값과 폼 값이 같아야 편집이 성립한다. */
export function detailToForm(d: ApiStudyDetail): StudyFormValues {
  return {
    programMode: 'existing',
    programId: String(d.programId),
    kind: d.studyKind,
    programTitle: d.programTitle,
    title: d.title,
    summary: d.oneLineSummary,
    description: d.description ?? '',
    category: d.category,
    deadline: toKstDate(d.recruitDeadlineAt),
    capacity: d.capacity == null ? '' : String(d.capacity),
    unlimited: d.capacity == null,
    schedule: d.schedule ?? '',
    timezone: d.timezone ?? '',
    startAt: toKstDate(d.startAt),
    discordUrl: d.discordChannelUrl ?? '',
    driveUrl: d.driveUrl ?? '',
    thumbnailUrl: d.thumbnailUrl ?? '',
    thumbnailFileId: null,
  };
}

/**
 * 폼에서 **바뀐 칸만** PATCH 바디로 만든다.
 *
 * 전부 보내면 이미 마감이 지난 스터디의 다른 칸을 고칠 때 지난 마감일이 함께 가서 서버가
 * 「마감일은 미래여야 합니다」로 거절한다. 비운 칸은 `null` 로 보내 서버 값도 비운다.
 */
export function formToPayload(form: StudyFormValues, initial: StudyFormValues): StudyUpdatePayload {
  const p: StudyUpdatePayload = {};
  const changed = (key: keyof StudyFormValues) => form[key] !== initial[key];

  if (changed('title')) p.title = form.title.trim();
  if (changed('summary')) p.oneLineSummary = form.summary.trim();
  if (changed('description')) p.description = form.description;
  if (changed('category')) p.category = form.category;
  if (changed('schedule')) p.schedule = form.schedule.trim();
  if (changed('timezone')) p.timezone = form.timezone || null;
  if (changed('deadline')) p.recruitDeadline = deadlineToIso(form.deadline);
  if (changed('capacity') || changed('unlimited')) {
    p.capacity = form.unlimited ? null : Number(form.capacity.trim());
  }
  if (changed('startAt')) p.startAt = form.startAt ? startDateToIso(form.startAt) : null;
  if (changed('discordUrl')) p.discordChannelUrl = form.discordUrl.trim() || null;
  if (changed('driveUrl')) p.driveUrl = form.driveUrl.trim() || null;
  // 새로 올렸으면 그 번호, 있던 것을 지웠으면 null — 그대로면 보내지 않는다 (같은 번호를 두 번 연결하면 400)
  if (form.thumbnailFileId !== null) p.thumbnailFileId = form.thumbnailFileId;
  else if (changed('thumbnailUrl') && !form.thumbnailUrl) p.thumbnailFileId = null;
  return p;
}

/**
 * 등록 바디. 프로그램은 **둘 중 하나만** 보낸다 — 새 프로그램이면 `studyKind`, 기존 클럽의 새 기수면
 * `studyProgramId`. 둘을 함께 보내면 서버가 400 으로 거절한다(종류는 한 번 정하면 못 바꾼다).
 *
 * ⚠️ 등록 API 는 아직 정원·진행 시작일·채널/드라이브 주소를 받지 않는다(`StudyCreateRequest`). 그래서 그
 * 칸들은 **등록 요청에 실리지 않고**, 등록 뒤 정보 탭에서 저장해야 한다 — specs/study-registration-spec.md
 * 10절의 남은 항목이다. 보내도 서버가 조용히 버리므로 아예 싣지 않는다.
 */
export function formToCreatePayload(form: StudyFormValues): StudyCreatePayload {
  const payload: StudyCreatePayload = {
    title: form.title.trim(),
    oneLineSummary: form.summary.trim(),
    category: form.category,
    recruitDeadline: deadlineToIso(form.deadline),
  };
  if (form.programMode === 'existing') payload.studyProgramId = Number(form.programId);
  else payload.studyKind = form.kind;
  if (form.description.trim()) payload.description = form.description;
  if (form.schedule.trim()) payload.schedule = form.schedule.trim();
  if (form.timezone) payload.timezone = form.timezone;
  if (form.thumbnailFileId !== null) payload.thumbnailFileId = form.thumbnailFileId;
  return payload;
}

export type StudyFormErrors = Partial<Record<keyof StudyFormValues, string>>;

/** 서버 오류 `필드: 사유` 를 어느 칸에 붙일지. 서버 필드 이름과 폼 필드 이름이 다른 것만 적는다. */
const SERVER_FIELD: Record<string, keyof StudyFormValues> = {
  oneLineSummary: 'summary',
  recruitDeadline: 'deadline',
  discordChannelUrl: 'discordUrl',
  studyProgramId: 'programId',
  studyKind: 'kind',
  thumbnailFileId: 'thumbnailUrl',
};

/** 서버 검증 메시지(`capacity: 1 이상의 정수여야 합니다.`)를 칸 오류로 바꾼다. 못 바꾸면 null. */
export function serverErrorToField(message: string): StudyFormErrors | null {
  const m = /^(\w+):\s*(.+)$/.exec(message);
  if (!m) return null;
  const field = SERVER_FIELD[m[1]] ?? m[1];
  if (!(field in EMPTY_FORM)) return null;
  return { [field]: m[2] } as StudyFormErrors;
}

const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

export const studyFormSchema = studyFields.superRefine((f, ctx) => {
  const e: StudyFormErrors = {};
  if (f.programMode === 'existing' && !f.programId) e.programId = '기수를 추가할 프로그램을 고르세요.';
  if (!f.title.trim()) e.title = '제목을 입력하세요.';
  else if (f.title.trim().length > TITLE_MAX_LENGTH) e.title = `${TITLE_MAX_LENGTH}자 이내로 입력하세요.`;
  if (!f.summary.trim()) e.summary = '한 줄 소개를 입력하세요.';
  else if (f.summary.trim().length > SUMMARY_MAX_LENGTH) e.summary = `${SUMMARY_MAX_LENGTH}자 이내로 입력하세요.`;
  if (!f.category) e.category = '카테고리를 선택하세요.';
  if (!f.deadline) e.deadline = '모집 마감일을 입력하세요.';
  if (f.deadline && f.startAt && f.startAt < f.deadline) {
    e.startAt = '진행 시작일은 모집 마감일보다 빠를 수 없어요.';
  }
  if (!f.unlimited && !/^[1-9]\d*$/.test(f.capacity.trim())) {
    e.capacity = '1 이상의 정수로 입력하세요. 제한이 없으면 「제한 없음」을 체크하세요.';
  }
  if (f.discordUrl.trim() && !isHttpUrl(f.discordUrl)) e.discordUrl = 'http(s):// 로 시작하는 주소를 입력하세요.';
  if (f.driveUrl.trim() && !isHttpUrl(f.driveUrl)) e.driveUrl = 'http(s):// 로 시작하는 주소를 입력하세요.';
  for (const field of ['discordUrl', 'driveUrl'] as const) {
    if (f[field].trim().length > URL_MAX_LENGTH) e[field] = `${URL_MAX_LENGTH}자 이내로 입력하세요.`;
  }
  for (const [field, message] of Object.entries(e)) {
    ctx.addIssue({ code: 'custom', path: [field], message });
  }
});

export function validateStudyForm(f: StudyFormValues): StudyFormErrors {
  const result = studyFormSchema.safeParse(f);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]));
}
