'use client';

import { useState } from 'react';

import { BlockView } from '@/components/LegalDoc';
import type { Locale } from '@/lib/content';
import { legalDoc, lx } from '@/lib/legal';
import { Button, Checkbox, Modal } from '@studyclub/ui';
import { ChevronRight } from 'lucide-react';

type ConsentKey = 'age' | 'terms' | 'privacy' | 'marketing';

type Item = {
  key: ConsentKey;
  required: boolean;
  ko: string;
  en: string;
  doc?: 'terms' | 'privacy';
  koNote?: string;
  enNote?: string;
};

const ITEMS: Item[] = [
  { key: 'age', required: true, ko: '만 14세 이상입니다', en: 'I am 14 or older' },
  { key: 'terms', required: true, ko: '이용약관 동의', en: 'Terms of Service', doc: 'terms' },
  {
    key: 'privacy',
    required: true,
    ko: '개인정보 수집·이용 동의',
    en: 'Collection and use of personal information',
    doc: 'privacy',
  },
  {
    key: 'marketing',
    required: false,
    ko: '마케팅 정보 수신 동의',
    en: 'Marketing messages',
    koNote: '스터디 소식과 행사 안내를 이메일로 보내드려요',
    enNote: 'Study news and event updates by email',
  },
];

export function OnboardingConsent({
  locale,
  values,
  onChange,
  disabled,
  error,
}: {
  locale: Locale;
  values: Record<ConsentKey, boolean>;
  onChange: (key: ConsentKey, value: boolean) => void;
  disabled?: boolean;
  error?: string;
}) {
  const ko = locale === 'ko';
  const [reading, setReading] = useState<Item['doc'] | null>(null);
  const all = ITEMS.every((item) => values[item.key]);

  function setAll(next: boolean) {
    for (const item of ITEMS) onChange(item.key, next);
  }

  return (
    <section>
      <label className='flex cursor-pointer items-center gap-3 rounded-card border border-border-strong px-4 py-3.5 transition hover:border-brand has-[:checked]:border-brand has-[:checked]:bg-brand-subtle'>
        <Checkbox
          id='consent-all'
          checked={all}
          disabled={disabled}
          onChange={(event) => setAll(event.target.checked)}
          label=''
          className='[&_span]:hidden'
          aria-label={ko ? '전체 동의' : 'Agree to all'}
        />
        <span className='text-[15px] font-bold text-fg'>
          {ko ? '전체 동의' : 'Agree to all'}
          <span className='ml-1.5 text-xs font-normal text-fg-muted'>
            {ko ? '(선택 항목 포함)' : '(includes optional)'}
          </span>
        </span>
      </label>

      <div className='mt-1 divide-y divide-border'>
        {ITEMS.map((item) => (
          <div key={item.key} className='flex items-start gap-3 py-3 pl-[17px] pr-[9px]'>
            <Checkbox
              id={`consent-${item.key}`}
              checked={values[item.key]}
              disabled={disabled}
              onChange={(event) => onChange(item.key, event.target.checked)}
              aria-required={item.required}
              aria-invalid={item.required && Boolean(error) && !values[item.key]}
              label=''
              className='mt-0.5 [&_span]:hidden'
              aria-label={ko ? item.ko : item.en}
            />
            <div className='min-w-0 flex-1'>
              <label htmlFor={`consent-${item.key}`} className='block cursor-pointer break-keep text-sm leading-snug'>
                <span className={`mr-1.5 font-semibold ${item.required ? 'text-brand' : 'text-fg-muted'}`}>
                  {item.required ? (ko ? '[필수]' : '[Required]') : ko ? '[선택]' : '[Optional]'}
                </span>
                {ko ? item.ko : item.en}
              </label>
              {(ko ? item.koNote : item.enNote) && (
                <p className='mt-1 break-keep text-xs leading-snug text-fg-muted'>
                  {ko ? item.koNote : item.enNote}
                </p>
              )}
            </div>
            {item.doc && (
              <button
                type='button'
                onClick={() => setReading(item.doc)}
                className='-mr-1 flex shrink-0 items-center gap-0.5 rounded-control px-2 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-1 hover:text-fg'
              >
                {ko ? '보기' : 'Read'}
                <ChevronRight size={13} aria-hidden='true' />
              </button>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p id='consent-error' role='alert' className='mt-2 text-xs text-error-700'>
          {error}
        </p>
      )}

      <Modal
        open={reading !== null}
        onClose={() => setReading(null)}
        size='lg'
        title={docTitle(reading, ko)}
        footer={
          <>
            <Button variant='secondary' onClick={() => setReading(null)}>
              {ko ? '닫기' : 'Close'}
            </Button>
            <Button
              onClick={() => {
                if (reading) onChange(reading, true);
                setReading(null);
              }}
            >
              {ko ? '동의하고 닫기' : 'Agree and close'}
            </Button>
          </>
        }
      >
        {reading && <LegalBody kind={reading} locale={locale} />}
      </Modal>
    </section>
  );
}

function docTitle(doc: Item['doc'] | null, ko: boolean): string {
  if (doc === 'privacy') return ko ? '개인정보 수집·이용' : 'Personal information';
  return ko ? '이용약관' : 'Terms of Service';
}

function LegalBody({ kind, locale }: { kind: 'terms' | 'privacy'; locale: Locale }) {
  const doc = legalDoc(kind);
  return (
    <div
      lang='ko'
      className='max-h-[60vh] overflow-auto overscroll-contain pr-1 [&_li]:text-sm [&_p]:text-sm [&_p]:leading-relaxed'
    >
      <div className='space-y-2'>
        {doc.intro?.map((block, index) => <BlockView key={index} block={block} locale={locale} />)}
      </div>
      {doc.sections.map((section) => (
        <div key={section.id} className='mt-5 space-y-2'>
          <h4 className='text-sm font-semibold text-fg'>{lx(section.heading, locale)}</h4>
          {section.blocks?.map((block, index) => (
            <BlockView key={index} block={block} locale={locale} />
          ))}
        </div>
      ))}
    </div>
  );
}
