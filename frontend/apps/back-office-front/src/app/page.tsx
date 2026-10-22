'use client';

import Link from 'next/link';

import { site, type StudyclubEvent } from '@studyclub/mock';
import { StatCard } from '@studyclub/ui';
import { BookOpen, CalendarDays } from 'lucide-react';

import { Card } from '@/components/DashboardCharts';
import { PageHeader, TableCard } from '@/components/ui';
import { useStudies } from '@/features/studies/queries';
import type { StudyRow } from '@/features/studies/types';
import { EVENT_TYPE_LABEL, tx } from '@/lib/l10n';

/**
 * 운영 대시보드.
 *
 * 지표는 **운영자가 손을 써야 하는지 알려주는 것**만 둔다. 모집중·진행중 같은 개수는 바로 아래
 * 목록이 이미 말해주므로 카드로 중복하지 않고 목록 우상단에 적는다.
 *
 * 활성 크루·출석률·분류별 출석률·거주지 분포는 집계 API 가 없어 준비 중으로 둔다 — 예전에는
 * 예시 크루·출석으로 숫자를 만들었는데 실데이터와 섞여 보여서 걷어냈다.
 * TODO(api): GET /api/admin/dashboard — specs/dashboard/spec.md
 */

function Pending() {
  return <p className='py-10 text-center text-sm text-fg-muted'>준비 중입니다.</p>;
}

export default function Dashboard() {
  const { data: studyPage } = useStudies({});
  const studyRows: StudyRow[] = studyPage?.rows ?? [];
  const upcoming: StudyclubEvent[] = [];

  const runningStudies = studyRows.filter((s) => s.phase !== 'CLOSED').length;
  const recruiting = studyRows.filter((s) => s.recruiting || s.phase === 'RECRUITING');
  const stats = [
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

      <div className='grid gap-3 sm:grid-cols-2'>
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className='group'>
            <StatCard
              label={s.label}
              value={s.value}
              sub={s.sub}
              leadingIcon={<s.icon size={15} />}
              className='h-full transition-[border-color,box-shadow] duration-fast ease-out group-hover:border-border-interactive group-hover:shadow-sm'
            />
          </Link>
        ))}
      </div>

      {/* 출석 지표: 분류별 출석률(막대) + 거주지 분포(도넛). 같은 높이로 나란히 둔다 */}
      <div className='mt-6 grid gap-4 lg:grid-cols-2'>
        <Card title='분류별 평균 출석률'>
          <Pending />
        </Card>
        <Card title='크루 거주지 분포'>
          <Pending />
        </Card>
      </div>

      <div className='mt-6'>
        <section>
          <div className='mb-3 flex items-baseline justify-between gap-3'>
            <h2 className='text-base font-bold'>
              모집중 스터디
              <span className='tnum ml-2 text-sm font-medium text-fg-muted'>{recruiting.length}</span>
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
              {recruiting.map((s) => (
                <tr key={s.studyId}>
                  <td className='max-w-0 truncate font-semibold'>
                    <Link
                      href={`/studies/${s.studyId}`}
                      className='underline-offset-4 hover:text-brand hover:underline'
                    >
                      {s.title}
                    </Link>
                  </td>
                  <td className='tnum whitespace-nowrap text-fg-secondary'>{s.deadline ? `~${s.deadline}` : '상시'}</td>
                </tr>
              ))}
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
              <span className='tnum ml-2 text-sm font-medium text-fg-muted'>{upcoming.length}</span>
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
