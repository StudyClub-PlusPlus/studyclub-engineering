import Link from "next/link";
import { Users, CalendarClock, ArrowUpRight } from "lucide-react";
import type { Locale, Operator, Study } from "@/lib/content";
import { m, t } from "@/lib/i18n";
import { Pill, StatusBadge } from "./Badge";
import { StudyThumb } from "./StudyThumb";

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
  const host = study.host;
  return (
    <div className="card card-hover relative flex flex-col gap-3 overflow-hidden p-5">
      {/* Stretched link — covers the whole card without nesting anchors */}
      <Link
        href={`/${locale}/studies/${study.id}`}
        className="absolute inset-0 z-[1] rounded-[inherit]"
        aria-label={t(study.title, locale)}
      />

      {/* Thumbnail — full-bleed at the top of the card */}
      <div className="-mx-5 -mt-5 mb-1">
        <StudyThumb image={study.image} seed={study.id} category={study.category ?? study.tags?.[0]} />
      </div>

      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-keep text-[17px] font-semibold leading-snug">{t(study.title, locale)}</h3>
        <StatusBadge status={study.status} locale={locale} />
      </div>

      <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">{t(study.summary, locale)}</p>

      <div className="flex flex-wrap gap-1.5">
        {study.kind === "club" && (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ color: "var(--color-accent)", background: "var(--color-accent-soft)" }}
          >
            {m("kind.club", locale)}
          </span>
        )}
        <Pill>{m(`format.${study.format}`, locale)}</Pill>
        {study.tags?.map((tag) => (
          <Pill key={tag}>#{tag}</Pill>
        ))}
      </div>

      {/* Host / 클럽장 */}
      {host && (
        <div className="mt-auto flex items-center gap-2.5">
          {host.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={host.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, var(--color-accent), #7c75f0)" }}
            >
              {t(host.name, locale).charAt(0)}
            </span>
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-xs font-semibold text-[var(--color-fg)]">{t(host.name, locale)}</div>
            {host.credential && (
              <div className="truncate text-[11px] text-[var(--color-fg-subtle)]">{t(host.credential, locale)}</div>
            )}
          </div>
        </div>
      )}

      <div
        className={`${host ? "" : "mt-auto"} flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-fg-subtle)]`}
      >
        {(study.schedule || study.year) && (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {study.schedule && (
              <span className="flex items-center gap-1.5">
                <CalendarClock size={13} /> {t(study.schedule, locale)}
              </span>
            )}
            {study.year && <span>📅 {study.year}</span>}
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
          className="relative z-[2] inline-flex items-center gap-1 self-start rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-[1.03]"
          style={{ background: "var(--color-accent)" }}
        >
          {t({ ko: "모집 신청", en: "Apply" }, locale)}
          <ArrowUpRight size={13} />
        </a>
      )}
    </div>
  );
}
