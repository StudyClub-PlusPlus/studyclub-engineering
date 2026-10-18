import Link from 'next/link';

import { BookOpen, Users, UserPlus, Sparkles, HelpCircle } from 'lucide-react';
import type { Metadata } from 'next';

import { JoinCta } from '@/components/JoinCta';
import { getSite, type Locale, type L10n } from '@/lib/content';
import { m, t } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

type Section = { id: string; icon: typeof BookOpen; title: L10n };

const SECTIONS: Section[] = [
  { id: 'what', icon: BookOpen, title: { ko: '스터디 클럽이란?', en: 'What is the study club?' } },
  { id: 'roles', icon: Users, title: { ko: '크루 · 네비게이터 · 캡틴', en: 'Crew · Navigator · Captain' } },
  { id: 'join', icon: UserPlus, title: { ko: '참여하는 법', en: 'How to join' } },
  {
    id: 'propose',
    icon: Sparkles,
    title: { ko: '스터디 제안·개설하는 법', en: 'How to propose a study' },
  },
  { id: 'faq', icon: HelpCircle, title: { ko: '자주 묻는 질문', en: 'FAQ' } },
];

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: '/guide',
    title: m('guide.title', locale),
    description: m('seo.guide_description', locale),
  });
}

export default async function GuidePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const site = await getSite();

  const joinSteps: L10n[] = [
    { ko: '디스코드에 합류합니다. 모든 스터디가 디스코드에서 진행됩니다.', en: 'Join the Discord server. Every study runs there.' },
    { ko: '구글 계정으로 로그인하고 모집 중인 스터디를 찾습니다.', en: "Sign in with Google and find a study that's recruiting." },
    {
      ko: '스터디 페이지에서 신청서를 내면 바로 크루가 됩니다.',
      en: "Submit the application on the study's page and you're Crew right away.",
    },
    {
      ko: '킥오프에서 네비게이터와 함께 일정·진행 방식을 정합니다.',
      en: 'At the kickoff, set the schedule and format with your Navigator.',
    },
  ];

  const proposeSteps: L10n[] = [
    {
      ko: '공부하고 싶은 주제로 스터디를 제안합니다. 누구나 할 수 있습니다.',
      en: 'Propose a study on a topic you want to learn. Anyone can.',
    },
    {
      ko: '캡틴이 모집 광고, 디스코드 채널, 킥오프 세팅을 도와줍니다.',
      en: 'A Captain helps set up recruiting, the Discord channel, and the kickoff.',
    },
    {
      ko: '모집이 열리면 크루가 모이고 킥오프로 시작합니다.',
      en: 'Once recruiting opens, Crew gather and you start with the kickoff.',
    },
    {
      ko: '네비게이터가 스터디를 이끌고, 발표자(백업 포함)를 정해 운영한 뒤 회고로 마무리합니다.',
      en: 'A Navigator leads the study, presenters (with backup) take turns, and you end with a retro.',
    },
  ];

  const roles: { id: string; name: L10n; desc: L10n }[] = [
    { id: 'crew', name: { ko: '크루', en: 'Crew' }, desc: { ko: '스터디에 참여해 함께 공부하는 스터디원.', en: 'Members who join a study and learn together.' } },
    {
      id: 'navigator',
      name: { ko: '네비게이터', en: 'Navigator' },
      desc: { ko: '스터디 하나를 이끄는 진행자. 일정·출석·발표 순서를 챙깁니다.', en: 'Leads a study: schedule, attendance, and presenter rotation.' },
    },
    {
      id: 'captain',
      name: { ko: '캡틴', en: 'Captain' },
      desc: { ko: '커뮤니티를 운영하는 운영진. 스터디 세팅을 돕습니다.', en: 'Organizers who run the community and help set up studies.' },
    },
  ];

  const faqs: { q: L10n; a: L10n }[] = [
    {
      q: { ko: '개발자가 아니어도 참여할 수 있나요?', en: "Can I join if I'm not a developer?" },
      a: {
        ko: '네. 개발·AI 스터디가 많지만 어학·북클럽·라이프스타일 등 다양한 스터디가 있어, 관심만 있으면 누구나 참여할 수 있습니다.',
        en: 'Yes. There are many dev and AI studies, but also language, book club, and habit clubs. Anyone interested is welcome.',
      },
    },
    {
      q: { ko: '스터디는 보통 몇 명이 참여하나요?', en: 'How many people are in a study?' },
      a: {
        ko: '스터디당 보통 10~15명이 참여합니다. 인원이 많으면 반을 나누기도 합니다.',
        en: 'Usually 10 to 15 people per study. Larger groups may split into sections.',
      },
    },
    {
      q: { ko: '중간에 합류할 수 있나요?', en: 'Can I join partway through?' },
      a: {
        ko: '마감일이 없는 스터디는 언제든 합류할 수 있습니다. 마감일이 지난 스터디는 다음 모집을 기다리면 됩니다.',
        en: 'Studies with no deadline accept members anytime. For studies with a deadline, wait for the next intake.',
      },
    },
    {
      q: { ko: '네비게이터는 누가 하나요?', en: 'Who becomes a Navigator?' },
      a: {
        ko: '스터디마다 한 명 이상이 맡아 스터디를 이끕니다. 맡고 싶다면 스터디를 제안하거나 캡틴에게 문의하세요.',
        en: 'Each study has at least one Navigator who leads it. To take it on, propose a study or ask a Captain.',
      },
    },
    {
      q: { ko: '캡틴이 되려면 어떻게 하나요?', en: 'How do I become a Captain?' },
      a: {
        ko: '누구나 지원할 수 있습니다. 디스코드에서 캡틴 모집 안내를 확인하고 문의하세요.',
        en: 'Anyone can apply. Check the Captain recruiting notice on Discord and reach out.',
      },
    },
  ];

  return (
    <div className='mx-auto max-w-6xl px-6 py-14'>
      <header className='max-w-2xl'>
        <h1 className='text-3xl font-extrabold tracking-tight sm:text-4xl'>{m('guide.title', locale)}</h1>
        <p className='mt-3 text-lg text-[var(--color-fg-muted)]'>{m('guide.subtitle', locale)}</p>
      </header>

      {/* 목차 */}
      <nav className='mt-8 flex flex-wrap gap-2'>
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className='inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-interactive)] hover:text-[var(--color-fg)]'
          >
            <s.icon size={14} style={{ color: 'var(--color-brand)' }} />
            {t(s.title, locale)}
          </a>
        ))}
      </nav>

      {/* 스터디 클럽이란? */}
      <SectionHeading section={SECTIONS[0]} locale={locale} />
      <div className='card p-8'>
        <p className='max-w-3xl text-[15px] leading-relaxed text-[var(--color-fg)]'>
          {t(
            {
              ko: `StudyClub 는 미국·캐나다·한국의 개발자 ${site.community.member_count.toLocaleString()}명 이상이 함께하는 글로벌 스터디 커뮤니티입니다. 여러 스터디가 모인 '풀(pool)'로, 누구나 공부하고 싶은 주제로 스터디를 제안하고 운영할 수 있습니다. 디스코드에서 모든 스터디와 이벤트가 운영됩니다.`,
              en: `StudyClub is a global study community of ${site.community.member_count.toLocaleString()}+ engineers across the US, Canada, and Korea. It's a pool of study groups where anyone can propose and run a study on a topic they want to learn. Every study and event runs on Discord.`,
            },
            locale,
          )}
        </p>
      </div>

      {/* 역할 — 크루 · 네비게이터 · 캡틴 (자세한 건 소개 페이지) */}
      <SectionHeading section={SECTIONS[1]} locale={locale} />
      <div className='grid gap-3 sm:grid-cols-3'>
        {roles.map((r) => (
          <Link key={r.id} href={`/${locale}/about#${r.id}`} className='card card-hover p-5'>
            <div className='text-base font-bold'>{t(r.name, locale)}</div>
            <p className='mt-1.5 text-[15px] leading-relaxed text-[var(--color-fg-muted)]'>{t(r.desc, locale)}</p>
          </Link>
        ))}
      </div>

      {/* 참여하는 법 */}
      <SectionHeading section={SECTIONS[2]} locale={locale} />
      <ol className='grid gap-3 sm:grid-cols-2'>
        {joinSteps.map((step, i) => (
          <li key={i} className='card flex items-start gap-3 p-5'>
            <span
              className='grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white'
              style={{ background: 'var(--color-brand)' }}
            >
              {i + 1}
            </span>
            <span className='text-[15px] leading-relaxed text-[var(--color-fg)]'>{t(step, locale)}</span>
          </li>
        ))}
      </ol>

      {/* 스터디 제안·개설하는 법 */}
      <SectionHeading section={SECTIONS[3]} locale={locale} />
      <ol className='grid gap-3 sm:grid-cols-2'>
        {proposeSteps.map((step, i) => (
          <li key={i} className='card flex items-start gap-3 p-5'>
            <span
              className='grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white'
              style={{ background: 'var(--color-brand)' }}
            >
              {i + 1}
            </span>
            <span className='text-[15px] leading-relaxed text-[var(--color-fg)]'>{t(step, locale)}</span>
          </li>
        ))}
      </ol>

      {/* FAQ */}
      <SectionHeading section={SECTIONS[4]} locale={locale} />
      <div className='flex flex-col gap-3'>
        {faqs.map((f, i) => (
          <details key={i} className='card group p-5'>
            <summary className='flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-[var(--color-fg)]'>
              {t(f.q, locale)}
              <span className='text-[var(--color-fg-faint)] transition-transform group-open:rotate-45'>+</span>
            </summary>
            <p className='mt-3 text-[15px] leading-relaxed text-[var(--color-fg-muted)]'>{t(f.a, locale)}</p>
          </details>
        ))}
      </div>

      <div className='mt-12'>
        <JoinCta locale={locale} discordUrl={site.discord_invite} />
      </div>
    </div>
  );
}

function SectionHeading({ section, locale }: { section: Section; locale: Locale }) {
  return (
    <h2 id={section.id} className='mb-4 mt-12 flex scroll-mt-20 items-center gap-2 text-xl font-bold tracking-tight'>
      <section.icon size={20} style={{ color: 'var(--color-brand)' }} />
      {t(section.title, locale)}
    </h2>
  );
}
