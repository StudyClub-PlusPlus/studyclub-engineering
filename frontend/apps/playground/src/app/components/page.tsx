"use client";

import { useState } from "react";
import {
  StatusBadge,
  Pill,
  StudyCard,
  StudyThumb,
  EventCard,
  JoinCta,
  Tabs,
  RegionClocks,
  StudyBrowser,
  EventBrowser,
  Footer,
} from "@studyclub/ui";
import { studies, events, operators, site } from "@studyclub/mock";
import type { Locale, StudyStatus } from "@studyclub/mock";

const STATUSES: StudyStatus[] = ["recruiting", "ongoing", "closed"];
const leads = Object.fromEntries(operators.map((o) => [o.id, o]));

/** 카탈로그 한 칸. 제목 + 짧은 설명 + 실물. */
function Case({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[var(--color-border)] pt-8">
      <h2 className="text-lg font-bold">{title}</h2>
      {note && <p className="mt-1 text-sm text-[var(--color-fg-subtle)]">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ComponentsCatalog() {
  const [locale, setLocale] = useState<Locale>("ko");

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">컴포넌트 카탈로그</h1>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            <code>@studyclub/ui</code> 의 컴포넌트를 상태별로 늘어놓았습니다. 여기 보이는 것이 실제 서비스에 나가는 것과 같습니다.
          </p>
        </div>
        {/* 언어 토글 — 대부분의 컴포넌트가 locale 을 받는다 */}
        <div className="flex items-center gap-1 rounded-full bg-[var(--color-surface-subtle)] p-1 text-sm">
          {(["ko", "en"] as Locale[]).map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              className="rounded-full px-3 py-1 font-semibold transition-colors"
              style={
                locale === l
                  ? { background: "var(--color-accent)", color: "#fff" }
                  : { color: "var(--color-fg-subtle)" }
              }
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <Case title="StatusBadge" note="스터디 상태 3종. 색은 packages/ui/src/theme.css 의 --color-{status} 토큰.">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <StatusBadge key={s} status={s} locale={locale} />
          ))}
        </div>
      </Case>

      <Case title="Pill" note="분류·태그용 중립 라벨.">
        <div className="flex flex-wrap gap-2">
          {["AI", "System Design", "Interview", "Frontend"].map((p) => (
            <Pill key={p}>{p}</Pill>
          ))}
        </div>
      </Case>

      <Case title="StudyThumb" note="이미지가 없으면 seed 로 그라데이션을 생성한다. 같은 seed = 항상 같은 그림.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {studies.slice(0, 4).map((s) => (
            <StudyThumb key={s.id} seed={s.id} image={s.image} category={s.category} />
          ))}
        </div>
      </Case>

      <Case title="StudyCard" note="스터디 목록의 기본 단위.">
        <div className="grid gap-4 sm:grid-cols-2">
          {studies.slice(0, 2).map((s) => (
            <StudyCard key={s.id} study={s} locale={locale} lead={s.lead ? leads[s.lead] : undefined} />
          ))}
        </div>
      </Case>

      <Case title="EventCard" note="행사 한 줄. 좌측 날짜 박스 + 본문.">
        <div className="card divide-y divide-[var(--color-border)] p-0">
          {events.slice(0, 3).map((e) => (
            <EventCard key={e.id} event={e} locale={locale} />
          ))}
        </div>
      </Case>

      <Case title="Tabs" note="클라이언트 상태. 첫 탭이 기본 선택.">
        <Tabs
          tabs={[
            { key: "a", label: "설명", content: <p className="py-6 text-sm">첫 번째 탭 내용입니다.</p> },
            { key: "b", label: "멤버", badge: 12, content: <p className="py-6 text-sm">badge 는 숫자를 옆에 붙입니다.</p> },
            { key: "c", label: "리뷰", content: <p className="py-6 text-sm">세 번째 탭.</p> },
          ]}
        />
      </Case>

      <Case title="RegionClocks" note="지역별 현재 시각. 마운트 전엔 placeholder (hydration 불일치 방지).">
        <RegionClocks locale={locale} />
      </Case>

      <Case title="JoinCta" note="디스코드 합류 유도 배너.">
        <JoinCta locale={locale} discordUrl={site.discord_invite} />
      </Case>

      <Case title="StudyBrowser" note="검색 + 필터가 붙은 스터디 목록 전체. 실제 /studies 페이지가 이걸 그대로 쓴다.">
        <StudyBrowser studies={studies.slice(0, 6)} locale={locale} leads={leads} />
      </Case>

      <Case title="EventBrowser" note="검색 + 종류 필터가 붙은 행사 목록.">
        <EventBrowser events={events.slice(0, 6)} locale={locale} />
      </Case>

      <Case title="Footer" note="site 객체(커뮤니티 정보·링크)를 받는다.">
        <Footer locale={locale} site={site} />
      </Case>

      {/* 카탈로그에서 뺀 것: Nav (앱 라우팅에 묶임), NavAuth (세션 필요) */}
      <p className="border-t border-[var(--color-border)] pt-8 text-sm text-[var(--color-fg-faint)]">
        Nav 는 앱 라우팅에, NavAuth 는 로그인 세션에 묶여 있어 카탈로그에 넣지 않았습니다.
        확인하려면 <code>/screens/*</code> 화면에서 보세요.
      </p>
    </div>
  );
}
