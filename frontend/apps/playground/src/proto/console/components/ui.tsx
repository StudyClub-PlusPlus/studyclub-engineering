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
        <h1 className='text-2xl font-extrabold tracking-tight'>{title}</h1>
        {subtitle && <p className='mt-1 text-sm text-fg-muted'>{subtitle}</p>}
      </div>
      {action ??
        (createLabel && (
          // TODO(api): wire to api.studyclub-plusplus.com — 생성 폼/뮤테이션 연결
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
      {/* TODO(api): wire to api.studyclub-plusplus.com — 편집 */}
      <Button variant='ghost' size='sm' disabled>
        편집
      </Button>
      {/* TODO(api): wire to api.studyclub-plusplus.com — 삭제 */}
      <Button variant='destructive' size='sm' disabled>
        삭제
      </Button>
    </div>
  );
}

export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className='card overflow-x-auto'>
      <table className='bo-table'>{children}</table>
    </div>
  );
}
