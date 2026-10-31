'use client';

import { useEffect, useMemo, useState } from 'react';

import { Badge, Button, Checkbox, Input, Modal, Segmented, Textarea, cx, toast } from '@studyclub/ui';

import {
  NOTICE_LIMITS,
  canSubmit,
  defaultSelection,
  discordUnavailableMessage,
  draftProblems,
  effectiveChannels,
  limitNote,
  mentionedCount,
  pruneSelection,
  statusCounts,
  toggleOne,
  toggleVisible,
  visibleRecipients,
  type StatusFilter,
} from '../model';
import { useSendNotice } from '../queries';
import { ApiError } from '@/lib/http';
import type { ApiNoticeCompose, NoticeChannel } from '@/lib/study-notice-api';

/**
 * 공지 쓰기 + 받는 사람 고르기 + 보내기. 판정(보낼 수 있는가 · 디스코드가 되는가 · 한도)은 서버가 내려준 `compose` 값을 그리기만 한다.
 * 한 번 보낸 공지는 고치거나 거두지 못해서, 보내기 전에 받는 사람 수와 보낼 곳을 적은 창으로 한 번 더 묻는다 (POL-0010).
 */
export function NoticeComposer({
  studyId,
  groupId,
  compose,
}: {
  studyId: number;
  groupId: number;
  compose: ApiNoticeCompose;
}) {
  const send = useSendNotice(studyId, groupId);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channels, setChannels] = useState<NoticeChannel[]>(['EMAIL']);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [selected, setSelected] = useState<Set<number>>(() => defaultSelection(compose.recipients));
  const [confirming, setConfirming] = useState(false);

  // 다른 반으로 바뀌면 후보도 달라진다. 같은 반에서 다시 받은 값으로는 고른 사람을 지우지 않는다.
  useEffect(() => {
    setSelected(defaultSelection(compose.recipients));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, groupId]);

  const { recipients, discord } = compose;
  // 다시 받은 명단에서 사라진 사람은 선택에서 뺀다. 모든 계산과 제출은 이 집합으로 한다
  const picked = useMemo(() => pruneSelection(selected, recipients), [selected, recipients]);
  const counts = useMemo(() => statusCounts(recipients), [recipients]);
  const visible = visibleRecipients(recipients, filter);
  const visiblePicked = visible.filter((r) => picked.has(r.participantId)).length;

  const effective = effectiveChannels(channels, discord.available);
  const problems = draftProblems({ title, body, channels: effective, selectedCount: picked.size });
  const submittable = canSubmit({ title, body, channels: effective, selectedCount: picked.size }, compose);
  const note = limitNote(compose);

  function setChannel(channel: NoticeChannel, on: boolean) {
    setChannels((cur) => (on ? [...cur.filter((c) => c !== channel), channel] : cur.filter((c) => c !== channel)));
  }

  function submit() {
    send.mutate(
      {
        title: title.trim(),
        body: body.trim(),
        channels: effective,
        participantIds: recipients.filter((r) => picked.has(r.participantId)).map((r) => r.participantId),
      },
      {
        onSuccess: () => {
          setConfirming(false);
          toast.success('공지를 보냈습니다.');
          // 쓴 글만 비운다. 보낼 곳과 받는 사람은 다음 공지에도 그대로 쓰는 일이 많다
          setTitle('');
          setBody('');
        },
        onError: (error) => {
          setConfirming(false);
          // 한도에 걸렸다: 글은 지우지 않고, 다시 받은 화면 값(사유와 시각)이 안내를 갱신한다
          if (error instanceof ApiError && error.status === 429) {
            toast.error('지금은 공지를 보낼 수 없습니다.');
          } else {
            toast.error('공지를 보내지 못했습니다. 다시 시도해 주세요.');
          }
        },
      },
    );
  }

  return (
    <div className='space-y-6'>
      <section className='card space-y-5 p-5 sm:p-6'>
        <h2 className='type-title-md text-fg'>공지 쓰기</h2>

        <div>
          <Input
            label='제목'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='예: 이번 주 모임 장소가 바뀌었어요'
            error={problems.titleOver ? `제목은 ${NOTICE_LIMITS.title}자까지 쓸 수 있습니다.` : undefined}
          />
          <p className={cx('mt-1 text-right type-label-sm', problems.titleOver ? 'text-error-700' : 'text-fg-muted')}>
            {problems.titleLen} / {NOTICE_LIMITS.title}
          </p>
        </div>

        <div>
          <Textarea
            label='본문'
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder='팀원에게 전할 내용을 적어 주세요.'
            error={
              problems.bodyOver ? `본문은 ${NOTICE_LIMITS.body.toLocaleString()}자까지 쓸 수 있습니다.` : undefined
            }
          />
          <p className={cx('mt-1 text-right type-label-sm', problems.bodyOver ? 'text-error-700' : 'text-fg-muted')}>
            {problems.bodyLen.toLocaleString()} / {NOTICE_LIMITS.body.toLocaleString()}
          </p>
        </div>

        <fieldset>
          <legend className='mb-2 type-label-lg text-fg'>보낼 곳</legend>
          <div className='flex flex-wrap gap-x-6 gap-y-2'>
            <Checkbox
              label='메일'
              checked={channels.includes('EMAIL')}
              onChange={(e) => setChannel('EMAIL', e.target.checked)}
            />
            <Checkbox
              label='디스코드'
              checked={channels.includes('DISCORD') && discord.available}
              disabled={!discord.available}
              onChange={(e) => setChannel('DISCORD', e.target.checked)}
            />
          </div>
          {!discord.available && (
            <p className='mt-2 type-body-sm text-fg-muted'>{discordUnavailableMessage(discord.unavailableReason)}</p>
          )}
        </fieldset>
      </section>

      <section className='card p-5 sm:p-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h2 className='type-title-md text-fg'>받는 사람</h2>
          <p className='type-body-sm text-fg-secondary' aria-live='polite'>
            {picked.size}명 선택
          </p>
        </div>

        <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
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
          <Checkbox
            label={`보이는 ${visible.length}명 모두 선택`}
            checked={visible.length > 0 && visiblePicked === visible.length}
            indeterminate={visiblePicked > 0 && visiblePicked < visible.length}
            disabled={visible.length === 0}
            onChange={(e) => setSelected((cur) => toggleVisible(cur, visible, e.target.checked))}
          />
        </div>

        <ul className='mt-3 divide-y divide-border rounded-control border border-border'>
          {visible.length === 0 && (
            <li className='px-4 py-6 text-center type-body-sm text-fg-muted'>이 상태의 팀원이 없습니다.</li>
          )}
          {visible.map((r) => (
            <li key={r.participantId} className='flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5'>
              <Checkbox
                label={r.displayName}
                checked={picked.has(r.participantId)}
                onChange={(e) => setSelected((cur) => toggleOne(cur, r.participantId, e.target.checked))}
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

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='type-body-sm text-fg-secondary' aria-live='polite'>
          {note}
        </p>
        <Button disabled={!submittable} loading={send.isPending} onClick={() => setConfirming(true)}>
          공지 보내기
        </Button>
      </div>

      <Modal
        open={confirming}
        onClose={() => !send.isPending && setConfirming(false)}
        title='공지를 보낼까요?'
        footer={
          <>
            <Button variant='secondary' data-autofocus disabled={send.isPending} onClick={() => setConfirming(false)}>
              취소
            </Button>
            <Button loading={send.isPending} onClick={submit}>
              보내기
            </Button>
          </>
        }
      >
        <div className='space-y-2 type-body-sm text-fg-secondary'>
          <p>
            <strong className='text-fg'>{picked.size}명</strong>에게 보냅니다. 보낸 공지는 고치거나 거둘 수 없습니다.
          </p>
          <ul className='list-disc pl-5'>
            {effective.includes('EMAIL') && <li>메일: {picked.size}명에게 한 통씩</li>}
            {effective.includes('DISCORD') && (
              <li>디스코드: 로비 채널에 글 한 건, {mentionedCount(recipients, picked)}명 멘션 (미연동 제외)</li>
            )}
            {channels.includes('DISCORD') && !discord.available && <li>디스코드는 보내지 않습니다.</li>}
          </ul>
        </div>
      </Modal>
    </div>
  );
}
