import { notFound } from "next/navigation";
import { studies } from "@studyclub/mock";
import { StudyConsole } from "@/components/StudyConsole";

export function generateStaticParams() {
  return studies.map((s) => ({ id: s.id }));
}

/** 스터디 운영 페이지 — 크루·출석·정보를 한 스터디 안에서 처리한다. */
export default async function StudyAdminDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const study = studies.find((s) => s.id === id);
  if (!study) notFound();

  return <StudyConsole study={study} />;
}
