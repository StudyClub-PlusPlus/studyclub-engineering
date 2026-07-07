"use client";

import { useMemo, useState } from "react";
import type { StudyclubEvent } from "@studyclub/mock";
import { tx, EVENT_TYPE_LABEL } from "@/lib/l10n";
import { RowActions, TableCard } from "@/components/ui";

type TypeFilter = "all" | "meetup" | "workshop" | "talk" | "online";

const TYPE_CHIPS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "meetup", label: "밋업" },
  { value: "workshop", label: "워크샵" },
  { value: "talk", label: "토크" },
  { value: "online", label: "온라인" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
      style={
        active
          ? { background: "var(--color-accent)", color: "#fff" }
          : { background: "var(--color-surface-subtle)", color: "var(--color-fg-muted)" }
      }
    >
      {children}
    </button>
  );
}

export function EventsTable({ events }: { events: StudyclubEvent[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => {
        if (type !== "all" && e.type !== type) return false;
        if (q && !tx(e.title).toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [events, query, type]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="행사명 검색"
          className="w-full max-w-sm rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[var(--color-fg-subtle)]">타입</span>
          {TYPE_CHIPS.map((c) => (
            <Chip key={c.value} active={type === c.value} onClick={() => setType(c.value)}>
              {c.label}
            </Chip>
          ))}
        </div>
        <div className="text-xs text-[var(--color-fg-subtle)]">{rows.length}개</div>
      </div>

      <TableCard>
        <thead>
          <tr>
            <th>행사</th>
            <th>타입</th>
            <th>날짜</th>
            <th>장소</th>
            <th className="text-right">액션</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="font-semibold">{tx(e.title)}</td>
              <td className="text-[var(--color-fg-muted)]">{EVENT_TYPE_LABEL[e.type] ?? e.type}</td>
              <td className="text-[var(--color-fg-muted)]">{e.date}</td>
              <td className="text-[var(--color-fg-muted)]">{e.location ? tx(e.location) : "—"}</td>
              <td>
                <RowActions />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-[var(--color-fg-subtle)]">
                조건에 맞는 행사가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </TableCard>
    </div>
  );
}
