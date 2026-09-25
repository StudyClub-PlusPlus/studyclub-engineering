'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';

import {
  STUDY_CATEGORIES,
  attendanceRate,
  getStudyCrew,
  publishState,
  recruitState,
  toISODate,
  applyFormUrl,
  type Study,
} from '@studyclub/mock';
import { Badge } from '@studyclub/ui';

import { STATUS_LABEL, tx } from '@/lib/l10n';

/**
 * 스터디 관리 목록.
 *
 * **칼럼은 등록 폼에 있는 항목으로만 짠다.** 운영자가 입력할 수 없는 값(형식·정원·연도·종류)은
 * 영원히 비거나 더미로 남으므로 목록에 두지 않는다. 상태 두 개(모집·공개)는 각각 등록 폼의
 * 「모집 마감일」·「공개일」 하나에서 파생되므로 별도 입력 없이도 항상 정확하다.
 *
 * 판정 함수는 사용자 사이트와 공유한다(`@studyclub/mock`) — 콘솔에만 "마감"으로 보이는 사고 방지.
 *
 * 행에 편집·삭제 버튼을 두지 않는다. 스터디 이름을 누르면 **운영 페이지**로 들어가고, 거기서
 * 크루 승인·출석·정보 수정을 모두 한다.
 */

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '주제 전체' },
  ...STUDY_CATEGORIES.map((c) => ({ value: c, label: c })),
];

type StudyStatusFilter = 'all' | 'recruiting' | 'ongoing' | 'closed';
type KindFilter = 'all' | 'study' | 'club';
type RecruitFilter = 'all' | 'apply' | 'closed';
type PublishFilter = 'all' | 'live' | 'draft';

// "전체" 항목에 축 이름을 붙인다 — 필터가 한 줄에 나란히 서면 어떤 축인지 라벨 없이 알아야 한다.
const STATUS_OPTIONS: { value: StudyStatusFilter; label: string }[] = [
  { value: 'all', label: '상태 전체' },
  { value: 'recruiting', label: '모집 중' },
  { value: 'ongoing', label: '진행 중' },
  { value: 'closed', label: '종료' },
];

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: '종류 전체' },
  { value: 'study', label: '스터디' },
  { value: 'club', label: '클럽' },
];

const RECRUIT_OPTIONS: { value: RecruitFilter; label: string }[] = [
  { value: 'all', label: '모집 전체' },
  { value: 'apply', label: '모집중' },
  { value: 'closed', label: '마감' },
];

const PUBLISH_OPTIONS: { value: PublishFilter; label: string }[] = [
  { value: 'all', label: '공개 전체' },
  { value: 'live', label: '공개' },
  { value: 'draft', label: '비공개' },
];

/** 필터 셀렉트 — 세 축이 한 줄에 나란히 서므로 생김새를 하나로 맞춘다. */
function FilterSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`h-9 rounded-control border bg-surface px-3 text-sm outline-none focus:border-brand ${
        value === 'all' ? 'border-border-strong text-fg-secondary' : 'border-brand font-semibold text-fg'
      }`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** 목록에 필요한 만큼만 뽑는다 — 어느 스터디를 열어야 하는지 고르기 위한 숫자. */
function summarize(study: Study) {
  const { crew, capacity, attendance } = getStudyCrew(study);
  const active = crew.filter((c) => c.status === 'active');
  const rows = active.map((c) => attendanceRate(attendance[c.id])).filter((r): r is number => r !== undefined);
  return {
    capacity,
    active: active.length,
    applied: crew.filter((c) => c.status !== 'rejected').length,
    pending: crew.filter((c) => c.status === 'pending').length,
    rate: rows.length === 0 ? undefined : Math.round(rows.reduce((a, b) => a + b, 0) / rows.length),
  };
}

function displayDate(value?: string) {
  return toISODate(value) ?? '—';
}

export function StudiesTable({ studies }: { studies: Study[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [studyStatus, setStudyStatus] = useState<StudyStatusFilter>('all');
  const [kind, setKind] = useState<KindFilter>('all');
  const [recruit, setRecruit] = useState<RecruitFilter>('all');
  const [publish, setPublish] = useState<PublishFilter>('all');
  const [noFormOnly, setNoFormOnly] = useState(false);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const syncTableScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const syncTopScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (
      studies
        .filter((s) => {
          if (category !== 'all' && s.category !== category) return false;
          if (studyStatus !== 'all' && s.status !== studyStatus) return false;
          if (kind !== 'all' && (s.kind ?? 'study') !== kind) return false;
          if (recruit !== 'all' && recruitState(s) !== recruit) return false;
          if (publish !== 'all' && publishState(s) !== publish) return false;
          if (noFormOnly && applyFormUrl(s)) return false;
          if (q) {
            const hay = `${tx(s.title)} ${tx(s.summary)} ${s.category ?? ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        })
        // 운영자가 손댈 것부터 위로: 모집중 먼저, 그 안에서 마감이 임박한 순.
        // 마감일 없는 상시 모집은 급할 게 없으므로 모집중 그룹의 끝.
        .sort((a, b) => {
          const ra = recruitState(a) === 'apply' ? 0 : 1;
          const rb = recruitState(b) === 'apply' ? 0 : 1;
          if (ra !== rb) return ra - rb;
          const da = toISODate(a.recruitment?.deadline) ?? '9999-99-99';
          const db = toISODate(b.recruitment?.deadline) ?? '9999-99-99';
          return da.localeCompare(db);
        })
    );
  }, [studies, query, category, studyStatus, kind, recruit, publish, noFormOnly]);

  return (
    <div>
      <div className='mb-5 flex flex-wrap items-center gap-2'>
        <input
          type='search'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='제목 · 한 줄 소개 검색'
          className='h-9 w-[188px] rounded-control border border-border-strong bg-surface px-3 text-sm outline-none focus:border-brand'
        />
        <FilterSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        <FilterSelect value={studyStatus} onChange={setStudyStatus} options={STATUS_OPTIONS} />
        <FilterSelect value={kind} onChange={setKind} options={KIND_OPTIONS} />
        <FilterSelect value={recruit} onChange={setRecruit} options={RECRUIT_OPTIONS} />
        <FilterSelect value={publish} onChange={setPublish} options={PUBLISH_OPTIONS} />
        <label className='inline-flex h-9 cursor-pointer items-center gap-2 rounded-control border border-border-strong bg-surface px-3 text-sm text-fg-secondary'>
          <input
            type='checkbox'
            checked={noFormOnly}
            onChange={(e) => setNoFormOnly(e.target.checked)}
            className='peer sr-only'
          />
          <span className='relative h-5 w-9 rounded-full bg-surface-3 transition peer-checked:bg-brand'>
            <span className='absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4' />
          </span>
          신청 폼 없는 것만
        </label>
        <span className='ml-auto text-xs text-fg-muted'>{rows.length}개</span>
      </div>

      <div className='card'>
        <div
          ref={topScrollRef}
          className='overflow-x-auto border-b border-border'
          onScroll={syncTableScroll}
          aria-label='테이블 가로 스크롤'
        >
          <div className='h-3 min-w-[1500px]' />
        </div>
        <div ref={tableScrollRef} className='overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' onScroll={syncTopScroll}>
          <table className='bo-table min-w-[1500px]'>
            <thead>
          <tr>
            <th className='whitespace-nowrap'>p-id</th>
            <th>스터디명</th>
            <th className='whitespace-nowrap'>스터디 상태</th>
            <th className='whitespace-nowrap'>주제</th>
            <th className='whitespace-nowrap'>종류</th>
            <th className='whitespace-nowrap'>시간대</th>
            <th className='whitespace-nowrap'>모집 시작일</th>
            <th className='whitespace-nowrap'>모집 마감일</th>
            <th className='whitespace-nowrap'>모집 상태</th>
            <th className='whitespace-nowrap'>지원 현황</th>
            <th className='whitespace-nowrap'>스터디 시작일</th>
            <th className='whitespace-nowrap'>출석률</th>
            <th className='whitespace-nowrap'>신청 폼</th>
            <th className='whitespace-nowrap'>스터디 공개</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const open = recruitState(s) === 'apply';
            const publish = publishState(s);
            const crewStat = summarize(s);
            const capacity = s.recruitment?.capacity ?? s.seats?.total;
            const applied = crewStat.applied;
            const statusTone = s.status === 'recruiting' ? 'recruiting' : s.status === 'ongoing' ? 'inprogress' : 'closed';
            return (
              <tr key={s.id}>
                <td className='whitespace-nowrap font-mono text-xs text-fg-muted'>{s.id}</td>
                <td className='w-[42%] max-w-0'>
                  <Link
                    href={`/studies/${s.id}`}
                    className='block truncate font-semibold underline-offset-4 hover:text-brand hover:underline'
                  >
                    {tx(s.title)}
                  </Link>
                </td>
                <td className='whitespace-nowrap'>
                  <Badge tone={statusTone} dot className='font-semibold'>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </Badge>
                </td>
                <td className='whitespace-nowrap'>
                  <Badge tone='neutral'>{s.category ?? '—'}</Badge>
                </td>
                <td className='whitespace-nowrap text-fg-secondary'>{s.kind === 'club' ? '클럽' : '스터디'}</td>
                <td className='whitespace-nowrap text-fg-secondary'>{s.schedule?.ko ?? '—'}</td>
                <td className='tnum whitespace-nowrap text-xs text-fg-secondary'>{displayDate(s.publish_at)}</td>
                <td className='tnum whitespace-nowrap text-xs text-fg-secondary'>{displayDate(s.recruitment?.deadline)}</td>
                <td>
                  <Badge tone={open ? 'recruiting' : 'closed'} dot className='px-2.5 py-1 font-semibold'>
                    {open ? '모집중' : '마감'}
                  </Badge>
                </td>
                <td className='tnum whitespace-nowrap text-xs text-fg-secondary'>
                  {applied} / {capacity === undefined ? '제한 없음' : capacity}
                </td>
                <td className='tnum whitespace-nowrap text-xs text-fg-secondary'>{displayDate(s.date)}</td>
                <td className='tnum whitespace-nowrap text-xs font-semibold text-fg-secondary'>
                  {crewStat.rate === undefined ? <span className='text-fg-muted'>—</span> : `${crewStat.rate}%`}
                </td>
                <td className='whitespace-nowrap text-center text-sm' aria-label={applyFormUrl(s) ? '신청 폼 있음' : '신청 폼 없음'}>
                  {applyFormUrl(s) ? '✓' : '—'}
                </td>
                <td className='whitespace-nowrap'>
                  <Badge tone='neutral'>{publish === 'live' ? '공개' : '비공개'}</Badge>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={14} className='text-center text-fg-muted'>
                조건에 맞는 스터디가 없습니다.
              </td>
            </tr>
          )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
