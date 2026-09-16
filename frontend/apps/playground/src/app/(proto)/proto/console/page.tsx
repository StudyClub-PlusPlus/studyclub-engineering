import { AttendanceTrend, Card, CategoryStudyCard, RegionDonut } from '@console/components/DashboardCharts';
import { KpiCard } from '@console/components/KpiCard';
import { StudyStatusBoard } from '@console/components/StudyStatusBoard';
import { aggregate } from '@console/lib/dashboard';
import { tx } from '@console/lib/l10n';
import { events, todayISO } from '@studyclub/mock';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

// 프로토는 /proto/console 아래 매달린다.
const BASE = '/proto/console';

/**
 * 운영 대시보드 — 현황 모니터링.
 *
 * 기간 필터를 두지 않는다. 운영자가 오는 이유는 「지금 손을 써야 하는 일이 있는가」라서,
 * 기간을 고르는 순간 그 질문이 「어느 기간을 볼까」로 바뀐다. 추세 차트만 최근 12주를 본다.
 *
 * 스터디 목록은 **현황 보드 한 곳에만** 둔다. 같은 목록이 화면에 두 번 나오면 어느 쪽이
 * 최신인지 매번 확인하게 된다.
 */
export default function Dashboard() {
  const { updatedAt, kpi, board, regions, categories, trend } = aggregate();
  const upcoming = events
    .filter((e) => e.date >= todayISO())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ id: e.id, title: tx(e.title), date: e.date }));

  return (
    <div>
      <ScreenSpecRegistrar spec={SPEC} />
      <header data-anno='1' className='mb-5 flex flex-wrap items-baseline justify-between gap-2'>
        <h1 className='text-2xl font-extrabold tracking-tight'>대시보드</h1>
        <p data-anno='1-1' className='tnum text-xs text-fg-muted'>
          전기간 기준 · {updatedAt} 갱신
        </p>
      </header>

      <div data-anno='2' className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <KpiCard
          anno='2-1'
          label='활성 크루'
          value={kpi.activeCrew.toLocaleString()}
          sub='진행 중 스터디 기준'
          href={`${BASE}/users`}
        />
        <KpiCard
          anno='2-2'
          label='평균 출석률'
          value={`${kpi.attendanceRate}%`}
          sub='전 스터디 · 지각 포함'
          delta={kpi.rateDelta}
          deltaUnit='%p'
        />
        <KpiCard
          anno='2-3'
          label='크루 1인당 참여 스터디'
          value={`${kpi.studiesPerCrew}개`}
          sub='진행 중 스터디 기준'
        />
        <KpiCard
          anno='2-4'
          label='커뮤니티 멤버'
          value={kpi.communityMembers.toLocaleString()}
          sub={kpi.communityRegion}
          href={`${BASE}/users`}
        />
      </div>

      <StudyStatusBoard ongoing={board.ongoing} recruiting={board.recruiting} events={upcoming} />

      <div className='mt-6 grid items-start gap-6 lg:grid-cols-10'>
        <div className='flex flex-col gap-6 lg:col-span-4'>
          <Card title='크루 지역 분포' anno='4'>
            <RegionDonut data={regions} />
          </Card>
          <Card title='평균 출석률 추세' anno='5'>
            <AttendanceTrend points={trend} />
          </Card>
        </div>
        <div className='lg:col-span-6'>
          <CategoryStudyCard data={categories} />
        </div>
      </div>
    </div>
  );
}
