import { Instagram, Linkedin, MessageCircle } from 'lucide-react';

import type { Locale } from '@/lib/content';
import { t } from '@/lib/i18n';
import { activeSocialChannels, type SocialId } from '@/lib/social';

function XMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'>
      <path d='M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' />
    </svg>
  );
}

const ICON: Record<SocialId, (p: { size?: number }) => React.ReactNode> = {
  instagram: (p) => <Instagram {...p} />,
  x: (p) => <XMark {...p} />,
  kakao: (p) => <MessageCircle {...p} />,
  linkedin: (p) => <Linkedin {...p} />,
};

/** 푸터용 — 아이콘만 */
export function SocialIcons({ locale }: { locale: Locale }) {
  const channels = activeSocialChannels();
  if (!channels.length) return null;
  return (
    <div className='flex items-center gap-1'>
      {channels.map((c) => (
        <a
          key={c.id}
          href={c.href}
          target='_blank'
          rel='noreferrer'
          aria-label={t(c.label, locale)}
          title={t(c.label, locale)}
          className='grid h-9 w-9 place-items-center rounded-full text-(--color-fg-muted) transition-colors hover:bg-(--color-surface-subtle) hover:text-(--color-fg)'
        >
          {ICON[c.id]({ size: 17 })}
        </a>
      ))}
    </div>
  );
}

/** 행사 목록 아래 — 소식 받기 띠 */
export function FollowStrip({ locale }: { locale: Locale }) {
  const channels = activeSocialChannels();
  if (!channels.length) return null;
  return (
    <section className='mt-12 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8' style={{ background: 'var(--color-brand-subtle)' }}>
      <div>
        <h2 className='text-lg font-bold tracking-tight'>{t({ ko: '행사와 모집 소식을 먼저 받아 보세요', en: 'Hear about events and new studies first' }, locale)}</h2>
        <p className='mt-1 text-sm text-(--color-fg-muted)'>
          {t({ ko: '새 행사가 열리거나 스터디 모집이 시작되면 여기에 알려 드려요.', en: 'We post here when an event opens or a study starts recruiting.' }, locale)}
        </p>
      </div>
      <div className='flex flex-wrap gap-2'>
        {channels.map((c) => (
          <a
            key={c.id}
            href={c.href}
            target='_blank'
            rel='noreferrer'
            className='inline-flex items-center gap-2 rounded-full bg-(--color-bg) px-4 py-2 text-sm font-semibold text-(--color-fg) shadow-sm transition-colors hover:bg-(--color-surface-subtle)'
          >
            {ICON[c.id]({ size: 16 })}
            {t(c.label, locale)}
          </a>
        ))}
      </div>
    </section>
  );
}
