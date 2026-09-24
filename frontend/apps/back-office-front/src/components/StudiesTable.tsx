'use client';

import { Badge } from '@studyclub/ui';

import { TableCard } from '@/components/ui';
import { PHASE_LABEL, type StudyRow } from '@/lib/studies';

/**
 * 스터디 관리 목록.
 *
 * **칼럼은 API 가 실제로 주는 값으로만 짠다.** 운영자가 보는 숫자가 추정값이면 그걸 믿고 내린 판단이
 * 전부 틀어진다 — 예전엔 목 데이터로 크루 수·출석률을 지어내 보여줬다. 지금은 안 준다.
 *
 * 정렬·필터·페이지는 서버가 한다({@link /api/studies}). 화면에서 다시 거르지 않는다 —
 * 두 곳이 계산하면 "목록에는 모집중인데 상세는 마감"처럼 어긋난다.
 *
 * 행에 편집·삭제 버튼을 두지 않는다. 이름을 누르면 운영 페이지로 들어가고 거기서 처리한다.
 */
export function StudiesTable({
  rows,
  detailSlugs,
}: {
  rows: StudyRow[];
  /** 운영 페이지가 있는 슬러그. 아직 목 데이터 기반이라 API 스터디는 상세가 없을 수 있다. */
  detailSlugs?: ReadonlySet<string>;
}) {
  return (
    <TableCard>
      <thead>
        <tr>
          <th>스터디</th>
          <th className='whitespace-nowrap'>카테고리</th>
          <th className='whitespace-nowrap'>단계</th>
          <th className='whitespace-nowrap'>모집 마감</th>
          <th className='whitespace-nowrap'>신청</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => {
          const hasDetail = detailSlugs?.has(s.slug) ?? false;
          return (
            <tr key={s.studyId}>
              <td className='w-[44%] max-w-0'>
                {hasDetail ? (
                  <a
                    href={`/studies/${s.slug}`}
                    className='block truncate font-semibold underline-offset-4 hover:text-brand hover:underline'
                  >
                    {s.title}
                  </a>
                ) : (
                  // 상세가 없는데 링크를 걸면 눌렀을 때 404 다. 왜 못 누르는지 제목으로 알려준다.
                  <span className='block truncate font-semibold' title='운영 페이지 준비 중'>
                    {s.title}
                  </span>
                )}
                <span className='block truncate text-xs text-fg-muted'>{s.summary}</span>
              </td>
              <td className='whitespace-nowrap text-fg-secondary'>{s.category}</td>
              <td>
                <Badge tone={s.recruiting ? 'recruiting' : 'closed'} dot className='px-2.5 py-1 font-semibold'>
                  {PHASE_LABEL[s.phase]}
                </Badge>
              </td>
              <td className='tnum whitespace-nowrap text-xs text-fg-muted'>
                {s.deadline ? (
                  <span className={s.closingSoon ? 'font-semibold text-warning-700' : undefined}>
                    ~{s.deadline}
                    {s.closingSoon && ' 임박'}
                  </span>
                ) : (
                  s.recruiting && '상시'
                )}
              </td>
              <td className='tnum whitespace-nowrap text-xs text-fg-secondary'>
                {s.applicants}
                {s.capacity !== null && <span className='text-fg-muted'>/{s.capacity}</span>}
              </td>
            </tr>
          );
        })}
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className='text-center text-fg-muted'>
              조건에 맞는 스터디가 없습니다.
            </td>
          </tr>
        )}
      </tbody>
    </TableCard>
  );
}
