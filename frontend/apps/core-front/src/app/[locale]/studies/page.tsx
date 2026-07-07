import { getStudies, getOperatorMap, type Locale } from "@/lib/content";
import { m } from "@/lib/i18n";
import { StudyBrowser } from "@/components/StudyBrowser";

const STATUS_RANK: Record<string, number> = { recruiting: 0, ongoing: 1, closed: 2 };

export default async function StudiesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [studies, leads] = await Promise.all([getStudies(), getOperatorMap()]);

  const sorted = [...studies].sort(
    (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || (a.order ?? 99) - (b.order ?? 99),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{m("studies.title", locale)}</h1>
        <p className="mt-3 text-lg text-[var(--color-fg-muted)]">{m("studies.subtitle", locale)}</p>
      </header>

      <StudyBrowser studies={sorted} locale={locale} leads={leads} />
    </div>
  );
}
