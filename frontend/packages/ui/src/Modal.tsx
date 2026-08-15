"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "./cx";

/**
 * design-system.md §9-8 Modal/Dialog.
 * radius-modal · shadow-xl · 오버레이 rgba(23,25,35,.48) · 등장 base/ease-out.
 * 모바일은 바텀시트(상단 radius 24).
 *
 * 접근성: Esc 닫기 · 배경 스크롤 잠금 · 열릴 때 첫 포커스 이동 · Tab 순환 가둠.
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** 하단 액션 영역 (버튼 등). */
  footer?: ReactNode;
  size?: "md" | "lg";
  children: ReactNode;
}

const SIZE = { md: "sm:max-w-lg", lg: "sm:max-w-2xl" } as const;

export function Modal({ open, onClose, title, description, footer, size = "md", children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // onClose 는 부모가 매 렌더마다 새로 만드는 경우가 많다. 의존성에 그대로 두면
  // 입력 한 글자마다 아래 효과가 재실행돼 **포커스가 첫 요소로 튄다.** ref 로 최신 값만 참조한다.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevFocus = document.activeElement as HTMLElement | null;

    // 열릴 때 패널 안 첫 포커스 대상으로 이동
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-[fadeIn_var(--duration-base)_var(--ease-out)]"
        style={{ background: "var(--overlay)" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "relative flex max-h-[90vh] w-full flex-col overflow-hidden bg-bg shadow-xl",
          // 모바일 = 바텀시트(상단만 라운드), sm+ = 중앙 모달
          "rounded-t-modal sm:rounded-modal",
          SIZE[size],
        )}
      >
        <header className="flex flex-col gap-1 border-b border-border px-6 py-4">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">{title}</h2>
          {description && <p className="text-sm text-fg-muted">{description}</p>}
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-border bg-surface-1 px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
