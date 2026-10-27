'use client';

import { PageHeader } from '@/components/ui';
import { AttendanceTrendCard } from '@/features/dashboard/components/AttendanceTrendCard';
import { CategoryCountsCard } from '@/features/dashboard/components/CategoryCountsCard';
import { CrewRegionCard } from '@/features/dashboard/components/CrewRegionCard';
import { KpiCards } from '@/features/dashboard/components/KpiCards';
import { StudyBoard } from '@/features/dashboard/components/StudyBoard';
import { formatAsOf } from '@/features/dashboard/format';
import {
  useAttendanceTrend,
  useCrewTimezones,
  useDashboardConsistency,
  useDashboardSummary,
  useStudiesByCategory,
  useStudyBoard,
  useViewerTimeZone,
} from '@/features/dashboard/queries';

/**
 * 운영 대시보드. 화면 정본은 playground 운영 콘솔 › 대시보드, 기획은 PRD `console-dashboard`,
 * 집계·API 계약은 specs/dashboard/spec.md.
 *
 * 기간 필터·자동 갱신이 없다 — 들어올 때와 새로고침할 때만 읽는다. 영역마다 따로 불러
 * 한 곳이 실패해도 나머지는 그린다. 수는 모두 서버가 센 값을 그대로 그린다.
 */
export default function Dashboard() {
  // 조회자 시간대 — 주간 집계·갱신 시각·마감 날짜가 이 시간대를 따른다. 요약·보드·추세에 같은 값을 보낸다
  const { ready, timeZone } = useViewerTimeZone();
  const summary = useDashboardSummary(timeZone, ready);
  const ongoing = useStudyBoard('ONGOING', timeZone, ready);
  const recruitment = useStudyBoard('RECRUITMENT', timeZone, ready);
  const crewTimezones = useCrewTimezones();
  const trend = useAttendanceTrend(timeZone, ready);
  const categories = useStudiesByCategory();

  useDashboardConsistency({ summary, boards: [ongoing, recruitment], trend });

  // 1-1 — 범위와 읽은 시각을 함께 적는다. 요약을 못 읽으면 범위만
  const readAt = summary.data && !summary.isError ? ` · ${formatAsOf(summary.data.asOf, summary.data.timeZone)} 갱신` : '';

  return (
    <div>
      <PageHeader title='대시보드' action={<p className='tnum type-label-sm text-fg-muted'>전기간 기준{readAt}</p>} />

      <KpiCards summary={summary} />

      <StudyBoard ongoing={ongoing} recruitment={recruitment} />

      <div className='mt-6 grid items-start gap-6 lg:grid-cols-10'>
        <div className='flex flex-col gap-6 lg:col-span-4'>
          <CrewRegionCard query={crewTimezones} />
          <AttendanceTrendCard query={trend} />
        </div>
        <div className='lg:col-span-6'>
          <CategoryCountsCard query={categories} />
        </div>
      </div>
    </div>
  );
}
