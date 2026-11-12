import { PageHeader } from '@/components/ui';

export const metadata = { title: '행사' };

// TODO(api): POST/GET/PATCH/DELETE /api/events 준비되면 EventCreateButton · EventsTable · EventDialog 를 복원하고
// FEATURES.EVENTS = true 로 바꿔 사이드바 메뉴를 노출한다.
export default function EventsAdmin() {
  return (
    <div>
      <PageHeader title='행사 관리' />
      <p className='mt-8 text-center type-body-sm text-fg-muted'>행사 기능은 준비 중입니다.</p>
    </div>
  );
}
