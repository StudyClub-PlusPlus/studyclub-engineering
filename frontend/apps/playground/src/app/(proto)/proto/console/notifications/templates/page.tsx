import { NotificationTabs } from '@console/components/NotificationTabs';
import { TemplatesTable } from '@console/components/TemplatesTable';
import { PageHeader } from '@console/components/ui';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export const metadata = { title: '알림 템플릿' };

export default function TemplatesAdmin() {
  return (
    <div data-anno='template:1'>
      <ScreenSpecRegistrar spec={SPEC} />
      <PageHeader title='알림' />
      <NotificationTabs />
      <TemplatesTable />
    </div>
  );
}
