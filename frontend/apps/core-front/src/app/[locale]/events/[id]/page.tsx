import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Tag, ArrowUpRight } from "lucide-react";
import { getEvent, getEvents, type Locale } from "@/lib/content";
import { m, t } from "@/lib/i18n";

export async function generateStaticParams() {
  const events = await getEvents();
  return events.map((e) => ({ id: e.id }));
}

function fullDate(iso: string, locale: Locale) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const loc = locale === "ko" ? "ko-KR" : "en-US";
  return d.toLocaleDateString(loc, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: iso.includes("T") ? "2-digit" : undefined,
    minute: iso.includes("T") ? "2-digit" : undefined,
  });
}

export default async function EventDetail({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const facts = [
    { icon: CalendarDays, label: m("common.when", locale), value: fullDate(event.date, locale) },
    { icon: Tag, label: m("common.type", locale), value: event.type },
    event.location && { icon: MapPin, label: m("common.where", locale), value: t(event.location, locale) },
  ].filter(Boolean) as { icon: typeof Tag; label: string; value: string }[];

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href={`/${locale}/events`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft size={15} /> {m("common.back_events", locale)}
      </Link>

      <span
        className="mt-6 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide"
        style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
      >
        {event.type}
      </span>
      <h1 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{t(event.title, locale)}</h1>
      <p className="mt-3 max-w-2xl text-lg text-[var(--color-fg-muted)]">{t(event.summary, locale)}</p>

      <dl className="mt-8 grid gap-3 sm:grid-cols-2">
        {facts.map((f) => (
          <div key={f.label} className="card flex items-center gap-3 p-4">
            <f.icon size={18} className="shrink-0 text-[var(--color-fg-faint)]" />
            <div>
              <dt className="text-xs text-[var(--color-fg-subtle)]">{f.label}</dt>
              <dd className="font-semibold">{f.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      {event.link && (
        <a
          href={event.link}
          target="_blank"
          rel="noreferrer"
          className="mt-12 inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
          style={{ background: "var(--color-accent)" }}
        >
          {m("common.rsvp", locale)} <ArrowUpRight size={17} />
        </a>
      )}
    </div>
  );
}
