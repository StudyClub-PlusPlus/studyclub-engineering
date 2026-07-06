import Link from "next/link";
import { ArrowRight, BookOpen, Calendar, MessageCircle } from "lucide-react";
import { getSite, type Locale } from "@/lib/content";
import { m, t } from "@/lib/i18n";
import { JoinCta } from "@/components/JoinCta";

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const site = await getSite();

  const body = t(
    {
      ko: `StudyClub++ 는 개발자 ${site.community.member_count}+명이 모인 커뮤니티입니다. SWE/MLE 커리어 — 이력서, 인터뷰, 시스템 디자인, 커리어 생존 — 를 함께 준비하는 자원봉사 운영 모임입니다. 오프라인 밋업과 온라인 세션을 오가며 원격으로도 참여합니다.`,
      en: `StudyClub++ is a community of ${site.community.member_count}+ engineers. It is a volunteer-run group preparing together for SWE/MLE careers — resumes, interviews, system design, and career survival. We mix offline meetups with online sessions, with members joining remotely.`,
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
