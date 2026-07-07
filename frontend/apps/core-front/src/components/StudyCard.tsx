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
    <div className="card card-hover relative flex flex-col overflow-hidden">
      {/* Stretched link — covers the whole card without nesting anchors */}
      <Link
        href={`/${locale}/studies/${study.id}`}
        className="absolute inset-0 z-[1] rounded-[inherit]"
        aria-label={t(study.title, locale)}
      />

      {/* Thumbnail — banner at the top */}
      <StudyThumb image={study.image} seed={study.id} category={study.category ?? study.tags?.[0]} />

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 break-keep text-[15px] font-semibold leading-snug">{t(study.title, locale)}</h3>
          <StatusBadge status={study.status} locale={locale} />
        </div>

        <p className="line-clamp-2 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">{t(study.summary, locale)}</p>

        <div className="flex flex-wrap gap-1.5">
          {study.kind === "club" && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ color: "var(--color-accent)", background: "var(--color-accent-soft)" }}
            >
              {m("kind.club", locale)}
            </span>
          )}
          <Pill>{m(`format.${study.format}`, locale)}</Pill>
          {study.tags?.slice(0, 2).map((tag) => (
            <Pill key={tag}>#{tag}</Pill>
          ))}
        </div>

        {/* 하단 그룹 (host · 메타 · 신청) — mt-auto 로 바닥 정렬 */}
        <div className="mt-auto flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
          {host && (
            <div className="flex items-center gap-2">
              {host.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={host.avatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              ) : (
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg, var(--color-accent), #7c75f0)" }}
                >
                  {t(host.name, locale).charAt(0)}
                </span>
              )}
              <div className="min-w-0 leading-tight">
                <span className="text-xs font-semibold text-[var(--color-fg)]">{t(host.name, locale)}</span>
                {host.credential && (
                  <span className="ml-1.5 text-[11px] text-[var(--color-fg-subtle)]">· {t(host.credential, locale)}</span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-[var(--color-fg-subtle)]">
            <span className="flex items-center gap-3">
              {study.schedule ? (
                <span className="flex items-center gap-1">
                  <CalendarClock size={12} /> {t(study.schedule, locale)}
                </span>
              ) : study.year ? (
                <span className="flex items-center gap-1">
                  <CalendarClock size={12} /> {study.year}
                </span>
              ) : (
                <span />
              )}
              {study.seats && (
                <span className="flex items-center gap-1">
                  <Users size={12} /> {study.seats.taken}/{study.seats.total}
                </span>
              )}
            </span>
            {study.recruit_url && (
              <a
                href={study.recruit_url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-[2] inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition-transform hover:scale-[1.03]"
                style={{ background: "var(--color-accent)" }}
              >
                {t({ ko: "모집 신청", en: "Apply" }, locale)}
                <ArrowUpRight size={12} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
