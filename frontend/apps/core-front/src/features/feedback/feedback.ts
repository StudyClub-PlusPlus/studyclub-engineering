// 문의·오류 신고 — 라벨 · 입력 규칙 · 오류 문구 · 표기 형식. 화면 이름은 여기 한 곳에서 API 값(enum)으로 바꾼다.
// specs/feedback/spec.md · 01-planning/stories/crew-submit-feedback/PRD.md · 프로토 proto/lib/feedback.ts
// vitest 에 @ 별칭이 없어 상대 경로로 부른다.
import { IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '@studyclub/ui';
import { z } from 'zod';

import { ApiError } from '../../lib/http';

/** `FEEDBACK.TYPE` 값 그대로. */
export type FeedbackType = 'QUESTION' | 'IDEA' | 'BUG';
/** 제출자가 보는 상태 — 서버가 `Feedback.submitterStatus()` 로 바꿔서 준다. 화면은 다시 계산하지 않는다. */
export type FeedbackStatus = 'RECEIVED' | 'ANSWERED';

/** 고르는 순서 — 문의 · 개선 의견 · 오류 신고 (프로토 `FEEDBACK_TYPES`) */
export const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'QUESTION', label: '문의' },
  { value: 'IDEA', label: '개선 의견' },
  { value: 'BUG', label: '오류 신고' },
];

export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  QUESTION: '문의',
  IDEA: '개선 의견',
  BUG: '오류 신고',
};

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  RECEIVED: '접수',
  ANSWERED: '답변 완료',
};

export function isFeedbackType(value: string): value is FeedbackType {
  return FEEDBACK_TYPES.some((t) => t.value === value);
}

/** 글자 수 — 앞뒤 공백을 자른 뒤 `string.length` (서버 Java `String.length()` 와 같은 UTF-16 단위) */
export const TITLE_MIN = 2;
export const TITLE_MAX = 100;
export const CONTENT_MIN = 10;
export const CONTENT_MAX = 2000;

/** 목록은 20건씩 (스펙 · PRD). */
export const PAGE_SIZE = 20;

/** 이미지 첨부 — 3장까지, 장당 5MB, PNG · JPG · WEBP (GIF 는 받지 않는다: 스펙 결정 기록). 형식·크기는 공용 업로드와 같다. */
export const IMAGE_MAX_COUNT = 3;
export { IMAGE_ACCEPT, IMAGE_MAX_BYTES };
const IMAGE_TYPES = IMAGE_ACCEPT.split(',');

export const IMAGE_HINT = `최대 ${IMAGE_MAX_COUNT}장, 장당 5MB · PNG, JPG, WEBP`;
export const IMAGE_TYPE_ERROR = 'PNG, JPG, WEBP 이미지만 첨부할 수 있습니다.';
export const IMAGE_SIZE_ERROR = '5MB 이하 이미지만 첨부할 수 있습니다.';
export const IMAGE_COUNT_ERROR = `이미지는 최대 ${IMAGE_MAX_COUNT}장까지 첨부할 수 있습니다.`;
export const IMAGE_UPLOAD_ERROR = '이미지를 올리지 못했습니다. 다시 시도해 주세요.';

export const SENT_MESSAGE = '의견을 보내주셔서 감사합니다.';
export const SEND_FAILED_MESSAGE = '의견을 보내지 못했습니다. 다시 시도해 주세요.';
export const TOO_MANY_MESSAGE = '잠시 후 다시 시도해 주세요.';
export const LOAD_FAILED_MESSAGE = '불러오지 못했습니다. 다시 시도해 주세요.';
export const NOT_FOUND_MESSAGE = '찾을 수 없는 문의입니다.';

function lengthRule(field: '제목' | '내용', min: number, max: number) {
  return (value: string, ctx: z.RefinementCtx) => {
    const len = value.trim().length;
    if (len < min) ctx.addIssue({ code: 'custom', message: `${field}을 ${min}자 이상 입력해 주세요.` });
    else if (len > max) ctx.addIssue({ code: 'custom', message: `${field}은 ${max}자를 넘을 수 없습니다.` });
  };
}

/**
 * 문의하기 팝업의 입력 규칙 — 서버 검증과 같은 범위. 유형은 기본 선택이 없어 빈 문자열로 시작한다.
 * 제목·내용 모두 앞뒤 공백을 자른 길이로 잰다.
 */
export const feedbackSchema = z.object({
  type: z.string().refine(isFeedbackType, '유형을 선택해 주세요.'),
  title: z.string().superRefine(lengthRule('제목', TITLE_MIN, TITLE_MAX)),
  content: z.string().superRefine(lengthRule('내용', CONTENT_MIN, CONTENT_MAX)),
});

/** 입력 중인 값 — 유형은 고르기 전 빈 문자열 */
export type FeedbackFormInput = z.input<typeof feedbackSchema>;
/** 검증을 마친 값 — 유형이 정해져 있다 */
export type FeedbackFormValues = z.output<typeof feedbackSchema>;

export const EMPTY_FEEDBACK: FeedbackFormInput = { type: '', title: '', content: '' };

/** POST /api/feedbacks 본문 */
export type FeedbackSubmitBody = {
  type: FeedbackType;
  title: string;
  content: string;
  imageFileIds: number[];
  viewport: { width: number; height: number };
};

/**
 * 검증을 마친 입력을 제출 본문으로. 제목은 자른 값을, 내용은 줄바꿈·들여쓰기를 지키려고 쓴 그대로 보낸다
 * (서버가 길이를 잴 때 자른다). 함께 가는 정보는 화면 크기뿐 — 브라우저·OS 는 서버가 요청 헤더에서 읽는다.
 */
export function toSubmitBody(
  values: FeedbackFormValues,
  imageFileIds: number[],
  viewport: { width: number; height: number },
): FeedbackSubmitBody {
  return { type: values.type, title: values.title.trim(), content: values.content, imageFileIds, viewport };
}

/** 제출 때 화면 크기 — `innerWidth` · `innerHeight`. 서버가 받는 범위(1~10000) 안으로 맞춘다. */
export function viewportOf(win: { innerWidth: number; innerHeight: number }): { width: number; height: number } {
  const fit = (n: number) => Math.min(10000, Math.max(1, Math.round(n) || 1));
  return { width: fit(win.innerWidth), height: fit(win.innerHeight) };
}

/** 고른 직후 거를 사유 — 서버가 다시 검사하지만 5MB 까지 올려 보낸 뒤 알려 주면 느리다. 없으면 null. */
export function imageProblem(file: { type: string; size: number }): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return IMAGE_TYPE_ERROR;
  if (file.size > IMAGE_MAX_BYTES) return IMAGE_SIZE_ERROR;
  return null;
}

/** POST /api/uploads/images 본문 — 용도는 FEEDBACK. `Content-Type` 은 브라우저가 multipart 경계와 함께 붙인다. */
export function feedbackImageForm(file: File): FormData {
  const body = new FormData();
  body.append('file', file);
  body.append('purpose', 'FEEDBACK');
  return body;
}

/** 전송 실패 문구 — 너무 자주 보냄(429)만 따로, 나머지(400 · 5xx · 네트워크)는 하나로. */
export function sendErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) return TOO_MANY_MESSAGE;
  return SEND_FAILED_MESSAGE;
}

/** 이미지 올리기 실패 문구 — 서버가 사유를 주면(400: 형식 · 올린 개수 상한 등) 그대로, 아니면 다시 시도. */
export function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return error.message;
    if (error.status === 413) return IMAGE_SIZE_ERROR;
  }
  return IMAGE_UPLOAD_ERROR;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function isOnboardingRequired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 목록 접수일 — 「10.18」 (프로토와 같은 형식, 보는 사람의 기기 시간) */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** 상세 시각 — 「26.10.18 14:02」 */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getFullYear()).slice(2)}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
