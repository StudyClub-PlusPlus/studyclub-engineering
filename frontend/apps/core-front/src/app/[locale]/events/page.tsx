import { getEvents, type Locale } from "@/lib/content";
import { m } from "@/lib/i18n";
import { EventBrowser } from "@/components/EventBrowser";

export default async function EventsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const events = await getEvents();

  // 최신순 (newest-first)
  const byDateDesc = [...events].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{m("events.title", locale)}</h1>
        <p className="mt-3 text-lg text-[var(--color-fg-muted)]">{m("events.subtitle", locale)}</p>
      </header>

      <EventBrowser events={byDateDesc} locale={locale} />
    </div>
  );
}
