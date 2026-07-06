import { studies, operators } from "@studyclub/mock";
import { tx, FORMAT_LABEL } from "@/lib/l10n";
import { StatusBadge, PageHeader, RowActions, TableCard } from "@/components/ui";

export const metadata = { title: "스터디" };

export default function StudiesAdmin() {
  const opMap = Object.fromEntries(operators.map((o) => [o.id, o]));

  return (
    <div>
      <PageHeader title="스터디 관리" subtitle="코호트 라이프사이클과 정원 관리" createLabel="스터디 생성" />

      <TableCard>
        <thead>
          <tr>
            <th>스터디</th>
            <th>상태</th>
            <th>형식</th>
            <th>정원</th>
            <th>운영</th>
            <th className="text-right">액션</th>
          </tr>
        </thead>
        <tbody>
          {studies.map((s) => (
            <tr key={s.id}>
              <td className="font-semibold">{tx(s.title)}</td>
              <td>
                <StatusBadge status={s.status} />
              </td>
              <td className="text-[var(--color-fg-muted)]">{FORMAT_LABEL[s.format] ?? s.format}</td>
              <td className="text-[var(--color-fg-muted)]">{s.seats ? `${s.seats.taken}/${s.seats.total}` : "—"}</td>
              <td className="text-[var(--color-fg-muted)]">{s.lead ? tx(opMap[s.lead]?.name) : "—"}</td>
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
