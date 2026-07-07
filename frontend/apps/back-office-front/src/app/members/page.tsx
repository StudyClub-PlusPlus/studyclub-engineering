import { members, studies } from "@studyclub/mock";
import { tx } from "@/lib/l10n";
import { PageHeader } from "@/components/ui";
import { MembersTable } from "@/components/MembersTable";

export const metadata = { title: "스터디원" };

export default function MembersAdmin() {
  const studyMap = Object.fromEntries(studies.map((s) => [s.id, tx(s.title)]));

  return (
    <div>
      <PageHeader title="스터디원 명부" subtitle="활동 스터디원과 참여 스터디" createLabel="스터디원 추가" />
      <MembersTable members={members} studyMap={studyMap} />
    </div>
  );
}
