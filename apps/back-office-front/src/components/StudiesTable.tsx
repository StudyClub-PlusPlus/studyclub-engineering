"use client";

import { useMemo, useState } from "react";
import type { Study } from "@studyclub/mock";
import { tx, FORMAT_LABEL, KIND_LABEL, RECRUITMENT_LABEL } from "@/lib/l10n";
import { StatusBadge, RowActions, TableCard } from "@/components/ui";

type KindFilter = "all" | "study" | "club";
type StatusFilter = "all" | "recruiting" | "ongoing" | "closed";

const KIND_CHIPS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "study", label: "스터디" },
  { value: "club", label: "클럽" },
];

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "recruiting", label: "모집중" },
  { value: "ongoing", label: "진행중" },
  { value: "closed", label: "종료" },
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

export function StudiesTable({ studies, opMap }: { studies: Study[]; opMap: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [year, setYear] = useState<string>("all");

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const s of studies) if (s.year) set.add(s.year);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [studies]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return studies.filter((s) => {
      if (kind !== "all" && (s.kind ?? "study") !== kind) return false;
      if (status !== "all" && s.status !== status) return false;
      if (year !== "all" && s.year !== year) return false;
      if (q) {
        const hay = [
          tx(s.title).toLowerCase(),
          (s.category ?? "").toLowerCase(),
          (s.tags ?? []).join(" ").toLowerCase(),
        ].join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [studies, query, kind, status, year]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목 · 카테고리 · 태그 검색"
          className="w-full max-w-sm rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[var(--color-fg-subtle)]">종류</span>
            {KIND_CHIPS.map((c) => (
              <Chip key={c.value} active={kind === c.value} onClick={() => setKind(c.value)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[var(--color-fg-subtle)]">상태</span>
            {STATUS_CHIPS.map((c) => (
              <Chip key={c.value} active={status === c.value} onClick={() => setStatus(c.value)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[var(--color-fg-subtle)]">연도</span>
            <Chip active={year === "all"} onClick={() => setYear("all")}>
              전체
            </Chip>
            {years.map((y) => (
              <Chip key={y} active={year === y} onClick={() => setYear(y)}>
                {y}
              </Chip>
            ))}
          </div>
        </div>
        <div className="text-xs text-[var(--color-fg-subtle)]">{rows.length}개</div>
      </div>

      <TableCard>
        <thead>
          <tr>
            <th>스터디</th>
            <th>상태</th>
            <th>모집</th>
            <th>형식</th>
            <th>정원</th>
            <th>연도</th>
            <th>운영</th>
            <th className="text-right">액션</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const rec = s.recruitment;
            const capacity = s.seats ? `${s.seats.taken}/${s.seats.total}` : rec?.capacity ? `${rec.capacity}` : "—";
            return (
              <tr key={s.id}>
                <td className="font-semibold">
                  <span className="inline-flex items-center gap-2">
                    {tx(s.title)}
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: "var(--color-surface-subtle)", color: "var(--color-fg-subtle)" }}
                    >
                      {KIND_LABEL[s.kind ?? "study"]}
                    </span>
                  </span>
                </td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
                <td className="text-[var(--color-fg-muted)]">
                  {rec ? (
                    <span>
                      {RECRUITMENT_LABEL[rec.status] ?? rec.status}
                      {rec.deadline && <span className="text-[var(--color-fg-subtle)]"> · ~{rec.deadline}</span>}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-[var(--color-fg-muted)]">{FORMAT_LABEL[s.format] ?? s.format}</td>
                <td className="text-[var(--color-fg-muted)]">{capacity}</td>
                <td className="text-[var(--color-fg-muted)]">{s.year ?? "—"}</td>
                <td className="text-[var(--color-fg-muted)]">{s.lead ? opMap[s.lead] ?? "—" : "—"}</td>
                <td>
                  <RowActions />
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-[var(--color-fg-subtle)]">
                조건에 맞는 스터디가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </TableCard>
    </div>
  );
}
