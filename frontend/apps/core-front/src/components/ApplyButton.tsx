"use client";

import { useState } from "react";

import { ApplyDialog } from "./ApplyDialog";
import type { Locale, Study } from "@/lib/content";
import { recruitLabel, recruitState } from "@/lib/recruit";

/** 신청 버튼 + 폼. 서버 컴포넌트인 상세 페이지에서 이 조각만 클라이언트로 분리한다. */
export function ApplyButton({ study, locale }: { study: Study; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const state = recruitState(study);
  const label = recruitLabel(state, locale);

  if (state === "closed") {
    return (
      <span className="inline-flex items-center rounded-pill bg-surface-2 px-7 py-3 text-sm font-bold text-fg-placeholder">
        {label}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-pill bg-brand px-8 py-3 text-sm font-bold text-on-brand shadow-sm transition-[background-color,transform] hover:bg-brand-hover hover:scale-[1.02] focus-visible:outline-none focus-visible:shadow-[var(--ring)]"
      >
        {label}
      </button>
      <ApplyDialog study={study} locale={locale} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
