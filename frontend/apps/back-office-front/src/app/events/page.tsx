import { PageHeader } from '@/components/ui';

export const metadata = { title: '행사' };

// TODO(api): POST/GET/PATCH/DELETE /api/events 가 붙으면 EventCreateButton · EventsTable · EventDialog 를 복원한다.
// 그 전까지는 화면을 열어 두되 저장 기능은 노출하지 않는다.
export default function EventsAdmin() {
  return (
    <div>
      <PageHeader title='행사 관리' />
      <p className='mt-8 text-center type-body-sm text-fg-muted'>행사 기능은 준비 중입니다.</p>
    </div>
  );
}
