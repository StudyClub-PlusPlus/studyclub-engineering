import Link from "next/link";
import { BookOpen, Compass, UserPlus, Sparkles, HelpCircle } from "lucide-react";
import { getSite, type Locale, type L10n } from "@/lib/content";
import { m, t } from "@/lib/i18n";
import { JoinCta } from "@/components/JoinCta";

type Section = { id: string; icon: typeof BookOpen; title: L10n };

const SECTIONS: Section[] = [
  { id: "what", icon: BookOpen, title: { ko: "스터디 클럽이란?", en: "What is the study club?" } },
  { id: "captain", icon: Compass, title: { ko: "캡틴이란?", en: "What's a Captain?" } },
  { id: "join", icon: UserPlus, title: { ko: "참여하는 법", en: "How to join" } },
  { id: "propose", icon: Sparkles, title: { ko: "스터디 제안·개설하는 법", en: "How to propose a study" } },
  { id: "faq", icon: HelpCircle, title: { ko: "자주 묻는 질문", en: "FAQ" } },
];

export default async function GuidePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const site = await getSite();

  const joinSteps: L10n[] = [
    { ko: "디스코드에 합류합니다.", en: "Join the Discord server." },
    { ko: "모집 중인 스터디를 찾습니다.", en: "Find a study that's recruiting." },
    { ko: "모집폼(구글폼)으로 신청합니다.", en: "Apply through the recruiting form." },
    { ko: "킥오프에 참여해 반장·일정·진행 방식을 정합니다.", en: "Join the kickoff to set the lead, schedule, and format." },
  ];

  const proposeSteps: L10n[] = [
    { ko: "공부하고 싶은 주제로 스터디를 제안합니다 — 누구나 가능합니다.", en: "Propose a study on a topic you want to learn — anyone can." },
    { ko: "캡틴이 모집 광고, 디스코드 채널, 킥오프 세팅을 도와줍니다.", en: "A Captain helps set up recruiting, the Discord channel, and the kickoff." },
    { ko: "모집이 열리면 스터디원이 모이고 킥오프로 시작합니다.", en: "Once recruiting opens, members gather and you start with the kickoff." },
    { ko: "반장·부반장, 발표자(백업 포함)를 정해 운영하고, 마지막엔 회고로 마무리합니다.", en: "Assign a lead and co-lead, dual presenters (with backup), and end with a retro." },
  ];

  const faqs: { q: L10n; a: L10n }[] = [
    {
      q: { ko: "참여 비용이 있나요?", en: "Does it cost anything?" },
      a: {
        ko: "무료입니다. StudyClub++ 는 100% 자원봉사로 운영되며, 발생하는 수익은 전액 기부합니다.",
        en: "It's free. StudyClub++ is 100% volunteer-run, and any profits are donated in full.",
      },
    },
    {
      q: { ko: "개발자가 아니어도 참여할 수 있나요?", en: "Can I join if I'm not a developer?" },
      a: {
        ko: "네. 개발·AI 스터디가 많지만 어학·북클럽·라이프스타일 등 다양한 스터디가 있어, 관심만 있으면 누구나 참여할 수 있습니다.",
        en: "Yes. There are many dev and AI studies, but also language, book club, and habit clubs — anyone interested is welcome.",
      },
    },
    {
      q: { ko: "스터디는 보통 몇 명이 참여하나요?", en: "How many people are in a study?" },
      a: {
        ko: "스터디당 보통 10~15명이 참여합니다. 인원이 많으면 반을 나누기도 합니다.",
        en: "Usually 10–15 people per study. Larger groups may split into sections.",
      },
    },
    {
      q: { ko: "중간에 합류할 수 있나요?", en: "Can I join partway through?" },
      a: {
        ko: "마감일이 없는 스터디는 언제든 합류할 수 있습니다. 마감일이 지난 스터디는 다음 모집을 기다리면 됩니다.",
        en: "Studies with no deadline accept members anytime. For studies with a deadline, wait for the next intake.",
      },
    },
    {
      q: { ko: "캡틴이 되려면 어떻게 하나요?", en: "How do I become a Captain?" },
      a: {
        ko: "누구나 지원할 수 있습니다. 디스코드에서 캡틴 모집 안내를 확인하고 문의하세요. 캡틴은 모든 스터디·이벤트에 무료로 참여합니다.",
        en: "Anyone can apply. Check the Captain recruiting notice on Discord and reach out. Captains join every study and event for free.",
      },
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{m("guide.title", locale)}</h1>
        <p className="mt-3 text-lg text-[var(--color-fg-muted)]">{m("guide.subtitle", locale)}</p>
      </header>

      {/* 목차 */}
      <nav className="mt-8 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
          >
            <s.icon size={14} style={{ color: "var(--color-accent)" }} />
            {t(s.title, locale)}
          </a>
        ))}
      </nav>

      {/* 스터디 클럽이란? */}
      <SectionHeading section={SECTIONS[0]} locale={locale} />
      <div className="card p-8">
        <p className="max-w-3xl text-[15px] leading-relaxed text-[var(--color-fg)]">
          {t(
            {
              ko: `StudyClub++ 는 미국·캐나다·한국의 개발자 ${site.community.member_count}+명이 함께하는 글로벌 스터디 커뮤니티입니다. 여러 스터디가 모인 '풀(pool)'로, 누구나 공부하고 싶은 주제로 스터디를 제안하고 운영할 수 있습니다. 디스코드에서 모든 스터디와 이벤트가 운영됩니다.`,
              en: `StudyClub++ is a global study community of ${site.community.member_count}+ engineers across the US, Canada, and Korea. It's a pool of study groups — anyone can propose and run a study on a topic they want to learn. Every study and event runs on Discord.`,
            },
            locale,
          )}
        </p>
      </div>

      {/* 캡틴이란? */}
      <SectionHeading section={SECTIONS[1]} locale={locale} />
      <div className="card p-8">
        <p className="max-w-3xl text-[15px] leading-relaxed text-[var(--color-fg)]">
          {m("about.captain_body", locale)}
        </p>
        <Link
          href={`/${locale}/about`}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          {t({ ko: "소개에서 캡틴 더 보기", en: "More about Captains on About" }, locale)} →
        </Link>
      </div>

      {/* 참여하는 법 */}
      <SectionHeading section={SECTIONS[2]} locale={locale} />
      <ol className="grid gap-3 sm:grid-cols-2">
        {joinSteps.map((step, i) => (
          <li key={i} className="card flex items-start gap-3 p-5">
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
              style={{ background: "var(--color-accent)" }}
            >
              {i + 1}
            </span>
            <span className="text-[15px] leading-relaxed text-[var(--color-fg)]">{t(step, locale)}</span>
          </li>
        ))}
      </ol>

      {/* 스터디 제안·개설하는 법 */}
      <SectionHeading section={SECTIONS[3]} locale={locale} />
      <ol className="grid gap-3 sm:grid-cols-2">
        {proposeSteps.map((step, i) => (
          <li key={i} className="card flex items-start gap-3 p-5">
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
              style={{ background: "var(--color-accent)" }}
            >
              {i + 1}
            </span>
            <span className="text-[15px] leading-relaxed text-[var(--color-fg)]">{t(step, locale)}</span>
          </li>
        ))}
      </ol>

      {/* FAQ */}
      <SectionHeading section={SECTIONS[4]} locale={locale} />
      <div className="flex flex-col gap-3">
        {faqs.map((f, i) => (
          <details key={i} className="card group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-[var(--color-fg)]">
              {t(f.q, locale)}
              <span className="text-[var(--color-fg-faint)] transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-fg-muted)]">{t(f.a, locale)}</p>
          </details>
        ))}
      </div>

      <div className="mt-12">
        <JoinCta locale={locale} discordUrl={site.discord_invite} />
      </div>
    </div>
  );
}

function SectionHeading({ section, locale }: { section: Section; locale: Locale }) {
  return (
    <h2 id={section.id} className="mb-4 mt-12 flex scroll-mt-20 items-center gap-2 text-xl font-bold tracking-tight">
      <section.icon size={20} style={{ color: "var(--color-accent)" }} />
      {t(section.title, locale)}
    </h2>
  );
}
