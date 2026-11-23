'use client';

import { useState } from 'react';

import { Button, Input, Radio, Select, Textarea } from '@studyclub/ui';

import {
  emptyEventForm,
  fieldOfServerError,
  formFromDetail,
  resolveDates,
  toPayload,
  validateEventForm,
  type DateField,
  type EventFormErrors,
  type EventFormValues,
} from '@/features/events/form-schema';
import { QuestionEditor } from '@/features/events/QuestionEditor';
import {
  EVENT_LIMITS,
  EVENT_ZONES,
  type EventDetail,
  type EventFormat,
  type EventPayload,
} from '@/features/events/types';
import { ApiError } from '@/lib/http';

/**
 * 행사 입력 폼 — 등록 팝업과 「행사 정보」 탭이 같이 쓴다.
 *
 * 수정할 수 있는지(`canEdit`) · 확정 방식을 바꿀 수 있는지(`canChangeConfirmation`) 는 서버가 내려준 값을 그린다.
 * 종료·취소 행사는 `canEdit=false` 라 전부 조회 전용이다.
 */
export function EventEditor({
  detail,
  submitting,
  serverError,
  onSubmit,
  onCancel,
  onReload,
}: {
  /** 있으면 수정, 없으면 등록 */
  detail?: EventDetail;
  submitting: boolean;
  serverError?: Error | null;
  onSubmit: (payload: EventPayload) => void;
  onCancel?: () => void;
  /** 다른 캡틴이 먼저 저장해 409 일 때, 최신 정보를 다시 불러와 폼을 새로 채운다 */
  onReload?: () => void;
}) {
  const [values, setValues] = useState<EventFormValues>(() => (detail ? formFromDetail(detail) : emptyEventForm()));
  const [picked, setPicked] = useState<Partial<Record<DateField, string>>>({});
  const [errors, setErrors] = useState<EventFormErrors>({});
  const readOnly = Boolean(detail) && !detail!.canEdit;
  const confirmationLocked = Boolean(detail) && !detail!.canChangeConfirmation;
  const dates = resolveDates(values, picked, detail);
  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  let server: { field: string | null; message: string; code?: string } | null = null;
  if (serverError) {
    const code = serverError instanceof ApiError ? serverError.code : undefined;
    server = { field: fieldOfServerError(code, serverError.message), message: serverError.message, code };
  }
  const errorOf = (key: string, ...also: string[]) =>
    errors[key] ?? (server?.field && [key, ...also].includes(server.field) ? server.message : undefined);

  function submit() {
    const found = validateEventForm(values, dates, { now: Date.now(), saved: detail });
    if (detail) {
      // 신청이 남은 참여 방식을 없애거나 정원을 줄이는 변경은 서버가 막는다. 값은 서버가 내려준 모집 현황이다
      const kept = new Set(values.format === 'HYBRID' ? ['ONLINE', 'OFFLINE'] : [values.format]);
      const blocked = detail.seats.some((s) => !kept.has(s.channel) && s.pending + s.confirmed > 0);
      if (blocked) found.format = '확인 대기·참가 확정 신청자가 있는 참여 방식은 없앨 수 없어요. 기존 신청을 먼저 정리해 주세요.';
      for (const seat of detail.seats) {
        const raw = seat.channel === 'ONLINE' ? values.onlineCapacity : values.offlineCapacity;
        const key = seat.channel === 'ONLINE' ? 'onlineCapacity' : 'offlineCapacity';
        if (kept.has(seat.channel) && !found[key] && Number(raw) < seat.pending + seat.confirmed)
          found[key] = `확인 대기와 참가 확정 합(${seat.pending + seat.confirmed}명)보다 정원을 줄일 수 없어요.`;
      }
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(toPayload(values, dates));
  }

  function dateField(field: DateField, label: string, required: boolean, helper?: string) {
    const { choices, error } = dates[field];
    const ambiguous = choices.length > 1;
    const chosen = choices.find((c) => c.iso === dates[field].iso)?.iso ?? '';
    return (
      <div className='flex flex-col gap-2'>
        <Input
          label={label}
          type='datetime-local'
          required={required}
          value={values[field]}
          error={errorOf(field) ?? (values[field] && !ambiguous && !readOnly ? error : undefined)}
          helper={readOnly ? undefined : helper}
          onChange={(e) => {
            set(field, e.target.value);
            setPicked((current) => ({ ...current, [field]: undefined }));
          }}
        />
        {!readOnly && ambiguous && (
          <Select
            label={`${label} 시각 구분`}
            required
            value={chosen}
            helper='이날은 같은 시각이 두 번 있어요. 시계 전환 전후 중 하나를 선택해 주세요.'
            onChange={(e) => setPicked((current) => ({ ...current, [field]: e.target.value }))}
          >
            <option value='' disabled>
              시각을 선택해 주세요
            </option>
            {choices.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.label}
              </option>
            ))}
          </Select>
        )}
      </div>
    );
  }

  const pendingTotal = detail?.seats.reduce((sum, s) => sum + s.pending, 0) ?? 0;
  const confirmationDetail: Record<'AUTO' | 'REVIEW', string> = {
    AUTO:
      detail && detail.confirmation === 'REVIEW' && values.confirmation === 'AUTO'
        ? `신청 즉시 확정으로 바꾸면 현재 확인 대기 ${pendingTotal}건이 저장과 동시에 참가 확정됩니다.`
        : '신청 즉시 참가가 확정됩니다.',
    REVIEW: '신청 내용을 확인한 뒤 운영진이 참가를 확정합니다.',
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!readOnly && !submitting) submit();
      }}
      className='flex flex-col gap-4'
    >
      {readOnly && (
        <p className='rounded-control bg-surface-2 p-3 type-body-sm text-fg-secondary'>
          {detail!.status === 'CANCELLED'
            ? '취소된 행사입니다. 등록했던 정보와 신청폼을 조회할 수 있습니다.'
            : '종료된 행사입니다. 등록했던 정보와 신청폼을 조회할 수 있습니다.'}
        </p>
      )}
      <fieldset disabled={readOnly} className='flex min-w-0 flex-col gap-7 border-0 p-0'>
        <section className='flex flex-col gap-4' aria-labelledby='event-basic-title'>
          <h2 id='event-basic-title' className='type-title-md'>
            기본 정보
          </h2>
          <Input
            label='행사명'
            required
            maxLength={EVENT_LIMITS.title}
            value={values.title}
            error={errorOf('title')}
            onChange={(e) => set('title', e.target.value)}
            placeholder='함께 만드는 개발자 커뮤니티'
          />
          <Input
            label='한 줄 소개'
            required
            maxLength={EVENT_LIMITS.summary}
            value={values.summary}
            error={errorOf('summary')}
            onChange={(e) => set('summary', e.target.value)}
            placeholder='누구와 어떤 경험을 나누는 행사인가요?'
          />
          <Textarea
            label='모집 상세'
            required
            rows={7}
            maxLength={EVENT_LIMITS.description}
            value={values.description}
            error={errorOf('description')}
            onChange={(e) => set('description', e.target.value)}
          />
          <Select
            label='기준 시간대'
            value={values.timeZone}
            error={errorOf('timeZone')}
            onChange={(e) => {
              set('timeZone', e.target.value);
              setPicked({});
            }}
          >
            {EVENT_ZONES.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </Select>
          <div className='grid gap-4 sm:grid-cols-2'>
            {dateField(
              'startsAt',
              '행사 시작',
              true,
              detail && !detail.canSetFutureStart && !readOnly ? '이미 시작한 행사는 시작 시각을 미래로 옮길 수 없어요.' : undefined,
            )}
            {dateField('endsAt', '행사 종료 (선택)', false)}
          </div>
          {dateField('deadlineAt', '신청 마감', true, '행사 시작 시각까지로 설정해 주세요.')}
        </section>

        <section className='flex flex-col gap-4 border-t border-border pt-6' aria-labelledby='event-recruit-title'>
          <h2 id='event-recruit-title' className='type-title-md'>
            모집 설정
          </h2>
          <Select
            label='참여 방식'
            value={values.format}
            error={errorOf('format')}
            onChange={(e) => set('format', e.target.value as EventFormat)}
          >
            <option value='ONLINE'>온라인</option>
            <option value='OFFLINE'>오프라인</option>
            <option value='HYBRID'>온라인·오프라인 동시 진행</option>
          </Select>
          <div className='grid gap-4 sm:grid-cols-2'>
            {values.format !== 'OFFLINE' && (
              <Input
                label='온라인 정원'
                type='number'
                min={EVENT_LIMITS.minCapacity}
                max={EVENT_LIMITS.maxCapacity}
                required
                suffix='명'
                value={values.onlineCapacity}
                error={errorOf('onlineCapacity', 'capacity')}
                onChange={(e) => set('onlineCapacity', e.target.value)}
              />
            )}
            {values.format !== 'ONLINE' && (
              <Input
                label='오프라인 정원'
                type='number'
                min={EVENT_LIMITS.minCapacity}
                max={EVENT_LIMITS.maxCapacity}
                required
                suffix='명'
                value={values.offlineCapacity}
                error={errorOf('offlineCapacity', 'capacity')}
                onChange={(e) => set('offlineCapacity', e.target.value)}
              />
            )}
          </div>
          {values.format !== 'ONLINE' && (
            <Input
              label='오프라인 장소'
              required
              maxLength={EVENT_LIMITS.location}
              value={values.location}
              error={errorOf('location')}
              onChange={(e) => set('location', e.target.value)}
              placeholder='장소명과 주소'
            />
          )}
          {values.format !== 'OFFLINE' && (
            <Input
              label='온라인 참여 링크'
              type='url'
              value={values.onlineUrl}
              error={errorOf('onlineUrl')}
              onChange={(e) => set('onlineUrl', e.target.value)}
              placeholder='https://'
              helper={readOnly ? undefined : '참가 확정자에게만 보여요. 아직 정해지지 않았다면 나중에 입력할 수 있습니다.'}
            />
          )}
          <fieldset className='flex flex-col gap-3' disabled={confirmationLocked}>
            <legend className='mb-1 type-label-lg'>참가 확정 방식</legend>
            {confirmationLocked && !readOnly && (
              <p className='rounded-control bg-warning-bg p-3 type-body-sm text-warning-fg'>
                행사 시작 후에는 참가 확정 방식을 변경할 수 없습니다.
              </p>
            )}
            <Radio
              name='confirmation'
              label='신청 즉시 확정'
              description={confirmationDetail.AUTO}
              checked={values.confirmation === 'AUTO'}
              onChange={() => set('confirmation', 'AUTO')}
            />
            <Radio
              name='confirmation'
              label='운영진 확인 후 확정'
              description={confirmationDetail.REVIEW}
              checked={values.confirmation === 'REVIEW'}
              onChange={() => set('confirmation', 'REVIEW')}
            />
            {errorOf('confirmation') && (
              <p role='alert' className='type-body-sm text-danger-fg'>
                {errorOf('confirmation')}
              </p>
            )}
          </fieldset>
        </section>

        <div className='border-t border-border pt-6'>
          <QuestionEditor
            questions={values.questions}
            readOnly={readOnly}
            errors={errors}
            onChange={(questions) => set('questions', questions)}
          />
        </div>
      </fieldset>

      {!readOnly && (
        <div className='border-t border-border pt-5'>
          {server && (
            <div role='alert' className='mb-3 flex flex-col gap-2 rounded-control bg-danger-bg p-3 type-body-sm text-danger-fg'>
              <p>
                {server.code === 'EVENT_VERSION_CONFLICT'
                  ? '다른 캡틴이 먼저 저장했거나 행사 상태가 바뀌었어요. 작성한 내용은 그대로 두었어요. 최신 정보를 불러와 다시 확인해 주세요.'
                  : server.message}
              </p>
              {server.code === 'EVENT_VERSION_CONFLICT' && onReload && (
                <Button type='button' size='sm' variant='secondary' className='self-start' onClick={onReload}>
                  최신 정보 다시 불러오기
                </Button>
              )}
            </div>
          )}
          {Object.keys(errors).length > 0 && (
            <p role='alert' className='mb-3 type-body-sm text-danger-fg'>
              입력 내용을 확인해 주세요.
            </p>
          )}
          <div className='flex justify-end gap-2'>
            {onCancel && (
              <Button type='button' variant='secondary' onClick={onCancel}>
                취소
              </Button>
            )}
            <Button type='submit' disabled={submitting}>
              {submitting ? '저장 중…' : '저장'}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
