import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import type { StudyclubEvent, Locale } from "@/lib/content";
import { t } from "@/lib/i18n";
import { Pill } from "./Badge";

function dateParts(iso: string, locale: Locale) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { mon: iso, day: "", time: "" };
  const loc = locale === "ko" ? "ko-KR" : "en-US";
  return {
    mon: d.toLocaleDateString(loc, { month: "short" }),
    day: d.toLocaleDateString(loc, { day: "numeric" }),
    time: iso.includes("T") ? d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" }) : "",
  };
}

export function EventCard({ event, locale }: { event: StudyclubEvent; locale: Locale }) {
  const { mon, day, time } = dateParts(event.date, locale);
  return (
    <Link href={`/${locale}/events/${event.id}`} className="card card-hover flex items-stretch gap-4 p-4">
      <div
        className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl py-2 text-center"
        style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide">{mon}</span>
        <span className="text-xl font-bold leading-none">{day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Pill>{event.type}</Pill>
            {time && <span className="text-xs text-[var(--color-fg-faint)]">{time}</span>}
          </div>
          <ArrowRight size={15} className="text-[var(--color-fg-faint)]" />
        </div>
        <h3 className="mt-1.5 text-[15px] font-semibold leading-snug">{t(event.title, locale)}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">{t(event.summary, locale)}</p>
        {event.location && (
          <span className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--color-fg-subtle)]">
            <MapPin size={12} /> {t(event.location, locale)}
          </span>
        )}
      </div>
    </Link>
  );
}
