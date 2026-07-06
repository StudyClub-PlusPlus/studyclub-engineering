import { events } from "@studyclub/mock";
import { tx } from "@/lib/l10n";
import { PageHeader, RowActions, TableCard } from "@/components/ui";

export const metadata = { title: "행사" };

export default function EventsAdmin() {
  return (
    <div>
      <PageHeader title="행사 관리" subtitle="오프라인 밋업과 온라인 워크샵" createLabel="행사 생성" />

      <TableCard>
        <thead>
          <tr>
            <th>행사</th>
            <th>유형</th>
            <th>일시</th>
            <th>장소</th>
            <th className="text-right">액션</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td className="font-semibold">{tx(e.title)}</td>
              <td className="text-[var(--color-fg-muted)]">{e.type}</td>
              <td className="text-[var(--color-fg-muted)]">{e.date}</td>
              <td className="text-[var(--color-fg-muted)]">{e.location ? tx(e.location) : "—"}</td>
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
