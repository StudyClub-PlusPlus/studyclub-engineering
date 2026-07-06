import { getEvents, type Locale } from "@/lib/content";
import { m } from "@/lib/i18n";
import { EventCard } from "@/components/EventCard";

export default async function EventsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const events = await getEvents();

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{m("events.title", locale)}</h1>
        <p className="mt-3 text-lg text-[var(--color-fg-muted)]">{m("events.subtitle", locale)}</p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {events.map((e) => (
          <EventCard key={e.id} event={e} locale={locale} />
        ))}
      </div>
    </div>
  );
}
