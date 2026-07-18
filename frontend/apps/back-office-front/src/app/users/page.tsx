"use client";

// 유저 (스터디원 + 운영진 통합) — 실제 DB 유저를 백엔드에서 조회.
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";

type ApiUser = {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  role: "STUDENT" | "OPERATOR" | "ADMIN" | string;
  createdAt: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "스터디원",
  OPERATOR: "운영진",
  ADMIN: "관리자",
};

const ROLE_STYLE: Record<string, { fg: string; bg: string }> = {
  STUDENT: { fg: "var(--color-accent)", bg: "var(--color-accent-soft)" },
  OPERATOR: { fg: "var(--color-ongoing)", bg: "var(--color-ongoing-soft)" },
  ADMIN: { fg: "var(--color-recruiting)", bg: "var(--color-recruiting-soft)" },
};

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.STUDENT;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: s.fg, background: s.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.fg }} />
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("ko-KR");
}

export default function UsersAdmin() {
  const [users, setUsers] = useState<ApiUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.message ?? `조회 실패 (${r.status})`);
        return data as ApiUser[];
      })
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "유저 조회 중 오류"));
  }, []);

  return (
    <div>
      <PageHeader title="유저" subtitle="스터디원 · 운영진 (실제 가입 계정)" />

      {error && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-red-600">
          {error}
        </div>
      )}

      {!error && users === null && (
        <div className="rounded-xl border border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-fg-subtle)]">
          불러오는 중…
        </div>
      )}

      {!error && users?.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-fg-subtle)]">
          아직 가입한 유저가 없어요. 구글 로그인으로 첫 유저가 생기면 여기 표시됩니다.
        </div>
      )}

      {!error && users && users.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-fg-subtle)]">
                <th className="px-4 py-3 font-medium">유저</th>
                <th className="px-4 py-3 font-medium">이메일</th>
                <th className="px-4 py-3 font-medium">역할</th>
                <th className="px-4 py-3 font-medium">가입일</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.picture} alt="" className="h-8 w-8 rounded-full" />
                      ) : (
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-surface-subtle)] text-xs font-bold">
                          {(u.name ?? u.email).slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium">{u.name ?? "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-fg-muted)]">{u.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3 tabular-nums text-[var(--color-fg-subtle)]">{fmtDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
