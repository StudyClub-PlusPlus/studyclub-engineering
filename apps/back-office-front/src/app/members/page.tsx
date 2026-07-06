import { members, studies } from "@studyclub/mock";
import { tx } from "@/lib/l10n";
import { PageHeader, RowActions, TableCard } from "@/components/ui";

export const metadata = { title: "스터디원" };

export default function MembersAdmin() {
  const studyMap = Object.fromEntries(studies.map((s) => [s.id, s]));

  return (
    <div>
      <PageHeader title="스터디원 명부" subtitle="활동 스터디원과 참여 스터디" createLabel="스터디원 추가" />

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
          {members.map((mem) => (
            <tr key={mem.id}>
              <td className="font-semibold">{tx(mem.name)}</td>
              <td className="text-[var(--color-fg-muted)]">{mem.track ?? "—"}</td>
              <td className="text-[var(--color-fg-muted)]">{mem.cohort ?? "—"}</td>
              <td className="text-[var(--color-fg-muted)]">
                {(mem.studies ?? []).map((id) => tx(studyMap[id]?.title)).filter(Boolean).join(", ") || "—"}
              </td>
              <td>
                <RowActions />
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </div>
  );
}
