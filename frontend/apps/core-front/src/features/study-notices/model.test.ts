import { describe, expect, it } from 'vitest';

import {
  canSubmit,
  defaultSelection,
  discordResultLabel,
  discordUnavailableMessage,
  draftProblems,
  effectiveChannels,
  limitNote,
  mailResultLabel,
  mentionedCount,
  mergeNoticePages,
  nextNoticeOffset,
  nextRefetchDelay,
  pruneSelection,
  statusCounts,
  toggleOne,
  toggleVisible,
  visibleRecipients,
} from './model';
import type { ApiNoticeCompose, ApiNoticeItem, ApiNoticeList, ApiNoticeRecipient } from '@/lib/study-notice-api';


const person = (
  id: number,
  status: ApiNoticeRecipient['participantStatus'] = 'ACTIVE',
  discordLinked = true,
): ApiNoticeRecipient => ({
  participantId: id,
  displayName: `크루${id}`,
  participantRole: 'MEMBER',
  participantStatus: status,
  discordLinked,
});

const recipients = [person(1), person(2), person(3, 'PAUSED'), person(4, 'ACTIVE', false)];

const compose = (patch: Partial<ApiNoticeCompose> = {}): ApiNoticeCompose => ({
  recipients,
  discord: { available: true, unavailableReason: null },
  canSend: true,
  blockedReason: null,
  nextAvailableAt: null,
  remainingToday: 30,
  ...patch,
});

describe('받는 사람 고르기', () => {
  it('처음에는 참여 중 전원이 골라져 있고 쉬는 중은 비어 있다', () => {
    expect([...defaultSelection(recipients)]).toEqual([1, 2, 4]);
  });

  it('상태로 거르고, 상태별 수를 센다', () => {
    expect(visibleRecipients(recipients, 'PAUSED').map((r) => r.participantId)).toEqual([3]);
    expect(visibleRecipients(recipients, 'ALL')).toHaveLength(4);
    expect(statusCounts(recipients)).toEqual({ ALL: 4, ACTIVE: 3, PAUSED: 1 });
  });

  it('보이는 사람만 켜고 끈다. 보이지 않는 사람의 선택은 그대로다', () => {
    const selected = new Set([1, 2, 4]);
    const pausedOnly = visibleRecipients(recipients, 'PAUSED');

    const on = toggleVisible(selected, pausedOnly, true);
    expect([...on].sort()).toEqual([1, 2, 3, 4]);

    const off = toggleVisible(on, pausedOnly, false);
    expect([...off].sort()).toEqual([1, 2, 4]);
  });

  it('한 명씩 켜고 끄며 원본 집합을 바꾸지 않는다', () => {
    const selected = new Set([1]);

    expect([...toggleOne(selected, 2, true)]).toEqual([1, 2]);
    expect([...toggleOne(selected, 1, false)]).toEqual([]);
    expect([...selected]).toEqual([1]);
  });

  it('다시 받은 명단에서 사라진 사람은 선택에서 걷어낸다', () => {
    const stale = new Set([1, 2, 99]);

    expect([...pruneSelection(stale, recipients)]).toEqual([1, 2]);
    expect([...pruneSelection(new Set([99]), recipients)]).toEqual([]);
    expect([...stale]).toEqual([1, 2, 99]);
  });

  it('멘션되는 사람은 고른 사람 중 디스코드를 연동한 사람이다', () => {
    expect(mentionedCount(recipients, new Set([1, 2, 3, 4]))).toBe(3);
    expect(mentionedCount(recipients, new Set([4]))).toBe(0);
  });
});

describe('쓰기와 보내기 가능 여부', () => {
  const ok = { title: '제목', body: '본문', channels: ['EMAIL' as const], selectedCount: 2 };

  it('글과 보낼 곳과 받는 사람이 갖춰지고 서버가 보낼 수 있다고 하면 보낼 수 있다', () => {
    expect(canSubmit(ok, compose())).toBe(true);
  });

  it('서버가 보낼 수 없다고 하면(한도) 글이 갖춰져도 보낼 수 없다', () => {
    expect(canSubmit(ok, compose({ canSend: false, blockedReason: 'COOLDOWN' }))).toBe(false);
  });

  it('제목·본문이 비었거나, 보낼 곳이 없거나, 받는 사람이 없으면 보낼 수 없다', () => {
    expect(canSubmit({ ...ok, title: '   ' }, compose())).toBe(false);
    expect(canSubmit({ ...ok, body: '' }, compose())).toBe(false);
    expect(canSubmit({ ...ok, channels: [] }, compose())).toBe(false);
    expect(canSubmit({ ...ok, selectedCount: 0 }, compose())).toBe(false);
  });

  it('길이는 앞뒤 공백을 자르고 센다. 제목 60자·본문 1,500자까지 된다', () => {
    expect(draftProblems({ ...ok, title: ` ${'가'.repeat(60)} ` }).titleOver).toBe(false);
    expect(draftProblems({ ...ok, title: '가'.repeat(61) }).titleOver).toBe(true);
    expect(draftProblems({ ...ok, body: '나'.repeat(1500) }).bodyOver).toBe(false);
    expect(draftProblems({ ...ok, body: '나'.repeat(1501) }).bodyOver).toBe(true);
    expect(canSubmit({ ...ok, body: '나'.repeat(1501) }, compose())).toBe(false);
  });

  it('디스코드를 못 쓰면 고른 디스코드를 빼고 보낸다', () => {
    expect(effectiveChannels(['EMAIL', 'DISCORD'], false)).toEqual(['EMAIL']);
    expect(effectiveChannels(['EMAIL', 'DISCORD'], true)).toEqual(['EMAIL', 'DISCORD']);
    // 디스코드만 골랐는데 못 쓰면 보낼 곳이 비어 보낼 수 없다
    expect(canSubmit({ ...ok, channels: effectiveChannels(['DISCORD'], false) }, compose())).toBe(false);
  });
});

describe('쿨다운이 끝나는 때 다시 받기 nextRefetchDelay', () => {
  const now = Date.parse('2026-10-23T03:00:00Z');

  it('쿨다운이면 끝나는 시각까지 남은 시간에 0.5초를 더한다', () => {
    const delay = nextRefetchDelay({ blockedReason: 'COOLDOWN', nextAvailableAt: '2026-10-23T03:00:45Z' }, now);

    expect(delay).toBe(45_500);
  });

  it('이미 지난 시각이면 곧바로(0.5초 뒤) 다시 받는다', () => {
    expect(nextRefetchDelay({ blockedReason: 'COOLDOWN', nextAvailableAt: '2026-10-23T02:59:00Z' }, now)).toBe(500);
  });

  it('쿨다운이 아니면(보낼 수 있음 · 하루 한도 · 끝난 스터디) 다시 받지 않는다', () => {
    expect(nextRefetchDelay({ blockedReason: null, nextAvailableAt: null }, now)).toBe(false);
    expect(nextRefetchDelay({ blockedReason: 'DAILY_LIMIT', nextAvailableAt: null }, now)).toBe(false);
    expect(nextRefetchDelay({ blockedReason: 'STUDY_ENDED', nextAvailableAt: null }, now)).toBe(false);
  });

  it('시각을 읽을 수 없으면 다시 받지 않는다', () => {
    expect(nextRefetchDelay({ blockedReason: 'COOLDOWN', nextAvailableAt: 'not-a-date' }, now)).toBe(false);
  });
});

describe('안내 문구', () => {
  it('디스코드를 못 쓰는 이유를 서버 사유대로 말한다', () => {
    expect(discordUnavailableMessage('SENDER_NOT_LINKED')).toContain('내 디스코드가 연동되어 있지 않아');
    expect(discordUnavailableMessage('BOT_NOT_CONFIGURED')).toContain('봇');
    expect(discordUnavailableMessage('NO_DISCORD_CHANNEL')).toContain('채널');
    expect(discordUnavailableMessage(null)).toBeTruthy();
  });

  it('한도에 걸리면 사유를, 남은 횟수가 적으면 횟수를, 넉넉하면 아무것도 말하지 않는다', () => {
    expect(
      limitNote(compose({ canSend: false, blockedReason: 'COOLDOWN', nextAvailableAt: '2026-10-23T03:00:00Z' })),
    ).toContain('방금 공지를 보냈습니다');
    expect(limitNote(compose({ canSend: false, blockedReason: 'DAILY_LIMIT', remainingToday: 0 }))).toContain(
      '내일 다시',
    );
    expect(limitNote(compose({ remainingToday: 5 }))).toBe('오늘 5번 더 보낼 수 있습니다.');
    expect(limitNote(compose({ remainingToday: 6 }))).toBeNull();
  });

  it('끝난 스터디는 한도 안내보다 먼저 말하고, 보낼 수 없다고 한다', () => {
    const ended = compose({ canSend: false, blockedReason: 'STUDY_ENDED', remainingToday: 0 });

    expect(limitNote(ended)).toBe('끝난 스터디라 새 공지를 보낼 수 없습니다.');
    expect(canSubmit({ title: '제목', body: '본문', channels: ['EMAIL'], selectedCount: 2 }, ended)).toBe(false);
  });

  it('줄표를 쓰지 않는다 (화면 문구 규칙)', () => {
    const texts = [
      discordUnavailableMessage('SENDER_NOT_LINKED'),
      discordUnavailableMessage('BOT_NOT_CONFIGURED'),
      discordUnavailableMessage('NO_DISCORD_CHANNEL'),
      limitNote(compose({ canSend: false, blockedReason: 'DAILY_LIMIT', remainingToday: 0 })) ?? '',
      limitNote(compose({ canSend: false, blockedReason: 'STUDY_ENDED' })) ?? '',
    ];
    for (const text of texts) expect(text).not.toMatch(/[\u2014\u2013\u3161]/);
  });
});

describe('기록의 채널별 결과', () => {
  const item = (patch: Partial<ApiNoticeItem> = {}): ApiNoticeItem => ({
    noticeId: 1,
    title: '제목',
    body: '본문',
    senderName: '네비게이터',
    sentAt: '2026-10-23T03:00:00Z',
    recipientCount: 3,
    email: { requested: true, pending: 1, sent: 1, failed: 1 },
    discord: { requested: true, status: 'SENT', skipReason: null, mentionedCount: 2 },
    ...patch,
  });

  it('메일은 대기·완료·실패 수를, 안 골랐으면 줄이 없다', () => {
    expect(mailResultLabel(item().email)).toBe('메일 · 대기 1 · 완료 1 · 실패 1');
    expect(mailResultLabel({ requested: false, pending: 0, sent: 0, failed: 0 })).toBeNull();
  });

  it('디스코드는 완료·건너뜀·실패·대기를 가른다. 건너뜀에는 사유가 붙는다', () => {
    expect(discordResultLabel(item().discord)).toBe('디스코드 · 완료 (멘션 2명 요청)');
    expect(
      discordResultLabel({ requested: true, status: 'SKIPPED', skipReason: 'SENDER_NOT_LINKED', mentionedCount: 0 }),
    ).toBe('디스코드 · 건너뜀 (보낸 사람 디스코드 미연동)');
    expect(discordResultLabel({ requested: true, status: 'FAILED', skipReason: null, mentionedCount: 0 })).toBe(
      '디스코드 · 실패',
    );
    expect(discordResultLabel({ requested: true, status: 'PENDING', skipReason: null, mentionedCount: 0 })).toBe(
      '디스코드 · 대기',
    );
    expect(
      discordResultLabel({ requested: false, status: 'NOT_REQUESTED', skipReason: null, mentionedCount: 0 }),
    ).toBeNull();
  });
});

describe('보낸 공지 기록 이어 붙이기', () => {
  const noticeAt = (noticeId: number): ApiNoticeItem => ({ ...base, noticeId });
  const base = {} as ApiNoticeItem;
  const page = (offset: number, ids: number[], total: number): ApiNoticeList => ({
    items: ids.map(noticeAt),
    total,
    offset,
    limit: 20,
  });

  it('다음 쪽은 받은 개수에서 시작하고, 다 받으면 없다', () => {
    expect(nextNoticeOffset([page(0, [1, 2, 3], 5)])).toBe(3);
    expect(nextNoticeOffset([page(0, [1, 2, 3], 5), page(3, [4, 5], 5)])).toBeUndefined();
  });

  it('서버가 쪽을 50 에서 잘라 줘도 51건부터 이어 받는다 (같은 쪽을 되풀이하지 않는다)', () => {
    const first = page(0, Array.from({ length: 50 }, (_, i) => i + 1), 55);
    expect(nextNoticeOffset([first])).toBe(50);
    const second = page(50, [51, 52, 53, 54, 55], 55);
    expect(nextNoticeOffset([first, second])).toBeUndefined();
  });

  it('받은 것이 하나도 없으면 더 받지 않는다', () => {
    expect(nextNoticeOffset([])).toBeUndefined();
    expect(nextNoticeOffset([page(0, [], 0)])).toBeUndefined();
  });

  it('쪽을 받는 사이 새 공지가 생겨 경계가 밀려도 같은 공지를 한 번만 보여 준다', () => {
    const merged = mergeNoticePages([page(0, [10, 9, 8], 6), page(3, [8, 7, 6], 6)]);
    expect(merged.map((n) => n.noticeId)).toEqual([10, 9, 8, 7, 6]);
  });
});
