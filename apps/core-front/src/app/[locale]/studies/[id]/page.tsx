import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Users, MessageCircle, Layers } from "lucide-react";
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

export async function generateStaticParams() {
  const studies = await getStudies();
  return studies.map((s) => ({ id: s.id }));
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

  const facts = [
    { icon: Layers, label: m("common.format", locale), value: m(`format.${study.format}`, locale) },
    study.schedule && { icon: CalendarClock, label: m("common.schedule", locale), value: t(study.schedule, locale) },
    study.seats && { icon: Users, label: m("common.seats", locale), value: `${study.seats.taken}/${study.seats.total}` },
    lead && { icon: Users, label: m("common.lead", locale), value: t(lead.name, locale) },
  ].filter(Boolean) as { icon: typeof Layers; label: string; value: string }[];

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href={`/${locale}/studies`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft size={15} /> {m("common.back_studies", locale)}
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{t(study.title, locale)}</h1>
        <StatusBadge status={study.status} locale={locale} />
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

      {/* Description */}
      {study.description && (
        <section className="mt-10">
          <h2 className="text-lg font-bold">{m("common.about_study", locale)}</h2>
          <p className="mt-3 max-w-2xl leading-loose text-[var(--color-fg-muted)]">{t(study.description, locale)}</p>
        </section>
      )}

      {/* Lead */}
      {lead && (
        <section className="mt-10">
          <h2 className="text-lg font-bold">{m("common.lead", locale)}</h2>
          <div className="card mt-3 flex items-start gap-4 p-5">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold text-white"
              style={{ background: "linear-gradient(135deg, var(--color-accent), #7c75f0)" }}
            >
              {t(lead.name, locale).charAt(0)}
            </div>
            <div>
              <div className="font-semibold">{t(lead.name, locale)}</div>
              <div className="text-xs font-semibold" style={{ color: "var(--color-accent)" }}>{t(lead.role, locale)}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-fg-muted)]">{t(lead.bio, locale)}</p>
            </div>
          </div>
        </section>
      )}

      {/* Participants */}
      {participants.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold">
            {m("common.participants", locale)} <span className="text-[var(--color-fg-faint)]">{participants.length}</span>
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {participants.map((p) => (
              <span key={p.id} className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-1 pl-1 pr-3 text-sm">
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
