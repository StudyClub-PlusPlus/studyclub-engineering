import { events } from "@studyclub/mock";
import { PageHeader } from "@/components/ui";
import { EventsTable } from "@/components/EventsTable";
import { EventCreateButton } from "@/components/EventCreateButton";

export const metadata = { title: "행사" };

export default function EventsAdmin() {
  return (
    <div>
      <PageHeader title="행사 관리" action={<EventCreateButton />} />
      <EventsTable events={events} />
    </div>
  );
}
