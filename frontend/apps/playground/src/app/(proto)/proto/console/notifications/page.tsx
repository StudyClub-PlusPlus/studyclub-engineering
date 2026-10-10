import { NotificationsTable } from '@console/components/NotificationsTable';
import { PageHeader } from '@console/components/ui';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export const metadata = { title: '알림 발송 이력' };

export default function NotificationsAdmin() {
  return (
    <div>
      <ScreenSpecRegistrar spec={SPEC} />
      <PageHeader title='알림 발송 이력' />
      <p data-anno='history:1' className='-mt-2 mb-4 text-sm text-fg-secondary'>
        가입 환영 메일의 발송 상태를 확인할 수 있습니다.
      </p>
      <NotificationsTable />
    </div>
  );
}
