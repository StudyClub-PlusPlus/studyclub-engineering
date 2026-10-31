import Image from 'next/image';
import Link from 'next/link';

import type { L10n, Locale } from '@studyclub/types';
import { ArrowRight, BookOpen, Calendar, Globe2, MessageCircle } from 'lucide-react';
import type { Metadata } from 'next';

import { JoinCta } from '@/components/JoinCta';
import { MemberMap } from '@/components/MemberMap';
import { RegionClocks } from '@/components/RegionClocks';
import { getSite, getOperators } from '@/features/community/server';
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
  // art = public/about-art/role-<id>.webp (zapp-design:icon 세트, 원본은 내부 design/assets/icons)
  const roles: { id: string; name: L10n; tagline: L10n; points: L10n[] }[] = [
    {
      id: 'crew',
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
      name: { ko: '네비게이터', en: 'Navigator' },
      tagline: { ko: '스터디 하나를 이끄는 진행자', en: 'The guide who leads a study' },
      points: [
        { ko: '일정·출석·발표 순서를 챙기며 스터디를 끝까지 이끕니다.', en: 'Keeps the schedule, attendance, and presenter rotation on track.' },
        { ko: '스터디의 디스코드 채널을 운영하고 크루의 질문을 받습니다.', en: "Runs the study's Discord channel and answers Crew questions." },
      ],
    },
    {
      id: 'captain',
      name: { ko: '캡틴', en: 'Captain' },
      tagline: { ko: '커뮤니티를 운영하는 운영진', en: 'Volunteer organizers of the community' },
      points: [
        { ko: '스터디 초기 세팅(모집 광고 · 디스코드 · 킥오프)을 도와줍니다.', en: 'Handle the initial setup: recruiting, Discord, and kickoff.' },
        { ko: '누구나 캡틴에 지원할 수 있습니다.', en: 'Anyone can apply to become a Captain.' },
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

  // 이야기 — 출처: 운영진 「스터디클럽 소개」 문서(인원·지역은 2025-08 기준), 운영진 설명.
  const story: { art: string; when: L10n; title: L10n; body: L10n }[] = [
    {
      art: 'region-us',
      when: { ko: '2024년 초', en: 'Early 2024' },
      title: { ko: '실리콘밸리에서 출발', en: 'Born in Silicon Valley' },
      body: {
        ko: '베이 에어리어 한인 엔지니어들의 스터디 모임으로 시작했어요. 미국 서부에서 동부로 퍼졌어요.',
        en: 'It started as a study group of Korean engineers in the Bay Area, then spread from the West Coast to the East.',
      },
    },
    {
      art: 'region-ca',
      when: { ko: '북미 전역', en: 'Across North America' },
      title: { ko: '캐나다와 유럽까지', en: 'Canada, then Europe' },
      body: {
        ko: '캐나다, 그리고 스위스·독일에서도 함께해요.',
        en: 'Members join from Canada, Switzerland, and Germany.',
      },
    },
    {
      art: 'region-kr',
      when: { ko: '그리고 한국', en: 'And Korea' },
      title: { ko: '한국으로 진출', en: 'Expanding to Korea' },
      body: {
        ko: '한국에서도 스터디가 열리고, 한국 크루와 북미 크루가 한 스터디에서 만나요.',
        en: 'Studies open in Korea too, where Korean and North American crew meet in one group.',
      },
    },
  ];
  const networking: { title: L10n; body: L10n }[] = [
    {
      title: { ko: '현업 엔지니어와 함께', en: 'Study with working engineers' },
      body: { ko: '미국·한국 현직자의 경험을 스터디에서 바로 들어요.', en: 'Hear real experience from engineers in the US and Korea.' },
    },
    {
      title: { ko: '레퍼럴과 커리어', en: 'Referrals and careers' },
      body: { ko: '레퍼럴을 부탁하고, 이직·인터뷰 경험을 나눠요.', en: 'Ask for referrals and share interview and job-change stories.' },
    },
    {
      title: { ko: '온라인 너머 오프라인', en: 'Beyond online' },
      body: { ko: '피크닉과 오프라인 특강으로 직접 만나요.', en: 'Meet in person at picnics and offline sessions.' },
    },
  ];

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
        <h1 className='type-headline-lg sm:type-headline-lg'>{m('about.title', locale)}</h1>
        <p className='mt-3 type-body-lg text-[var(--color-fg-muted)] type-prose'>{m('about.subtitle', locale)}</p>
      </header>

      <div className='card mt-10 p-8'>
        <div className='flex max-w-3xl flex-col gap-4 type-body-lg text-[var(--color-fg)]'>
          {intro.map((p, i) => (
            <p key={i}>{t(p, locale)}</p>
          ))}
        </div>
        <div className='mt-6 grid gap-4 md:grid-cols-2'>
          {problems.map((pr, i) => (
            <div key={i} className='rounded-xl border border-[var(--color-border)] p-5'>
              <h3 className='type-title-md text-[var(--color-fg)]'>
                <span style={{ color: 'var(--color-brand)' }}>{i + 1}. </span>
                {t(pr.q, locale)}
              </h3>
              <ul className='mt-3 flex flex-col gap-2'>
                {pr.a.map((line, j) => (
                  <li key={j} className='flex items-start gap-2 type-body-md text-[var(--color-fg-muted)]'>
                    <span className='mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-fg-faint)]' />
                    {t(line, locale)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className='mt-6 max-w-3xl type-title-md text-[var(--color-fg)]'>{t(outro, locale)}</p>
      </div>

      {/* 우리의 이야기 — 실리콘밸리에서 시작해 한국까지 */}
      <div className='mt-10'>
        <h2 className='type-title-lg'>{t({ ko: '실리콘밸리에서 시작했어요', en: 'It started in Silicon Valley' }, locale)}</h2>
        <p className='mt-2 max-w-3xl type-body-md text-[var(--color-fg-muted)]'>
          {t(
            {
              ko: '베이 에어리어에서 일하는 한인 엔지니어들이 같이 공부하려고 모인 것이 시작이에요. 미국을 중심으로 자라 캐나다와 한국까지 넓어졌고, 지금은 시차를 넘어 함께 공부하며 서로의 경험과 기회를 나눠요.',
              en: 'It began with Korean engineers in the Bay Area who wanted to study together. It grew across the US, then reached Canada and Korea. Today we study across time zones and share experience and opportunities with each other.',
            },
            locale,
          )}
        </p>
        <ol className='mt-6 grid gap-4 md:grid-cols-3'>
          {story.map((st) => (
            <li key={st.art} className='card flex flex-col gap-3 p-6'>
              <Image src={`/about-art/${st.art}.webp`} alt='' width={64} height={64} className='h-16 w-16' />
              <div className='type-label-lg text-[var(--color-brand)]'>{t(st.when, locale)}</div>
              <div className='type-title-md'>{t(st.title, locale)}</div>
              <p className='type-body-md text-[var(--color-fg-muted)]'>{t(st.body, locale)}</p>
            </li>
          ))}
        </ol>
        <ul className='mt-4 grid gap-3 sm:grid-cols-3'>
          {networking.map((n, i) => (
            <li key={i} className='rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 type-body-md'>
              <span className='font-semibold'>{t(n.title, locale)}</span>
              <span className='text-[var(--color-fg-muted)]'> {t(n.body, locale)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 역할 — 크루 · 네비게이터 · 캡틴 */}
      <div className='mt-10'>
        <h2 className='type-title-lg'>{m('about.roles_title', locale)}</h2>
        <p className='mt-2 max-w-3xl type-body-md text-[var(--color-fg-muted)]'>
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
              <Image src={`/about-art/role-${r.id}.webp`} alt='' width={72} height={72} className='h-18 w-18' />
              <h3 className='mt-3 type-title-md'>{t(r.name, locale)}</h3>
              <p className='mt-1 type-label-lg text-[var(--color-brand)]'>{t(r.tagline, locale)}</p>
              <ul className='mt-4 flex flex-col gap-2.5'>
                {r.points.map((p, i) => (
                  <li key={i} className='flex items-start gap-2 type-body-md text-[var(--color-fg)]'>
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
          <h2 className='mb-4 type-title-lg'>{m('about.operators', locale)}</h2>
          <div className='grid gap-4 sm:grid-cols-2'>
            {operators.map((op) => (
              <div key={op.id} className='card p-6'>
                <div className='type-title-md'>{t(op.name, locale)}</div>
                <div className='mt-0.5 type-label-lg text-[var(--color-brand)]'>{t(op.role, locale)}</div>
                <p className='mt-2.5 type-body-sm text-[var(--color-fg-muted)]'>{t(op.bio, locale)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 어디서 함께하나 — 지도 + 지역별 시간대 */}
      <div className='mt-10'>
        <h2 className='flex items-center gap-2 type-title-lg'>
          <Globe2 size={20} style={{ color: 'var(--color-brand)' }} />
          {t({ ko: '어디서 함께하나요', en: 'Where we are' }, locale)}
        </h2>
        <p className='mt-2 mb-4 max-w-3xl type-body-md text-[var(--color-fg-muted)]'>
          {t(
            {
              ko: '미국 서부부터 동부, 캐나다, 한국, 유럽까지. 시차가 달라도 같은 스터디에서 만나요.',
              en: 'From the US West Coast to the East, Canada, Korea, and Europe. Different time zones, same study.',
            },
            locale,
          )}
        </p>
        <MemberMap locale={locale} />
      </div>

      {/* 지금 각 지역의 시간 */}
      <div className='mt-10'>
        <h2 className='mb-4 type-title-lg'>{t({ ko: '지금, 각 지역의 시간', en: 'Right now, around the world' }, locale)}</h2>
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
