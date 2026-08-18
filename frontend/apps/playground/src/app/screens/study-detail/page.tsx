// 화면 시안 — 스터디 상세.
// 새 화면을 만들 때 이 폴더를 통째로 복사해서 시작하세요.
// 규칙 하나: 컴포넌트는 직접 만들지 말고 @studyclub/ui 에서 가져옵니다.
//           여기 없는 게 필요하면 일단 이 파일 안에 만들고, 두 화면에서 쓰이게 되면 ui 로 올립니다.
"use client";

import { StatusBadge, Pill, StudyThumb, Tabs, JoinCta, t, m } from "@studyclub/ui";
import { studies, operators, site } from "@studyclub/mock";
import type { Locale } from "@studyclub/mock";

const LOCALE: Locale = "ko";

export default function StudyDetailScreen() {
  const study = studies[0];
  const lead = operators.find((o) => o.id === study.lead);

  return (
    <article className="space-y-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-faint)]">
        화면 시안 · 스터디 상세
      </p>

      {/* 헤더 — 썸네일 + 제목 + 메타 */}
      <header className="grid gap-6 sm:grid-cols-[220px_1fr]">
        <StudyThumb seed={study.id} image={study.image} category={study.category} />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={study.status} locale={LOCALE} />
            {(study.tags ?? []).slice(0, 4).map((tag) => (
              <Pill key={tag}>{tag}</Pill>
            ))}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{t(study.title, LOCALE)}</h1>
          <p className="mt-3 leading-relaxed text-[var(--color-fg-muted)]">{t(study.summary, LOCALE)}</p>

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <Meta label={m("common.lead", LOCALE)} value={lead ? t(lead.name, LOCALE) : "—"} />
            <Meta label={m("common.format", LOCALE)} value={m(`format.${study.format}`, LOCALE)} />
            <Meta label={m("common.schedule", LOCALE)} value={study.schedule ? t(study.schedule, LOCALE) : "—"} />
          </dl>
        </div>
      </header>

      <Tabs
        tabs={[
          {
            key: "about",
            label: m("detail.tab_about", LOCALE),
            content: (
              <div className="py-6 leading-relaxed text-[var(--color-fg-muted)]">
                {study.description ? t(study.description, LOCALE) : m("detail.empty_about", LOCALE)}
              </div>
            ),
          },
          {
            key: "weeks",
            label: m("detail.duration", LOCALE),
            badge: study.weeks?.length,
            content: (
              <ol className="divide-y divide-[var(--color-border)] py-2">
                {(study.weeks ?? []).map((w, i) => (
                  <li key={i} className="flex gap-4 py-3 text-sm">
                    <span className="w-16 shrink-0 font-semibold text-[var(--color-fg-faint)]">
                      {t(w.label, LOCALE)}
                    </span>
                    <span>{t(w.title, LOCALE)}</span>
                  </li>
                ))}
                {!study.weeks?.length && (
                  <li className="py-6 text-sm text-[var(--color-fg-subtle)]">커리큘럼이 아직 없습니다.</li>
                )}
              </ol>
            ),
          },
          {
            key: "reviews",
            label: m("detail.tab_reviews", LOCALE),
            badge: study.reviews?.length,
            content: (
              <div className="space-y-3 py-4">
                {(study.reviews ?? []).map((r, i) => (
                  <blockquote key={i} className="card p-5 text-sm leading-relaxed">
                    “{t(r.text, LOCALE)}”
                    {r.author && (
                      <footer className="mt-2 text-xs text-[var(--color-fg-faint)]">— {t(r.author, LOCALE)}</footer>
                    )}
                  </blockquote>
                ))}
                {!study.reviews?.length && (
                  <p className="text-sm text-[var(--color-fg-subtle)]">{m("detail.empty_reviews", LOCALE)}</p>
                )}
              </div>
            ),
          },
        ]}
      />

      <JoinCta locale={LOCALE} discordUrl={site.discord_invite} />
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-[var(--color-fg-faint)]">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
