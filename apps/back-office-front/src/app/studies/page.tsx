import { studies, operators } from "@studyclub/mock";
import { tx } from "@/lib/l10n";
import { PageHeader } from "@/components/ui";
import { StudiesTable } from "@/components/StudiesTable";

export const metadata = { title: "스터디" };

export default function StudiesAdmin() {
  const opMap = Object.fromEntries(operators.map((o) => [o.id, tx(o.name)]));

  return (
    <div>
      <PageHeader title="스터디 관리" subtitle="코호트 라이프사이클과 정원 관리" createLabel="스터디 생성" />
      <StudiesTable studies={studies} opMap={opMap} />
    </div>
  );
}
