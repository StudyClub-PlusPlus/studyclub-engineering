import { MyFeedbackList } from '@core/components/MyFeedback';
import { getSite, type Locale } from '@core/lib/content';

export default async function MyFeedbacksPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const site = await getSite();
  return <MyFeedbackList locale={locale} discordUrl={site.discord_invite} />;
}
