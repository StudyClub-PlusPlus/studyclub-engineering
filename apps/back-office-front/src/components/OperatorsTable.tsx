"use client";

import { useMemo, useState } from "react";
import type { Operator } from "@studyclub/mock";
import { tx } from "@/lib/l10n";
import { RowActions, TableCard } from "@/components/ui";

export function OperatorsTable({ operators }: { operators: Operator[] }) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return operators;
    return operators.filter((op) => {
      const hay = [tx(op.name), tx(op.role), tx(op.bio)].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [operators, query]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 · 역할 · 소개 검색"
          className="w-full max-w-sm rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <div className="text-xs text-[var(--color-fg-subtle)]">{rows.length}명</div>
      </div>

      <TableCard>
        <thead>
          <tr>
            <th>이름</th>
            <th>역할</th>
            <th>소개</th>
            <th className="text-right">액션</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((op) => (
            <tr key={op.id}>
              <td className="font-semibold">{tx(op.name)}</td>
              <td className="text-[var(--color-fg-muted)]">{tx(op.role)}</td>
              <td className="max-w-md text-[var(--color-fg-muted)]">{tx(op.bio)}</td>
              <td>
                <RowActions />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center text-[var(--color-fg-subtle)]">
                조건에 맞는 운영진이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </TableCard>
    </div>
  );
}
