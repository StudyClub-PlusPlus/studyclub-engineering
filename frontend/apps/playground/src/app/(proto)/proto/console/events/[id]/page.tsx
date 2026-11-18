import { EventAdminDetail } from '@/proto/events/EventAdminDetail';

export const metadata = { title: '행사 운영 · Playground' };
export default async function EventAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventAdminDetail id={id} />;
}
