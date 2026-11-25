import type { ReactNode } from 'react';

import { STATUS_LABEL } from '@console/lib/l10n';
import { Badge, Button, type BadgeTone } from '@studyclub/ui';
import { Plus } from 'lucide-react';

/** 스터디 상태 → 디자인 시스템 tone (design-system.md §2-5). */
const STATUS_TONE: Record<string, BadgeTone> = {
  recruiting: 'recruiting',
  ongoing: 'inprogress',
  closed: 'closed',
};

export type SortDir = 'asc' | 'desc';

/**
 * 정렬하는 컬럼 머리 — **이름을 누른다.** 처음 누르면 `first`(기본 오름차순), 다시 누르면 반대로.
 * 화살표를 그리지 않는다 — 열마다 작은 화살표 두 개가 서면 머리 줄이 어수선하다.
 * 지금 정렬 중인 열은 이름이 강조색이다.
 */
export function SortLabel({
  label,
  active,
  onChange,
  anno,
  first = 'asc',
}: {
  label: string;
  active: SortDir | null;
  onChange: (dir: SortDir) => void;
  anno?: string;
  /** 처음 누를 때 방향 — 수(👍 등)는 큰 것부터 보는 게 보통이라 'desc' 를 준다. */
  first?: SortDir;
}) {
  const next: SortDir = active ? (active === 'asc' ? 'desc' : 'asc') : first;
  return (
    <button
      // ui-native: 표 머리 정렬 — 머리 글자 자체가 정렬 단추
      type='button'
      data-anno={anno}
      onClick={() => onChange(next)}
      aria-label={`${label} ${next === 'desc' ? '내림차순으로' : '오름차순으로'} 정렬`}
      className={`whitespace-nowrap rounded-sm text-left underline-offset-4 hover:underline ${active ? 'text-brand' : ''}`}
    >
      {label}
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'closed'} dot className='px-2.5 py-1 font-semibold'>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

/** 페이지 헤더 + (비활성) 생성 버튼. */
export function PageHeader({
  title,
  subtitle,
  createLabel,
  action,
}: {
  title: string;
  subtitle?: string;
  createLabel?: string;
  /** 우측 액션 슬롯. 지정하면 createLabel 기본 버튼 대신 이걸 렌더한다. */
  action?: ReactNode;
}) {
  return (
    <div className='mb-6 flex items-end justify-between gap-4'>
      <div>
        <h1 className='type-headline-md'>{title}</h1>
        {subtitle && <p className='mt-1 type-body-sm text-fg-muted'>{subtitle}</p>}
      </div>
      {action ??
        (createLabel && (
          // TODO(api): wire to api.studyclub.life — 생성 폼/뮤테이션 연결
          <Button size='sm' disabled title='미구현 (백엔드 연결 예정)' leadingIcon={<Plus size={15} />}>
            {createLabel}
          </Button>
        ))}
    </div>
  );
}

/** 행 단위 편집/삭제 액션 (전부 비활성). */
export function RowActions() {
  return (
    <div className='flex justify-end gap-1.5'>
      {/* TODO(api): wire to api.studyclub.life — 편집 */}
      <Button variant='tertiary' size='sm' disabled>
        편집
      </Button>
      {/* TODO(api): wire to api.studyclub.life — 삭제 */}
      <Button variant='destructive' size='sm' disabled>
        삭제
      </Button>
    </div>
  );
}

/**
 * `top` 을 주면 표 맨 위(카드 안)에 붙인다 — 일괄 수정 작업 바 자리. 그때 카드는 overflow-clip 이라
 * 스크롤 상자가 생기지 않아 작업 바가 화면 위에 붙고, 가로 스크롤은 표만 한다.
 */
export function TableCard({
  children,
  anno,
  top,
  tableClassName,
}: {
  children: ReactNode;
  anno?: string;
  top?: ReactNode;
  /** 표 최소 너비 등 — 좁은 화면에서 칸을 줄이지 않고 가로로 밀게 할 때 */
  tableClassName?: string;
}) {
  const table = 'bo-table ' + (tableClassName ?? '');
  if (!top) {
    return (
      <div data-anno={anno} className='card overflow-x-auto'>
        <table className={table}>{children}</table>
      </div>
    );
  }
  return (
    <div data-anno={anno} className='card overflow-clip'>
      {top}
      <div className='overflow-x-auto'>
        <table className={table}>{children}</table>
      </div>
    </div>
  );
}
