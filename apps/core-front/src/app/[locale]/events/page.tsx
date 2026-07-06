import { getEvents, type Locale } from "@/lib/content";
import { m, t } from "@/lib/i18n";
import { EventCard } from "@/components/EventCard";

export default async function EventsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const events = await getEvents();

  const byDateDesc = [...events].sort((a, b) => b.date.localeCompare(a.date));
  const now = new Date();
  const upcoming = byDateDesc.filter((e) => new Date(e.date) >= now);
  const past = byDateDesc.filter((e) => new Date(e.date) < now);

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{m("events.title", locale)}</h1>
        <p className="mt-3 text-lg text-[var(--color-fg-muted)]">{m("events.subtitle", locale)}</p>
      </header>

      {upcoming.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-fg-muted)]">
            {t({ ko: "다가오는 행사", en: "Upcoming" }, locale)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-10">
          {upcoming.length > 0 && (
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-fg-muted)]">
              {t({ ko: "지난 행사", en: "Past events" }, locale)}
            </h2>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {past.map((e) => (
              <EventCard key={e.id} event={e} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
