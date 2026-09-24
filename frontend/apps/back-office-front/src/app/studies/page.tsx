'use client';

// 스터디 관리 — 실제 API 로 조회한다.
//
// ⚠️ 지금은 **사용자 사이트용** 목록 API(`GET /api/studies`)를 쓴다. 백오피스 전용 목록 API 는
// 다른 담당자가 개발 예정이라, 그때까지의 한시적 예외다 (`src/app/api/studies/route.ts` 주석 참고).
// 그래서 **공개된 스터디만** 보인다 — 숨김·작성 중(DRAFT)은 사용자 API 가 애초에 안 준다.
import { useEffect, useMemo, useState } from 'react';

import { studies as mockStudies } from '@studyclub/mock';

import { StudiesTable } from '@/components/StudiesTable';
import { StudyCreateButton } from '@/components/StudyCreateButton';
import { PageHeader } from '@/components/ui';
import { CATEGORY_OPTIONS, toRow, type ApiStudyPage, type StudyPhase, type StudyRow } from '@/lib/studies';

const PHASE_OPTIONS: { value: StudyPhase | 'all'; label: string }[] = [
  { value: 'all', label: '단계 전체' },
  { value: 'RECRUITING', label: '모집중' },
  { value: 'ONGOING', label: '진행중' },
  { value: 'CLOSED', label: '종료' },
];

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

export default function StudiesAdmin() {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('all');
  const [phase, setPhase] = useState<StudyPhase | 'all'>('all');
  const [page, setPage] = useState<ApiStudyPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 상세(운영 페이지)는 아직 목 데이터 기반이다 — 있는 것만 링크를 건다.
  const detailSlugs = useMemo(() => new Set(mockStudies.map((s) => s.id)), []);

  useEffect(() => {
    // 타이핑마다 부르지 않는다. 셀렉트는 즉시 반응해도 되지만 같은 경로로 묶어 단순하게 둔다.
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ limit: '100' });
      if (keyword.trim()) query.set('keyword', keyword.trim());
      if (category !== 'all') query.set('category', category);
      if (phase !== 'all') query.set('status', phase);

      setError(null);
      fetch(`/api/studies?${query}`, { cache: 'no-store' })
        .then(async (r) => {
          const data = await r.json().catch(() => null);
          if (!r.ok) throw new Error(data?.errorMessage ?? data?.message ?? `조회 실패 (${r.status})`);
          return data as ApiStudyPage;
        })
        .then(setPage)
        .catch((e) => setError(e instanceof Error ? e.message : '스터디 조회 중 오류'));
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, category, phase]);

  const rows: StudyRow[] = (page?.items ?? []).map(toRow);

  return (
    <div>
      <PageHeader title='스터디 관리' action={<StudyCreateButton />} />

      <p className='mb-4 rounded-xl border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-fg-muted'>
        사용자 사이트에 <strong>공개된 스터디만</strong> 표시됩니다. 숨김·작성 중(DRAFT) 스터디는 백오피스 전용 목록
        API 가 연결되면 함께 보입니다.
      </p>

      <div className='mb-5 flex flex-wrap items-center gap-2'>
        <input
          type='search'
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder='제목 · 한 줄 소개 검색'
          className='h-9 w-56 rounded-control border border-border-strong bg-surface px-3 text-sm outline-none focus:border-brand'
        />
        <FilterSelect
          value={category}
          onChange={setCategory}
          options={[{ value: 'all', label: '카테고리 전체' }, ...CATEGORY_OPTIONS]}
        />
        <FilterSelect value={phase} onChange={setPhase} options={PHASE_OPTIONS} />
        <span className='ml-auto text-xs text-fg-muted'>
          {page ? `${rows.length}개${page.total > rows.length ? ` / 전체 ${page.total}개` : ''}` : ''}
        </span>
      </div>

      {error && (
        <div className='mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-red-600'>
          {error}
        </div>
      )}
      {!page && !error ? (
        <p className='py-10 text-center text-sm text-fg-muted'>불러오는 중…</p>
      ) : (
        <StudiesTable rows={rows} detailSlugs={detailSlugs} />
      )}
    </div>
  );
}
