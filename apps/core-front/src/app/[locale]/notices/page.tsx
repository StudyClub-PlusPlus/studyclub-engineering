import { getNotices, getSite, type Locale } from "@/lib/content";
import { m, t } from "@/lib/i18n";
import { Pill } from "@/components/Badge";
import { JoinCta } from "@/components/JoinCta";

export default async function NoticesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [notices, site] = await Promise.all([getNotices(), getSite()]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{m("notices.title", locale)}</h1>
        <p className="mt-3 text-lg text-[var(--color-fg-muted)]">{m("notices.subtitle", locale)}</p>
      </header>

      <div className="mt-10 flex flex-col gap-4">
        {notices.map((n) => (
          <article
            key={n.id}
            className="card card-hover p-6"
            style={n.pinned ? { borderColor: "var(--color-accent)", background: "var(--color-accent-soft)" } : undefined}
          >
            <div className="flex flex-wrap items-center gap-2">
              {n.pinned && <span aria-label="pinned">📌</span>}
              {n.tag && <Pill>{m(`notice_tag.${n.tag}`, locale)}</Pill>}
              <time className="ml-auto text-xs font-medium text-[var(--color-fg-faint)]">{n.date}</time>
            </div>
            <h2 className="mt-3 text-lg font-bold tracking-tight">{t(n.title, locale)}</h2>
            <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-[var(--color-fg-muted)]">
              {t(n.body, locale)}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-12">
        <JoinCta locale={locale} discordUrl={site.discord_invite} />
      </div>
    </div>
  );
}
