'use client';

import { cohortTitle, type ClubConfig, type Month, type PastCohort } from '@console/lib/clubs';
import { Button } from '@studyclub/ui';

/**
 * 지난 기수 — 클럽은 매달 기수가 끝난다. 달마다 몇 명이 시작해 몇 명이 끝까지 남고 다음 달로 이어졌는지 본다.
 * TODO(api): GET /api/admin/clubs/{programId}/cohorts — 끝난 기수 집계, 최신 순
 */
export function ClubPastCohorts({
  club,
  cohorts,
  onOpenBook,
}: {
  club: ClubConfig;
  cohorts: PastCohort[];
  /** 그 달 출석부를 연다 */
  onOpenBook: (m: Month) => void;
}) {
  return (
    <section className='mt-8'>
      <h2 data-anno='cohort:4' className='mb-3 type-title-md text-fg'>
        지난 기수
      </h2>
      <div className='card overflow-x-auto'>
        <table className='w-full border-separate border-spacing-0 type-body-sm'>
          <thead>
            <tr className='bg-surface-1 text-left type-label-sm text-fg-muted'>
              <th className='px-4 py-2'>기수</th>
              <th data-anno='cohort:4-1' className='px-2 py-2 text-right'>
                시작
              </th>
              <th data-anno='cohort:4-2' className='px-2 py-2 text-right'>
                완주
              </th>
              <th data-anno='cohort:4-3' className='px-2 py-2 text-right'>
                참여 중단
              </th>
              <th data-anno='cohort:4-4' className='px-2 py-2 text-right'>
                다음 달로 이어짐
              </th>
              <th data-anno='cohort:4-5' className='px-2 py-2 text-right'>
                평균 출석률
              </th>
              <th className='px-4 py-2'>
                <span className='sr-only'>출석부</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c, i) => (
              <tr key={`${c.month.year}-${c.month.month}`}>
                <td className='border-t border-border px-4 py-2 type-label-lg text-fg'>{cohortTitle(club, c.month)}</td>
                <td className='tnum border-t border-border px-2 py-2 text-right'>{c.members}명</td>
                <td className='tnum border-t border-border px-2 py-2 text-right'>{c.completed}명</td>
                <td className='tnum border-t border-border px-2 py-2 text-right'>{c.withdrawn}명</td>
                <td className='tnum border-t border-border px-2 py-2 text-right'>
                  {c.carried}명 <span className='text-fg-muted'>({Math.round((c.carried / c.completed) * 100)}%)</span>
                </td>
                <td className='tnum border-t border-border px-2 py-2 text-right'>{c.rate}%</td>
                <td className='border-t border-border px-4 py-2 text-right'>
                  <Button
                    data-anno={i === 0 ? 'cohort:4-6' : undefined}
                    size='sm'
                    variant='tertiary'
                    onClick={() => onOpenBook(c.month)}
                  >
                    출석부
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
