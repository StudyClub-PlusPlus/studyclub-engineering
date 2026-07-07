import Link from "next/link";
import { ArrowRight, BookOpen, Calendar, Compass, MessageCircle } from "lucide-react";
import { getSite, getOperators, type Locale } from "@/lib/content";
import { m, t } from "@/lib/i18n";
import { JoinCta } from "@/components/JoinCta";
import { RegionClocks } from "@/components/RegionClocks";

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [site, operators] = await Promise.all([getSite(), getOperators()]);

  const captainPoints = [
    { ko: "스터디 초기 세팅(모집 광고 · 디스코드 · 킥오프)을 도와줍니다.", en: "They handle the initial setup — recruiting, Discord, and kickoff." },
    { ko: "100% 자원봉사이며, 수익은 전액 기부합니다.", en: "100% volunteer, and all profits are donated." },
    { ko: "캡틴은 모든 스터디와 이벤트에 무료로 참여합니다.", en: "Captains join every study and event for free." },
    { ko: "누구나 캡틴에 지원할 수 있습니다.", en: "Anyone can apply to become a Captain." },
  ];

  const body = t(
    {
      ko: `StudyClub++ 는 미국·캐나다·한국의 개발자 ${site.community.member_count}+명이 함께하는 글로벌 커뮤니티입니다. SWE/MLE 커리어 — 이력서, 인터뷰, 시스템 디자인, 커리어 생존 — 를 함께 준비하는 자원봉사 운영 모임입니다. 세 지역의 시차를 넘나들며 온라인 세션과 오프라인 밋업을 오가고, 원격으로도 참여합니다.`,
      en: `StudyClub++ is a global community of ${site.community.member_count}+ engineers across the US, Canada, and Korea. It is a volunteer-run group preparing together for SWE/MLE careers — resumes, interviews, system design, and career survival. Spanning three time zones, we mix online sessions with offline meetups, and members join remotely.`,
    },
    locale,
  );

  const cards = [
    { href: `/${locale}/studies`, icon: BookOpen, label: m("studies.title", locale), external: false },
    { href: `/${locale}/events`, icon: Calendar, label: m("events.title", locale), external: false },
    ...(site.mentoring_url
      ? [{ href: site.mentoring_url, icon: MessageCircle, label: m("nav.mentoring", locale), external: true }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{m("about.title", locale)}</h1>
        <p className="mt-3 text-lg text-[var(--color-fg-muted)]">{m("about.subtitle", locale)}</p>
      </header>

      <div className="card mt-10 p-8">
        <p className="max-w-3xl text-[17px] leading-loose text-[var(--color-fg)]">{body}</p>
      </div>

      {/* 캡틴이란? */}
      <div
        className="mt-6 rounded-2xl border p-8"
        style={{ background: "var(--color-accent-soft)", borderColor: "var(--color-accent-soft)" }}
      >
        <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Compass size={20} style={{ color: "var(--color-accent)" }} />
          {m("about.captain_title", locale)}
        </h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[var(--color-fg-muted)]">
          {m("about.captain_body", locale)}
        </p>
        <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {captainPoints.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-[15px] text-[var(--color-fg)]">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--color-accent)" }} />
              {t(p, locale)}
            </li>
          ))}
        </ul>
      </div>

      {/* 캡틴 (운영진) 소개 */}
      {operators.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-xl font-bold tracking-tight">{m("about.operators", locale)}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {operators.map((op) => (
              <div key={op.id} className="card p-6">
                <div className="text-base font-bold">{t(op.name, locale)}</div>
                <div className="mt-0.5 text-sm font-medium text-[var(--color-accent)]">{t(op.role, locale)}</div>
                <p className="mt-2.5 text-sm leading-relaxed text-[var(--color-fg-muted)]">{t(op.bio, locale)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 글로벌 — 세 지역 실시간 시계 */}
      <div className="mt-10">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold tracking-tight">
          🌏 {t({ ko: "지금, 세 지역에서", en: "Right now, across three regions" }, locale)}
        </h2>
        <RegionClocks locale={locale} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => {
          const body = (
            <>
              <span className="flex items-center gap-2.5 font-semibold">
                <c.icon size={18} style={{ color: "var(--color-accent)" }} />
                {c.label}
              </span>
              <ArrowRight size={16} className="text-[var(--color-fg-faint)]" />
            </>
          );
          return c.external ? (
            <a key={c.label} href={c.href} target="_blank" rel="noreferrer" className="card card-hover flex items-center justify-between p-5">
              {body}
            </a>
          ) : (
            <Link key={c.label} href={c.href} className="card card-hover flex items-center justify-between p-5">
              {body}
            </Link>
          );
        })}
      </div>

      <div className="mt-10">
        <JoinCta locale={locale} discordUrl={site.discord_invite} />
      </div>
    </div>
  );
}
