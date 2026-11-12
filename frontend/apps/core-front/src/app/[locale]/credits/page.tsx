import Link from 'next/link';

import { CREW, CREW_SNAPSHOT, LEGENDS, type Contributor, type CrewMember } from '@/features/credits/data';

const box = 'border-[3px] border-[#282A43] bg-white';
const STAT_MAX = { prs: 15, specs: 6, commits: 80 };

function Stat({ label, v, max, color }: { label: string; v: number; max: number; color: string }) {
  return (
    <div className='flex items-center gap-2.5'>
      <div className='font-pixel w-[52px] shrink-0 text-[9px]'>{label}</div>
      <div className='h-3.5 grow border-2 border-[#282A43] bg-[#EFE7D6]'>
        <div
          className='h-full'
          style={{ width: `${Math.max(4, Math.round((Math.min(v, max) / max) * 100))}%`, background: color }}
        />
      </div>
      <div className='font-pixel w-7 text-right text-[10px]'>{v}</div>
    </div>
  );
}

function HeroCard({ c, locale }: { c: Contributor; locale: string }) {
  return (
    <Link
      href={`/${locale}/++/${c.handle}`}
      className={`${box} flex flex-col text-[#282A43] shadow-[8px_8px_0_#F4B740,8px_8px_0_3px_#282A43] transition-transform hover:-translate-y-1`}
    >
      <div className='flex items-center justify-between border-b-[3px] border-[#282A43] bg-[#FFF3D1] px-4 py-2.5'>
        <div className='font-pixel text-[10px] text-[#6E4E00]'>LEGEND</div>
        <div className='font-pixel text-[10px]'>LV.{c.stats.prs}</div>
      </div>
      <div className='flex flex-col gap-4 p-5'>
        <div className='flex items-center gap-4'>
          <div className='font-dot flex size-[72px] shrink-0 items-center justify-center border-[3px] border-[#282A43] bg-[#FFE9E2] text-[34px]'>
            {c.initial}
          </div>
          <div className='flex min-w-0 flex-col gap-1.5'>
            <div className='font-dot text-[28px] leading-none'>{c.name}</div>
            <div className='flex flex-wrap items-center gap-1.5'>
              <span className='font-pixel bg-[#3A4BB0] px-[7px] py-[5px] text-[9px] text-white'>{c.cls}</span>
              <span className='text-[13px] text-[#4A4C63]'>{c.role}</span>
            </div>
            <div className='font-pixel text-[9px] text-[#5A5C70]'>@{c.handle}</div>
          </div>
        </div>
        <div className='flex flex-col gap-2'>
          <Stat label='PR' v={c.stats.prs} max={STAT_MAX.prs} color='#5267D8' />
          <Stat label='SPEC' v={c.stats.specs} max={STAT_MAX.specs} color='#FF805C' />
          <Stat label='COMMIT' v={c.stats.commits} max={STAT_MAX.commits} color='#F4B740' />
        </div>
        <div className='text-[13px] text-[#4A4C63]'>{c.period}</div>
        <div className='flex flex-col gap-2 border-t-[3px] border-dotted border-[#D8CDB4] pt-3.5'>
          <div className='font-pixel text-[9px] text-[#3A4BB0]'>LOOT</div>
          {c.loot.map((w) => (
            <div key={w} className='flex gap-2.5 text-sm leading-normal'>
              <span className='font-pixel text-[10px] leading-[21px] text-[#C2410C]'>+</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
        <div className='font-pixel text-[10px] text-[#3A4BB0]'>▶ 퀘스트 로그 보기</div>
      </div>
    </Link>
  );
}

function CrewCard({ c, locale }: { c: CrewMember; locale: string }) {
  return (
    <Link
      href={`/${locale}/++/${c.handle}`}
      className={`${box} flex flex-col gap-3 p-4 text-[#282A43] shadow-[4px_4px_0_#282A43] transition-transform hover:-translate-y-0.5`}
    >
      <div className='flex items-center gap-3'>
        <div className='font-dot flex size-12 shrink-0 items-center justify-center border-[3px] border-[#282A43] bg-[#E9ECFF] text-2xl'>
          {c.initial}
        </div>
        <div className='flex min-w-0 flex-col gap-1'>
          <div className='flex items-center gap-2'>
            <span className='font-dot text-xl leading-none'>{c.name}</span>
            <span className='font-pixel border-2 border-[#282A43] bg-[#E6F4EC] px-1.5 py-1 text-[8px] text-[#1F5A3A]'>
              ACTIVE
            </span>
          </div>
          <div className='flex flex-wrap items-center gap-1.5'>
            <span className='font-pixel bg-[#3A4BB0] px-1.5 py-1 text-[8px] text-white'>{c.cls}</span>
            <span className='text-xs text-[#4A4C63]'>{c.role}</span>
          </div>
        </div>
        {c.prs > 0 && <div className='font-pixel ml-auto shrink-0 text-[10px]'>LV.{c.prs}</div>}
      </div>
      {c.recent.length > 0 && (
        <div className='flex flex-col gap-1.5 border-t-2 border-dotted border-[#D8CDB4] pt-2.5'>
          {c.recent.map((r) => (
            <div key={`${r.repo}-${r.no}`} className='flex gap-2 text-[13px] leading-snug'>
              <span className='font-pixel text-[9px] leading-[19px] text-[#C2410C]'>+</span>
              <span className='line-clamp-1'>{r.title}</span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

export default async function CreditsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const totalPrs = LEGENDS.reduce((n, c) => n + c.stats.prs, 0) + CREW.reduce((n, c) => n + c.prs, 0);
  return (
    <>
      <section className='mx-auto flex max-w-[1120px] flex-col items-center gap-5 px-6 pt-16 pb-8 text-center'>
        <div className='font-pixel bg-[#282A43] px-3.5 py-2 text-[13px] text-white'>SECRET STAGE UNLOCKED</div>
        <h1 className='font-dot m-0 text-[40px] leading-tight font-normal sm:text-[60px]'>스터디클럽을 만든 사람들</h1>
        <div className='font-pixel text-sm text-[#3A4BB0]'>
          SELECT YOUR HERO<span className='credits-blink'>_</span>
        </div>
        <div className='mt-2 flex flex-wrap justify-center gap-3.5'>
          {[
            [LEGENDS.length, 'LEGEND · 졸업', '#9A6A00'],
            [CREW.length, 'ACTIVE · 크루', '#1F5A3A'],
            [totalPrs, '머지 PR', '#3A4BB0'],
          ].map(([v, label, color]) => (
            <div key={label} className={`${box} min-w-[120px] px-[18px] py-3 shadow-[4px_4px_0_#282A43]`}>
              <div className='font-pixel text-[22px]' style={{ color: String(color) }}>
                {v}
              </div>
              <div className='mt-1.5 text-[13px]'>{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className='mx-auto flex max-w-[1120px] flex-col gap-[22px] px-6 pb-14'>
        <div className='flex flex-wrap items-center gap-3.5'>
          <div className='font-pixel border-[3px] border-[#282A43] bg-[#F4B740] px-3.5 py-2.5 text-lg shadow-[4px_4px_0_#282A43]'>
            HALL OF FAME
          </div>
          <div className='font-dot text-[22px]'>졸업 멤버 — 떠났지만 만든 것은 남는다</div>
        </div>
        <div className='grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-[26px]'>
          {LEGENDS.map((c) => (
            <HeroCard key={c.handle} c={c} locale={locale} />
          ))}
        </div>
      </section>

      <section className='mx-auto flex max-w-[1120px] flex-col gap-[22px] px-6 pb-14'>
        <div className='flex flex-wrap items-center gap-3.5'>
          <div className='font-pixel border-[3px] border-[#282A43] bg-[#9FD8B5] px-3.5 py-2.5 text-lg shadow-[4px_4px_0_#282A43]'>
            PARTY
          </div>
          <div className='font-dot text-[22px]'>함께하는 크루</div>
          <div className='font-pixel text-[9px] text-[#5A5C70]'>머지 PR {CREW_SNAPSHOT} 기준</div>
        </div>
        <div className='grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-[18px]'>
          {CREW.map((c) => (
            <CrewCard key={c.handle} c={c} locale={locale} />
          ))}
        </div>
      </section>

      <section className='mx-auto max-w-[1120px] px-6 pb-[72px]'>
        <div
          className={`${box} grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6 p-6 shadow-[6px_6px_0_#282A43]`}
        >
          <div className='flex flex-col gap-2.5'>
            <div className='font-pixel text-xs'>ENTRY RULE</div>
            <div className='font-dot text-[22px]'>3개월 이상 함께하고, 남긴 것이 있는 사람</div>
            <div className='text-sm leading-relaxed text-[#4A4C63]'>
              머지 PR·스펙·디자인처럼 결과물로 남은 활동이 있어야 실린다. 운영진이 판정하고 본인 동의를 받는다. 빼고
              싶으면 운영진에게.
            </div>
          </div>
          <div className='flex flex-col gap-2.5'>
            <div className='font-pixel text-xs'>LEGEND</div>
            <div className='grid grid-cols-2 gap-2 text-[13px]'>
              {[
                ['WARRIOR', '백엔드'],
                ['ARCHER', '프론트'],
                ['MAGE', '디자인'],
                ['BARD', '기획·운영'],
                ['ENGINEER', '인프라·디바이스'],
                ['LV', '머지 PR 수'],
                ['ACTIVE', '지금 크루'],
              ].map(([k, v]) => (
                <div key={k}>
                  <b className='font-pixel text-[9px]'>{k}</b> {v}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
