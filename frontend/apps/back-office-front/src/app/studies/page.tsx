'use client';

// 스터디 관리 — 조회는 features/studies/queries.ts 가 한다.
//
// ⚠️ 지금은 **사용자 사이트용** 목록 API 를 중계해 쓴다(백오피스 전용 API 는 다른 담당자가 개발 예정).
// 그래서 공개된 스터디만 보인다 — 숨김·작성 중(DRAFT)은 사용자 API 가 애초에 안 준다.
import { useMemo, useState } from 'react';

import { studies as mockStudies } from '@studyclub/mock';

import { StudyCreateButton } from '@/components/StudyCreateButton';
import { PageHeader } from '@/components/ui';
import { useStudies } from '@/features/studies/queries';
import { StudiesTable } from '@/features/studies/StudiesTable';
import { CATEGORY_OPTIONS, type StudyPhase } from '@/features/studies/types';

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

  const { data, error, isPending } = useStudies({
    keyword: keyword.trim() || undefined,
    category: category === 'all' ? undefined : category,
    phase: phase === 'all' ? undefined : phase,
  });

  // 상세(운영 페이지)는 아직 목 데이터 기반이다 — 있는 것만 링크를 건다.
  const detailSlugs = useMemo(() => new Set(mockStudies.map((s) => s.id)), []);

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
          {data && `${data.rows.length}개${data.total > data.rows.length ? ` / 전체 ${data.total}개` : ''}`}
        </span>
      </div>

      {error && (
        <div className='mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-red-600'>
          {error.message}
        </div>
      )}

      {isPending ? (
        <p className='py-10 text-center text-sm text-fg-muted'>불러오는 중…</p>
      ) : (
        <StudiesTable rows={data?.rows ?? []} detailSlugs={detailSlugs} />
      )}
    </div>
  );
}
