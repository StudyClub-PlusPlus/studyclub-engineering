import type { Locale, Study } from "@/lib/content";
import { m } from "@/lib/i18n";

const STATUS_STYLE: Record<Study["status"], { fg: string; bg: string }> = {
  recruiting: { fg: "var(--color-recruiting)", bg: "var(--color-recruiting-soft)" },
  ongoing: { fg: "var(--color-ongoing)", bg: "var(--color-ongoing-soft)" },
  closed: { fg: "var(--color-closed)", bg: "var(--color-closed-soft)" },
};

export function StatusBadge({ status, locale }: { status: Study["status"]; locale: Locale }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: s.fg, background: s.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.fg }} />
      {m(`status.${status}`, locale)}
    </span>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-fg-subtle)]">
      {children}
    </span>
  );
}
