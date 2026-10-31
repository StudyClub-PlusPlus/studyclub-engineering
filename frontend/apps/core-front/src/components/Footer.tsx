import Image from 'next/image';
import Link from 'next/link';

import { ArrowUpRight } from 'lucide-react';

import { SocialIcons } from './SocialLinks';
import type { Locale, Site } from '@/lib/content';
import { m, t } from '@/lib/i18n';


export function Footer({ locale, site }: { locale: Locale; site: Site }) {
  return (
    <footer className='mt-20 border-t border-(--color-border)'>
      <div className='mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <div className='flex items-center gap-2 type-title-md'>
            <Image src='/logo-mark.png' alt='' width={28} height={28} className='h-7 w-7' />
            <span>
              Study<span className='text-[#FF805C]'>Club</span>
            </span>
          </div>
          <p className='mt-3 type-body-sm text-(--color-fg-muted)'>
            {m('footer.tagline', locale)} · {t(site.community.region, locale)} · {site.community.member_count.toLocaleString()}+
          </p>
          <p className='mt-1 flex flex-wrap items-center gap-x-3 type-label-sm text-(--color-fg-faint)'>
            <span>© {new Date().getFullYear()} StudyClub</span>
            {/* 문의·오류 신고 — 쓰는 창이 바로 열린다. 로그인하지 않았으면 로그인으로 보낸다 (specs/feedback 「진입점」) */}
            <Link
              href={`/${locale}/my/feedbacks?write=1`}
              className='font-semibold text-(--color-fg-muted) hover:text-(--color-fg)'
            >
              {m('nav.feedback', locale)}
            </Link>
            <Link href={`/${locale}/terms`} className='hover:text-(--color-fg)'>
              {t({ ko: '이용약관', en: 'Terms' }, locale)}
            </Link>
            {/* 개인정보처리방침은 법적으로 눈에 띄게 둔다 — 굵게 */}
            <Link href={`/${locale}/privacy`} className='font-semibold text-(--color-fg-muted) hover:text-(--color-fg)'>
              {t({ ko: '개인정보처리방침', en: 'Privacy Policy' }, locale)}
            </Link>
            {/* 가입하다 막힌 사람을 위한 운영 메일 — 링크·폼이 아니라 글자만 (문의·오류 신고는 온보딩을 마쳐야 쓴다) */}
            <span className='select-all'>contact@studyclub.life</span>
          </p>
        </div>
        <div className='flex flex-col gap-3 type-body-sm sm:items-end'>
          <SocialIcons locale={locale} />
          <div className='flex flex-wrap gap-x-6 gap-y-2 text-(--color-fg-muted)'>
            <Link href={`/${locale}/studies`} className='hover:text-(--color-fg)'>
              {m('nav.studies', locale)}
            </Link>
            <Link href={`/${locale}/events`} className='hover:text-(--color-fg)'>
              {m('nav.events', locale)}
            </Link>
            <Link href={`/${locale}/guide`} className='hover:text-(--color-fg)'>
              {m('nav.guide', locale)}
            </Link>
            <Link href={`/${locale}/notices`} className='hover:text-(--color-fg)'>
              {m('nav.notices', locale)}
            </Link>
            <Link href={`/${locale}/about`} className='hover:text-(--color-fg)'>
              {m('nav.about', locale)}
            </Link>
            <a href={site.discord_invite} target='_blank' rel='noreferrer' className='hover:text-(--color-fg)'>
              Discord
            </a>
            {site.mentoring_url && (
              <a
                href={site.mentoring_url}
                target='_blank'
                rel='noreferrer'
                className='inline-flex items-center gap-0.5 hover:text-(--color-fg)'
              >
                {m('nav.mentoring', locale)} <ArrowUpRight size={12} />
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
