import Link from "next/link";
import { Users, CalendarClock, ArrowUpRight } from "lucide-react";
import type { Locale, Operator, Study } from "@/lib/content";
import { m, t } from "@/lib/i18n";
import { Pill, StatusBadge } from "./Badge";

export function StudyCard({
  study,
  locale,
  lead,
}: {
  study: Study;
  locale: Locale;
  lead?: Operator;
  index?: number;
}) {
  return (
    <div className="card card-hover relative flex flex-col gap-3 p-5">
      {/* Stretched link — covers the whole card without nesting anchors */}
      <Link
        href={`/${locale}/studies/${study.id}`}
        className="absolute inset-0 rounded-[inherit]"
        aria-label={t(study.title, locale)}
      />

      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-semibold leading-snug">{t(study.title, locale)}</h3>
        <StatusBadge status={study.status} locale={locale} />
      </div>

      <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">{t(study.summary, locale)}</p>

      <div className="flex flex-wrap gap-1.5">
        <Pill>{m(`format.${study.format}`, locale)}</Pill>
        {study.tags?.map((tag) => (
          <Pill key={tag}>#{tag}</Pill>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-fg-subtle)]">
        {study.schedule && (
          <span className="flex items-center gap-1.5">
            <CalendarClock size={13} /> {t(study.schedule, locale)}
          </span>
        )}
        <div className="flex items-center justify-between">
          {study.seats ? (
            <span className="flex items-center gap-1.5">
              <Users size={13} /> {study.seats.taken}/{study.seats.total}
            </span>
          ) : (
            <span />
          )}
          {lead && (
            <span>
              {m("common.lead", locale)} · {t(lead.name, locale)}
            </span>
          )}
        </div>
      </div>

      {study.recruit_url && (
        <a
          href={study.recruit_url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 inline-flex items-center gap-1 self-start rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-[1.03]"
          style={{ background: "var(--color-accent)" }}
        >
          {t({ ko: "모집 신청", en: "Apply" }, locale)}
          <ArrowUpRight size={13} />
        </a>
      )}
    </div>
  );
}
