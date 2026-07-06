import { operators } from "@studyclub/mock";
import { tx } from "@/lib/l10n";
import { PageHeader, RowActions, TableCard } from "@/components/ui";

export const metadata = { title: "운영진" };

export default function OperatorsAdmin() {
  return (
    <div>
      <PageHeader title="운영진 관리" subtitle="스터디 클럽을 굴리는 자원봉사 운영진" createLabel="운영진 추가" />

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
          {operators.map((op) => (
            <tr key={op.id}>
              <td className="font-semibold">{tx(op.name)}</td>
              <td className="text-[var(--color-fg-muted)]">{tx(op.role)}</td>
              <td className="max-w-md text-[var(--color-fg-muted)]">{tx(op.bio)}</td>
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
