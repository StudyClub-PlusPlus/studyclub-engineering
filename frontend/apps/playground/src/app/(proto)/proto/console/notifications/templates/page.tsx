import { TemplatesTable } from '@console/components/TemplatesTable';
import { PageHeader } from '@console/components/ui';
import { createTemplates } from '@console/lib/templates';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export const metadata = { title: '알림 템플릿' };

// 메일 시안 페이지와 같이 빌드 때 HTML 을 담는다. standalone 배포에는 원본 src 가 없다.
export const dynamic = 'force-static';

export default function TemplatesAdmin() {
  const welcomeBody = readFileSync(join(process.cwd(), 'src/proto/mail/templates/user-registered-email.html'), 'utf8');

  return (
    <div data-anno='template:1'>
      <ScreenSpecRegistrar spec={SPEC} />
      <PageHeader title='알림' />
      <TemplatesTable initialTemplates={createTemplates(welcomeBody)} />
    </div>
  );
}
