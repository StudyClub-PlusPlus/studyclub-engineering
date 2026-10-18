import { FeedbackNewForm } from '@core/components/Feedback';
import { getSite, type Locale } from '@core/lib/content';

export default async function NewFeedbackPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const site = await getSite();
  return <FeedbackNewForm locale={locale} discordUrl={site.discord_invite} />;
}
