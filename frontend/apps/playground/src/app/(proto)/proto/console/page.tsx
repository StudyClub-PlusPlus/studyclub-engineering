import Link from 'next/link';

import { Card, CategoryBars, RegionDonut } from '@console/components/DashboardCharts';
import { PageHeader, TableCard } from '@console/components/ui';
import { tx, EVENT_TYPE_LABEL } from '@console/lib/l10n';
import {
  MEMBER_REGIONS,
  events,
  getStudyCrew,
  publishState,
  recruitState,
  studies,
  toISODate,
  type MemberRegion,
} from '@studyclub/mock';
import { Badge, StatCard } from '@studyclub/ui';
import { CalendarClock, EyeOff, TrendingUp, UserPlus, Users } from 'lucide-react';

// 프로토는 /proto/console 아래 매달린다.
const BASE = '/proto/console';

/**
 * 운영 대시보드.
 *
 * 지표는 **운영자가 손을 써야 하는지 알려주는 것**만 둔다. 모집중·진행중 같은 개수는 바로 아래
 * 목록이 이미 말해주므로 카드로 중복하지 않고 목록 우상단에 적는다.
 */

const TODAY = new Date().toISOString().slice(0, 10);

/** 마감 임박 기준. 이 안에 들면 이번 주에 손을 써야 한다. */
const DEADLINE_SOON_DAYS = 7;

/**
 * 승인 대기 목록에 미리 보여줄 스터디 수.
 *
 * 대시보드는 **훑는 화면**이다. 대기가 걸린 스터디를 전량 늘어놓으면 아래 지표가 스크롤 밖으로
 * 밀려 대시보드가 목록 페이지가 된다. 급한 것만 보여주고 나머지는 스터디 관리로 보낸다.
 */
const WAITING_PREVIEW = 6;

/** yyyy-mm-dd 두 개의 날짜 차이(일). */
function daysUntil(iso: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${TODAY}T00:00:00Z`)) / 86_400_000);
}

/** 전 스터디의 크루·출석을 한 번만 순회해 필요한 집계를 모두 뽑는다. */
function aggregate() {
  const regionCount: Record<MemberRegion, number> = { KR: 0, NA: 0, ETC: 0 };
  const byCategory = new Map<string, { present: number; checked: number; crew: number }>();
  // 승인 대기는 합계만으로는 처리할 수 없다 — 어느 스터디를 열어야 하는지가 같이 있어야 한다.
  const waiting: { id: string; title: string; pending: number }[] = [];
  let activeCrew = 0;
  let present = 0;
  let checked = 0;

  for (const study of studies) {
    const { crew, attendance } = getStudyCrew(study);
    const active = crew.filter((c) => c.status === 'active');
    const pending = crew.filter((c) => c.status === 'pending').length;
    if (pending > 0) waiting.push({ id: study.id, title: tx(study.title), pending });
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
    // 대기 인원이 많은 스터디부터 — 먼저 열어야 할 순서다
    waiting: waiting.sort((a, b) => b.pending - a.pending),
    pendingTotal: waiting.reduce((sum, w) => sum + w.pending, 0),
  };
}

export default function Dashboard() {
  const { activeCrew, avgRate, regions, categories, waiting, pendingTotal } = aggregate();
  const recruiting = studies
    .filter((s) => recruitState(s) === 'apply')
    .map((s) => {
      const deadline = toISODate(s.recruitment?.deadline);
      return { study: s, deadline, dday: deadline ? daysUntil(deadline) : undefined };
    })
    // 마감이 가까운 것부터. 상시 모집(마감일 없음)은 급할 게 없으므로 끝으로.
    .sort((a, b) => (a.dday ?? 9999) - (b.dday ?? 9999));
  const closingSoon = recruiting.filter((r) => r.dday !== undefined && r.dday <= DEADLINE_SOON_DAYS).length;
  // 공개일이 아직 오지 않아 사용자 사이트에 안 보이는 스터디
  const scheduled = studies.filter((s) => publishState(s) === 'scheduled');
  const upcoming = events
    .filter((e) => e.date >= TODAY)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  // 카드는 **손을 써야 하는지 알려주는 것**만 둔다. 개수는 아래 목록이 이미 말한다.
  const stats = [
    {
      label: '승인 대기',
      value: pendingTotal.toLocaleString(),
      sub: pendingTotal === 0 ? '처리할 신청 없음' : `${waiting.length}개 스터디`,
      href: `${BASE}/studies`,
      icon: UserPlus,
      alert: pendingTotal > 0,
    },
    {
      label: '마감 임박 모집',
      value: closingSoon.toLocaleString(),
      sub: `${DEADLINE_SOON_DAYS}일 이내 마감`,
      href: `${BASE}/studies`,
      icon: CalendarClock,
      alert: closingSoon > 0,
    },
    {
      label: '활성 크루',
      value: activeCrew.toLocaleString(),
      sub: '진행 중 스터디 기준',
      href: `${BASE}/users`,
      icon: Users,
      alert: false,
    },
    {
      label: '평균 출석률',
      value: `${avgRate}%`,
      sub: '전 스터디 · 지각 포함',
      href: `${BASE}/studies`,
      icon: TrendingUp,
      alert: false,
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
              className={`h-full transition-[border-color,box-shadow] duration-fast ease-out group-hover:border-border-strong group-hover:shadow-sm ${
                s.alert ? 'border-warning-300 bg-warning-50' : ''
              }`}
            />
          </Link>
        ))}
      </div>

      {/* 손을 써야 하는 일이 있으면 지표 바로 아래에 놓는다. 아래로 밀면 스크롤 밖으로 나간다. */}
      {(waiting.length > 0 || scheduled.length > 0) && (
        <div className='mt-6 grid items-start gap-6 lg:grid-cols-2'>
          {waiting.length > 0 && (
            <section>
              <div className='mb-3 flex items-baseline justify-between gap-3'>
                <h2 className='text-base font-bold'>
                  승인 대기
                  <span className='tnum ml-2 text-[13px] font-medium text-warning-700'>{pendingTotal}</span>
                </h2>
                <Link href={`${BASE}/studies`} className='text-xs font-medium text-brand'>
                  전체 보기
                </Link>
              </div>
              <TableCard>
                <thead>
                  <tr>
                    <th>스터디</th>
                    <th className='whitespace-nowrap text-right'>대기</th>
                  </tr>
                </thead>
                <tbody>
                  {waiting.slice(0, WAITING_PREVIEW).map((w) => (
                    <tr key={w.id}>
                      <td className='max-w-0 truncate font-semibold'>
                        <Link
                          href={`${BASE}/studies/${w.id}`}
                          className='underline-offset-4 hover:text-brand hover:underline'
                        >
                          {w.title}
                        </Link>
                      </td>
                      <td className='tnum whitespace-nowrap text-right font-bold text-warning-700'>{w.pending}</td>
                    </tr>
                  ))}
                  {waiting.length > WAITING_PREVIEW && (
                    <tr>
                      <td colSpan={2} className='text-center text-xs text-fg-muted'>
                        외 {waiting.length - WAITING_PREVIEW}개 스터디
                      </td>
                    </tr>
                  )}
                </tbody>
              </TableCard>
            </section>
          )}

          {/* 공개일이 안 왔다 = 사용자 사이트에서 아직 안 보인다. 운영자가 착각하기 쉬운 지점이다. */}
          {scheduled.length > 0 && (
            <section>
              <div className='mb-3 flex items-baseline justify-between gap-3'>
                <h2 className='flex items-center gap-1.5 text-base font-bold'>
                  <EyeOff size={15} className='text-fg-muted' />
                  공개 예정
                  <span className='tnum text-[13px] font-medium text-fg-muted'>{scheduled.length}</span>
                </h2>
              </div>
              <TableCard>
                <thead>
                  <tr>
                    <th>스터디</th>
                    <th className='whitespace-nowrap'>공개일</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduled.map((s) => (
                    <tr key={s.id}>
                      <td className='max-w-0 truncate font-semibold'>
                        <Link
                          href={`${BASE}/studies/${s.id}`}
                          className='underline-offset-4 hover:text-brand hover:underline'
                        >
                          {tx(s.title)}
                        </Link>
                      </td>
                      <td className='tnum whitespace-nowrap text-fg-secondary'>{toISODate(s.publish_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            </section>
          )}
        </div>
      )}

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
            <Link href='/proto/console/studies' className='text-xs font-medium text-brand'>
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
              {recruiting.map(({ study, deadline, dday }) => (
                <tr key={study.id}>
                  <td className='max-w-0 truncate font-semibold'>
                    <Link
                      href={`${BASE}/studies/${study.id}`}
                      className='underline-offset-4 hover:text-brand hover:underline'
                    >
                      {tx(study.title)}
                    </Link>
                  </td>
                  <td className='whitespace-nowrap'>
                    {deadline === undefined ? (
                      <span className='text-fg-muted'>상시</span>
                    ) : (
                      <span className='flex items-center gap-2'>
                        <span className='tnum text-fg-secondary'>~{deadline}</span>
                        {/* 날짜만으로는 급한지 알 수 없다. 남은 일수를 같이 적는다 */}
                        {dday !== undefined && dday <= DEADLINE_SOON_DAYS && (
                          <Badge tone='closingsoon' className='px-2 py-0.5 text-[11px] font-bold'>
                            {dday === 0 ? '오늘 마감' : `D-${dday}`}
                          </Badge>
                        )}
                      </span>
                    )}
                  </td>
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
              <span className='tnum ml-2 text-[13px] font-medium text-fg-muted'>{upcoming.length}</span>
            </h2>
            <Link href='/proto/console/events' className='text-xs font-medium text-brand'>
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
