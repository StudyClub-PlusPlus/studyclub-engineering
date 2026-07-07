import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { STATUS_LABEL } from "@/lib/l10n";

const STATUS_STYLE: Record<string, { fg: string; bg: string }> = {
  recruiting: { fg: "var(--color-recruiting)", bg: "var(--color-recruiting-soft)" },
  ongoing: { fg: "var(--color-ongoing)", bg: "var(--color-ongoing-soft)" },
  closed: { fg: "var(--color-closed)", bg: "var(--color-closed-soft)" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.closed;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: s.fg, background: s.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.fg }} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
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
