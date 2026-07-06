import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Locale } from "@/lib/content";
import { m } from "@/lib/i18n";

export function Nav({
  locale,
  discordUrl,
  mentoringUrl,
}: {
  locale: Locale;
  discordUrl: string;
  mentoringUrl?: string;
}) {
  const other: Locale = locale === "ko" ? "en" : "ko";
  const links = [
    { href: `/${locale}/studies`, label: m("nav.studies", locale) },
    { href: `/${locale}/events`, label: m("nav.events", locale) },
    { href: `/${locale}/guide`, label: m("nav.guide", locale) },
    { href: `/${locale}/notices`, label: m("nav.notices", locale) },
    { href: `/${locale}/about`, label: m("nav.about", locale) },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-7 px-6">
        <Link href={`/${locale}`} className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span
            className="grid h-7 w-7 place-items-center rounded-lg text-sm font-extrabold text-white"
            style={{ background: "var(--color-accent)" }}
          >
            S
          </span>
          StudyClub++
        </Link>

        <nav className="ml-2 hidden items-center gap-6 text-sm font-medium md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]">
              {l.label}
            </Link>
          ))}
          {mentoringUrl && (
            <a
              href={mentoringUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-accent)]"
            >
              {m("nav.mentoring", locale)}
              <ArrowUpRight size={13} />
            </a>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link
            href={`/${other}`}
            className="rounded-full px-2 py-1 text-xs font-semibold text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-fg)]"
          >
            {other.toUpperCase()}
          </Link>
          <a
            href={discordUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors sm:block"
            style={{ background: "var(--color-accent)" }}
          >
            {m("nav.join", locale)}
          </a>
        </div>
      </div>
    </header>
  );
}
