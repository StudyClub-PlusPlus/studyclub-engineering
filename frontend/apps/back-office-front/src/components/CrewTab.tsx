'use client';

import { MEMBER_REGIONS, type Crew } from '@studyclub/mock';

import { TableCard } from '@/components/ui';

function regionLabel(key: Crew['region']) {
  return MEMBER_REGIONS.find((r) => r.key === key)?.label.ko ?? key;
}

function Completion({ crew }: { crew: Crew }) {
  if (crew.completionRate === undefined) {
    return <span className='text-fg-muted'>첫 참여</span>;
  }
  const tone =
    crew.completionRate >= 80 ? 'text-success-700' : crew.completionRate >= 60 ? 'text-fg' : 'text-warning-700';
  return (
    <span className='tnum'>
      <span className={`font-bold ${tone}`}>{crew.completionRate}%</span>
      <span className='ml-1 text-xs text-fg-muted'>({crew.pastStudies}회)</span>
    </span>
  );
}

export function CrewTab({ crew, capacity }: { crew: Crew[]; capacity: number }) {
  return (
    <div className='flex flex-col gap-6'>
      <section>
        <h2 className='flex items-baseline gap-2 text-[15px] font-bold'>
          참여 크루
          <span className='tnum text-[13px] font-medium text-fg-muted'>
            {crew.length}/{capacity}
          </span>
        </h2>
        <div className='mt-2'>
          <TableCard>
            <thead>
              <tr>
                <th className='whitespace-nowrap'>이름</th>
                <th>이메일</th>
                <th className='whitespace-nowrap'>지역</th>
                <th className='whitespace-nowrap'>완주율</th>
                <th className='whitespace-nowrap'>신청일</th>
              </tr>
            </thead>
            <tbody>
              {crew.map((c) => (
                <tr key={c.id}>
                  <td className='whitespace-nowrap font-semibold'>{c.name}</td>
                  <td className='whitespace-nowrap text-fg-secondary'>{c.email}</td>
                  <td className='whitespace-nowrap text-fg-secondary'>{regionLabel(c.region)}</td>
                  <td className='whitespace-nowrap'>
                    <Completion crew={c} />
                  </td>
                  <td className='tnum whitespace-nowrap text-xs text-fg-muted'>{c.appliedAt}</td>
                </tr>
              ))}
              {crew.length === 0 && (
                <tr>
                  <td colSpan={5} className='text-center text-fg-muted'>
                    신청한 크루가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </TableCard>
        </div>
      </section>
    </div>
  );
}
