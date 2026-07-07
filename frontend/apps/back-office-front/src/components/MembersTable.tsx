"use client";

import { useMemo, useState } from "react";
import type { Member } from "@studyclub/mock";
import { tx } from "@/lib/l10n";
import { RowActions, TableCard } from "@/components/ui";

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

export function MembersTable({ members, studyMap }: { members: Member[]; studyMap: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState<string>("all");

  const tracks = useMemo(() => {
    const set = new Set<string>();
    for (const m of members) if (m.track) set.add(m.track);
    return Array.from(set).sort();
  }, [members]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (track !== "all" && m.track !== track) return false;
      if (q) {
        const hay = [tx(m.name), tx(m.headline), m.track ?? ""].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [members, query, track]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 · 소개 · 트랙 검색"
          className="w-full max-w-sm rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-[var(--color-fg-subtle)]">트랙</span>
          <Chip active={track === "all"} onClick={() => setTrack("all")}>
            전체
          </Chip>
          {tracks.map((t) => (
            <Chip key={t} active={track === t} onClick={() => setTrack(t)}>
              {t}
            </Chip>
          ))}
        </div>
        <div className="text-xs text-[var(--color-fg-subtle)]">{rows.length}명</div>
      </div>

      <TableCard>
        <thead>
          <tr>
            <th>이름</th>
            <th>트랙</th>
            <th>기수</th>
            <th>참여 스터디</th>
            <th className="text-right">액션</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((mem) => (
            <tr key={mem.id}>
              <td className="font-semibold">{tx(mem.name)}</td>
              <td className="text-[var(--color-fg-muted)]">{mem.track ?? "—"}</td>
              <td className="text-[var(--color-fg-muted)]">{mem.cohort ?? "—"}</td>
              <td className="text-[var(--color-fg-muted)]">
                {(mem.studies ?? [])
                  .map((id) => studyMap[id])
                  .filter(Boolean)
                  .join(", ") || "—"}
              </td>
              <td>
                <RowActions />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-[var(--color-fg-subtle)]">
                조건에 맞는 스터디원이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </TableCard>
    </div>
  );
}
