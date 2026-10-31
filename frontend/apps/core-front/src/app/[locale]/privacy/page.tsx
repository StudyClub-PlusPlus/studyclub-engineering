import type { Locale } from '@studyclub/types';
import type { Metadata } from 'next';

import { legalDoc, lx } from '@/features/legal/content';
import { LegalDoc } from '@/features/legal/LegalDoc';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const doc = legalDoc('privacy');
  return pageMetadata({ locale, path: '/privacy', title: lx(doc.title, locale), description: lx(doc.title, locale) });
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <LegalDoc doc={legalDoc('privacy')} locale={locale} />;
}
