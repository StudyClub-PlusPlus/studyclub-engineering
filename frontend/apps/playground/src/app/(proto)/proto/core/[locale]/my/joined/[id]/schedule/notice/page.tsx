'use client';

import { useEffect, useMemo, useState } from 'react';

import { useManage } from '@core/components/StudyManageShell';
import {
  NOTICE_LIMITS,
  NoticeRateLimitedError,
  getCompose,
  listNotices,
  sendNotice,
  type NoticeChannel,
  type NoticeCompose,
  type NoticeRecord,
  type NoticeRecipient,
} from '@core/lib/study-notice';
import { Badge, Button, Checkbox, Input, Modal, Segmented, Textarea, cx, toast } from '@studyclub/ui';

import { MANAGE_SPEC } from '../spec';
import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

type StatusFilter = 'ALL' | 'ACTIVE' | 'PAUSED';

const DISCORD_REASON: Record<string, string> = {
  BOT_NOT_CONFIGURED: '디스코드 봇이 연결되어 있지 않아 보낼 수 없습니다.',
  NO_DISCORD_CHANNEL: '이 스터디에 디스코드 채널이 만들어져 있지 않아 보낼 수 없습니다.',
  SENDER_NOT_LINKED: '내 디스코드가 연동되어 있지 않아 보낼 수 없습니다.',
};

const SKIP_LABEL: Record<string, string> = {
  BOT_NOT_CONFIGURED: '봇 미연결',
  NO_DISCORD_CHANNEL: '스터디 디스코드 채널 없음',
  SENDER_NOT_LINKED: '보낸 사람 디스코드 미연동',
  NO_TEXT_CHANNEL: '텍스트 채널 없음',
};

const PAGE = 20;

/** 보는 사람의 시간대로 HH:mm. */
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
const when = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * 공지 탭 — 네비게이터(캡틴)가 자기 반 팀원 중 고른 사람에게 메일·디스코드로 공지를 보낸다 (POL-0010).
 * 판정(보낼 수 있는가 · 디스코드가 되는가 · 한도)은 서버가 내려준 값을 그리기만 한다.
 */
export default function StudyManageNoticesPage() {
  const { study, group, canEdit } = useManage();
  const [compose, setCompose] = useState<NoticeCompose | null>(null);
  const [records, setRecords] = useState<NoticeRecord[]>([]);
  const [shown, setShown] = useState(PAGE);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channels, setChannels] = useState<NoticeChannel[]>(['EMAIL']);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  /** 고른 사람. 거르기로 지워지지 않는다 — 처음에는 참여 중 전원. */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [openBody, setOpenBody] = useState<Set<string>>(new Set());

  function refresh() {
    setCompose(getCompose(study, group));
    setRecords(listNotices(study, group));
  }

  // 프로토는 브라우저 저장소에서 읽는다 — 마운트 때 한 번, 그리고 메일이 나간 것으로 보이도록 10초마다.
  useEffect(() => {
    const c = getCompose(study, group);
    setCompose(c);
    setPicked(new Set(c.recipients.filter((r) => r.participantStatus === 'ACTIVE').map((r) => r.participantId)));
    setRecords(listNotices(study, group));
    const t = setInterval(() => setRecords(listNotices(study, group)), 10_000);
    return () => clearInterval(t);
  }, [study, group]);

  // 값이 없을 때마다 새 빈 배열을 만들면 아래 useMemo 가 매 렌더 다시 계산된다 — compose 가 바뀔 때만 만든다
  const recipients = useMemo(() => compose?.recipients ?? [], [compose]);
  const counts = useMemo(
    () => ({
      ALL: recipients.length,
      ACTIVE: recipients.filter((r) => r.participantStatus === 'ACTIVE').length,
      PAUSED: recipients.filter((r) => r.participantStatus === 'PAUSED').length,
    }),
    [recipients],
  );
  const visible = recipients.filter((r) => filter === 'ALL' || r.participantStatus === filter);
  const visiblePicked = visible.filter((r) => picked.has(r.participantId)).length;

  if (!canEdit) {
    return (
      <>
        <ScreenSpecRegistrar spec={MANAGE_SPEC} />
        <div className='card px-6 py-10 text-center'>
          <p className='text-sm font-semibold text-fg'>공지는 네비게이터와 캡틴만 보낼 수 있습니다.</p>
          <p className='mt-1.5 text-sm text-fg-muted'>보낸 공지는 메일과 디스코드로 받습니다.</p>
        </div>
      </>
    );
  }

  const discordOn = channels.includes('DISCORD');
  const discordAvailable = compose?.discord.available ?? false;
  const titleLen = title.trim().length;
  const bodyLen = body.trim().length;
  const titleOver = titleLen > NOTICE_LIMITS.title;
  const bodyOver = bodyLen > NOTICE_LIMITS.body;
  const mentioned = recipients.filter((r) => picked.has(r.participantId) && r.discordLinked).length;
  const valid =
    titleLen > 0 && !titleOver && bodyLen > 0 && !bodyOver && channels.length > 0 && picked.size > 0 && Boolean(compose?.canSend);

  function toggleChannel(ch: NoticeChannel, on: boolean) {
    setChannels((cur) => (on ? [...cur.filter((c) => c !== ch), ch] : cur.filter((c) => c !== ch)));
  }

  function toggleOne(id: string, on: boolean) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** 보이는(거른) 사람만 건드린다 — 보이지 않는 사람의 선택은 그대로. */
  function toggleVisible(on: boolean) {
    setPicked((cur) => {
      const next = new Set(cur);
      for (const r of visible) {
        if (on) next.add(r.participantId);
        else next.delete(r.participantId);
      }
      return next;
    });
  }

  async function send() {
    setSending(true);
    try {
      // TODO(api): POST /api/studies/{studyId}/groups/{groupId}/notices
      await new Promise((r) => setTimeout(r, 500));
      sendNotice(study, group, { title, body, channels, participantIds: [...picked] });
      setConfirming(false);
      toast.success('공지를 보냈습니다.');
      setTitle('');
      setBody('');
      refresh();
    } catch (e) {
      setConfirming(false);
      if (e instanceof NoticeRateLimitedError) {
        // 글은 지우지 않는다 — 한도 안내만 새로 그린다
        refresh();
        toast.error('지금은 공지를 보낼 수 없습니다.');
      } else {
        toast.error('공지를 보내지 못했습니다. 다시 시도해 주세요.');
      }
    } finally {
      setSending(false);
    }
  }

  const limitNote = (() => {
    if (!compose) return null;
    if (compose.blockedReason === 'COOLDOWN' && compose.nextAvailableAt) {
      return `방금 공지를 보냈습니다. ${hhmm(compose.nextAvailableAt)} 이후에 다시 보낼 수 있습니다.`;
    }
    if (compose.blockedReason === 'DAILY_LIMIT') {
      return `오늘 보낼 수 있는 횟수(${NOTICE_LIMITS.dailyMax}회)를 모두 썼습니다. 내일 다시 보낼 수 있습니다.`;
    }
    if (compose.remainingToday <= 5) return `오늘 ${compose.remainingToday}번 더 보낼 수 있습니다.`;
    return null;
  })();

  return (
    <>
      <ScreenSpecRegistrar spec={MANAGE_SPEC} />
      <ScreenSpecRegistrar spec={SPEC} />

      <div className='max-w-2xl space-y-6'>
        <section data-anno='notice:1' className='card space-y-5 p-6'>
          <h2 className='text-base font-bold text-fg'>공지 쓰기</h2>

          <div data-anno='notice:1-1'>
            <Input
              label='제목'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='예: 이번 주 모임 장소가 바뀌었어요'
              error={titleOver ? `제목은 ${NOTICE_LIMITS.title}자까지 쓸 수 있습니다.` : undefined}
            />
            <p className={cx('mt-1 text-right text-xs', titleOver ? 'text-danger-fg' : 'text-fg-muted')}>
              {titleLen} / {NOTICE_LIMITS.title}
            </p>
          </div>

          <div data-anno='notice:1-2'>
            <Textarea
              label='본문'
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='팀원에게 전할 내용을 적어 주세요.'
              error={bodyOver ? `본문은 ${NOTICE_LIMITS.body.toLocaleString()}자까지 쓸 수 있습니다.` : undefined}
            />
            <p className={cx('mt-1 text-right text-xs', bodyOver ? 'text-danger-fg' : 'text-fg-muted')}>
              {bodyLen.toLocaleString()} / {NOTICE_LIMITS.body.toLocaleString()}
            </p>
          </div>

          <fieldset data-anno='notice:1-3'>
            <legend className='mb-2 text-sm font-semibold text-fg'>보낼 곳</legend>
            <div className='flex flex-wrap gap-x-6 gap-y-2'>
              <Checkbox label='메일' checked={channels.includes('EMAIL')} onChange={(e) => toggleChannel('EMAIL', e.target.checked)} />
              <Checkbox
                label='디스코드'
                checked={discordOn && discordAvailable}
                disabled={!discordAvailable}
                onChange={(e) => toggleChannel('DISCORD', e.target.checked)}
              />
            </div>
            {compose && !discordAvailable && compose.discord.unavailableReason && (
              <p data-anno='notice:1-4' className='mt-2 text-sm text-fg-muted'>
                {DISCORD_REASON[compose.discord.unavailableReason]}
              </p>
            )}
          </fieldset>
        </section>

        <section data-anno='notice:2' className='card p-6'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <h2 className='text-base font-bold text-fg'>받는 사람</h2>
            <p className='text-sm text-fg-secondary' aria-live='polite'>
              {picked.size}명 선택
            </p>
          </div>

          <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
            <div data-anno='notice:2-1'>
              <Segmented<StatusFilter>
                size='sm'
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'ALL', label: `전체 ${counts.ALL}` },
                  { value: 'ACTIVE', label: `참여 중 ${counts.ACTIVE}` },
                  { value: 'PAUSED', label: `쉬는 중 ${counts.PAUSED}` },
                ]}
              />
            </div>
            <div data-anno='notice:2-2'>
              <Checkbox
                label={`보이는 ${visible.length}명 모두 선택`}
                checked={visible.length > 0 && visiblePicked === visible.length}
                indeterminate={visiblePicked > 0 && visiblePicked < visible.length}
                disabled={visible.length === 0}
                onChange={(e) => toggleVisible(e.target.checked)}
              />
            </div>
          </div>

          <ul data-anno='notice:2-3' className='mt-3 divide-y divide-border rounded-control border border-border'>
            {visible.length === 0 && <li className='px-4 py-6 text-center text-sm text-fg-muted'>이 상태의 팀원이 없습니다.</li>}
            {visible.map((r: NoticeRecipient) => (
              <li key={r.participantId} className='flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5'>
                <Checkbox
                  label={r.displayName}
                  checked={picked.has(r.participantId)}
                  onChange={(e) => toggleOne(r.participantId, e.target.checked)}
                />
                <span className='flex flex-wrap items-center gap-1.5'>
                  {r.participantRole === 'LEADER' && <Badge tone='navigator'>네비게이터</Badge>}
                  {r.participantStatus === 'PAUSED' && <Badge tone='neutral'>쉬는 중</Badge>}
                  {!r.discordLinked && <Badge tone='neutral'>디스코드 미연동</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div data-anno='notice:3' className='flex flex-wrap items-center justify-between gap-3'>
          <p data-anno='notice:3-1' className='text-sm text-fg-secondary' aria-live='polite'>
            {limitNote}
          </p>
          <Button data-anno='notice:3-2' disabled={!valid} loading={sending} onClick={() => setConfirming(true)}>
            공지 보내기
          </Button>
        </div>

        <section data-anno='notice:5' className='card p-6'>
          <h2 className='text-base font-bold text-fg'>보낸 공지</h2>
          {records.length === 0 ? (
            <p data-anno='notice:5-2' className='py-10 text-center text-sm text-fg-muted'>
              아직 보낸 공지가 없습니다.
            </p>
          ) : (
            <ul className='mt-3 divide-y divide-border'>
              {records.slice(0, shown).map((n, i) => (
                <li key={n.noticeId} data-anno={i === 0 ? 'notice:5-1' : undefined} className='py-4'>
                  <div className='flex flex-wrap items-baseline justify-between gap-2'>
                    <p className='font-semibold text-fg'>{n.title}</p>
                    <p className='text-xs text-fg-muted'>
                      {n.senderName} · {when(n.sentAt)} · {n.recipientCount}명
                    </p>
                  </div>
                  <p className={cx('mt-1 whitespace-pre-line text-sm text-fg-secondary', !openBody.has(n.noticeId) && 'line-clamp-3')}>
                    {n.body}
                  </p>
                  {n.body.split('\n').length > 3 || n.body.length > 120 ? (
                    <button
                      type='button'
                      className='mt-1 text-xs font-semibold text-brand hover:underline'
                      onClick={() =>
                        setOpenBody((cur) => {
                          const next = new Set(cur);
                          if (next.has(n.noticeId)) next.delete(n.noticeId);
                          else next.add(n.noticeId);
                          return next;
                        })
                      }
                    >
                      {openBody.has(n.noticeId) ? '접기' : '모두 보기'}
                    </button>
                  ) : null}
                  <div className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted'>
                    {n.email.requested && (
                      <span>
                        메일 · 대기 {n.email.pending} · 완료 {n.email.sent} · 실패 {n.email.failed}
                      </span>
                    )}
                    {n.discord.requested && (
                      <span>
                        디스코드 ·{' '}
                        {n.discord.status === 'SENT'
                          ? `완료 (멘션 ${n.discord.mentionedCount}명)`
                          : n.discord.status === 'SKIPPED'
                            ? `건너뜀 (${SKIP_LABEL[n.discord.skipReason ?? ''] ?? n.discord.skipReason})`
                            : n.discord.status === 'FAILED'
                              ? '실패'
                              : '대기'}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {records.length > shown && (
            <div className='mt-3 text-center'>
              <Button variant='secondary' size='sm' onClick={() => setShown((s) => s + PAGE)}>
                더 보기
              </Button>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={confirming}
        onClose={() => !sending && setConfirming(false)}
        title='공지를 보낼까요?'
        footer={
          <>
            <Button variant='secondary' disabled={sending} onClick={() => setConfirming(false)}>
              취소
            </Button>
            <Button loading={sending} onClick={send}>
              보내기
            </Button>
          </>
        }
      >
        <div className='space-y-2 text-sm text-fg-secondary'>
          <p>
            <strong className='text-fg'>{picked.size}명</strong>에게 보냅니다. 보낸 공지는 고치거나 거둘 수 없습니다.
          </p>
          <ul className='list-disc pl-5'>
            {channels.includes('EMAIL') && <li>메일: {picked.size}명에게 한 통씩</li>}
            {discordOn && discordAvailable && <li>디스코드: 로비 채널에 글 한 건, {mentioned}명 멘션 (미연동 제외)</li>}
            {discordOn && !discordAvailable && <li>디스코드는 보내지 않습니다.</li>}
          </ul>
        </div>
      </Modal>
    </>
  );
}
