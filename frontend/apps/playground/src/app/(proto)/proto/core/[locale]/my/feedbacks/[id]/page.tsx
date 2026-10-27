import { MyFeedbackDetail } from '@core/components/MyFeedback';
import type { Locale } from '@core/lib/content';

export default async function MyFeedbackPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  return <MyFeedbackDetail locale={locale} id={id} />;
}
