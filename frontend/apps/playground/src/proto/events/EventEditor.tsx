'use client';

import { useState } from 'react';

import { TimeZoneField } from '@core/components/TimeZoneField';
import { scheduleZoneTitle } from '@core/lib/schedule-timezone';
import { localDateTime } from '@core/lib/time-zone-preview';
import { useDisplayTimeZone } from '@core/lib/use-display-timezone';
import type { PreviewEvent } from '@studyclub/types';
import { Button, DatePicker, Input, Select, Textarea, TimePicker } from '@studyclub/ui';

import { EventQuestionEditor } from './EventQuestionEditor';
import { EVENT_LIMITS, resolveEventInput, wallTime } from './model';

type DateField = 'startsAt' | 'endsAt' | 'deadlineAt';

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
  const viewerZone = useDisplayTimeZone();
  const [dates, setDates] = useState({
    startsAt: wallTime(event.startsAt, event.timeZone),
    endsAt: wallTime(event.endsAt, event.timeZone),
    deadlineAt: wallTime(event.deadlineAt, event.timeZone),
  });
  const [occurrences, setOccurrences] = useState<Partial<Record<DateField, string>>>({});
  const [error, setError] = useState('');
  const set = <K extends keyof PreviewEvent>(key: K, value: PreviewEvent[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const resolveDate = (field: DateField) =>
    resolveEventInput(dates[field], draft.timeZone, { iso: event[field], timeZone: event.timeZone }, occurrences[field]);
  const resolvedDates = {
    startsAt: resolveDate('startsAt'),
    endsAt: resolveDate('endsAt'),
    deadlineAt: resolveDate('deadlineAt'),
  };

  const dateFields: DateField[] = ['startsAt', 'endsAt', 'deadlineAt'];
  const unresolvedDate = dateFields.some((field) => dates[field] && !resolvedDates[field].iso);
  function changeTimeZone(timeZone: string) {
    if (unresolvedDate) return;
    // 시간대만 바꾸면 입력된 실제 행사 시각을 유지한다.
    setDates({
      startsAt: wallTime(resolvedDates.startsAt.iso ?? '', timeZone),
      endsAt: wallTime(resolvedDates.endsAt.iso ?? '', timeZone),
      deadlineAt: wallTime(resolvedDates.deadlineAt.iso ?? '', timeZone),
    });
    setOccurrences(Object.fromEntries(dateFields.map((field) => [field, resolvedDates[field].iso])));
    set('timeZone', timeZone);
  }

  /** 날짜 · 시각을 따로 고르므로 한쪽만 있어도 남긴다 — 다 고르기 전까지 resolveEventInput 이 오류로 본다. */
  function changeWall(field: DateField, day: string, time: string) {
    setDates({ ...dates, [field]: day || time ? `${day}T${time}` : '' });
    setOccurrences({ ...occurrences, [field]: undefined });
  }

  function renderDate(field: DateField, label: string, required: boolean, helper?: string) {
    const { choices, errors, iso } = resolvedDates[field];
    const ambiguous = choices.length > 1;
    // 기존 일정에는 초 단위가 있을 수 있지만 선택지는 분 단위로 보여준다.
    const chosen = choices.find(({ scheduledAt }) => Math.abs(Date.parse(scheduledAt) - Date.parse(iso ?? '')) < 60_000);
    const [day = '', time = ''] = dates[field].split('T');
    const message = !readOnly && dates[field] && !ambiguous ? errors.time : undefined;
    const hint = readOnly ? undefined : helper;
    return (
      <div className='space-y-2'>
        <fieldset className='flex flex-col gap-1.5'>
          <legend className='mb-1.5 type-label-lg text-ink'>
            {label}
            {required && <span className='ml-0.5 text-danger-fg' aria-hidden='true'>*</span>}
          </legend>
          <div className='grid grid-cols-[minmax(0,1fr)_8rem] gap-2'>
            <DatePicker aria-label={`${label} 날짜`} required={required} value={day} onChange={(value) => changeWall(field, value, time)} />
            <TimePicker aria-label={`${label} 시각`} required={required} value={time} onChange={(value) => changeWall(field, day, value)} />
          </div>
          {(message || hint) && (
            <p className={message ? 'type-label-sm text-danger-fg' : 'type-label-sm text-fg-muted'}>{message ?? hint}</p>
          )}
        </fieldset>
        {iso && viewerZone !== draft.timeZone && (
          <p className='type-label-sm text-fg-muted' aria-live='polite'>
            {scheduleZoneTitle(viewerZone, 'ko', new Date(iso))} 기준 · {localDateTime(new Date(iso), viewerZone)}
          </p>
        )}
        {!readOnly && ambiguous && (
          <Select
            label={`${label} 시각 구분`}
            required
            value={chosen?.scheduledAt ?? ''}
            helper='이날은 같은 시각이 두 번 있어요. 시계 전환 전후 중 하나를 선택해 주세요.'
            onChange={(e) => setOccurrences({ ...occurrences, [field]: e.target.value })}
          >
            <option value='' disabled>시각을 선택해 주세요</option>
            {choices.map((choice) => (
              <option key={choice.scheduledAt} value={choice.scheduledAt}>{choice.label}</option>
            ))}
          </Select>
        )}
      </div>
    );
  }

  function save() {
    const startsAt = resolvedDates.startsAt.iso;
    const endsAt = dates.endsAt ? resolvedDates.endsAt.iso : '';
    const deadlineAt = resolvedDates.deadlineAt.iso;
    if (!startsAt || endsAt === undefined || !deadlineAt) {
      setError('행사 시작·종료·신청 마감 시각을 확인해 주세요.');
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
          {event.status === 'CANCELLED'
            ? '취소된 행사입니다. 등록했던 정보와 신청폼을 조회할 수 있습니다.'
            : '종료된 행사입니다. 등록했던 정보와 신청폼을 조회할 수 있습니다.'}
        </p>
      )}
      <fieldset disabled={readOnly} className='min-w-0 space-y-7 border-0 p-0'>
        <section data-anno='event-manage:2' className='space-y-4'>
          <h2 className='type-title-md'>기본 정보</h2>
          <Input
            label='행사명'
            required
            maxLength={EVENT_LIMITS.title}
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder='함께 만드는 개발자 커뮤니티'
          />
          <Input
            label='한 줄 소개'
            required
            maxLength={EVENT_LIMITS.summary}
            value={draft.summary}
            onChange={(e) => set('summary', e.target.value)}
            placeholder='누구와 어떤 경험을 나누는 행사인가요?'
          />
          <Textarea
            label='모집 상세'
            required
            rows={7}
            maxLength={EVENT_LIMITS.description}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
          />
          <TimeZoneField
            label='기준 시간대' locale='ko' compact prioritizeCountries required={false} annotation={false}
            value={draft.timeZone} disabled={readOnly || unresolvedDate} onChange={changeTimeZone}
            error={!readOnly && unresolvedDate ? '날짜·시각 입력을 완료한 뒤 시간대를 변경해 주세요.' : undefined}
          />
          <div className='grid gap-4 sm:grid-cols-2'>
            {renderDate('startsAt', '행사 시작', true)}
            {renderDate('endsAt', '행사 종료 (선택)', false)}
          </div>
          {renderDate('deadlineAt', '신청 마감', true, '행사 시작 시각까지로 설정해 주세요.')}
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
              maxLength={EVENT_LIMITS.location}
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
              helper={readOnly ? undefined : '참가 확정자에게만 보여요. 아직 정해지지 않았다면 나중에 입력할 수 있습니다.'}
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
                className={`flex items-start gap-3 rounded-control border p-4 ${readOnly || confirmationLocked ? '' : 'cursor-pointer'} ${draft.confirmation === value ? 'border-brand bg-brand-subtle' : 'border-border'}`}
              >
                <input
                  // ui-native: 확정 방식 카드 — 설명 두 줄을 품은 카드 전체가 고르는 곳
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
          <EventQuestionEditor
            questions={draft.questions}
            readOnly={readOnly}
            onChange={(questions) => set('questions', questions)}
          />
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
