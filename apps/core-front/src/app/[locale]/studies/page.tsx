import { getStudies, getOperatorMap, type Locale } from "@/lib/content";
import { m } from "@/lib/i18n";
import { StudyCard } from "@/components/StudyCard";

export default async function StudiesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [studies, leads] = await Promise.all([getStudies(), getOperatorMap()]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{m("studies.title", locale)}</h1>
        <p className="mt-3 text-lg text-[var(--color-fg-muted)]">{m("studies.subtitle", locale)}</p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {studies.map((s) => (
          <StudyCard key={s.id} study={s} locale={locale} lead={s.lead ? leads[s.lead] : undefined} />
        ))}
      </div>
    </div>
  );
}
