import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CalendarCheck } from "lucide-react";
import { getStudy, getStudies, type Locale } from "@/lib/content";
import { isHotStudy } from "@studyclub/mock";
import { m, t } from "@/lib/i18n";
import { categoryGradient, categoryMeta } from "@/components/StudyThumb";
import { recruitLabel, recruitState, toISODate } from "@/lib/recruit";
import { BookmarkButton } from "@/components/BookmarkButton";
import { HotBadge } from "@/components/HotBadge";
import { ApplyButton } from "@/components/ApplyButton";

export async function generateStaticParams() {
  const studies = await getStudies();
  return studies.map((s) => ({ id: s.id }));
}

/**
 * 스터디 상세.
 *
 * **등록 폼(운영자 콘솔)에 있는 항목만 노출한다.** 폼에 없는 값은 운영자가 채울 방법이 없으므로
 * 화면에도 두지 않는다 — 목표·주제·대상·주차 커리큘럼·멤버·후기·통계·정원 전부 제외.
 *
 * 레이아웃은 카드 하나로 묶는다. 헤더(색)–본문(흰색)–신청(고정 바)이 한 덩어리로 읽히게 해서
 * 요소가 따로 떠 보이지 않도록 한다.
 */
export default async function StudyDetail({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const study = await getStudy(id);
  if (!study) notFound();

  const rec = study.recruitment;
  const { icon: CategoryIcon, label: categoryLabel } = categoryMeta(study.category);
  // 모집 여부는 목록 카드·탭과 **같은 함수**로 판정한다. 여기서 따로 계산하면 화면 간 표기가 어긋난다.
  const state = recruitState(study);
  const closed = state === "closed";
  const deadline = toISODate(rec?.deadline);


  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-8">
      <Link
        href={`/${locale}/studies`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary transition-colors hover:text-fg"
      >
        <ArrowLeft size={15} /> {m("common.back_studies", locale)}
      </Link>

      {/* 본문 전체가 하나의 카드 — 헤더와 내용이 분리돼 보이지 않게 한다 */}
      <article className="card mt-4 overflow-hidden">
        {/* 헤더: 카테고리 색. 목록 카드와 같은 규칙이라 어디서 왔는지 바로 이어진다 */}
        <header
          className="flex flex-col gap-2.5 px-8 pb-7 pt-6"
          style={{ background: categoryGradient(study.category) }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-1.5 text-white/85">
              <CategoryIcon size={14} strokeWidth={1.75} className="shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em]">{categoryLabel}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isHotStudy(study) && <HotBadge />}
              <BookmarkButton studyId={study.id} locale={locale} />
            </div>
          </div>
          <h1 className="break-keep text-[28px] font-bold leading-[1.25] tracking-tight text-white">
            {t(study.title, locale)}
          </h1>
          <p className="text-[16px] leading-relaxed text-white/90">{t(study.summary, locale)}</p>
          {study.schedule && (
            <p className="flex items-center gap-1.5 text-[14px] font-medium text-white/90">
              <CalendarClock size={14} strokeWidth={1.75} className="shrink-0" />
              {t(study.schedule, locale)}
            </p>
          )}
        </header>


        {study.description && (
          <div className="px-8 py-7">
            <h2 className="text-[15px] font-bold text-fg">{m("common.about_study", locale)}</h2>
            <p className="mt-3 whitespace-pre-line text-[16px] leading-[1.85] text-fg-secondary">
              {t(study.description, locale)}
            </p>
          </div>
        )}

        {/*
          신청은 카드의 마지막 줄에 둔다. 정보를 다 읽은 직후가 결정 시점이고,
          카드 밖 고정 바는 페이지가 짧을 때 본문과 분리돼 떠 보인다.
        */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-surface-1 px-8 py-5">
          <span className="tnum text-sm font-medium text-fg-secondary">
            {deadline ? t({ ko: `${deadline}까지 모집`, en: `Apply by ${deadline}` }, locale) : ""}
          </span>
          <ApplyButton study={study} locale={locale} />
        </div>
      </article>
    </div>
  );
}
