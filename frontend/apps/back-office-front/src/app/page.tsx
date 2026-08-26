import Link from 'next/link';

import {
  MEMBER_REGIONS,
  events,
  getStudyCrew,
  recruitState,
  site,
  studies,
  toISODate,
  type MemberRegion,
} from '@studyclub/mock';
import { StatCard } from '@studyclub/ui';
import { BookOpen, CalendarDays, TrendingUp, Users } from 'lucide-react';

import { Card, CategoryBars, RegionDonut } from '@/components/DashboardCharts';
import { PageHeader, TableCard } from '@/components/ui';
import { tx, EVENT_TYPE_LABEL } from '@/lib/l10n';

/**
 * 운영 대시보드.
 *
 * 지표는 **운영자가 손을 써야 하는지 알려주는 것**만 둔다. 모집중·진행중 같은 개수는 바로 아래
 * 목록이 이미 말해주므로 카드로 중복하지 않고 목록 우상단에 적는다.
 */

const TODAY = new Date().toISOString().slice(0, 10);

/** 전 스터디의 크루·출석을 한 번만 순회해 필요한 집계를 모두 뽑는다. */
function aggregate() {
  const regionCount: Record<MemberRegion, number> = { KR: 0, NA: 0, ETC: 0 };
  const byCategory = new Map<string, { present: number; checked: number; crew: number }>();
  let activeCrew = 0;
  let present = 0;
  let checked = 0;

  for (const study of studies) {
    const { crew, attendance } = getStudyCrew(study);
    const active = crew.filter((c) => c.status === 'active');
    // 진행 중이 아닌 스터디의 크루는 "지금 참가 중"이 아니다
    const running = study.status !== 'closed';
    const category = study.category ?? '기타';
    const bucket = byCategory.get(category) ?? { present: 0, checked: 0, crew: 0 };

    for (const c of active) {
      bucket.crew += 1;
      if (running) {
        activeCrew += 1;
        regionCount[c.region] += 1;
      }
      for (const v of Object.values(attendance[c.id] ?? {})) {
        checked += 1;
        bucket.checked += 1;
        // 지각도 참석으로 센다 — 출석부의 출석률과 같은 기준
        if (v !== 'absent') {
          present += 1;
          bucket.present += 1;
        }
      }
    }
    byCategory.set(category, bucket);
  }

  const categories = [...byCategory.entries()]
    .filter(([, v]) => v.checked > 0)
    .map(([category, v]) => ({
      category,
      rate: Math.round((v.present / v.checked) * 100),
      crew: v.crew,
    }))
    .sort((a, b) => b.rate - a.rate);

  return {
    activeCrew,
    avgRate: checked === 0 ? 0 : Math.round((present / checked) * 100),
    regions: MEMBER_REGIONS.map((r) => ({ key: r.key, count: regionCount[r.key] })),
    categories,
  };
}

export default function Dashboard() {
  const { activeCrew, avgRate, regions, categories } = aggregate();
  const runningStudies = studies.filter((s) => s.status !== 'closed').length;
  const recruiting = studies.filter((s) => recruitState(s) === 'apply');
  const upcoming = events
    .filter((e) => e.date >= TODAY)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const stats = [
    {
      label: '활성 크루',
      value: activeCrew.toLocaleString(),
      sub: '진행 중 스터디 기준',
      href: '/studies',
      icon: Users,
    },
    {
      label: '평균 출석률',
      value: `${avgRate}%`,
      sub: '전 스터디 · 지각 포함',
      href: '/studies',
      icon: TrendingUp,
    },
    // 활성 크루와 **같은 집합**을 센다(종료되지 않은 스터디). 기준이 다르면 두 숫자가 서로 안 맞는다.
    {
      label: '진행 중 스터디',
      value: runningStudies,
      sub: '종료 제외',
      href: '/studies',
      icon: BookOpen,
    },
    {
      label: '커뮤니티 멤버',
      value: site.community.member_count.toLocaleString(),
      sub: tx(site.community.region),
      href: '/users',
      icon: CalendarDays,
    },
  ];

  return (
    <div>
      <PageHeader title='대시보드' />

      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className='group'>
            <StatCard
              label={s.label}
              value={s.value}
              sub={s.sub}
              leadingIcon={<s.icon size={15} />}
              className='h-full transition-[border-color,box-shadow] duration-fast ease-out group-hover:border-border-strong group-hover:shadow-sm'
            />
          </Link>
        ))}
      </div>

      <div className='mt-6 grid items-start gap-6 lg:grid-cols-2'>
        <Card title='크루 지역 분포'>
          <RegionDonut data={regions} />
        </Card>
        <Card title='카테고리별 출석률'>
          <CategoryBars data={categories} />
        </Card>
      </div>

      <div className='mt-6 grid gap-6 lg:grid-cols-2'>
        <section>
          <div className='mb-3 flex items-baseline justify-between gap-3'>
            <h2 className='text-base font-bold'>
              모집중 스터디
              <span className='tnum ml-2 text-[13px] font-medium text-fg-muted'>{recruiting.length}</span>
            </h2>
            <Link href='/studies' className='text-xs font-medium text-brand'>
              전체 보기
            </Link>
          </div>
          <TableCard>
            <thead>
              <tr>
                <th>스터디</th>
                <th className='whitespace-nowrap'>모집 마감</th>
              </tr>
            </thead>
            <tbody>
              {recruiting.map((s) => {
                const deadline = toISODate(s.recruitment?.deadline);
                return (
                  <tr key={s.id}>
                    <td className='max-w-0 truncate font-semibold'>
                      <Link href={`/studies/${s.id}`} className='underline-offset-4 hover:text-brand hover:underline'>
                        {tx(s.title)}
                      </Link>
                    </td>
                    <td className='tnum whitespace-nowrap text-fg-secondary'>{deadline ? `~${deadline}` : '상시'}</td>
                  </tr>
                );
              })}
              {recruiting.length === 0 && (
                <tr>
                  <td colSpan={2} className='text-center text-fg-muted'>
                    모집중 스터디가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </TableCard>
        </section>

        <section>
          <div className='mb-3 flex items-baseline justify-between gap-3'>
            <h2 className='text-base font-bold'>
              다가오는 행사
              <span className='tnum ml-2 text-[13px] font-medium text-fg-muted'>{upcoming.length}</span>
            </h2>
            <Link href='/events' className='text-xs font-medium text-brand'>
              전체 보기
            </Link>
          </div>
          <TableCard>
            <thead>
              <tr>
                <th>행사</th>
                <th className='whitespace-nowrap'>타입</th>
                <th className='whitespace-nowrap'>날짜</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((e) => (
                <tr key={e.id}>
                  <td className='max-w-0 truncate font-semibold'>{tx(e.title)}</td>
                  <td className='whitespace-nowrap text-fg-secondary'>{EVENT_TYPE_LABEL[e.type] ?? e.type}</td>
                  <td className='tnum whitespace-nowrap text-fg-secondary'>{e.date}</td>
                </tr>
              ))}
              {upcoming.length === 0 && (
                <tr>
                  <td colSpan={3} className='text-center text-fg-muted'>
                    예정된 행사가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </TableCard>
        </section>
      </div>
    </div>
  );
}
