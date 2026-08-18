import { studies } from "@studyclub/mock";
import { PageHeader } from "@/components/ui";
import { StudiesTable } from "@/components/StudiesTable";
import { StudyCreateButton } from "@/components/StudyCreateButton";

export const metadata = { title: "스터디" };

export default function StudiesAdmin() {
  return (
    <div>
      <PageHeader
        title="스터디 관리"
        action={<StudyCreateButton />}
      />
      <StudiesTable studies={studies} />
    </div>
  );
}
