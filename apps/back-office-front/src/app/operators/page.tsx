import { operators } from "@studyclub/mock";
import { PageHeader } from "@/components/ui";
import { OperatorsTable } from "@/components/OperatorsTable";

export const metadata = { title: "운영진" };

export default function OperatorsAdmin() {
  return (
    <div>
      <PageHeader title="운영진 관리" subtitle="스터디 클럽을 굴리는 자원봉사 운영진" createLabel="운영진 추가" />
      <OperatorsTable operators={operators} />
    </div>
  );
}
