import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import type { StudyStatus } from "@studyclub/mock";
import { StatusBadge as SharedStatusBadge } from "@studyclub/ui";

// 상태 배지는 @studyclub/ui 와 스타일·라벨이 동일했다 (모집 중/진행 중/종료).
// 여기서 다시 정의하지 않고 공유본을 ko 로 고정해 감싼다 — 호출부는 그대로 둔다.
export function StatusBadge({ status }: { status: string }) {
  return <SharedStatusBadge status={status as StudyStatus} locale="ko" />;
}

/** 페이지 헤더 + (비활성) 생성 버튼. */
export function PageHeader({
  title,
  subtitle,
  createLabel,
}: {
  title: string;
  subtitle?: string;
  createLabel?: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--color-fg-subtle)]">{subtitle}</p>}
      </div>
      {createLabel && (
        // TODO(api): wire to api.studyclub-plusplus.com — 생성 폼/뮤테이션 연결
        <button className="btn btn-primary" disabled title="미구현 (백엔드 연결 예정)">
          <Plus size={15} /> {createLabel}
        </button>
      )}
    </div>
  );
}

/** 행 단위 편집/삭제 액션 (전부 비활성). */
export function RowActions() {
  return (
    <div className="flex justify-end gap-1.5">
      {/* TODO(api): wire to api.studyclub-plusplus.com — 편집 */}
      <button className="btn btn-ghost" disabled>
        편집
      </button>
      {/* TODO(api): wire to api.studyclub-plusplus.com — 삭제 */}
      <button className="btn btn-ghost" disabled style={{ color: "#b91c1c" }}>
        삭제
      </button>
    </div>
  );
}

export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="bo-table">{children}</table>
    </div>
  );
}
