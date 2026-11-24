import { ClubConsole } from '@console/components/ClubConsole';

import { SPECS } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export const metadata = { title: '클럽 운영' };

/** 클럽 운영 — 다음 기수 · 이어서 참여 · 월간 출석부. */
export default function ClubsAdmin() {
  return (
    <div>
      {SPECS.map((spec) => (
        <ScreenSpecRegistrar key={spec.scope} spec={spec} />
      ))}
      <ClubConsole />
    </div>
  );
}
