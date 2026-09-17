'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { TableCard } from '@console/components/ui';
import { tx } from '@console/lib/l10n';
import {
  STUDY_CATEGORIES,
  applyFormUrl,
  attendanceRate,
  getStudyCrew,
  publishState,
  recruitState,
  toISODate,
  type Study,
  categoriesOf,
} from '@studyclub/mock';
import { Badge } from '@studyclub/ui';
import { Check, Minus } from 'lucide-react';

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
 * 크루 명단·출석·정보 수정을 모두 한다.
 */

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '주제 전체' },
  ...STUDY_CATEGORIES.map((c) => ({ value: c, label: c })),
];

type RecruitFilter = 'all' | 'apply' | 'closed';
type PublishFilter = 'all' | 'live' | 'draft';

// "전체" 항목에 축 이름을 붙인다 — 필터가 한 줄에 나란히 서면 어떤 축인지 라벨 없이 알아야 한다.
const RECRUIT_OPTIONS: { value: RecruitFilter; label: string }[] = [
  { value: 'all', label: '모집 전체' },
  { value: 'apply', label: '모집중' },
  { value: 'closed', label: '마감' },
];

const PUBLISH_OPTIONS: { value: PublishFilter; label: string }[] = [
  { value: 'all', label: '공개 전체' },
  { value: 'live', label: '공개' },
  { value: 'draft', label: '미공개' },
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
    rate: rows.length === 0 ? undefined : Math.round(rows.reduce((a, b) => a + b, 0) / rows.length),
  };
}

/** 화면에서 바꾼 공개 상태. TODO(api): 저장 API 를 붙이면 서버 값으로 대체한다. */
type PublishPatch = { published?: boolean; publish_at?: string };

export function StudiesTable({ studies }: { studies: Study[] }) {
  const [patch, setPatch] = useState<Record<string, PublishPatch>>({});
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [recruit, setRecruit] = useState<RecruitFilter>('all');
  const [publish, setPublish] = useState<PublishFilter>('all');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (
      studies
        .map((s) => (patch[s.id] ? { ...s, ...patch[s.id] } : s))
        .filter((s) => {
          if (category !== 'all' && !categoriesOf(s).includes(category)) return false;
          if (recruit !== 'all' && recruitState(s) !== recruit) return false;
          if (publish !== 'all' && publishState(s) !== publish) return false;
          if (q) {
            const hay = `${tx(s.title)} ${tx(s.summary)} ${categoriesOf(s).join(' ')}`.toLowerCase();
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
  }, [studies, patch, query, category, recruit, publish]);

  return (
    <div>
      <div className='mb-5 flex flex-wrap items-center gap-2'>
        <input
          type='search'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='제목 · 한 줄 소개 검색'
          className='h-9 w-56 rounded-control border border-border-strong bg-surface px-3 text-sm outline-none focus:border-brand'
        />
        <FilterSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        <FilterSelect value={recruit} onChange={setRecruit} options={RECRUIT_OPTIONS} />
        <span data-anno='publish:3'>
          <FilterSelect value={publish} onChange={setPublish} options={PUBLISH_OPTIONS} />
        </span>
        <span className='ml-auto text-xs text-fg-muted'>{rows.length}개</span>
      </div>

      <TableCard>
        <thead>
          <tr>
            <th>스터디</th>
            <th className='whitespace-nowrap'>주제</th>
            <th className='whitespace-nowrap'>모집</th>
            <th className='whitespace-nowrap'>크루</th>
            <th className='whitespace-nowrap'>출석률</th>
            <th className='whitespace-nowrap'>신청 폼</th>
            <th className='whitespace-nowrap'>공개 설정</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const open = recruitState(s) === 'apply';
            const deadline = toISODate(s.recruitment?.deadline);
            const crewStat = summarize(s);
            return (
              <tr key={s.id}>
                <td className='w-[30%] max-w-0'>
                  <Link
                    href={`/proto/console/studies/${s.id}`}
                    className='block truncate font-semibold underline-offset-4 hover:text-brand hover:underline'
                  >
                    {tx(s.title)}
                  </Link>
                </td>
                <td className='whitespace-nowrap text-fg-secondary'>
                  <CategoryCell categories={categoriesOf(s)} />
                </td>
                <td>
                  <div className='flex items-center gap-2 whitespace-nowrap'>
                    <Badge tone={open ? 'recruiting' : 'closed'} dot className='px-2.5 py-1 font-semibold'>
                      {open ? '모집중' : '마감'}
                    </Badge>
                    <span className='tnum text-xs text-fg-muted'>{deadline ? `~${deadline}` : open ? '상시' : ''}</span>
                  </div>
                </td>
                <td className='tnum whitespace-nowrap text-xs text-fg-secondary'>
                  {crewStat.active}/{crewStat.capacity}
                </td>
                <td className='tnum whitespace-nowrap text-xs font-semibold text-fg-secondary'>
                  {crewStat.rate === undefined ? <span className='text-fg-muted'>—</span> : `${crewStat.rate}%`}
                </td>
                <td data-anno='publish:2' className='whitespace-nowrap text-xs'>
                  <FormCell url={applyFormUrl(s)} recruiting={open} />
                </td>
                <td data-anno='publish:1' className='whitespace-nowrap text-xs'>
                  <PublishCell
                    live={publishState(s) === 'live'}
                    hasForm={Boolean(applyFormUrl(s))}
                    onToggle={(next) =>
                      setPatch((m) => ({ ...m, [s.id]: { published: next, publish_at: undefined } }))
                    }
                  />
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className='text-center text-fg-muted'>
                조건에 맞는 스터디가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </TableCard>
    </div>
  );
}

/**
 * 공개 설정 칸 — **공개는 여기서 켠다.**
 *
 * 등록 폼에는 공개일이 없다. 등록 직후에는 신청 폼도 회차도 없어서, 그 상태로 사이트에 뜨면
 * 크루가 신청할 데 없는 스터디를 보게 된다. 그래서 등록은 늘 미공개로 끝나고, 준비가 된 뒤
 * 이 자리에서 켠다.
 *
 * **예약 공개는 두지 않는다** — 준비가 됐는지는 날짜가 아니라 사람이 판단한다.
 * **신청 폼이 없으면 켤 수 없다** — 공개하는 순간 신청할 데 없는 스터디가 목록에 선다.
 */
function PublishCell({
  live,
  hasForm,
  onToggle,
}: {
  live: boolean;
  hasForm: boolean;
  onToggle: (next: boolean) => void;
}) {
  const blocked = !live && !hasForm;
  return (
    <button
      type='button'
      onClick={() => !blocked && onToggle(!live)}
      disabled={blocked}
      data-anno={blocked ? 'publish:1-1' : undefined}
      title={blocked ? '신청 폼을 먼저 연결하세요.' : live ? '눌러서 내린다' : '눌러서 공개한다'}
      className={`rounded-pill px-2.5 py-1 text-xs font-semibold transition-colors ${
        live
          ? 'bg-success-50 text-success-700 hover:bg-success-100'
          : blocked
            ? 'cursor-not-allowed bg-surface-2 text-fg-placeholder'
            : 'bg-surface-2 text-fg-secondary hover:bg-neutral-200'
      }`}
    >
      {live ? '공개' : '미공개'}
    </button>
  );
}

/**
 * 신청 폼 칸 — 폼이 걸려 있는가.
 *
 * 값을 읽기만 한다. **폼을 붙이는 자리는 스터디 운영 화면의 신청폼 탭**이며, 그 탭은 다른
 * 작업으로 만들어지는 중이다. 여기서 또 입력받게 하면 같은 값을 두 곳에서 고치게 된다.
 *
 * 있고 없고 두 값뿐이라 글자로 쓰지 않는다. 목록에서 훑는 값이라 표시가 짧을수록 빨리 읽힌다.
 * **모집중인데 폼이 없으면** 신청할 데가 없다는 뜻이므로 그 경우만 눈에 띄게 하고,
 * 마감된 스터디의 빈 폼은 조용히 둔다 — 이미 지난 일이라 고칠 것이 없다.
 */
function FormCell({ url, recruiting }: { url?: string; recruiting: boolean }) {
  if (url) {
    return (
      <span title={url}>
        <Check size={15} className='inline text-success-700' aria-label='연결됨' />
      </span>
    );
  }
  return (
    <Minus
      size={15}
      className={`inline ${recruiting ? 'text-warning-700' : 'text-fg-placeholder'}`}
      aria-label={recruiting ? '없음 — 모집중인데 신청 폼이 없다' : '없음'}
    />
  );
}

/** 목록에서 보여줄 주제 수. 셋을 넘기면 제목 칸이 밀려 스터디를 못 읽는다. */
const CATEGORY_PREVIEW = 2;

/**
 * 주제 칸.
 *
 * 주제는 여러 개 붙는다. 전부 늘어놓으면 이 칸이 제목보다 넓어지므로 **두 개까지만** 적고
 * 나머지는 개수로 접는다. 접힌 이름은 마우스를 올리면 볼 수 있다.
 */
function CategoryCell({ categories }: { categories: string[] }) {
  if (categories.length === 0) return <span className='text-fg-muted'>—</span>;
  const shown = categories.slice(0, CATEGORY_PREVIEW);
  const rest = categories.slice(CATEGORY_PREVIEW);
  return (
    <span className='inline-flex items-center gap-1.5' title={categories.join(' · ')}>
      {shown.map((c) => (
        <span key={c} className='rounded-pill bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-secondary'>
          {c}
        </span>
      ))}
      {rest.length > 0 && <span className='tnum text-xs text-fg-muted'>+{rest.length}</span>}
    </span>
  );
}
