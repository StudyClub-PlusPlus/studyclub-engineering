import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { Metadata } from 'next';

import {
  CREW,
  CREW_SNAPSHOT,
  LEGENDS,
  PR_URL,
  findCrew,
  findLegend,
  repoPrUrl,
  type CrewMember,
  type QuestItem,
  type QuestKind,
} from '@/features/credits/data';

const box = 'border-[3px] border-[var(--color-ink)] bg-white';
const BADGE: Record<QuestKind, string> = {
  SPEC: 'bg-[var(--arcade-orange-bg)] text-[var(--arcade-orange-ink)]',
  UI: 'bg-[var(--color-primary-light)] text-[var(--arcade-blue-ink)]',
  API: 'bg-[var(--arcade-gold-bg)] text-[var(--arcade-gold-deep)]',
  DESIGN: 'bg-[var(--arcade-purple-bg)] text-[var(--arcade-purple-ink)]',
};

const itemHref = (it: QuestItem) => it.url ?? (it.no ? `${PR_URL}${it.no}` : undefined);

export function generateStaticParams() {
  return [...LEGENDS, ...CREW].map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const handle = (await params).handle;
  const c = findLegend(handle) ?? findCrew(handle);
  return { title: c ? `${c.name}의 퀘스트 로그` : '만든 사람들', robots: { index: false, follow: false } };
}

export default async function ContributorPage({ params }: { params: Promise<{ locale: string; handle: string }> }) {
  const { locale, handle } = await params;
  const c = findLegend(handle);
  if (!c) {
    const m = findCrew(handle);
    if (!m) notFound();
    return <CrewSheet m={m} locale={locale} />;
  }

  return (
    <>
      <div className='mx-auto max-w-[1120px] px-6 pt-6'>
        <Link
          href={`/${locale}/++`}
          className='font-pixel inline-flex min-h-11 items-center text-[length:var(--arcade-fs-11)] text-[var(--color-ink)]'
        >
          ◀ SELECT
        </Link>
      </div>

      <section className='mx-auto max-w-[1120px] px-6 pt-4 pb-7'>
        <div className={`${box} flex flex-wrap shadow-[8px_8px_0_#282A43]`}>
          <div className='flex flex-[1_1_280px] flex-col items-center gap-3.5 border-[var(--color-ink)] bg-[var(--arcade-gold-bg)] p-7 text-center sm:border-r-[3px]'>
            <div className='font-pixel border-[3px] border-[var(--color-ink)] bg-[var(--arcade-gold)] px-2.5 py-1.5 text-[length:var(--arcade-fs-11)]'>
              LEGEND
            </div>
            <div className='font-dot flex size-[140px] items-center justify-center border-[3px] border-[var(--color-ink)] bg-[var(--arcade-orange-bg)] text-[length:var(--arcade-fs-72)] shadow-[6px_6px_0_#282A43]'>
              {c.initial}
            </div>
            <div className='font-pixel text-[length:var(--arcade-fs-10)] text-[var(--arcade-gold-deep)]'>CLEARED {c.cleared}</div>
          </div>
          <div className='flex min-w-0 flex-[999_1_520px] flex-col gap-[18px] p-7'>
            <div className='flex flex-wrap items-baseline gap-3.5'>
              <h1 className='font-dot m-0 text-[length:var(--arcade-fs-56)] leading-none font-normal'>{c.name}</h1>
              <span className='font-pixel bg-[var(--arcade-blue-deep)] px-2 py-1.5 text-[length:var(--arcade-fs-11)] text-white'>{c.cls}</span>
              <span className='font-pixel text-sm'>LV.{c.stats.prs}</span>
            </div>
            <div className='font-pixel text-[length:var(--arcade-fs-10)] leading-relaxed text-[var(--arcade-ink-muted)]'>
              @{c.handle} · {c.role} · {c.period}
            </div>
            <div className='grid grid-cols-3 gap-3'>
              {[
                [c.stats.prs, '머지 PR', 'var(--arcade-blue-deep)'],
                [c.stats.specs, '스펙 문서', 'var(--arcade-orange-deep)'],
                [c.stats.commits, '커밋', 'var(--arcade-gold-ink)'],
              ].map(([v, label, color]) => (
                <div key={label} className='border-[3px] border-[var(--color-ink)] p-3'>
                  <div className='font-pixel text-xl' style={{ color: String(color) }}>
                    {v}
                  </div>
                  <div className='mt-1.5 text-xs'>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className='mx-auto max-w-[1120px] px-6 pb-8'>
        <div className='flex flex-col gap-3.5 border-[3px] border-[var(--color-ink)] bg-[var(--color-primary)] p-[22px] shadow-[6px_6px_0_#282A43]'>
          <div className='font-pixel text-[length:var(--arcade-fs-11)] text-[var(--arcade-gold-soft)]'>ITEMS IN USE — 지금 사용자가 쓰는 것</div>
          <div className='flex flex-wrap gap-2.5'>
            {c.shipped.map((s) => (
              <div key={s} className={`${box} px-3 py-2 text-sm font-medium`}>
                {s}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className='mx-auto flex max-w-[1120px] flex-col gap-[26px] px-6 pb-20'>
        <div className='flex flex-wrap items-center gap-3.5'>
          <div className='font-pixel bg-[var(--color-ink)] px-3.5 py-2.5 text-lg text-white'>QUEST LOG</div>
          <div className='font-dot text-[length:var(--arcade-fs-22)]'>기능 하나 = 퀘스트 하나 · 머지 PR = 달성 목표</div>
        </div>
        {c.quests.map((q, i) => (
          <div key={q.title} className={`${box} shadow-[6px_6px_0_#282A43]`}>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-[var(--color-ink)] bg-[var(--color-primary-50)] px-5 py-4'>
              <div className='flex flex-wrap items-center gap-3'>
                <div className='font-pixel text-[length:var(--arcade-fs-10)] text-[var(--arcade-blue-deep)]'>QUEST {String(i + 1).padStart(2, '0')}</div>
                <h2 className='font-dot m-0 text-2xl font-normal'>{q.title}</h2>
              </div>
              <div className='flex items-center gap-2.5'>
                <div className='text-[length:var(--arcade-fs-13)] text-[var(--arcade-ink-soft)]'>{q.when}</div>
                <div className='font-pixel border-2 border-[var(--color-ink)] bg-[var(--color-success-bg)] px-[7px] py-[5px] text-[length:var(--arcade-fs-9)] text-[var(--arcade-green-deep)]'>
                  CLEAR {q.items.length}/{q.items.length}
                </div>
              </div>
            </div>
            <p className='m-0 px-5 pt-4 pb-1.5 text-[length:var(--arcade-fs-15)] leading-relaxed text-[var(--arcade-ink-soft)]'>{q.why}</p>
            {q.image && (
              // eslint-disable-next-line @next/next/no-img-element -- 작은 정적 로고 한 장
              <img
                src={q.image}
                alt={`${q.title} 이미지`}
                className='mx-5 mt-3 h-24 w-24 border-[3px] border-[var(--color-ink)] bg-white object-contain p-2'
              />
            )}
            <div className='flex flex-col px-3 pt-1.5 pb-3'>
              {q.items.map((it) => {
                const href = itemHref(it);
                const body = (
                  <>
                    <svg
                      width='18'
                      height='18'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='var(--arcade-green-deep)'
                      strokeWidth='3'
                      aria-hidden='true'
                      className='shrink-0'
                    >
                      <rect x='3' y='3' width='18' height='18' />
                      <path d='M7 12l3 3 7-7' />
                    </svg>
                    <span
                      className={`font-pixel shrink-0 border-2 border-[var(--color-ink)] px-1.5 py-1 text-[length:var(--arcade-fs-8)] ${BADGE[it.kind]}`}
                    >
                      {it.kind}
                    </span>
                    <span className='min-w-0 grow text-sm leading-normal'>{it.title}</span>
                    <span className='font-pixel shrink-0 text-[length:var(--arcade-fs-9)] text-[var(--arcade-ink-muted)]'>
                      {it.no ? `#${it.no} ` : ''}
                      {it.date}
                    </span>
                  </>
                );
                const cls =
                  'flex min-h-11 items-center gap-3 border-b-2 border-dotted border-[var(--arcade-paper-line)] px-2 py-2.5 text-[var(--color-ink)]';
                return href ? (
                  <a key={href} href={href} target='_blank' rel='noreferrer' className={`${cls} hover:text-[var(--arcade-blue-deep)]`}>
                    {body}
                  </a>
                ) : (
                  <div key={it.title} className={cls}>
                    {body}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className='font-pixel pt-3 text-center text-sm text-[var(--arcade-blue-deep)]'>THANK YOU FOR PLAYING</div>
      </section>
    </>
  );
}

function CrewSheet({ m, locale }: { m: CrewMember; locale: string }) {
  return (
    <>
      <div className='mx-auto max-w-[1120px] px-6 pt-6'>
        <Link
          href={`/${locale}/++`}
          className='font-pixel inline-flex min-h-11 items-center text-[length:var(--arcade-fs-11)] text-[var(--color-ink)]'
        >
          ◀ SELECT
        </Link>
      </div>
      <section className='mx-auto max-w-[1120px] px-6 pt-4 pb-7'>
        <div className={`${box} flex flex-wrap shadow-[8px_8px_0_#282A43]`}>
          <div className='flex flex-[1_1_240px] flex-col items-center gap-3.5 border-[var(--color-ink)] bg-[var(--color-success-bg)] p-7 text-center sm:border-r-[3px]'>
            <div className='font-pixel border-[3px] border-[var(--color-ink)] bg-[var(--arcade-green-soft)] px-2.5 py-1.5 text-[length:var(--arcade-fs-11)]'>
              ACTIVE
            </div>
            <div className='font-dot flex size-[120px] items-center justify-center border-[3px] border-[var(--color-ink)] bg-[var(--color-primary-light)] text-[length:var(--arcade-fs-60)] shadow-[6px_6px_0_#282A43]'>
              {m.initial}
            </div>
          </div>
          <div className='flex min-w-0 flex-[999_1_480px] flex-col gap-[18px] p-7'>
            <div className='flex flex-wrap items-baseline gap-3.5'>
              <h1 className='font-dot m-0 text-[length:var(--arcade-fs-48)] leading-none font-normal'>{m.name}</h1>
              <span className='font-pixel bg-[var(--arcade-blue-deep)] px-2 py-1.5 text-[length:var(--arcade-fs-11)] text-white'>{m.cls}</span>
              {m.prs > 0 && <span className='font-pixel text-sm'>LV.{m.prs}</span>}
            </div>
            <div className='font-pixel text-[length:var(--arcade-fs-10)] leading-relaxed text-[var(--arcade-ink-muted)]'>
              @{m.handle} · {m.role}
            </div>
            <div className='text-sm text-[var(--arcade-ink-soft)]'>지금 함께 만들고 있는 크루. 졸업하면 퀘스트 로그가 채워진다.</div>
          </div>
        </div>
      </section>
      <section className='mx-auto flex max-w-[1120px] flex-col gap-4 px-6 pb-20'>
        <div className='flex flex-wrap items-center gap-3.5'>
          <div className='font-pixel bg-[var(--color-ink)] px-3.5 py-2.5 text-lg text-white'>RECENT</div>
          <div className='font-dot text-[length:var(--arcade-fs-22)]'>최근 머지 PR</div>
          <div className='font-pixel text-[length:var(--arcade-fs-9)] text-[var(--arcade-ink-muted)]'>{CREW_SNAPSHOT} 기준</div>
        </div>
        <div className={`${box} flex flex-col px-3 py-2 shadow-[6px_6px_0_#282A43]`}>
          {m.recent.length === 0 ? (
            <div className='px-2 py-4 text-sm text-[var(--arcade-ink-soft)]'>코드 밖(기획·운영)에서 함께하고 있다.</div>
          ) : (
            m.recent.map((r) => (
              <a
                key={`${r.repo}-${r.no}`}
                href={repoPrUrl(r.repo, r.no)}
                target='_blank'
                rel='noreferrer'
                className='flex min-h-11 items-center gap-3 border-b-2 border-dotted border-[var(--arcade-paper-line)] px-2 py-2.5 text-[var(--color-ink)] hover:text-[var(--arcade-blue-deep)]'
              >
                <span className='min-w-0 grow text-sm leading-normal'>{r.title}</span>
                <span className='font-pixel shrink-0 text-[length:var(--arcade-fs-9)] text-[var(--arcade-ink-muted)]'>
                  #{r.no} {r.date}
                </span>
              </a>
            ))
          )}
        </div>
      </section>
    </>
  );
}
