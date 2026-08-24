import { StudyBrowser } from "@/components/StudyBrowser";
import { getStudies, getOperatorMap, type Locale } from "@/lib/content";

const STATUS_RANK: Record<string, number> = { recruiting: 0, ongoing: 1, closed: 2 };

export default async function StudiesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [studies, leads] = await Promise.all([getStudies(), getOperatorMap()]);

  const sorted = [...studies].sort(
    (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || (a.order ?? 99) - (b.order ?? 99),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 pb-14 pt-6">
      <StudyBrowser studies={sorted} locale={locale} leads={leads} />
    </div>
  );
}
