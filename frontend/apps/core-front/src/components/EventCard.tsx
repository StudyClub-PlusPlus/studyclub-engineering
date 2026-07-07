import Link from "next/link";
import { MapPin, ChevronRight } from "lucide-react";
import type { StudyclubEvent, Locale } from "@/lib/content";
import { m, t } from "@/lib/i18n";

function dateParts(iso: string, locale: Locale) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { mon: iso, day: "", year: "", time: "" };
  const loc = locale === "ko" ? "ko-KR" : "en-US";
  return {
    mon: d.toLocaleDateString(loc, { month: "short" }),
    day: d.toLocaleDateString(loc, { day: "numeric" }),
    year: String(d.getFullYear()),
    time: iso.includes("T") ? d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" }) : "",
  };
}

// 행사 목록의 한 "행". (카드 그리드가 아니라 리스트형)
export function EventRow({ event, locale }: { event: StudyclubEvent; locale: Locale }) {
  const { mon, day, year, time } = dateParts(event.date, locale);
  return (
    <Link
      href={`/${locale}/events/${event.id}`}
      className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-[var(--color-surface-subtle)] sm:px-5"
    >
      {/* 날짜 박스 */}
      <div
        className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl py-1.5 text-center"
        style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide">{mon}</span>
        <span className="text-lg font-bold leading-none">{day}</span>
        {year && <span className="mt-0.5 text-[9px] font-medium opacity-70">{year}</span>}
      </div>

      {/* 본문 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11px] text-[var(--color-fg-faint)]">
          <span
            className="rounded-full px-2 py-0.5 font-semibold"
            style={{ color: "var(--color-accent)", background: "var(--color-accent-soft)" }}
          >
            {m(`event_type.${event.type}`, locale)}
          </span>
          {time && <span>{time}</span>}
          {event.location && (
            <span className="flex items-center gap-0.5">
              <MapPin size={11} /> {t(event.location, locale)}
            </span>
          )}
        </div>
        <h3 className="mt-1 truncate text-[15px] font-semibold leading-snug">{t(event.title, locale)}</h3>
        <p className="truncate text-[13px] text-[var(--color-fg-muted)]">{t(event.summary, locale)}</p>
      </div>

      <ChevronRight
        size={18}
        className="shrink-0 text-[var(--color-fg-faint)] transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

// 이전 이름 호환 (행으로 렌더).
export const EventCard = EventRow;
