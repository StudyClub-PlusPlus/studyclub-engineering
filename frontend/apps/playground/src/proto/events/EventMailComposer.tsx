'use client';

import { useState } from 'react';

import { useDisplayTimeZone } from '@core/lib/use-display-timezone';
import type { EventChannel, PreviewEvent } from '@studyclub/types';
import { Button, Modal, Select, Tabs, Textarea } from '@studyclub/ui';

import { useEventWorkspace } from './EventWorkspace';
import { CHANNEL_LABEL, cancellationEventTemplate, channels, renderEventNoticePreview } from './model';
import { toPreviewDocument } from '@/proto/mail/render';

export function EventMailComposer({
  event,
  mode = 'NOTICE',
  onClose,
  onSent,
}: {
  event: PreviewEvent;
  mode?: 'NOTICE' | 'CANCELLATION';
  onClose: () => void;
  onSent: () => void;
}) {
  const { state, dispatch } = useEventWorkspace();
  const displayTimeZone = useDisplayTimeZone();
  const isCancellation = mode === 'CANCELLATION';
  const recipientIds = event.cancellationRecipientIds ?? [];
  const [channel, setChannel] = useState<EventChannel | 'ALL'>('ALL');
  const [notice, setNotice] = useState(
    isCancellation
      ? '부득이한 사정으로 행사가 취소되었습니다.\n\n기다려 주신 분들께 양해 부탁드리며, 새로운 일정이 정해지면 다시 안내드리겠습니다.'
      : '',
  );
  const [tab, setTab] = useState('write');
  const [error, setError] = useState('');
  const template = state?.eventTemplates[0];
  const mailTemplate = isCancellation && template ? cancellationEventTemplate(template) : template;
  const recipients =
    state?.registrations.filter((r) =>
      isCancellation
        ? r.eventId === event.id && recipientIds.includes(r.id)
        : r.eventId === event.id && r.status === 'CONFIRMED' && (channel === 'ALL' || r.channel === channel),
    ) ?? [];
  const rendered = mailTemplate ? renderEventNoticePreview(mailTemplate, event, channel, notice, displayTimeZone) : null;
  return (
    <Modal
      open
      onClose={onClose}
      title={isCancellation ? '행사 취소 안내 메일' : '참가자 안내 메일'}
      size='lg'
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            {isCancellation ? '나중에 하기' : '취소'}
          </Button>
          <Button
            variant={isCancellation ? 'destructive' : 'primary'}
            disabled={!template || !recipients.length || !notice.trim()}
            onClick={() => {
              if (!template) return;
              const failure = dispatch(
                isCancellation
                  ? {
                      type: 'CANCELLATION_MAIL',
                      eventId: event.id,
                      templateId: template.id,
                      notice,
                      displayTimeZone,
                    }
                  : { type: 'MAIL', eventId: event.id, channel, templateId: template.id, notice, displayTimeZone },
              );
              setError(failure ?? '');
              if (!failure) onSent();
            }}
          >
            {isCancellation ? '취소 안내 메일 보내기' : '안내 메일 보내기'}
          </Button>
        </>
      }
    >
      <div data-anno='event-manage:7-1' className='space-y-4'>
        {isCancellation ? (
          <div>
            <p className='type-label-sm text-fg-secondary'>받는 사람</p>
            <p className='mt-2 rounded-control border border-border bg-surface-2 px-3 py-2 type-body-sm'>
              취소 직전의 확인 대기·참가 확정 신청자 전체
            </p>
          </div>
        ) : (
          <div>
            <Select
              label='받는 사람'
              value={channel}
              onChange={(e) => setChannel(e.target.value as EventChannel | 'ALL')}
            >
              <option value='ALL'>참가 확정자 전체</option>
              {channels(event).map((mode) => (
                <option key={mode} value={mode}>
                  {CHANNEL_LABEL[mode]} 참가 확정자
                </option>
              ))}
            </Select>
          </div>
        )}
        <p className='type-body-sm text-fg-muted'>받는 사람 {recipients.length}명</p>
        {isCancellation && !recipients.length && (
          <p role='status' className='type-body-sm text-fg-muted'>
            {event.cancellationRecipientIds === undefined
              ? '취소 당시 수신 대상 기록이 없어 안내 메일을 보낼 수 없습니다.'
              : '취소 당시 확인 대기 또는 참가 확정 신청자가 없어 안내 메일을 보낼 대상이 없습니다.'}
          </p>
        )}
        {!template && (
          <p role='status' className='type-body-sm text-fg-muted'>
            등록된 행사 안내 템플릿이 없습니다.
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
            label={isCancellation ? '취소 사유 및 안내' : '안내 내용'}
            required
            rows={7}
            maxLength={5000}
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            placeholder={isCancellation ? '행사 취소 사유와 이후 일정을 알려 주세요.' : '참여 방법, 준비물, 변경된 사항을 알려 주세요.'}
          />
        ) : (
          <div role='tabpanel' aria-label='미리보기' className='space-y-3'>
            {rendered ? (
              <>
                <p className='break-words type-label-lg'>{rendered.subject}</p>
                <iframe
                  title={isCancellation ? '행사 취소 안내 메일 미리보기' : '행사 안내 메일 미리보기'}
                  sandbox=''
                  srcDoc={toPreviewDocument(rendered.body, rendered.format)}
                  className='h-96 w-full rounded-card border border-border bg-surface-1 sm:h-[32rem]'
                />
              </>
            ) : (
              <p className='type-body-sm text-fg-muted'>행사 안내 템플릿이 등록되면 메일을 미리 볼 수 있습니다.</p>
            )}
          </div>
        )}
        {error && (
          <p role='alert' className='type-body-sm text-danger-fg'>
            {error}
          </p>
        )}
        {isCancellation && (
          <p className='type-body-sm text-fg-muted'>이 창을 닫아도 행사 취소와 신청 취소 상태는 유지됩니다.</p>
        )}
      </div>
    </Modal>
  );
}
