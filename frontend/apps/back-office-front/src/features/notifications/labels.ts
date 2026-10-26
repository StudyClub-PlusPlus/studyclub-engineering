// 발송 이력 화면 문구. 서버 코드를 사람이 읽는 말로 바꾸는 일은 여기서만 한다.
import type { BadgeTone } from '@studyclub/ui';

import type { ApiNotificationStatus } from '@/features/notifications/types';

/**
 * 상태 문구. 「발송」을 앞에 붙이지 않는다 — 열 이름이 이미 무엇의 상태인지 말한다.
 * 「완료」는 **보냈다는 뜻**이지 받았다는 뜻이 아니다(수신함 도착·읽음은 알 수 없다).
 */
export const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  PROCESSING: '처리 중',
  SENT: '완료',
  FAILED: '실패',
};

/** 색은 문구와 함께 쓴다 — 색만으로 가르지 않는다. */
const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: 'neutral',
  PROCESSING: 'inprogress',
  SENT: 'recruiting',
  FAILED: 'error',
};

/** 모르는 상태값은 원문 코드를 회색으로 적는다 — 빈칸으로 두지 않는다. */
export function statusLabel(status: ApiNotificationStatus): string {
  return STATUS_LABEL[status] ?? status;
}

export function statusTone(status: ApiNotificationStatus): BadgeTone {
  return STATUS_TONE[status] ?? 'neutral';
}

/** 거르는 칸의 상태 선택지. 아직 없는 상태(탈퇴로 취소)는 미리 넣지 않는다. */
export const STATUS_OPTIONS = (['PENDING', 'PROCESSING', 'SENT', 'FAILED'] as const).map((value) => ({
  value,
  label: STATUS_LABEL[value]!,
}));

/** 알림 조건 → 사람이 읽는 이름. 모르는 코드는 코드 그대로 적는다(빈칸보다 낫다). */
const EVENT_LABEL: Record<string, string> = {
  USER_REGISTERED: '회원가입',
};

export function eventLabel(eventType: string): string {
  return EVENT_LABEL[eventType] ?? eventType;
}

const CHANNEL_LABEL: Record<string, string> = { EMAIL: '메일' };

export function channelLabel(recipientType: string): string {
  return CHANNEL_LABEL[recipientType] ?? recipientType;
}

/**
 * 보는 사람의 시간대로 24시간제로 적는다. 서버는 UTC 로 주고 브라우저가 바꾼다.
 * **약칭은 줄마다 달지 않는다** — 어느 시간대 기준인지는 표 위에서 한 번 밝힌다(`TimezoneNote`, POL-0006).
 * 읽을 수 없는 값이면 **원문을 그대로** 둔다 — 비우면 값이 없는 것으로 읽힌다.
 */
export function formatStamp(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// ── 재발송 안내 문구 (기획 PRD 「끝난 뒤 알리는 말」)
export const RESEND_REQUEST_FAILED = '재발송을 요청하지 못했습니다. 다시 시도해 주세요.';

/** 끝을 확인한 뒤 한 번만 알린다. `bulk` 는 한 번에 여러 건을 보냈는가. */
export function resendResultMessage(args: { bulk: boolean; succeeded: number; failed: number }): string {
  const { bulk, succeeded, failed } = args;
  if (!bulk) return failed > 0 ? '발송에 실패했습니다.' : '재발송에 성공했습니다.';
  if (failed === 0) return `${succeeded}건 재발송에 성공했습니다.`;
  if (succeeded === 0) return `발송에 실패했습니다. 실패: ${failed}건`;
  return `${succeeded}건 재발송에 성공했습니다. 실패: ${failed}건`;
}
