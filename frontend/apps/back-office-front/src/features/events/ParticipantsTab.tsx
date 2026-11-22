'use client';

import { useEffect, useState } from 'react';

import { Badge, Button, IconButton, Modal, Pagination } from '@studyclub/ui';
import { Eye, EyeOff, Mail } from 'lucide-react';

import { TableCard } from '@/components/ui';
import { useDecideRegistration, useEventRegistrations, useRevealRegistrationEmail } from '@/features/events/queries';
import { RegistrationAnswerDialog } from '@/features/events/RegistrationAnswerDialog';
import {
  CHANNEL_LABEL,
  REGISTRATION_LABEL,
  type EventDetail,
  type EventRegistrationRow,
  type RegistrationTarget,
} from '@/features/events/types';
import { ApiError } from '@/lib/http';

const STATUS_TONE = { CONFIRMED: 'recruiting', PENDING: 'closingsoon', DECLINED: 'neutral', CANCELLED: 'neutral' } as const;

type Pending = { row: EventRegistrationRow; status: 'DECLINED' | 'CANCELLED' };

export function ParticipantsTab({
  detail,
  page,
  onPage,
  onCompose,
  onNotice,
}: {
  detail: EventDetail;
  page: number;
  onPage: (page: number) => void;
  onCompose: () => void;
  onNotice: (message: string) => void;
}) {
  const eventId = detail.eventId;
  const list = useEventRegistrations(eventId, page);
  const decide = useDecideRegistration(eventId);
  const reveal = useRevealRegistrationEmail(eventId);
  const [revealed, setRevealed] = useState<Record<number, string>>({});
  const [revealing, setRevealing] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const [answerOf, setAnswerOf] = useState<EventRegistrationRow | null>(null);

  const cancelled = detail.status === 'CANCELLED';
  const nameOf = (row: EventRegistrationRow) => row.nickname ?? '탈퇴한 회원';

  function toggleEmail(row: EventRegistrationRow) {
    if (revealed[row.registrationId] !== undefined) {
      // 가림은 API 를 부르지 않고 화면 메모리에서 지운다
      setRevealed((current) => {
        const next = { ...current };
        delete next[row.registrationId];
        return next;
      });
      return;
    }
    setError('');
    setRevealing((current) => new Set(current).add(row.registrationId));
    // 행마다 따로 기다린다. 여러 행을 연달아 눌러도 각 행의 진행 표시가 자기 응답으로 풀린다
    reveal
      .mutateAsync(row.registrationId)
      .then((result) => setRevealed((current) => ({ ...current, [row.registrationId]: result.email })))
      .catch((e: Error) => setError(e.message))
      .finally(() =>
        setRevealing((current) => {
          const next = new Set(current);
          next.delete(row.registrationId);
          return next;
        }),
      );
  }

  function run(row: EventRegistrationRow, status: RegistrationTarget, message: string) {
    setError('');
    decide
      .mutateAsync({ registrationId: row.registrationId, status })
      .then(() => onNotice(message))
      .catch((e: Error) => {
        const code = e instanceof ApiError ? e.code : undefined;
        setError(
          code === 'EVENT_REGISTRATION_STATUS_NOT_ALLOWED'
            ? '현재 상태에서는 처리할 수 없습니다. 목록을 다시 불러왔어요.'
            : e.message,
        );
      });
  }

  const data = list.data;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  // 범위 밖 페이지(서버는 빈 items + 실제 total)는 빈 목록이 아니라 마지막 페이지로 보낸다
  useEffect(() => {
    if (data && !list.isPlaceholderData && data.items.length === 0 && data.offset >= data.total && page > 1) onPage(pageCount);
  }, [data, list.isPlaceholderData, page, pageCount, onPage]);
  const showMailButton = !cancelled || detail.hasCancellationRecipients;

  return (
    <section className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='type-body-sm text-fg-muted'>{data ? `전체 신청 이력 ${data.total}건` : ''}</p>
        {showMailButton && (
          <Button
            size='sm'
            variant={cancelled ? 'destructive' : 'secondary'}
            leadingIcon={<Mail size={15} />}
            onClick={onCompose}
          >
            {cancelled ? '취소 안내 메일 보내기' : '안내 메일 보내기'}
          </Button>
        )}
      </div>
      {(error || list.error) && (
        <p role='alert' className='rounded-control bg-danger-bg p-3 type-body-sm text-danger-fg'>
          {error || list.error?.message}
        </p>
      )}
      {list.isPending && !list.error && <p className='py-10 text-center type-body-sm text-fg-muted'>불러오는 중…</p>}
      {data && (
        <>
          <TableCard>
            <thead>
              <tr>
                <th>신청자</th>
                <th>이메일</th>
                <th>참여 방식</th>
                <th>상태</th>
                <th>신청 내용</th>
                <th>처리</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => {
                const shown = revealed[row.registrationId];
                const done = !row.canConfirm && !row.canDecline && !row.canCancel;
                return (
                  <tr key={row.registrationId}>
                    <td className='whitespace-nowrap font-semibold'>{nameOf(row)}</td>
                    <td>
                      {row.accountDeleted || !row.maskedEmail ? (
                        <span className='text-fg-muted'>-</span>
                      ) : (
                        <span className='inline-flex items-center gap-1 whitespace-nowrap type-body-sm text-fg-muted'>
                          <span>{revealing.has(row.registrationId) ? '확인 중…' : (shown ?? row.maskedEmail)}</span>
                          <IconButton
                            size='sm'
                            variant='tertiary'
                            disabled={revealing.has(row.registrationId)}
                            icon={shown === undefined ? <Eye size={15} aria-hidden='true' /> : <EyeOff size={15} aria-hidden='true' />}
                            aria-label={`${nameOf(row)} 이메일 ${shown === undefined ? '보기' : '가리기'}`}
                            aria-pressed={shown !== undefined}
                            onClick={() => toggleEmail(row)}
                          />
                        </span>
                      )}
                    </td>
                    <td className='whitespace-nowrap'>{CHANNEL_LABEL[row.channel]}</td>
                    <td>
                      <Badge tone={STATUS_TONE[row.status]} dot>
                        {REGISTRATION_LABEL[row.status]}
                      </Badge>
                    </td>
                    <td>
                      <Button size='sm' variant='tertiary' aria-label={`${nameOf(row)} 신청서 보기`} onClick={() => setAnswerOf(row)}>
                        답변 보기
                      </Button>
                    </td>
                    <td>
                      <div className='flex min-h-8 items-center gap-1 whitespace-nowrap'>
                        {row.canConfirm && (
                          <Button
                            size='sm'
                            disabled={decide.isPending}
                            onClick={() => run(row, 'CONFIRMED', `${nameOf(row)} 님의 참가가 확정되었습니다.`)}
                          >
                            참가 확정
                          </Button>
                        )}
                        {row.canDecline && (
                          <Button size='sm' variant='tertiary' onClick={() => setConfirm({ row, status: 'DECLINED' })}>
                            참가 불가
                          </Button>
                        )}
                        {row.canCancel && (
                          <Button size='sm' variant='tertiary' onClick={() => setConfirm({ row, status: 'CANCELLED' })}>
                            신청 취소
                          </Button>
                        )}
                        {done && <span className='type-label-sm text-fg-muted'>처리 완료</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className='py-12 text-center text-fg-muted'>
                    아직 신청자가 없습니다. 행사 링크를 공유해 보세요.
                  </td>
                </tr>
              )}
            </tbody>
          </TableCard>
          {data.total > data.limit && <Pagination page={page} total={pageCount} onChange={onPage} />}
        </>
      )}

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.status === 'DECLINED' ? '참가 불가로 처리할까요?' : '신청을 취소할까요?'}
        footer={
          <>
            <Button variant='secondary' data-autofocus onClick={() => setConfirm(null)}>
              돌아가기
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                if (!confirm) return;
                const { row, status } = confirm;
                setConfirm(null);
                run(row, status, status === 'DECLINED' ? `${nameOf(row)} 님을 참가 불가로 처리했습니다.` : `${nameOf(row)} 님의 신청을 취소했습니다.`);
              }}
            >
              {confirm?.status === 'DECLINED' ? '참가 불가' : '신청 취소'}
            </Button>
          </>
        }
      >
        <p className='type-body-md'>
          {confirm?.status === 'DECLINED'
            ? `${nameOf(confirm.row)} 님의 자리가 반환되고 참가 불가 안내 메일이 발송됩니다.`
            : confirm && `${nameOf(confirm.row)} 님의 신청을 취소하고 자리를 반환합니다. 취소 안내 메일이 발송됩니다.`}
        </p>
      </Modal>
      <RegistrationAnswerDialog
        eventId={eventId}
        registrationId={answerOf?.registrationId ?? null}
        onClose={() => setAnswerOf(null)}
      />
    </section>
  );
}
