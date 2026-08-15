"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@studyclub/ui";
import { StudyCreateDialog } from "./StudyCreateDialog";

/**
 * 페이지 헤더의 생성 버튼 + 등록 팝업.
 *
 * `?new=1` 로 팝업이 바로 열린다 — 문서·메신저에서 버튼 위치를 설명하지 않고 링크 하나로 보내기 위함.
 *
 * 주소는 `useSearchParams` 대신 마운트 후 `window.location` 으로 읽는다.
 * `useSearchParams` 는 Suspense 경계를 요구하는데, 그 fallback 버튼이 실제 버튼과 함께 남아
 * "눌리지 않는 버튼"이 생겼다. 이 화면은 첫 렌더에 파라미터가 필요하지 않으므로 마운트 후 읽으면 충분하다.
 */
export function StudyCreateButton({ label = "스터디 등록" }: { label?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") setOpen(true);
  }, []);

  /** 팝업 상태를 주소에 반영한다 (히스토리를 쌓지 않고 교체). */
  function syncUrl(next: boolean) {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("new", "1");
    else url.searchParams.delete("new");
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <Button
        size="sm"
        leadingIcon={<Plus size={15} />}
        onClick={() => {
          setOpen(true);
          syncUrl(true);
        }}
      >
        {label}
      </Button>
      <StudyCreateDialog
        open={open}
        onClose={() => {
          setOpen(false);
          syncUrl(false);
        }}
      />
    </>
  );
}
