
import type { Locale, Study } from '@core/lib/content';
import { m } from '@core/lib/i18n';
import { Badge, type BadgeTone } from '@studyclub/ui';

/** 스터디 상태 → 디자인 시스템 tone (design-system.md §2-5).
 *  ongoing 은 "진행중" = inprogress(info) 로 매핑된다. */
const STATUS_TONE: Record<Study['status'], BadgeTone> = {
  recruiting: 'recruiting',
  ongoing: 'inprogress',
  closed: 'closed',
};

export function StatusBadge({ status, locale }: { status: Study['status']; locale: Locale }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot className='px-2.5 py-1 font-semibold'>
      {m(`status.${status}`, locale)}
    </Badge>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <Badge tone='neutral' className='px-2.5 py-1'>
      {children}
    </Badge>
  );
}
