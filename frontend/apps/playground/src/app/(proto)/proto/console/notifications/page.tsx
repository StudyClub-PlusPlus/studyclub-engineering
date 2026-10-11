import { NotificationsTable } from '@console/components/NotificationsTable';
import { NotificationTabs } from '@console/components/NotificationTabs';
import { PageHeader } from '@console/components/ui';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export const metadata = { title: '알림 발송 이력' };

export default function NotificationsAdmin() {
  return (
    <div>
      <ScreenSpecRegistrar spec={SPEC} />
      <PageHeader title='알림' />
      <NotificationTabs />
      <NotificationsTable />
    </div>
  );
}
