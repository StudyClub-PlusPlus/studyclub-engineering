import { events } from "@studyclub/mock";
import { PageHeader } from "@/components/ui";
import { EventsTable } from "@/components/EventsTable";

export const metadata = { title: "행사" };

export default function EventsAdmin() {
  return (
    <div>
      <PageHeader title="행사 관리" subtitle="오프라인 밋업과 온라인 워크샵" createLabel="행사 생성" />
      <EventsTable events={events} />
    </div>
  );
}
