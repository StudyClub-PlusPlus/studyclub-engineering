import { UsersTable } from '@console/components/UsersTable';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export const metadata = { title: '유저' };

/**
 * 유저 — 명단과 역할·권한 부여를 한 화면에서 한다.
 *
 * 명단과 역할 부여를 두 화면으로 나누면 "이 사람이 무엇을 할 수 있는가"를 보려고 화면을 옮겨야
 * 한다. 캡틴이 명단을 보는 이유가 대개 역할을 주기 위해서라 한 화면에 둔다.
 *
 * 헤더까지 `UsersTable` 이 그린다 — 제목 옆 ⓘ 가 표 모달을 여는 클라이언트 상태를 쥐고 있다.
 */
export default function UsersAdmin() {
  return (
    <div>
      <ScreenSpecRegistrar spec={SPEC} />
      <UsersTable />
    </div>
  );
}
