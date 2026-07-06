import { getStudies, getOperatorMap, type Locale } from "@/lib/content";
import { m, t } from "@/lib/i18n";
import { StudyCard } from "@/components/StudyCard";

const STATUS_RANK: Record<string, number> = { recruiting: 0, ongoing: 1, closed: 2 };

export default async function StudiesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [studies, leads] = await Promise.all([getStudies(), getOperatorMap()]);

  const sorted = [...studies].sort(
    (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || (a.order ?? 99) - (b.order ?? 99),
  );
  const active = sorted.filter((s) => s.status !== "closed");
  const past = sorted.filter((s) => s.status === "closed");

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{m("studies.title", locale)}</h1>
        <p className="mt-3 text-lg text-[var(--color-fg-muted)]">{m("studies.subtitle", locale)}</p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((s) => (
          <StudyCard key={s.id} study={s} locale={locale} lead={s.lead ? leads[s.lead] : undefined} />
        ))}
      </div>

      {past.length > 0 && (
        <details className="mt-10 group">
          <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]">
            <span className="inline-flex items-center gap-1.5">
              {t(
                {
                  ko: `지난 스터디 ${past.length}개 보기`,
                  en: `Show ${past.length} past studies`,
                },
                locale,
              )}
              <span className="transition-transform group-open:rotate-90">→</span>
            </span>
          </summary>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((s) => (
              <StudyCard key={s.id} study={s} locale={locale} lead={s.lead ? leads[s.lead] : undefined} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
