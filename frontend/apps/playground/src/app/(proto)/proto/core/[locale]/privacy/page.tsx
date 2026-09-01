import { LegalDoc } from '@core/components/LegalDoc';
import type { Locale } from '@core/lib/content';
import { PRIVACY } from '@core/lib/legal';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <>
      <ScreenSpecRegistrar spec={SPEC} />
      <LegalDoc doc={PRIVACY} locale={locale} />
    </>
  );
}
