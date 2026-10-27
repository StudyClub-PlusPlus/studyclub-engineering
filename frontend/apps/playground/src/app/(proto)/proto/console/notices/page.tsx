import { NoticesConsole } from '@console/components/NoticesConsole';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export const metadata = { title: '공지' };

export default function NoticesAdmin() {
  return (
    <div>
      <ScreenSpecRegistrar spec={SPEC} />
      <NoticesConsole />
    </div>
  );
}
