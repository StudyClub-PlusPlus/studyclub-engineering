import { RetrosTable } from '@console/components/RetrosTable';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export const metadata = { title: '회고' };

export default function RetrosAdmin() {
  return (
    <div>
      <ScreenSpecRegistrar spec={SPEC} />
      <RetrosTable />
    </div>
  );
}
