import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  Users,
  MessageCircle,
  Layers,
  Target,
  ListChecks,
  Route,
  CalendarRange,
  UserCheck,
  Quote,
} from "lucide-react";
import {
  getStudy,
  getStudies,
  getOperatorMap,
  getMembersByStudy,
  getSite,
  type Locale,
} from "@/lib/content";
import { m, t } from "@/lib/i18n";
import { StatusBadge, Pill } from "@/components/Badge";
import { StudyThumb } from "@/components/StudyThumb";
import { Tabs, type TabItem } from "@/components/Tabs";

export async function generateStaticParams() {
  const studies = await getStudies();
  return studies.map((s) => ({ id: s.id }));
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="card grid place-items-center px-6 py-12 text-center text-sm text-[var(--color-fg-subtle)]">
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Target; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-bold">
      <Icon size={18} className="text-[var(--color-accent)]" /> {children}
    </h2>
  );
}

export default async function StudyDetail({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const study = await getStudy(id);
  if (!study) notFound();

  const [leads, participants, site] = await Promise.all([
    getOperatorMap(),
    getMembersByStudy(id),
    getSite(),
  ]);
  const lead = study.lead ? leads[study.lead] : undefined;
  const host = study.host;

  const facts = [
    { icon: Layers, label: m("common.format", locale), value: m(`format.${study.format}`, locale) },
    study.schedule && { icon: CalendarClock, label: m("common.schedule", locale), value: t(study.schedule, locale) },
    study.year && !study.schedule && { icon: CalendarClock, label: m("filter.year", locale), value: study.year },
    study.seats && { icon: Users, label: m("common.seats", locale), value: `${study.seats.taken}/${study.seats.total}` },
  ].filter(Boolean) as { icon: typeof Layers; label: string; value: string }[];

  const rec = study.recruitment;
  const recClosed = rec?.status === "closed";

  // ── About 탭 ──────────────────────────────────────────────
  const hasAbout =
    study.description ||
    study.goal ||
    (study.topics && study.topics.length) ||
    (study.how_it_works && study.how_it_works.length) ||
    study.duration ||
    (study.weeks && study.weeks.length) ||
    study.audience;
  const aboutTab = hasAbout ? (
    <div className="space-y-10">
      {study.description && (
        <section>
          <SectionTitle icon={ListChecks}>{m("common.about_study", locale)}</SectionTitle>
          <p className="mt-3 max-w-2xl leading-loose text-[var(--color-fg-muted)]">{t(study.description, locale)}</p>
        </section>
      )}
      {study.goal && (
        <section>
          <SectionTitle icon={Target}>{m("detail.goal", locale)}</SectionTitle>
          <p className="mt-3 max-w-2xl leading-loose text-[var(--color-fg-muted)]">{t(study.goal, locale)}</p>
        </section>
      )}
      {study.topics && study.topics.length > 0 && (
        <section>
          <SectionTitle icon={ListChecks}>{m("detail.topics", locale)}</SectionTitle>
          <ul className="mt-3 max-w-2xl space-y-2">
            {study.topics.map((topic, i) => (
              <li key={i} className="flex gap-2.5 text-[var(--color-fg-muted)]">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--color-accent)" }} />
                <span className="leading-relaxed">{t(topic, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {study.how_it_works && study.how_it_works.length > 0 && (
        <section>
          <SectionTitle icon={Route}>{m("detail.how_it_works", locale)}</SectionTitle>
          <ol className="mt-3 max-w-2xl space-y-3">
            {study.how_it_works.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ background: "var(--color-accent)" }}
                >
                  {i + 1}
                </span>
                <span className="leading-relaxed text-[var(--color-fg-muted)]">{t(step, locale)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {(study.duration || (study.weeks && study.weeks.length > 0)) && (
        <section>
          <SectionTitle icon={CalendarRange}>{m("detail.duration", locale)}</SectionTitle>
          {study.duration && <p className="mt-3 font-semibold text-[var(--color-fg)]">{t(study.duration, locale)}</p>}
          {study.weeks && study.weeks.length > 0 && (
            <ol className="mt-4 space-y-0">
              {study.weeks.map((w, i) => (
                <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-accent)" }} />
                    {i < study.weeks!.length - 1 && <span className="mt-1 w-px flex-1 bg-[var(--color-border)]" />}
                  </div>
                  <div className="pb-1">
                    <div className="text-xs font-semibold" style={{ color: "var(--color-accent)" }}>
                      {t(w.label, locale)}
                    </div>
                    <div className="mt-0.5 font-medium leading-snug">{t(w.title, locale)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {study.audience && (
        <section>
          <SectionTitle icon={UserCheck}>{m("detail.audience", locale)}</SectionTitle>
          <p className="mt-3 max-w-2xl leading-loose text-[var(--color-fg-muted)]">{t(study.audience, locale)}</p>
        </section>
      )}
    </div>
  ) : (
    <Empty>{m("detail.empty_about", locale)}</Empty>
  );

  // ── Members 탭 ────────────────────────────────────────────
  const memberCount = participants.length + (study.past_participants?.length ?? 0);
  const hasMembers = lead || host || memberCount > 0;
  const membersTab = hasMembers ? (
    <div className="space-y-10">
      {(host || lead) && (
        <section>
          <SectionTitle icon={UserCheck}>{m("common.lead", locale)}</SectionTitle>
          <div className="card mt-3 flex items-start gap-4 p-5">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold text-white"
              style={{ background: "linear-gradient(135deg, var(--color-accent), #7c75f0)" }}
            >
              {t(host?.name ?? lead!.name, locale).charAt(0)}
            </div>
            <div>
              <div className="font-semibold">{t(host?.name ?? lead!.name, locale)}</div>
              {(host?.credential || lead?.role) && (
                <div className="text-xs font-semibold" style={{ color: "var(--color-accent)" }}>
                  {host?.credential ? t(host.credential, locale) : t(lead!.role, locale)}
                </div>
              )}
              {lead?.bio && (
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-fg-muted)]">{t(lead.bio, locale)}</p>
              )}
            </div>
          </div>
        </section>
      )}
      {participants.length > 0 && (
        <section>
          <h3 className="text-base font-bold">
            {m("common.participants", locale)}{" "}
            <span className="text-[var(--color-fg-faint)]">{participants.length}</span>
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {participants.map((p) => (
              <span
                key={p.id}
                className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-1 pl-1 pr-3 text-sm"
              >
                <span
                  className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #818cf8, #a78bfa)" }}
                >
                  {t(p.name, locale).charAt(0)}
                </span>
                {t(p.name, locale)}
              </span>
            ))}
          </div>
        </section>
      )}
      {study.past_participants && study.past_participants.length > 0 && (
        <section>
          <h3 className="text-base font-bold">
            {m("detail.past_participants", locale)}{" "}
            <span className="text-[var(--color-fg-faint)]">{study.past_participants.length}</span>
          </h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {study.past_participants.map((p, i) => (
              <Pill key={i}>{t(p, locale)}</Pill>
            ))}
          </div>
        </section>
      )}
    </div>
  ) : (
    <Empty>{m("detail.empty_members", locale)}</Empty>
  );

  // ── Reviews 탭 ────────────────────────────────────────────
  const reviewsTab =
    study.reviews && study.reviews.length > 0 ? (
      <div className="grid gap-3 sm:grid-cols-2">
        {study.reviews.map((r, i) => (
          <figure key={i} className="card p-5">
            <Quote size={16} className="text-[var(--color-fg-faint)]" />
            <blockquote className="mt-2 leading-relaxed text-[var(--color-fg-muted)]">{t(r.text, locale)}</blockquote>
            {r.author && (
              <figcaption className="mt-3 text-sm font-semibold text-[var(--color-fg-subtle)]">
                — {t(r.author, locale)}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    ) : (
      <Empty>{m("detail.empty_reviews", locale)}</Empty>
    );

  // ── Stats 탭 ──────────────────────────────────────────────
  const st = study.stats;
  const statsTab = st ? (
    <div className="card p-5">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-4">
        <div>
          <div className="text-3xl font-extrabold" style={{ color: "var(--color-accent)" }}>
            {st.participants}
          </div>
          <div className="mt-0.5 text-xs text-[var(--color-fg-subtle)]">{m("detail.stat_participants", locale)}</div>
        </div>
        {typeof st.completion_rate === "number" && (
          <div className="min-w-[200px] flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-fg-subtle)]">{m("detail.completion_rate", locale)}</span>
              <span className="font-semibold">{st.completion_rate}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-surface-subtle)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, st.completion_rate))}%`, background: "var(--color-accent)" }}
              />
            </div>
          </div>
        )}
      </div>
      {st.demographics && st.demographics.length > 0 && (
        <div className="mt-5 space-y-2.5 border-t border-[var(--color-border)] pt-4">
          {(() => {
            const max = Math.max(...st.demographics!.map((d) => d.count), 1);
            return st.demographics!.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-[var(--color-fg-subtle)]">{t(d.label, locale)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-subtle)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(d.count / max) * 100}%`, background: "var(--color-accent)" }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-semibold">{d.count}</span>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  ) : (
    <Empty>{m("detail.empty_stats", locale)}</Empty>
  );

  const tabs: TabItem[] = [
    { key: "about", label: m("detail.tab_about", locale), content: aboutTab },
    { key: "members", label: m("detail.tab_members", locale), badge: memberCount || undefined, content: membersTab },
    { key: "reviews", label: m("detail.tab_reviews", locale), badge: study.reviews?.length || undefined, content: reviewsTab },
    { key: "stats", label: m("detail.tab_stats", locale), content: statsTab },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href={`/${locale}/studies`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft size={15} /> {m("common.back_studies", locale)}
      </Link>

      {/* Banner */}
      <div className="mt-5 overflow-hidden rounded-2xl">
        <StudyThumb image={study.image} seed={study.id} category={study.category ?? study.tags?.[0]} />
      </div>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{t(study.title, locale)}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {study.kind && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ color: "var(--color-accent)", background: "var(--color-accent-soft)" }}
            >
              {m(`kind.${study.kind}`, locale)}
              {study.kind === "club" && <span className="font-normal opacity-70">· {m("kind.club_hint", locale)}</span>}
            </span>
          )}
          <StatusBadge status={study.status} locale={locale} />
        </div>
      </header>
      <p className="mt-3 max-w-2xl text-lg text-[var(--color-fg-muted)]">{t(study.summary, locale)}</p>

      {study.tags && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {study.tags.map((tag) => (
            <Pill key={tag}>#{tag}</Pill>
          ))}
        </div>
      )}

      {/* Fact grid */}
      {facts.length > 0 && (
        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
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
      )}

      {/* Recruitment box (탭 위에 항상 고정) */}
      {rec && (
        <div
          className="card mt-6 p-5"
          style={recClosed ? undefined : { borderColor: "var(--color-accent)", background: "var(--color-accent-soft)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--color-fg-subtle)]">{m("detail.recruitment", locale)}</span>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold"
                style={
                  recClosed
                    ? { color: "var(--color-closed)", background: "var(--color-closed-soft)" }
                    : { color: "#fff", background: "var(--color-accent)" }
                }
              >
                {m(`recruit.${rec.status}`, locale)}
              </span>
            </div>
            {rec.form_url && !recClosed && (
              <a
                href={rec.form_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
                style={{ background: "var(--color-accent)" }}
              >
                {m("detail.apply", locale)} <ArrowUpRight size={15} />
              </a>
            )}
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {rec.deadline && (
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-xs text-[var(--color-fg-subtle)]">{m("detail.deadline", locale)}</dt>
                <dd className="font-semibold">{rec.deadline}</dd>
              </div>
            )}
            {rec.kickoff && (
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-xs text-[var(--color-fg-subtle)]">{m("detail.kickoff", locale)}</dt>
                <dd className="font-semibold">{rec.kickoff}</dd>
              </div>
            )}
            {typeof rec.capacity === "number" && (
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-xs text-[var(--color-fg-subtle)]">{m("detail.capacity", locale)}</dt>
                <dd className="font-semibold">
                  {rec.capacity}
                  {m("detail.people", locale)}
                </dd>
              </div>
            )}
            {rec.cadence && (
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-xs text-[var(--color-fg-subtle)]">{m("detail.cadence", locale)}</dt>
                <dd className="font-semibold">{rec.cadence}</dd>
              </div>
            )}
          </dl>
          {recClosed && <p className="mt-3 text-sm text-[var(--color-fg-subtle)]">{m("detail.recruit_closed", locale)}</p>}
          {rec.note && <p className="mt-3 text-xs leading-relaxed text-[var(--color-fg-subtle)]">{t(rec.note, locale)}</p>}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-10">
        <Tabs tabs={tabs} />
      </div>

      {/* CTA */}
      <a
        href={study.discord_url || site.discord_invite}
        target="_blank"
        rel="noreferrer"
        className="mt-12 inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
        style={{ background: "var(--color-accent)" }}
      >
        <MessageCircle size={17} /> {m("common.apply_discord", locale)}
      </a>
    </div>
  );
}
