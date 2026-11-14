'use client';

import { useState } from 'react';

import type { PreviewEvent } from '@studyclub/types';
import { Button, Input, Select, Textarea } from '@studyclub/ui';

import { EventQuestionEditor } from './EventQuestionEditor';
import { ZONES, wallTime, wallTimeToIso } from './model';

export function EventEditor({
  event,
  confirmationLocked,
  readOnly = false,
  onSave,
  onCancel,
}: {
  event: PreviewEvent;
  confirmationLocked?: boolean;
  readOnly?: boolean;
  onSave: (event: PreviewEvent) => string | null;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(event);
  const [dates, setDates] = useState({
    startsAt: wallTime(event.startsAt, event.timeZone),
    endsAt: wallTime(event.endsAt, event.timeZone),
    deadlineAt: wallTime(event.deadlineAt, event.timeZone),
  });
  const [error, setError] = useState('');
  const set = <K extends keyof PreviewEvent>(key: K, value: PreviewEvent[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  function save() {
    const startsAt = wallTimeToIso(dates.startsAt, draft.timeZone),
      endsAt = dates.endsAt ? wallTimeToIso(dates.endsAt, draft.timeZone) : '',
      deadlineAt = wallTimeToIso(dates.deadlineAt, draft.timeZone);
    if (!startsAt || endsAt === null || !deadlineAt) {
      setError('일정을 확인해 주세요. 서머타임 전환으로 없거나 중복되는 시각은 다른 시각을 선택해 주세요.');
      return;
    }
    setError(
      onSave({ ...draft, title: draft.title.trim(), summary: draft.summary.trim(), startsAt, endsAt, deadlineAt }) ??
        '',
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!readOnly) save();
      }}
      className='space-y-4'
    >
      {readOnly && (
        <p className='rounded-control bg-surface-2 p-3 type-body-sm text-fg-secondary'>
          취소된 행사입니다. 등록했던 정보와 신청폼을 조회할 수 있습니다.
        </p>
      )}
      <fieldset disabled={readOnly} className='min-w-0 space-y-7 border-0 p-0'>
        <section data-anno='event-manage:2' className='space-y-4'>
          <h2 className='type-title-md'>기본 정보</h2>
          <Input
            label='행사명'
            required
            maxLength={60}
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder='함께 만드는 개발자 커뮤니티'
          />
          <Input
            label='한 줄 소개'
            required
            maxLength={160}
            value={draft.summary}
            onChange={(e) => set('summary', e.target.value)}
            placeholder='누구와 어떤 경험을 나누는 행사인가요?'
          />
          <Textarea
            label='모집 상세'
            required
            rows={7}
            maxLength={10000}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
          />
          <Select label='기준 시간대' value={draft.timeZone} onChange={(e) => set('timeZone', e.target.value)}>
            {ZONES.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </Select>
          <div className='grid gap-4 sm:grid-cols-2'>
            <Input
              label='행사 시작'
              type='datetime-local'
              required
              value={dates.startsAt}
              onChange={(e) => setDates({ ...dates, startsAt: e.target.value })}
            />
            <Input
              label='행사 종료 (선택)'
              type='datetime-local'
              value={dates.endsAt}
              onChange={(e) => setDates({ ...dates, endsAt: e.target.value })}
            />
          </div>
          <Input
            label='신청 마감'
            type='datetime-local'
            required
            value={dates.deadlineAt}
            onChange={(e) => setDates({ ...dates, deadlineAt: e.target.value })}
            helper='행사 시작 시각까지로 설정해 주세요.'
          />
        </section>
        <section data-anno='event-manage:3' className='space-y-4 border-t border-border pt-6'>
          <h2 className='type-title-md'>모집 설정</h2>
          {!readOnly && confirmationLocked && (
            <p className='rounded-control bg-warning-bg p-3 type-body-sm text-warning-fg'>
              행사 시작 후에는 참가 확정 방식을 변경할 수 없습니다.
            </p>
          )}
          <Select
            label='참여 방식'
            value={draft.format}
            onChange={(e) => set('format', e.target.value as PreviewEvent['format'])}
          >
            <option value='ONLINE'>온라인</option>
            <option value='OFFLINE'>오프라인</option>
            <option value='HYBRID'>온라인·오프라인 동시 진행</option>
          </Select>
          <div className='grid gap-4 sm:grid-cols-2'>
            {draft.format !== 'OFFLINE' && (
              <Input
                label='온라인 정원'
                type='number'
                min={1}
                max={10000}
                required
                suffix='명'
                value={draft.onlineCapacity}
                onChange={(e) => set('onlineCapacity', Number(e.target.value))}
              />
            )}
            {draft.format !== 'ONLINE' && (
              <Input
                label='오프라인 정원'
                type='number'
                min={1}
                max={10000}
                required
                suffix='명'
                value={draft.offlineCapacity}
                onChange={(e) => set('offlineCapacity', Number(e.target.value))}
              />
            )}
          </div>
          {draft.format !== 'ONLINE' && (
            <Input
              label='오프라인 장소'
              required
              value={draft.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder='장소명과 주소'
            />
          )}
          {draft.format !== 'OFFLINE' && (
            <Input
              label='온라인 참여 링크'
              type='url'
              value={draft.onlineUrl}
              onChange={(e) => set('onlineUrl', e.target.value)}
              placeholder='https://'
              helper='참가 확정자에게만 보여요. 아직 정해지지 않았다면 나중에 입력할 수 있습니다.'
            />
          )}
          <fieldset className='space-y-2'>
            <legend className='mb-2 type-label-lg'>참가 확정 방식</legend>
            {(
              [
                [
                  'AUTO',
                  '신청 즉시 확정',
                  event.confirmation !== 'AUTO' && draft.confirmation === 'AUTO'
                    ? '신청 즉시 확정으로 바꾸면 현재 확인 대기 신청도 저장과 동시에 참가 확정됩니다.'
                    : '신청 즉시 참가가 확정됩니다.',
                ],
                ['REVIEW', '운영진 확인 후 확정', '신청 내용을 확인한 뒤 운영진이 참가를 확정합니다.'],
              ] as const
            ).map(([value, label, detail]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-control border p-4 ${draft.confirmation === value ? 'border-brand bg-brand-subtle' : 'border-border'}`}
              >
                <input
                  className='mt-1 accent-(--color-brand)'
                  type='radio'
                  name='confirmation'
                  value={value}
                  disabled={confirmationLocked}
                  checked={draft.confirmation === value}
                  onChange={() => set('confirmation', value)}
                />
                <span>
                  <span className='block type-label-lg'>{label}</span>
                  <span className='mt-1 block type-body-sm text-fg-muted'>{detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </section>
        <div className='border-t border-border pt-6'>
          <EventQuestionEditor questions={draft.questions} onChange={(questions) => set('questions', questions)} />
        </div>
        {!readOnly && (
          <div className='border-t border-border pt-5'>
            {error && (
              <p id='event-editor-error' role='alert' className='mb-3 type-body-sm text-danger-fg'>
                {error}
              </p>
            )}
            <div className='flex justify-end gap-2'>
              <Button type='button' variant='secondary' onClick={onCancel}>
                취소
              </Button>
              <Button type='submit' aria-describedby={error ? 'event-editor-error' : undefined}>
                저장
              </Button>
            </div>
          </div>
        )}
      </fieldset>
    </form>
  );
}
