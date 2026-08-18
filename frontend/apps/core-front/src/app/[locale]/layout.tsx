import { notFound } from "next/navigation";
import { Nav, Footer } from "@studyclub/ui";
import { NavAuth } from "@/components/NavAuth";
import { getSite } from "@/lib/content";
import { LOCALES, isLocale } from "@/lib/i18n";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const site = await getSite();

  return (
    <div className="flex min-h-screen flex-col">
      <Nav
        locale={locale}
        discordUrl={site.discord_invite}
        mentoringUrl={site.mentoring_url}
        auth={<NavAuth locale={locale} />}
      />
      <main className="flex-1">{children}</main>
      <Footer locale={locale} site={site} />
    </div>
  );
}
