// 알림 템플릿 타입. 백엔드 NotificationTemplateResponse 와 1:1 이다.
// 조건·채널 이름과 시각 표기는 발송 이력과 같은 규칙이라 `features/notifications/labels.ts` 를 쓴다.

import { eventLabel } from '@/features/notifications/labels';

export type NotificationTemplate = {
  id: number;
  eventType: string;
  channel: string;
  subject: string;
  body: string;
  updatedAt: string | null;
  updatedByAdminId: number | null;
};

/** 추가·수정 요청 바디. 채널은 보내지 않는다 — 지금 보낼 수 있는 것은 메일뿐이라 서버가 정한다. */
export type TemplateDraft = {
  eventType: string;
  subject: string;
  body: string;
};

/** 제목 최대 글자 수. 서버의 `SUBJECT VARCHAR(255)` 와 같다. */
export const SUBJECT_MAX_LENGTH = 255;

/** 본문 최대 크기(UTF-8 바이트). 서버의 `BODY TEXT` 한도와 같다 — 글자 수가 아니라 바이트라 한글은 3바이트로 센다. */
export const BODY_MAX_BYTES = 65_535;

const encoder = new TextEncoder();

export function utf8Bytes(text: string): number {
  return encoder.encode(text).length;
}

/** 한도를 넘으면 한도 안에 들어가는 앞부분만 남긴다. 글자 한가운데서 자르지 않는다. */
export function clampToUtf8Bytes(text: string, maxBytes: number): string {
  if (utf8Bytes(text) <= maxBytes) return text;
  let used = 0;
  let kept = '';
  for (const char of text) {
    const size = utf8Bytes(char);
    if (used + size > maxBytes) break;
    used += size;
    kept += char;
  }
  return kept;
}

export type BodyEdit = {
  value: string;
  /** 한도에 걸려 값을 고쳤을 때, 커서를 돌려 놓을 자리. 고치지 않았으면 null. */
  caret: number | null;
};

/**
 * 본문 입력이 한도를 넘지 않게 고친다. 이전 값과 비교해 **바뀐 가운데 부분만** 줄인다 — 끝을 자르면 가운데에 친 글자 대신
 * 멀쩡한 본문 끝이 지워진다. 한 글자를 쳤는데 들어갈 자리가 없으면 그 글자만 받지 않고, 긴 글을 붙여 넣으면 들어가는 만큼만 남는다.
 */
export function applyBodyEdit(prev: string, next: string, maxBytes: number): BodyEdit {
  if (utf8Bytes(next) <= maxBytes) return { value: next, caret: null };

  const shared = Math.min(prev.length, next.length);
  let head = 0;
  while (head < shared && prev[head] === next[head]) head++;
  let tail = 0;
  while (tail < shared - head && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) tail++;
  // 이모지 같은 두 칸짜리 글자의 반쪽에서 나누지 않는다
  while (head > 0 && isHighSurrogate(next.charCodeAt(head - 1))) head--;
  while (tail > 0 && isLowSurrogate(next.charCodeAt(next.length - tail))) tail--;

  const before = next.slice(0, head);
  const after = next.slice(next.length - tail);
  const inserted = next.slice(head, next.length - tail);
  const room = Math.max(0, maxBytes - utf8Bytes(before) - utf8Bytes(after));
  const kept = clampToUtf8Bytes(inserted, room);
  return { value: before + kept + after, caret: head + kept.length };
}

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * 팝업에서 고를 수 있는 알림 조건 코드. **조건이 곧 그 알림의 이름이다** — 이름을 따로 받지 않는다.
 * 저장되는 이벤트 코드는 이 선택이 정하고, 화면에 적는 이름은 목록과 같은 `eventLabel` 한 곳에서 온다.
 * 백엔드에 이벤트가 있는 조건만 둔다. 회원 탈퇴는 BE 이벤트가 생길 때 코드 한 줄을 더하고 `labels.ts` 에 이름을 단다.
 */
const SELECTABLE_EVENTS = ['USER_REGISTERED'];

export const TEMPLATE_CONDITIONS: { value: string; label: string }[] = SELECTABLE_EVENTS.map((value) => ({
  value,
  label: eventLabel(value),
}));
