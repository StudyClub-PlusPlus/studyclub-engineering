'use client';

import { useState } from 'react';

import { Button, Modal, Select, Tabs, Textarea } from '@studyclub/ui';

import { isUnknownOutcome, useEventMailPreview, useIdempotencyKey, useSendEventMail } from '@/features/events/queries';
import {
  CHANNEL_LABEL,
  EVENT_LIMITS,
  MAIL_AUDIENCE_LABEL,
  type EventDetail,
  type EventMailPreview,
  type MailAudience,
  type MailType,
} from '@/features/events/types';
import { toPreviewDocument } from '@/features/notification-templates/preview-document';
import { ApiError } from '@/lib/http';

const CANCELLATION_DEFAULT =
  '부득이한 사정으로 행사가 취소되었습니다.\n\n기다려 주신 분들께 양해 부탁드리며, 새로운 일정이 정해지면 다시 안내드리겠습니다.';

const BLOCKED_MESSAGE: Partial<Record<NonNullable<EventMailPreview['blockedReason']>, (cancel: boolean) => string>> = {
  TEMPLATE_MISSING: (cancel) => `등록된 ${cancel ? '행사 취소 안내' : '행사 안내'} 템플릿이 없습니다.`,
  NO_RECIPIENTS: (cancel) =>
    cancel
      ? '취소 당시 확인 대기 또는 참가 확정 신청자가 없어 안내 메일을 보낼 대상이 없습니다.'
      : '선택한 대상에 참가 확정자가 없습니다.',
};

export function EventMailComposer({
  detail,
  type,
  onClose,
  onSent,
  onStale,
}: {
  detail: EventDetail;
  type: MailType;
  onClose: () => void;
  onSent: () => void;
  /** 행사 상태가 바뀌어 이 창을 더 쓸 수 없을 때 (취소됨·취소 아님). 상세를 다시 읽는다 */
  onStale: () => void;
}) {
  const cancellation = type === 'CANCELLATION';
  const [audience, setAudience] = useState<MailAudience>(cancellation ? 'CANCELLED_ACTIVE' : 'ALL');
  const [notice, setNotice] = useState(cancellation ? CANCELLATION_DEFAULT : '');
  const [tab, setTab] = useState('write');
  const idempotency = useIdempotencyKey();
  const send = useSendEventMail(detail.eventId);

  // 안내 작성 탭은 안내 내용 없이 받는 사람 수·판정만, 미리보기 탭은 입력한 내용으로 부른다. 타이핑마다 부르지 않는다
  const preview = useEventMailPreview(
    detail.eventId,
    { type, audience, notice: tab === 'preview' ? notice.trim() : '' },
    true,
  );
  const data = preview.data;
  const blocked = data?.blockedReason ?? null;
  // 안내 내용이 비었는지는 작성 탭에서 서버가 모르는 값이다. 그 밖의 이유는 서버 판정을 따른다
  const canSend = Boolean(data) && !preview.isPlaceholderData && (blocked === null || blocked === 'NOTICE_REQUIRED') && notice.trim().length > 0;
  const label = cancellation ? '행사 취소 안내' : '행사 안내';
  const channels = (detail.format === 'HYBRID' ? ['ONLINE', 'OFFLINE'] : [detail.format]) as ('ONLINE' | 'OFFLINE')[];

  function submit() {
    if (!data || !canSend) return;
    const draft = { type, audience, notice: notice.trim(), templateId: data.templateId ?? undefined };
    send.mutate(
      { draft, key: idempotency.current(JSON.stringify(draft)) },
      {
        onSuccess: () => {
          idempotency.clear();
          onSent();
        },
        onError: (error) => {
          if (!isUnknownOutcome(error)) idempotency.clear();
          const code = error instanceof ApiError ? error.code : undefined;
          if (code === 'EVENT_CANCELLED' || code === 'EVENT_NOT_CANCELLED') {
            onStale();
            onClose();
          } else if (code?.startsWith('EVENT_MAIL_')) {
            void preview.refetch();
          }
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={cancellation ? '행사 취소 안내 메일' : '참가자 안내 메일'}
      size='lg'
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            {cancellation ? '나중에 하기' : '취소'}
          </Button>
          <Button variant={cancellation ? 'destructive' : 'primary'} disabled={!canSend || send.isPending} onClick={submit}>
            {send.isPending ? '보내는 중…' : cancellation ? '취소 안내 메일 보내기' : '안내 메일 보내기'}
          </Button>
        </>
      }
    >
      <div className='flex flex-col gap-4'>
        {cancellation ? (
          <div>
            <p className='type-label-sm text-fg-secondary'>받는 사람</p>
            <p className='mt-2 rounded-control border border-border bg-surface-2 px-3 py-2 type-body-sm'>
              취소 직전의 확인 대기·참가 확정 신청자 전체
            </p>
          </div>
        ) : (
          <Select label='받는 사람' value={audience} onChange={(e) => setAudience(e.target.value as MailAudience)}>
            <option value='ALL'>{MAIL_AUDIENCE_LABEL.ALL}</option>
            {channels.map((channel) => (
              <option key={channel} value={channel}>
                {CHANNEL_LABEL[channel]} 참가 확정자
              </option>
            ))}
          </Select>
        )}
        <p className='type-body-sm text-fg-muted'>{data ? `받는 사람 ${data.recipientCount}명` : ' '}</p>
        {data && blocked && BLOCKED_MESSAGE[blocked] && (
          <p role='status' className='type-body-sm text-fg-muted'>
            {BLOCKED_MESSAGE[blocked]!(cancellation)}
          </p>
        )}
        {preview.error && (
          <p role='alert' className='type-body-sm text-danger-fg'>
            {preview.error.message}
          </p>
        )}
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'write', label: '안내 작성' },
            { key: 'preview', label: '미리보기' },
          ]}
        />
        {tab === 'write' ? (
          <Textarea
            label={cancellation ? '취소 사유 및 안내' : '안내 내용'}
            required
            rows={7}
            maxLength={EVENT_LIMITS.notice}
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            placeholder={cancellation ? '행사 취소 사유와 이후 일정을 알려 주세요.' : '참여 방법, 준비물, 변경된 사항을 알려 주세요.'}
          />
        ) : (
          <div role='tabpanel' aria-label='미리보기' className='flex flex-col gap-3'>
            {preview.isFetching && !data && <p className='type-body-sm text-fg-muted'>불러오는 중…</p>}
            {data?.body !== null && data?.body !== undefined ? (
              <>
                <p className='break-words type-label-lg'>{data.subject}</p>
                <iframe
                  title={`${label} 메일 미리보기`}
                  sandbox=''
                  srcDoc={toPreviewDocument(data.body)}
                  className='h-96 w-full rounded-card border border-border bg-bg sm:h-128'
                />
              </>
            ) : (
              data && <p className='type-body-sm text-fg-muted'>{label} 템플릿이 등록되면 메일을 미리 볼 수 있습니다.</p>
            )}
          </div>
        )}
        {send.error && (
          <p role='alert' className='type-body-sm text-danger-fg'>
            {send.error.message}
          </p>
        )}
        {cancellation && <p className='type-body-sm text-fg-muted'>이 창을 닫아도 행사 취소와 신청 취소 상태는 유지됩니다.</p>}
      </div>
    </Modal>
  );
}
