import './proto.css';

import { ProtoShell } from '@/proto/ProtoShell';

/**
 * 프로토 표면 — 실제 서비스 화면을 **폭 제한 없이** 그대로 재현한다.
 * `(site)` 의 max-w-6xl 문서형 크롬을 쓰지 않으려고 라우트 그룹을 나눴다.
 */
export default function ProtoRootLayout({ children }: { children: React.ReactNode }) {
  return <ProtoShell>{children}</ProtoShell>;
}
