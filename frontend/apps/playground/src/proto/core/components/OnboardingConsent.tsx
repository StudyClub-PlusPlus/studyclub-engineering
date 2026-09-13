'use client';

import { useState } from 'react';

import { BlockView } from '@core/components/LegalDoc';
import type { Locale } from '@core/lib/content';
import { legalDoc, lx } from '@core/lib/legal';
import { Button, Checkbox, Modal } from '@studyclub/ui';
import { ChevronRight } from 'lucide-react';

/**
 * 약관 동의 — 한 덩어리.
 *
 * **전문을 펼쳐 두지 않는다.** 가입 화면에서 약관을 끝까지 읽는 사람은 거의 없는데, 스크롤 박스
 * 두 개가 세로의 절반을 먹어 정작 눌러야 할 「가입 완료」가 화면 밖으로 밀린다. 전문은 「보기」로
 * 연다 — 읽겠다는 사람은 그때 읽는다.
 *
 * **[필수]·[선택] 라벨이 곧 설명이다.** 「동의하지 않아도 가입할 수 있어요」는 [선택]과 같은 말이고,
 * 「필수 동의를 확인해 주세요」는 [필수]와 같은 말이다. 같은 말을 두 번 하면 둘 다 읽히지 않는다.
 */

type ConsentKey = 'age' | 'terms' | 'privacy' | 'marketing';

type Item = {
  key: ConsentKey;
  required: boolean;
  ko: string;
  en: string;
  /** 읽을 전문이 있는 항목만. 없으면 「보기」를 달지 않는다. */
  doc?: 'terms' | 'privacy';
  /** 무엇을 받게 되는지 한 줄로. 라벨만으로 알 수 없는 것에만 붙인다. */
  koNote?: string;
  enNote?: string;
};

const ITEMS: Item[] = [
  // 만 14세 미만은 가입할 수 없다 (이용약관 제3조 4항). 확인 없이 받으면 뒤늦게 지워야 한다.
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

/**
 * 수신 매체.
 *
 * 마케팅 수신 동의는 **매체별로 따로 받는다** — 이메일만 받겠다는 사람과 문자까지 받겠다는 사람이
 * 다르고, 나중에 한쪽만 끄는 길도 있어야 한다.
 *
 * 지금은 이메일뿐이다. **문자는 보낼 수단이 없다** — 구글 로그인으로는 전화번호가 넘어오지 않고
 * 서비스 어디서도 번호를 받지 않는다. 번호를 받기로 하면 여기에 한 줄 더한다.
 */
const CHANNELS = [{ key: 'email', ko: '이메일', en: 'Email' }] as const;

type ChannelKey = (typeof CHANNELS)[number]['key'];

/** 모든 매체를 같은 값으로. 매체가 늘어도 여기만 보면 된다. */
function fill(value: boolean): Record<ChannelKey, boolean> {
  return Object.fromEntries(CHANNELS.map((channel) => [channel.key, value])) as Record<ChannelKey, boolean>;
}

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
  /** 필수 항목을 비운 채 제출했을 때. 항목 옆에 붙는다 — 버튼 밑에 두면 어디를 고칠지 되짚어야 한다. */
  error?: string;
}) {
  const ko = locale === 'ko';
  const [reading, setReading] = useState<Item['doc'] | null>(null);
  // TODO(api): 매체별 동의를 저장할 필드가 아직 없다. 지금은 화면 상태로만 들고 있다.
  const [channels, setChannels] = useState<Record<ChannelKey, boolean>>(() => fill(false));
  const all = ITEMS.every((item) => values[item.key]);

  function setAll(next: boolean) {
    for (const item of ITEMS) onChange(item.key, next);
    setChannels(fill(next));
  }

  /** 매체를 하나라도 받겠다면 마케팅 동의가 선다. 다 끄면 동의도 내려간다. */
  function setChannel(key: ChannelKey, next: boolean) {
    const merged = { ...channels, [key]: next };
    setChannels(merged);
    onChange('marketing', CHANNELS.some((channel) => merged[channel.key]));
  }

  return (
    <section data-anno='4'>
      {/* 한 번에 끝내는 길을 맨 위에 둔다 — 대부분은 여기서 끝난다 */}
      <label
        data-anno='4-1'
        className='flex cursor-pointer items-center gap-3 rounded-card border border-border-strong px-4 py-3.5 transition hover:border-brand has-[:checked]:border-brand has-[:checked]:bg-brand-subtle'
      >
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
          {/* 선택 항목까지 켜진다는 사실은 법적으로 밝혀야 한다. 괄호 한 마디로 붙인다. */}
          <span className='ml-1.5 text-xs font-normal text-fg-muted'>
            {ko ? '(선택 항목 포함)' : '(includes optional)'}
          </span>
        </span>
      </label>

      <div className='mt-1 divide-y divide-border' data-anno='4-2'>
        {ITEMS.map((item) => (
          <div key={item.key} className='flex items-start gap-3 py-3 pl-[17px] pr-[9px]'>
            <Checkbox
              id={`consent-${item.key}`}
              checked={values[item.key]}
              disabled={disabled}
              onChange={(event) => {
                const next = event.target.checked;
                onChange(item.key, next);
                if (item.key === 'marketing') setChannels(fill(next));
              }}
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
              {/* 설명은 아랫줄에 통째로 둔다 — 제목 옆에 붙이면 좁은 화면에서 제목이 중간에 끊긴다 */}
              {(ko ? item.koNote : item.enNote) && (
                <p className='mt-1 break-keep text-xs leading-snug text-fg-muted'>{ko ? item.koNote : item.enNote}</p>
              )}
              {/* 수신 매체는 따로 받는다 — 이메일만 받겠다는 사람과 둘 다 받겠다는 사람이 다르다 */}
              {item.key === 'marketing' && CHANNELS.length > 1 && (
                <div className='mt-2 flex flex-wrap items-center gap-x-5 gap-y-2'>
                  {CHANNELS.map((channel) => (
                    <Checkbox
                      key={channel.key}
                      id={`consent-marketing-${channel.key}`}
                      checked={channels[channel.key]}
                      disabled={disabled}
                      label={ko ? channel.ko : channel.en}
                      onChange={(event) => setChannel(channel.key, event.target.checked)}
                      className='[&_span]:text-xs [&_span]:text-fg-secondary'
                    />
                  ))}
                </div>
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
          /* 읽고 나온 사람은 대개 동의한다. 그 자리에서 체크하고 닫는 길을 같이 둔다. */
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

/** 전문. 팝업 안에서만 쓴다 — 가입 화면 본문에는 펼치지 않는다. */
function LegalBody({ kind, locale }: { kind: 'terms' | 'privacy'; locale: Locale }) {
  const doc = legalDoc(kind);
  return (
    <div lang='ko' className='max-h-[60vh] overflow-auto overscroll-contain pr-1 [&_li]:text-sm [&_p]:text-sm [&_p]:leading-relaxed'>
      <div className='space-y-2'>
        {doc.intro?.map((block, index) => <BlockView key={index} block={block} locale={locale} />)}
      </div>
      {doc.sections.map((section) => (
        <div key={section.id} className='mt-5 space-y-2'>
          <h4 className='text-sm font-semibold text-fg'>{lx(section.heading, locale)}</h4>
          {section.blocks?.map((block, index) => <BlockView key={index} block={block} locale={locale} />)}
        </div>
      ))}
    </div>
  );
}
