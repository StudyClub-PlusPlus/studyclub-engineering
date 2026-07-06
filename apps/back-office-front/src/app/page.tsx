import Link from "next/link";
import { BookOpen, CalendarDays, Users, UserCog, ArrowRight } from "lucide-react";
import { studies, events, members, operators } from "@studyclub/mock";
import { tx } from "@/lib/l10n";
import { StatusBadge, PageHeader, TableCard } from "@/components/ui";

export default function Dashboard() {
  const recruiting = studies.filter((s) => s.status === "recruiting").length;

  const stats = [
    { label: "스터디", value: studies.length, sub: `${recruiting} 모집 중`, href: "/studies", icon: BookOpen },
    { label: "행사", value: events.length, sub: "예정", href: "/events", icon: CalendarDays },
    { label: "스터디원", value: members.length, sub: "활동 중", href: "/members", icon: Users },
    { label: "운영진", value: operators.length, sub: "자원봉사", href: "/operators", icon: UserCog },
  ];

  return (
    <div>
      <PageHeader title="대시보드" subtitle="StudyClub++ 운영 현황 한눈에 보기 (mock 데이터)" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card flex flex-col gap-2 p-5 transition-colors hover:border-[var(--color-border-strong)]">
            <div className="flex items-center justify-between">
              <s.icon size={18} className="text-[var(--color-fg-faint)]" />
              <ArrowRight size={15} className="text-[var(--color-fg-faint)]" />
            </div>
            <div className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--color-accent)" }}>
              {s.value}
            </div>
            <div className="text-sm font-medium">{s.label}</div>
            <div className="text-xs text-[var(--color-fg-subtle)]">{s.sub}</div>
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-bold">스터디 라이프사이클</h2>
        <TableCard>
          <thead>
            <tr>
              <th>스터디</th>
              <th>상태</th>
              <th>정원</th>
            </tr>
          </thead>
          <tbody>
            {studies.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold">{tx(s.title)}</td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
                <td className="text-[var(--color-fg-muted)]">{s.seats ? `${s.seats.taken}/${s.seats.total}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      </section>
    </div>
  );
}
