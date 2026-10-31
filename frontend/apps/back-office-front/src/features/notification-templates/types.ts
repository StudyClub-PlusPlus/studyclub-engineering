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

const BODY_FORMAT_HELP = 'HTML과 일반 텍스트를 입력할 수 있습니다.';

/**
 * 조건별 안내. 치환 변수는 서버가 그 조건의 알림을 만들 때 넣는 값이고, 영향(`stopEffect`)은 그 조건에 템플릿이 하나도 없을 때 서버가 하는 일이다
 * (specs/notification/spec.md). 서버에 조건이 늘면 여기에 한 줄을 더한다 — 모르는 조건은 안내 없이 일반 문구만 보인다.
 */
const CONDITION_GUIDE: Record<string, { bodyHelp: string; stopEffect: string }> = {
  USER_REGISTERED: {
    bodyHelp: `{{nickname}} 으로 닉네임 삽입. ${BODY_FORMAT_HELP}`,
    stopEffect: '새로 가입한 회원에게 웰컴 메일이 나가지 않습니다.',
  },
  FEEDBACK_REPLIED: {
    bodyHelp: `{{nickname}} 으로 닉네임, {{feedbackUrl}} 로 답변 확인 링크를 삽입할 수 있습니다. ${BODY_FORMAT_HELP}`,
    stopEffect: '문의에 첫 답변을 등록할 수 없습니다. 이미 등록한 답변 수정은 가능합니다.',
  },
  STUDY_NOTICE: {
    bodyHelp: `{{studyTitle}} 스터디 이름, {{groupName}} 반 이름, {{senderName}} 보낸 사람, {{title}} 공지 제목, {{body}} 공지 본문을 삽입할 수 있습니다. ${BODY_FORMAT_HELP}`,
    stopEffect:
      '메일을 포함한 스터디 공지를 보낼 수 없습니다. 메일과 디스코드를 함께 보내는 공지는 디스코드에도 올라가지 않으며, 디스코드만 보내는 공지는 영향이 없습니다.',
  },
};

/** 본문 칸 아래 안내. 그 조건에서 쓸 수 있는 치환 변수를 알려 준다. */
export function bodyHelp(eventType: string): string {
  return CONDITION_GUIDE[eventType]?.bodyHelp ?? BODY_FORMAT_HELP;
}

/** 삭제 확인의 영향 안내. `severe` 는 그 조건의 알림이 멈추는 경우다 — 빨간 글씨로 보인다. */
export type DeleteImpact = { message: string; severe: boolean };

/**
 * 삭제 확인 단계에서 그 조건의 알림에 어떤 일이 생기는지. `sameConditionCount` 는 그 조건의 템플릿 수(지우려는 것 포함)다.
 * 같은 조건에 다른 템플릿이 남으면 이 템플릿의 메일만 멈추고, 마지막이면 조건별 영향이다. 모르는 조건의 마지막은 null.
 */
export function deleteImpact(eventType: string, sameConditionCount: number): DeleteImpact | null {
  if (sameConditionCount > 1) {
    return {
      message: `이 템플릿의 메일만 더 이상 나가지 않습니다. 같은 조건의 다른 템플릿 ${sameConditionCount - 1}개는 계속 나갑니다.`,
      severe: false,
    };
  }
  const effect = CONDITION_GUIDE[eventType]?.stopEffect;
  return effect ? { message: `삭제하면 ${effect}`, severe: true } : null;
}

/**
 * 수정 팝업에서 이 템플릿의 조건을 **다른 조건으로 바꿀 때**의 영향 안내. 원래 조건(`eventType`)에서 이 템플릿이 마지막이면 옮기는 순간 그
 * 조건에 템플릿이 하나도 없게 된다 — 삭제와 같은 결과다(서버는 조건 변경도 막지 않는다). 다른 템플릿이 남거나 모르는 조건이면 null.
 */
export function moveImpact(eventType: string, label: string, sameConditionCount: number): string | null {
  if (sameConditionCount > 1) return null;
  const effect = CONDITION_GUIDE[eventType]?.stopEffect;
  return effect ? `이 템플릿이 ‘${label}’ 조건의 마지막입니다. 조건을 바꿔 저장하면 ${effect}` : null;
}

/**
 * 팝업에서 고를 수 있는 알림 조건 코드. **조건이 곧 그 알림의 이름이다** — 이름을 따로 받지 않는다.
 * 저장되는 이벤트 코드는 이 선택이 정하고, 화면에 적는 이름은 목록과 같은 `eventLabel` 한 곳에서 온다.
 * 백엔드에 이벤트가 있는 조건만 둔다. 회원 탈퇴는 BE 이벤트가 생길 때 코드 한 줄을 더하고 `labels.ts` 에 이름을 단다.
 * 스터디 공지도 둔다 — 시드된 템플릿을 지우면 메일을 포함한 공지가 막히는데, 선택지가 없으면 화면에서 다시 만들 길이 없다.
 * 이미 템플릿이 있는 조건도 고를 수 있다 — 같은 조건에 템플릿을 여럿 두면 그 조건이 생길 때 모두 나간다.
 */
const SELECTABLE_EVENTS = ['USER_REGISTERED', 'STUDY_NOTICE', 'FEEDBACK_REPLIED'];

export const TEMPLATE_CONDITIONS: { value: string; label: string }[] = SELECTABLE_EVENTS.map((value) => ({
  value,
  label: eventLabel(value),
}));
