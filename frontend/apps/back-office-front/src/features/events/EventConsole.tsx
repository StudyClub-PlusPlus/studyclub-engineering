'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import { Badge, Button, Modal, Tabs } from '@studyclub/ui';
import { ArrowLeft } from 'lucide-react';

import { EventEditor } from '@/features/events/EventEditor';
import { EventMailComposer } from '@/features/events/EventMailComposer';
import { DISPLAY_STATUS_TONE, formatInstant } from '@/features/events/format';
import { MailHistoryTab } from '@/features/events/MailHistoryTab';
import { ParticipantsTab } from '@/features/events/ParticipantsTab';
import { useChangeEventStatus, useUpdateEvent } from '@/features/events/queries';
import {
  CHANNEL_LABEL,
  DISPLAY_STATUS_LABEL,
  type EventDetail,
  type EventPayload,
  type EventStatusTarget,
  type MailType,
} from '@/features/events/types';
import { ApiError } from '@/lib/http';
import { pageOf, useUrlState } from '@/lib/use-url-state';

const TABS = ['attendees', 'info', 'mails'] as const;
const URL_DEFAULTS = { tab: 'attendees', page: '1' };
const URL_ALLOWED = { tab: TABS };

type StatusAction = 'CLOSE' | 'REOPEN' | 'REOPEN_BLOCKED' | 'CANCEL';

const REOPEN_BLOCKED_TEXT = {
  STARTED: '이미 시작한 행사에는 새 신청을 받을 수 없어요.',
  DEADLINE_PASSED:
    '신청 마감 시간이 지났어요. 행사 정보·신청폼에서 신청 마감 시간을 미래로 바꾼 뒤 다시 열어 주세요.',
} as const;

/** 행사 상세: 상태 전환 · 모집 현황 · 참가자 · 행사 정보 · 메일 이력. 버튼은 서버의 `can*` 판정으로만 보인다. */
export function EventConsole({ detail, refetch }: { detail: EventDetail; refetch: () => Promise<unknown> }) {
  const [url, setUrl] = useUrlState(URL_DEFAULTS, URL_ALLOWED);
  const tab = url.tab;
  const page = pageOf(url.page);
  const setPage = useCallback((next: number) => setUrl({ page: String(next) }), [setUrl]);
  const [action, setAction] = useState<StatusAction | null>(null);
  const [compose, setCompose] = useState<MailType | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [formKey, setFormKey] = useState(0);
  const change = useChangeEventStatus(detail.eventId);
  const update = useUpdateEvent(detail.eventId);
  const zone = detail.timeZone;
  const cancelled = detail.status === 'CANCELLED';
  const pendingTotal = detail.seats.reduce((sum, s) => sum + s.pending, 0);

  function goTab(next: string) {
    setUrl({ tab: next, page: '1' }, { reset: true });
  }

  function selectTab(next: string) {
    setNotice('');
    setError('');
    // 지난 저장 실패(버전 충돌 등)가 탭을 돌아왔을 때 다시 보이지 않게 한다
    update.reset();
    goTab(next);
  }

  function runStatus(status: EventStatusTarget, message: string) {
    setError('');
    change.mutate(
      { status, version: detail.version },
      {
        onSuccess: (next) => {
          setAction(null);
          setNotice(message);
          // 취소 직후 안내 대상이 있으면 취소 안내 메일 작성창을 바로 연다
          if (status === 'CANCELLED' && next.hasCancellationRecipients) setCompose('CANCELLATION');
        },
        onError: (e) => {
          setAction(null);
          const code = e instanceof ApiError ? e.code : undefined;
          if (code === 'EVENT_VERSION_CONFLICT')
            setError('다른 캡틴이 먼저 저장했거나 행사 상태가 바뀌었어요. 최신 상태를 불러왔으니 확인한 뒤 다시 시도해 주세요.');
          else if (code === 'EVENT_REOPEN_DEADLINE_PASSED') {
            setError(REOPEN_BLOCKED_TEXT.DEADLINE_PASSED);
            goTab('info');
          } else setError(e.message);
          void refetch();
        },
      },
    );
  }

  function save(payload: EventPayload) {
    setNotice('');
    update.mutate(
      { ...payload, version: detail.version },
      {
        onSuccess: () => {
          setNotice('행사 정보를 저장했습니다. 변경된 일정이나 장소는 안내 메일로 알려 주세요.');
          setFormKey((k) => k + 1);
        },
        onError: (e) => {
          const code = e instanceof ApiError ? e.code : undefined;
          // 취소·종료가 됐으면 조회 전용으로 다시 그린다. 버전 충돌은 입력을 유지하고 다시 불러오기를 안내한다
          if (code === 'EVENT_CANCELLED' || code === 'EVENT_ENDED') void refetch();
        },
      },
    );
  }

  function reload() {
    update.reset();
    void refetch().then(() => setFormKey((k) => k + 1));
  }

  const confirmCopy = {
    CLOSE: {
      title: '모집을 마감할까요?',
      body: '크루는 새로 신청할 수 없어요. 행사는 예정된 행사에 계속 표시되고 기존 신청 내역도 볼 수 있어요.',
      label: '모집 마감',
      message: '모집을 마감했습니다.',
      status: 'CLOSED' as const,
    },
    REOPEN: {
      title: '모집을 다시 열까요?',
      body: '크루는 자리가 남은 참여 방식에 신청 마감 시간까지 다시 신청할 수 있어요.',
      label: '모집 다시 열기',
      message: '모집을 다시 열었습니다.',
      status: 'PUBLISHED' as const,
    },
    CANCEL: {
      title: '행사를 취소할까요?',
      body: detail.hasCancellationRecipients
        ? '크루 화면에서 행사는 지난 행사로 이동하고 행사 취소로 표시돼요. 확인 대기와 참가 확정 신청도 모두 취소되며, 취소 사유를 담은 안내 메일 작성창이 열려요.'
        : '크루 화면에서 행사는 지난 행사로 이동하고 행사 취소로 표시돼요. 새 신청은 받을 수 없어요.',
      label: '행사 취소',
      message: '행사가 취소되었습니다.',
      status: 'CANCELLED' as const,
    },
  };
  const copy = action && action !== 'REOPEN_BLOCKED' ? confirmCopy[action] : null;

  return (
    <>
      <Link href='/events' className='mb-4 inline-flex items-center gap-1 type-label-sm text-fg-muted hover:text-brand'>
        <ArrowLeft size={15} />
        행사 목록
      </Link>
      <header className='mb-6 flex flex-col gap-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge tone={DISPLAY_STATUS_TONE[detail.displayStatus]} dot>
            {DISPLAY_STATUS_LABEL[detail.displayStatus]}
          </Badge>
        </div>
        <h1 className='type-headline-md'>{detail.title}</h1>
        <p className='type-body-sm text-fg-muted'>
          {formatInstant(detail.startsAt, zone)} · 신청 마감 {formatInstant(detail.deadlineAt, zone)}
        </p>
        <div className='flex flex-wrap items-center gap-2'>
          {detail.canClose && (
            <Button variant='secondary' size='sm' onClick={() => setAction('CLOSE')}>
              모집 마감
            </Button>
          )}
          {(detail.canReopen || detail.reopenBlockedReason) && (
            <Button size='sm' onClick={() => setAction(detail.canReopen ? 'REOPEN' : 'REOPEN_BLOCKED')}>
              모집 다시 열기
            </Button>
          )}
          {detail.canCancel && (
            <Button variant='destructive' size='sm' className='sm:ml-auto' onClick={() => setAction('CANCEL')}>
              행사 취소
            </Button>
          )}
        </div>
      </header>

      {error && (
        <p role='alert' className='mb-4 rounded-control bg-danger-bg p-3 type-body-sm text-danger-fg'>
          {error}
        </p>
      )}
      {notice && (
        <p role='status' className='mb-4 type-body-sm text-success-fg'>
          {notice}
        </p>
      )}

      <div className='mb-6 grid gap-3 sm:grid-cols-2'>
        {detail.seats.map((seat) => (
          <section key={seat.channel} className='card p-4'>
            <div className='flex items-center justify-between'>
              <h2 className='type-label-lg'>{CHANNEL_LABEL[seat.channel]}</h2>
              <span className='type-label-lg text-brand'>잔여 {seat.remaining}석</span>
            </div>
            <p className='mt-2 type-body-sm text-fg-muted'>
              확정 {seat.confirmed}명 · 확인 대기 {seat.pending}명 / 정원 {seat.capacity}명
            </p>
          </section>
        ))}
      </div>

      <Tabs
        activeKey={tab}
        onChange={selectTab}
        items={[
          { key: 'attendees', label: '참가자', badge: pendingTotal ? `확인 대기 ${pendingTotal}` : undefined },
          { key: 'info', label: '행사 정보·신청폼' },
          { key: 'mails', label: '메일 이력' },
        ]}
      />
      <div className='mt-6'>
        {tab === 'attendees' && (
          <ParticipantsTab
            detail={detail}
            page={page}
            onPage={setPage}
            onCompose={() => setCompose(cancelled ? 'CANCELLATION' : 'ANNOUNCEMENT')}
            onNotice={(message) => {
              setError('');
              setNotice(message);
            }}
          />
        )}
        {tab === 'info' && (
          <EventEditor
            key={`${detail.version}-${formKey}`}
            detail={detail}
            submitting={update.isPending}
            serverError={update.error}
            onSubmit={save}
            onCancel={() => selectTab('attendees')}
            onReload={reload}
          />
        )}
        {tab === 'mails' && (
          <MailHistoryTab eventId={detail.eventId} page={page} onPage={setPage} />
        )}
      </div>

      <Modal
        open={copy !== null}
        onClose={() => setAction(null)}
        title={copy?.title ?? ''}
        footer={
          <>
            <Button variant='secondary' data-autofocus onClick={() => setAction(null)}>
              돌아가기
            </Button>
            {copy && (
              <Button
                variant={copy.status === 'CANCELLED' ? 'destructive' : 'primary'}
                disabled={change.isPending}
                onClick={() => runStatus(copy.status, copy.message)}
              >
                {copy.label}
              </Button>
            )}
          </>
        }
      >
        <p className='type-body-md'>{copy?.body}</p>
      </Modal>
      <Modal
        open={action === 'REOPEN_BLOCKED'}
        onClose={() => setAction(null)}
        title='모집을 다시 열 수 없어요'
        footer={
          <>
            <Button variant='secondary' onClick={() => setAction(null)}>
              닫기
            </Button>
            {detail.reopenBlockedReason === 'DEADLINE_PASSED' && (
              <Button
                onClick={() => {
                  setAction(null);
                  selectTab('info');
                }}
              >
                행사 정보로 이동
              </Button>
            )}
          </>
        }
      >
        <p className='type-body-md'>{detail.reopenBlockedReason ? REOPEN_BLOCKED_TEXT[detail.reopenBlockedReason] : ''}</p>
      </Modal>

      {compose && (
        <EventMailComposer
          detail={detail}
          type={compose}
          onClose={() => setCompose(null)}
          onStale={() => void refetch()}
          onSent={() => {
            const cancellation = compose === 'CANCELLATION';
            setCompose(null);
            setError('');
            setNotice(cancellation ? '행사 취소 안내 메일을 접수했습니다.' : '안내 메일을 접수했습니다.');
            setUrl({ tab: 'mails', page: '1' }, { reset: true });
          }}
        />
      )}
    </>
  );
}
