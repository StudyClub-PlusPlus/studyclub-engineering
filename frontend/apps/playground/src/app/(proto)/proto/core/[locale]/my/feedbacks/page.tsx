import { MyFeedbackList } from '@core/components/MyFeedback';
import type { Locale } from '@core/lib/content';

export default async function MyFeedbacksPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <MyFeedbackList locale={locale} />;
}
