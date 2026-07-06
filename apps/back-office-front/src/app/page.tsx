import Link from "next/link";
import { BookOpen, Megaphone, PlayCircle, Users2, CalendarDays, Users, ArrowRight } from "lucide-react";
import { studies, events, site } from "@studyclub/mock";
import { tx, EVENT_TYPE_LABEL } from "@/lib/l10n";
import { StatusBadge, PageHeader, TableCard } from "@/components/ui";

export default function Dashboard() {
  const recruiting = studies.filter((s) => s.status === "recruiting");
  const ongoing = studies.filter((s) => s.status === "ongoing");
  const clubs = studies.filter((s) => (s.kind ?? "study") === "club");

  const stats = [
    { label: "총 스터디", value: studies.length, sub: "전체 코호트", href: "/studies", icon: BookOpen },
    { label: "모집중", value: recruiting.length, sub: "오픈 모집", href: "/studies", icon: Megaphone },
    { label: "진행중", value: ongoing.length, sub: "활성 코호트", href: "/studies", icon: PlayCircle },
    { label: "클럽", value: clubs.length, sub: "정기 모임", href: "/studies", icon: Users2 },
    { label: "총 행사", value: events.length, sub: "밋업·워크샵", href: "/events", icon: CalendarDays },
    {
      label: "커뮤니티 멤버",
      value: site.community.member_count.toLocaleString(),
      sub: tx(site.community.region),
      href: "/members",
      icon: Users,
    },
  ];

  const recentEvents = [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div>
      <PageHeader title="대시보드" subtitle="StudyClub++ 운영 현황 한눈에 보기 (mock 데이터)" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="card flex flex-col gap-2 p-5 transition-colors hover:border-[var(--color-border-strong)]"
          >
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

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">모집중 스터디</h2>
            <Link href="/studies" className="text-xs font-medium text-[var(--color-accent)]">
              전체 보기
            </Link>
          </div>
          <TableCard>
            <thead>
              <tr>
                <th>스터디</th>
                <th>상태</th>
                <th>모집 일정</th>
              </tr>
            </thead>
            <tbody>
              {recruiting.map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold">{tx(s.title)}</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="text-[var(--color-fg-muted)]">
                    {s.recruitment?.deadline
                      ? `~${s.recruitment.deadline}`
                      : s.recruitment?.kickoff
                        ? `킥오프 ${s.recruitment.kickoff}`
                        : "—"}
                  </td>
                </tr>
              ))}
              {recruiting.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-[var(--color-fg-subtle)]">
                    모집중 스터디가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </TableCard>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">곧/최근 행사</h2>
            <Link href="/events" className="text-xs font-medium text-[var(--color-accent)]">
              전체 보기
            </Link>
          </div>
          <TableCard>
            <thead>
              <tr>
                <th>행사</th>
                <th>타입</th>
                <th>날짜</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((e) => (
                <tr key={e.id}>
                  <td className="font-semibold">{tx(e.title)}</td>
                  <td className="text-[var(--color-fg-muted)]">{EVENT_TYPE_LABEL[e.type] ?? e.type}</td>
                  <td className="text-[var(--color-fg-muted)]">{e.date}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </section>
      </div>
    </div>
  );
}
