'use client';

import { useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { MEMBER_REGIONS, type MemberRegion } from '@studyclub/mock';
import { Button, Checkbox, Modal, Textarea } from '@studyclub/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { Locale, Study } from '@/lib/content';
import { t } from '@/lib/i18n';
import { addApplication, getRegion } from '@/lib/me';

/**
 * 스터디 신청 폼 — 프로토타입.
 *
 * **스터디마다 폼을 설계하지 않는다.** 운영자가 등록 때 넣은 「진행 일정」 유무로 묻는 것이 갈린다:
 * - 일정 있음 → 그 시간에 참여 가능한지 **확인**만 받는다
 * - 일정 미정 → 참여자끼리 맞춰야 하므로 **가능한 요일·시간대를 받는다**
 *
 * 회원은 여러 지역에 흩어져 있으므로 **가능한 시간은 각자의 현지 시간으로 받는다.**
 * 한국의 일요일 저녁과 북미의 일요일 저녁은 다른 시각이라, 지역 없이 요일·시간대만 모으면
 * 운영자가 겹치는 시간을 구할 수 없다. 저장 시 지역(기준 시간대)을 함께 남긴다.
 *
 * TODO(api): POST /api/studies/{id}/applications — 저장 테이블·API 미구현이라 화면 상태로만 처리.
 * TODO(api): 신청자 지역은 로그인 회원 정보에서 읽는다. 지금은 마이페이지에서 고른 값을 쓴다.
 */

const DAYS = [
  { key: 'mon', ko: '월', en: 'Mon' },
  { key: 'tue', ko: '화', en: 'Tue' },
  { key: 'wed', ko: '수', en: 'Wed' },
  { key: 'thu', ko: '목', en: 'Thu' },
  { key: 'fri', ko: '금', en: 'Fri' },
  { key: 'sat', ko: '토', en: 'Sat' },
  { key: 'sun', ko: '일', en: 'Sun' },
] as const;

const SLOTS = [
  { key: 'morning', ko: '오전', en: 'Morning' },
  { key: 'afternoon', ko: '오후', en: 'Afternoon' },
  { key: 'evening', ko: '저녁', en: 'Evening' },
] as const;

type ApplyFormValues = {
  agreed: boolean;
  cells: string[];
  motivation: string;
};

function makeSchema(hasFixed: boolean, locale: Locale) {
  return z
    .object({
      agreed: z.boolean(),
      cells: z.array(z.string()),
      motivation: z.string(),
    })
    .superRefine((val, ctx) => {
      if (hasFixed && !val.agreed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['agreed'],
          message: t({ ko: '일정 참여 가능 여부를 확인해 주세요.', en: 'Please confirm you can attend.' }, locale),
        });
      }
      if (!hasFixed && val.cells.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cells'],
          message: t({ ko: '가능한 시간을 하나 이상 선택해 주세요.', en: 'Select at least one time slot.' }, locale),
        });
      }
    });
}

export function ApplyDialog({
  study,
  locale,
  open,
  onClose,
}: {
  study: Study;
  locale: Locale;
  open: boolean;
  onClose: () => void;
}) {
  const fixedSchedule = study.schedule ? t(study.schedule, locale) : null;
  const [myRegion, setMyRegion] = useState<MemberRegion>('KR');
  const [done, setDone] = useState(false);

  const schema = useMemo(() => makeSchema(Boolean(fixedSchedule), locale), [fixedSchedule, locale]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
    clearErrors,
  } = useForm<ApplyFormValues>({
    defaultValues: { agreed: false, cells: [], motivation: '' },
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!open) return;
    reset({ agreed: false, cells: [], motivation: '' });
    setDone(false);
    setMyRegion(getRegion());
  }, [open, reset]);

  const cells = watch('cells');
  const agreedValue = watch('agreed');

  function toggleCell(key: string) {
    const next = cells.includes(key) ? cells.filter((x) => x !== key) : [...cells, key];
    setValue('cells', next);
    if (next.length > 0) clearErrors('cells');
  }

  const onSubmit = handleSubmit(async (values) => {
    // TODO(api): POST /api/studies/{id}/applications
    await new Promise((r) => setTimeout(r, 400));
    addApplication({
      studyId: study.id,
      appliedAt: new Date().toISOString().slice(0, 10),
      status: 'pending',
      region: myRegion,
      cells: fixedSchedule ? undefined : values.cells,
      motivation: values.motivation.trim() || undefined,
    });
    setDone(true);
  });

  const region = MEMBER_REGIONS.find((r) => r.key === myRegion)!;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t({ ko: '스터디 신청', en: 'Apply to study' }, locale)}
      footer={
        done ? (
          <Button onClick={onClose}>{t({ ko: '확인', en: 'Done' }, locale)}</Button>
        ) : (
          <>
            <Button variant='secondary' onClick={onClose} disabled={isSubmitting}>
              {t({ ko: '취소', en: 'Cancel' }, locale)}
            </Button>
            <Button onClick={onSubmit} loading={isSubmitting}>
              {t({ ko: '신청', en: 'Apply' }, locale)}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className='py-6 text-center text-sm text-fg-secondary'>
          {t(
            {
              ko: '신청이 접수되었습니다. 승인 결과는 이메일로 안내됩니다.',
              en: "Your application was received. We'll email you the result.",
            },
            locale,
          )}
        </p>
      ) : (
        <div className='flex flex-col gap-5'>
          {/* 어떤 스터디에 신청하는지 — 목록 카드와 같은 어휘(작은 라벨 + 굵은 제목)를 쓴다 */}
          <div className='border-b border-border pb-4'>
            <p className='text-[11px] font-bold uppercase tracking-[0.14em] text-fg-muted'>
              {t({ ko: '신청 대상', en: 'Applying to' }, locale)}
            </p>
            <p className='mt-1.5 text-lg font-bold leading-snug text-fg'>{t(study.title, locale)}</p>
            <p className='mt-1 text-[13px] leading-relaxed text-fg-secondary'>{t(study.summary, locale)}</p>
          </div>

          {fixedSchedule ? (
            <div className='flex flex-col gap-1.5'>
              <Checkbox
                {...register('agreed')}
                checked={agreedValue}
                label={t({ ko: `${fixedSchedule} 참여 가능합니다`, en: `I can attend: ${fixedSchedule}` }, locale)}
              />
              {errors.agreed && <p className='text-xs text-error-700'>{errors.agreed.message}</p>}
            </div>
          ) : (
            <div className='flex flex-col gap-2'>
              <div className='flex items-baseline justify-between gap-2'>
                <p className='text-sm font-medium text-neutral-800'>
                  {t({ ko: '가능한 시간', en: "When you're available" }, locale)}
                  <span className='ml-0.5 text-error-600'>*</span>
                </p>
                <span className='text-xs text-fg-muted'>
                  {t(
                    {
                      ko: `${t(region.label, locale)} 시간(${region.tzLabel}) 기준`,
                      en: `In ${t(region.label, locale)} time (${region.tzLabel})`,
                    },
                    locale,
                  )}
                </span>
              </div>

              {/* 요일 × 시간대 격자 — 칸을 눌러 조합을 고른다 (월 저녁 + 일 오후 같은 응답이 가능) */}
              <div className='overflow-x-auto'>
                <table className='w-full table-fixed border-separate border-spacing-1'>
                  <thead>
                    <tr>
                      <th className='w-9 p-0' />
                      {DAYS.map((d) => (
                        <th key={d.key} className='pb-1 text-center text-xs font-semibold text-fg-secondary'>
                          {locale === 'ko' ? d.ko : d.en}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SLOTS.map((sl) => (
                      <tr key={sl.key}>
                        <th
                          scope='row'
                          className='w-9 whitespace-nowrap pr-1.5 text-right text-xs font-medium text-fg-secondary'
                        >
                          {locale === 'ko' ? sl.ko : sl.en}
                        </th>
                        {DAYS.map((d) => {
                          const key = `${d.key}-${sl.key}`;
                          const on = cells.includes(key);
                          return (
                            <td key={key} className='p-0'>
                              <button
                                type='button'
                                aria-pressed={on}
                                aria-label={`${locale === 'ko' ? d.ko : d.en} ${locale === 'ko' ? sl.ko : sl.en}`}
                                onClick={() => toggleCell(key)}
                                className={`h-9 w-full rounded-sm border transition-colors focus-visible:outline-none focus-visible:shadow-(--ring) ${
                                  on ? 'border-transparent bg-brand' : 'border-border-strong bg-bg hover:bg-surface-2'
                                }`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {errors.cells && <p className='text-xs text-error-700'>{errors.cells.message}</p>}

              <p className='text-xs text-fg-muted'>
                {t(
                  {
                    ko: '일정이 아직 정해지지 않아 신청자들의 응답을 모아 정합니다. 되는 시간을 모두 선택해 주세요. 다른 지역 신청자와는 시차를 반영해 맞춥니다.',
                    en: "The schedule isn't set yet — it's decided from applicants' answers. Select every slot that works; time zones are reconciled across regions.",
                  },
                  locale,
                )}
              </p>
            </div>
          )}

          <Textarea
            {...register('motivation')}
            label={t({ ko: '지원 동기', en: "Why you're applying" }, locale)}
            rows={3}
            placeholder={t(
              {
                ko: '선택 입력입니다. 간단히 적어 주시면 운영진이 참고합니다.',
                en: 'Optional. A short note helps the organizers.',
              },
              locale,
            )}
          />
        </div>
      )}
    </Modal>
  );
}
