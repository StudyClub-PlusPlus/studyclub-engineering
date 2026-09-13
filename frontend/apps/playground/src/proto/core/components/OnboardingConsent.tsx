'use client';


import { BlockView } from '@core/components/LegalDoc';
import type { Locale } from '@core/lib/content';
import { legalDoc, lx } from '@core/lib/legal';
import { Checkbox } from '@studyclub/ui';
import { FileText } from 'lucide-react';

export function OnboardingConsent({
  kind,
  locale,
  checked,
  onChange,
  disabled,
  error,
}: {
  kind: 'terms' | 'privacy';
  locale: Locale;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  error?: string;
}) {
  const ko = locale === 'ko';
  const doc = legalDoc(kind);
  const title =
    kind === 'terms'
      ? ko
        ? '이용약관'
        : 'Terms of Service'
      : ko
        ? '개인정보 수집·이용 안내'
        : 'Personal information collection and use';
  const agree =
    kind === 'terms'
      ? ko
        ? '이용약관에 동의합니다.'
        : 'I agree to the Terms of Service.'
      : ko
        ? '개인정보 수집·이용에 동의합니다.'
        : 'I agree to the collection and use of my personal information.';
  const n = kind === 'terms' ? '4-1' : '4-2';

  return (
    <section data-anno={n}>
      <div className='mb-2 flex items-center gap-1.5 text-sm font-medium text-neutral-800'>
        <FileText size={14} className='shrink-0 text-fg-muted' aria-hidden='true' />
        <h3 id={`${kind}-title`}>{title}</h3>
      </div>
      <div
        role='region'
        aria-labelledby={`${kind}-title`}
        tabIndex={0}
        lang='ko'
        className='h-36 overflow-auto overscroll-contain rounded-control border border-border bg-surface-1 px-4 py-3 outline-none focus-visible:shadow-(--ring) [&_p]:text-xs [&_p]:leading-relaxed [&_ul]:text-xs [&_ol]:text-xs [&_table]:text-xs'
      >
        <div className='space-y-2'>
          {doc.intro?.map((block, index) => (
            <BlockView key={index} block={block} locale={locale} />
          ))}
        </div>
        {doc.sections.map((section) => (
          <div key={section.id} className='mt-4 space-y-2'>
            <h4 className='text-xs font-semibold text-fg'>{lx(section.heading, locale)}</h4>
            {section.blocks?.map((block, index) => (
              <BlockView key={index} block={block} locale={locale} />
            ))}
          </div>
        ))}
      </div>
      <div className='mt-2.5 flex items-start gap-2'>
        <span className={`mt-0.5 shrink-0 text-xs font-semibold text-brand ${ko ? 'w-8' : 'w-16'}`}>
          {ko ? '[필수]' : '[Required]'}
        </span>
        <Checkbox
          id={`${kind}-agreed`}
          checked={checked}
          disabled={disabled}
          label={agree}
          onChange={(event) => onChange(event.target.checked)}
          aria-required='true'
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${kind}-error` : undefined}
          className='items-start [&_input]:mt-0.5 [&_span]:break-keep [&_span]:leading-snug'
        />
      </div>
      {error && (
        <p id={`${kind}-error`} className='mt-1.5 text-xs text-error-700'>
          {error}
        </p>
      )}
    </section>
  );
}
