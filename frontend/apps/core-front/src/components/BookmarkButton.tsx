"use client";

import { useEffect, useState } from "react";

import { Heart } from "lucide-react";

import type { Locale } from "@/lib/content";
import { t } from "@/lib/i18n";
import { getBookmarks, setBookmarked } from "@/lib/me";

/** 관심 스터디(하트). 저장은 `lib/me` 가 담당한다(마이페이지가 같은 목록을 읽는다). */

export function BookmarkButton({
  studyId,
  locale,
  tone = "onColor",
}: {
  studyId: string;
  locale: Locale;
  /** onColor = 컬러 배너 위, plain = 흰 배경 위 */
  tone?: "onColor" | "plain";
}) {
  // 서버 렌더 결과와 어긋나지 않도록 마운트 후에만 실제 상태를 반영한다
  const [marked, setMarked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMarked(getBookmarks().includes(studyId));
    setReady(true);
  }, [studyId]);

  function toggle(e: React.MouseEvent) {
    // 카드 전체가 링크인 목록에서 상세로 이동해버리지 않게 막는다
    e.preventDefault();
    e.stopPropagation();
    const next = !marked;
    setMarked(next);
    setBookmarked(studyId, next);
  }

  const label = t(
    marked
      ? { ko: "관심 스터디에서 빼기", en: "Remove from saved" }
      : { ko: "관심 스터디에 담기", en: "Save study" },
    locale,
  );

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={marked}
      aria-label={label}
      title={label}
      className={`relative z-[2] inline-grid h-9 w-9 shrink-0 place-items-center rounded-full transition-[background-color,transform] hover:scale-110 focus-visible:outline-none focus-visible:shadow-[var(--ring)] ${
        tone === "onColor"
          ? ready && marked
            ? "bg-white/90 hover:bg-white"
            : "bg-white/15 hover:bg-white/25"
          : "bg-surface-2 hover:bg-surface-3"
      }`}
    >
      {/*
        눌린 하트를 컬러 배너 위에 그대로 두면, 배너가 붉은 계열일 때 빨간 하트가 묻힌다.
        컬러 위에서는 **흰 원 + 빨간 하트**로 뒤집어 어떤 색 위에서도 눌림이 보이게 한다.
      */}
      <Heart
        size={17}
        strokeWidth={2}
        className={
          ready && marked
            ? "fill-current text-error-600"
            : tone === "onColor"
              ? "text-white/90"
              : "text-fg-placeholder"
        }
      />
    </button>
  );
}
