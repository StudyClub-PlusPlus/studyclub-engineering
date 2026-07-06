import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Locale, Site } from "@/lib/content";
import { m, t } from "@/lib/i18n";

export function Footer({ locale, site }: { locale: Locale; site: Site }) {
  return (
    <footer className="mt-20 border-t border-[var(--color-border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold">
            <span
              className="grid h-7 w-7 place-items-center rounded-lg text-sm font-extrabold text-white"
              style={{ background: "var(--color-accent)" }}
            >
              S
            </span>
            StudyClub++
          </div>
          <p className="mt-3 text-sm text-[var(--color-fg-subtle)]">
            {m("footer.tagline", locale)} · {t(site.community.region, locale)} · {site.community.member_count}+
          </p>
          <p className="mt-1 text-xs text-[var(--color-fg-faint)]">
            © {new Date().getFullYear()} StudyClub++ · preview · dummy data
          </p>
        </div>
        <div className="flex flex-col gap-3 text-sm sm:items-end">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[var(--color-fg-muted)]">
            <Link href={`/${locale}/studies`} className="hover:text-[var(--color-fg)]">{m("nav.studies", locale)}</Link>
            <Link href={`/${locale}/events`} className="hover:text-[var(--color-fg)]">{m("nav.events", locale)}</Link>
            <Link href={`/${locale}/about`} className="hover:text-[var(--color-fg)]">{m("nav.about", locale)}</Link>
            <a href={site.discord_invite} target="_blank" rel="noreferrer" className="hover:text-[var(--color-fg)]">Discord</a>
            {site.mentoring_url && (
              <a href={site.mentoring_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-[var(--color-fg)]">
                {m("nav.mentoring", locale)} <ArrowUpRight size={12} />
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
