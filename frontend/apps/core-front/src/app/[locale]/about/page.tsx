import Link from 'next/link';

import { ArrowRight, BookOpen, Calendar, Compass, Flag, Globe2, MessageCircle, Users } from 'lucide-react';
import type { Metadata } from 'next';

import { JoinCta } from '@/components/JoinCta';
import { RegionClocks } from '@/components/RegionClocks';
import { getSite, getOperators, type L10n, type Locale } from '@/lib/content';
import { m, t } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: '/about',
    title: m('about.title', locale),
    description: m('seo.about_description', locale),
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [site, operators] = await Promise.all([getSite(), getOperators()]);

  // 역할 세 가지 — 크루(참여) · 네비게이터(스터디 하나를 이끈다) · 캡틴(운영진).
  // 예전 「반장·부반장」은 네비게이터로 바뀌었다.
  const roles: { id: string; icon: typeof Users; name: L10n; tagline: L10n; points: L10n[] }[] = [
    {
      id: 'crew',
      icon: Users,
      name: { ko: '크루', en: 'Crew' },
      tagline: { ko: '함께 공부하는 스터디원', en: 'Members who study together' },
      points: [
        { ko: '모집 중인 스터디에 신청하면 크루가 됩니다.', en: 'Apply to a recruiting study and you become Crew.' },
        { ko: '매주 세션에 참여하고 돌아가며 발표합니다.', en: 'Join weekly sessions and take turns presenting.' },
        { ko: '마지막 회고로 한 시즌을 마무리합니다.', en: 'Wrap up the season with a retro.' },
      ],
    },
    {
      id: 'navigator',
      icon: Flag,
      name: { ko: '네비게이터', en: 'Navigator' },
      tagline: { ko: '스터디 하나를 이끄는 진행자', en: 'The guide who leads a study' },
      points: [
        { ko: '일정·출석·발표 순서를 챙기며 스터디를 끝까지 이끕니다.', en: 'Keeps the schedule, attendance, and presenter rotation on track.' },
        { ko: '스터디의 디스코드 채널을 운영하고 크루의 질문을 받습니다.', en: "Runs the study's Discord channel and answers Crew questions." },
      ],
    },
    {
      id: 'captain',
      icon: Compass,
      name: { ko: '캡틴', en: 'Captain' },
      tagline: { ko: '커뮤니티를 운영하는 운영진', en: 'Volunteer organizers of the community' },
      points: [
        { ko: '스터디 초기 세팅(모집 광고 · 디스코드 · 킥오프)을 도와줍니다.', en: 'Handle the initial setup: recruiting, Discord, and kickoff.' },
        { ko: '100% 자원봉사이며, 수익은 전액 기부합니다.', en: '100% volunteer, and all profits are donated.' },
        { ko: '모든 스터디와 이벤트에 무료로 참여하고, 누구나 지원할 수 있습니다.', en: 'Join every study and event for free, and anyone can apply.' },
      ],
    },
  ];

  // 소개 본문 — 운영진이 쓴 원래 설명 (2026-10-18). 문단 · 두 가지 문제 · 그래서 만든 것 순서.
  const intro: L10n[] = [
    {
      ko: '혼자 공부는 지속하기 어렵습니다. 하지만 스터디 그룹으로 같이 하면 지속 가능성을 훨씬 높일 수 있습니다. 스터디원들과 일정한 진도를 꾸준히 나가므로 포기하지 않게 되고, 모르는 걸 물어볼 수도 있고, 다른 사람들의 경험에서 배울 수도 있습니다. 게다가 오랫동안 같이 하므로 사람과 사람의 네트워킹이 실제로 이뤄집니다.',
      en: "Studying alone is hard to sustain. Studying in a group makes it far more likely you'll keep going. You move forward at a steady pace with others so you don't give up, you can ask what you don't know, and you learn from other people's experience. And because you stay together for a long time, real connections form between people.",
    },
    {
      ko: '하지만 스터디 그룹으로 뭔가 공부하려고 할 때, 두 가지 문제가 나옵니다.',
      en: 'But when you try to study something as a group, two problems come up.',
    },
  ];
  const problems: { q: L10n; a: L10n[] }[] = [
    {
      q: { ko: '원하는 스터디 그룹을 어디서 찾을 수 있을까요?', en: 'Where can I find the study group I want?' },
      a: [
        {
          ko: '페이스북 그룹, 네이버 카페, 오픈 카톡방 등 여러 곳을 찾아볼 수 있지만, 찾는 노력도 꽤 들고, 원하는 스터디가 없거나, 스터디가 이미 진행 중이라 중간에 못 들어갈 수도 있습니다.',
          en: "You can look in Facebook groups, online forums, and open chat rooms, but searching takes real effort, the study you want may not exist, or it may already be underway so you can't join midway.",
        },
      ],
    },
    {
      q: {
        ko: '적당한 스터디 그룹을 못 찾았는데, 내가 어떻게 만들 수 있을까요?',
        en: "I couldn't find a good one. How do I start my own?",
      },
      a: [
        { ko: '지나가는 아무한테나 물어봐 모집할 수도 없고, 매번 물어보기도 힘듭니다.', en: "You can't recruit by asking random people, and asking every time is exhausting." },
        { ko: '누군가 강하게 리딩하지 않으면 흐지부지됩니다.', en: 'Without someone leading firmly, it fizzles out.' },
        {
          ko: '어떻게 모집했다 해도, 언제 할지, 어떤 플랫폼으로 할지, 무슨 강의나 교재로 할지 등 결정에 에너지를 많이 써서, 막상 스터디 때는 에너지가 없어 집중하지 못합니다.',
          en: "Even once you've gathered people, deciding when to meet, which platform to use, and which course or book to follow drains so much energy that there's little left for the study itself.",
        },
      ],
    },
  ];
  const outro: L10n = {
    ko: `이 두 가지 문제를 해결하기 위해 2024년 초에 만들어진 것이 스터디클럽입니다. 스터디클럽은 일종의 스터디 그룹 풀로서, 누구나 이곳에서 스터디를 제안하고, 모집해서 진행할 수 있습니다. 지금은 미국·캐나다·한국의 개발자 ${site.community.member_count.toLocaleString()}명 이상이 함께하고 있습니다.`,
    en: `StudyClub was created in early 2024 to solve these two problems. It is a pool of study groups where anyone can propose a study, recruit members, and run it. Today more than ${site.community.member_count.toLocaleString()} engineers across the US, Canada, and Korea are part of it.`,
  };

  const cards = [
    {
      href: `/${locale}/studies`,
      icon: BookOpen,
      label: m('studies.title', locale),
      external: false,
    },
    {
      href: `/${locale}/events`,
      icon: Calendar,
      label: m('events.title', locale),
      external: false,
    },
    ...(site.mentoring_url
      ? [
          {
            href: site.mentoring_url,
            icon: MessageCircle,
            label: m('nav.mentoring', locale),
            external: true,
          },
        ]
      : []),
  ];

  return (
    <div className='mx-auto max-w-6xl px-6 py-14'>
      <header className='max-w-2xl'>
        <h1 className='text-3xl font-extrabold tracking-tight sm:text-4xl'>{m('about.title', locale)}</h1>
        <p className='mt-3 text-lg text-[var(--color-fg-muted)]'>{m('about.subtitle', locale)}</p>
      </header>

      <div className='card mt-10 p-8'>
        <div className='flex max-w-3xl flex-col gap-4 text-[17px] leading-loose text-[var(--color-fg)]'>
          {intro.map((p, i) => (
            <p key={i}>{t(p, locale)}</p>
          ))}
        </div>
        <div className='mt-6 grid gap-4 md:grid-cols-2'>
          {problems.map((pr, i) => (
            <div key={i} className='rounded-xl border border-[var(--color-border)] p-5'>
              <h3 className='text-[15px] font-bold text-[var(--color-fg)]'>
                <span style={{ color: 'var(--color-brand)' }}>{i + 1}. </span>
                {t(pr.q, locale)}
              </h3>
              <ul className='mt-3 flex flex-col gap-2'>
                {pr.a.map((line, j) => (
                  <li key={j} className='flex items-start gap-2 text-[15px] leading-relaxed text-[var(--color-fg-muted)]'>
                    <span className='mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-fg-faint)]' />
                    {t(line, locale)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className='mt-6 max-w-3xl text-[17px] font-semibold leading-loose text-[var(--color-fg)]'>{t(outro, locale)}</p>
      </div>

      {/* 역할 — 크루 · 네비게이터 · 캡틴 */}
      <div className='mt-10'>
        <h2 className='text-xl font-bold tracking-tight'>{m('about.roles_title', locale)}</h2>
        <p className='mt-2 max-w-3xl text-[15px] leading-relaxed text-[var(--color-fg-muted)]'>
          {m('about.roles_body', locale)}
        </p>
        <div className='mt-5 grid gap-4 md:grid-cols-3'>
          {roles.map((r) => (
            <section
              key={r.id}
              id={r.id}
              className='scroll-mt-20 rounded-2xl border p-6'
              style={{ background: 'var(--color-brand-subtle)', borderColor: 'var(--color-brand-subtle)' }}
            >
              <h3 className='flex items-center gap-2 text-lg font-bold tracking-tight'>
                <r.icon size={20} style={{ color: 'var(--color-brand)' }} />
                {t(r.name, locale)}
              </h3>
              <p className='mt-1 text-sm font-medium text-[var(--color-brand)]'>{t(r.tagline, locale)}</p>
              <ul className='mt-4 flex flex-col gap-2.5'>
                {r.points.map((p, i) => (
                  <li key={i} className='flex items-start gap-2 text-[15px] leading-relaxed text-[var(--color-fg)]'>
                    <span className='mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full' style={{ background: 'var(--color-brand)' }} />
                    {t(p, locale)}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      {/* 캡틴 (운영진) 소개 */}
      {operators.length > 0 && (
        <div className='mt-10'>
          <h2 className='mb-4 text-xl font-bold tracking-tight'>{m('about.operators', locale)}</h2>
          <div className='grid gap-4 sm:grid-cols-2'>
            {operators.map((op) => (
              <div key={op.id} className='card p-6'>
                <div className='text-base font-bold'>{t(op.name, locale)}</div>
                <div className='mt-0.5 text-sm font-medium text-[var(--color-brand)]'>{t(op.role, locale)}</div>
                <p className='mt-2.5 text-sm leading-relaxed text-[var(--color-fg-muted)]'>{t(op.bio, locale)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 글로벌 — 세 지역 실시간 시계 */}
      <div className='mt-10'>
        <h2 className='mb-4 flex items-center gap-2 text-xl font-bold tracking-tight'>
          <Globe2 size={20} style={{ color: 'var(--color-brand)' }} />
          {t({ ko: '지금, 세 지역에서', en: 'Right now, across three regions' }, locale)}
        </h2>
        <RegionClocks locale={locale} />
      </div>

      <div className='mt-6 grid gap-4 sm:grid-cols-3'>
        {cards.map((c) => {
          const body = (
            <>
              <span className='flex items-center gap-2.5 font-semibold'>
                <c.icon size={18} style={{ color: 'var(--color-brand)' }} />
                {c.label}
              </span>
              <ArrowRight size={16} className='text-[var(--color-fg-faint)]' />
            </>
          );
          return c.external ? (
            <a
              key={c.label}
              href={c.href}
              target='_blank'
              rel='noreferrer'
              className='card card-hover flex items-center justify-between p-5'
            >
              {body}
            </a>
          ) : (
            <Link key={c.label} href={c.href} className='card card-hover flex items-center justify-between p-5'>
              {body}
            </Link>
          );
        })}
      </div>

      <div className='mt-10'>
        <JoinCta locale={locale} discordUrl={site.discord_invite} />
      </div>
    </div>
  );
}
