import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getStudies, getEvents, getOperatorMap, getMembers, getSite, type Locale } from "@/lib/content";
import { m, t } from "@/lib/i18n";
import { StudyCard } from "@/components/StudyCard";
import { EventCard } from "@/components/EventCard";
import { JoinCta } from "@/components/JoinCta";

export default async function Landing({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [studies, events, leads, members, site] = await Promise.all([
    getStudies(),
    getEvents(),
    getOperatorMap(),
    getMembers(),
    getSite(),
  ]);
  const featured = studies
    .filter((s) => s.status === "recruiting" || s.status === "ongoing")
    .sort((a, b) => (a.status === "recruiting" ? 0 : 1) - (b.status === "recruiting" ? 0 : 1) || (a.order ?? 99) - (b.order ?? 99))
    .slice(0, 6);
  const upcoming = [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  const stats = [
    { k: `${site.community.member_count}+`, v: t({ ko: "커뮤니티 멤버", en: "Members" }, locale) },
    { k: `${members.length}`, v: t({ ko: "활동 스터디원", en: "Active members" }, locale) },
    { k: `${studies.length}`, v: t({ ko: "스터디", en: "Studies" }, locale) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Hero */}
      <section className="relative py-16 sm:py-24">
        <div className="hero-glow" />
        <div
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-fg-muted)] shadow-sm"
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-accent)" }} />
          {m("hero.eyebrow", locale)}
        </div>
        <h1 className="mt-5 max-w-3xl whitespace-pre-line text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
          {m("hero.title", locale)}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--color-fg-muted)]">{m("hero.subtitle", locale)}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={site.discord_invite}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
            style={{ background: "var(--color-accent)" }}
          >
            {m("hero.cta", locale)}
            <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
          </a>
          <Link
            href={`/${locale}/studies`}
            className="rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-6 py-3 text-base font-semibold shadow-sm transition-colors hover:bg-[var(--color-surface-subtle)]"
          >
            {m("hero.cta_studies", locale)}
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-12 flex flex-wrap gap-8">
          {stats.map((s) => (
            <div key={s.v}>
              <div className="text-3xl font-extrabold tracking-tight">{s.k}</div>
              <div className="mt-0.5 text-sm text-[var(--color-fg-subtle)]">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured studies */}
      {featured.length > 0 && (
        <section className="pb-14">
          <SectionHead
            title={m("studies.title", locale)}
            subtitle={m("studies.subtitle", locale)}
            href={`/${locale}/studies`}
            more={t({ ko: "전체 보기", en: "View all" }, locale)}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((s) => (
              <StudyCard key={s.id} study={s} locale={locale} lead={s.lead ? leads[s.lead] : undefined} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <section className="pb-14">
          <SectionHead
            title={m("events.title", locale)}
            subtitle={m("events.subtitle", locale)}
            href={`/${locale}/events`}
            more={t({ ko: "전체 보기", en: "View all" }, locale)}
          />
          <div className="card divide-y divide-[var(--color-border)] overflow-hidden p-0">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} locale={locale} />
            ))}
          </div>
        </section>
      )}

      <section className="pb-4">
        <JoinCta locale={locale} discordUrl={site.discord_invite} />
      </section>
    </div>
  );
}

function SectionHead({
  title,
  subtitle,
  href,
  more,
}: {
  title: string;
  subtitle?: string;
  href: string;
  more: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-[var(--color-fg-subtle)]">{subtitle}</p>}
      </div>
      <Link href={href} className="shrink-0 text-sm font-medium text-[var(--color-accent)] hover:underline">
        {more} →
      </Link>
    </div>
  );
}
