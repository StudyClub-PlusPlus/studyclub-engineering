"use client";

import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

/**
 * design-system.md §9-8 Filter Chip.
 * 미선택: 흰 bg + border-strong + neutral-700
 * 선택(다중): brand-subtle bg + primary-700 / 선택(단일): brand solid
 */
export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** single = 라디오처럼 하나만 고르는 그룹 → 선택 시 solid */
  selectMode?: "single" | "multi";
}

export function FilterChip({
  selected = false,
  selectMode = "multi",
  className,
  children,
  ...rest
}: FilterChipProps) {
  const solid = selected && selectMode === "single";
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={selected}
      className={cx(
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-3 text-sm font-medium",
        "transition-[background-color,border-color,color] duration-fast ease-out",
        "focus-visible:outline-none focus-visible:shadow-[var(--ring)]",
        solid
          ? "border border-transparent bg-brand text-on-brand hover:bg-brand-hover"
          : selected
            ? "border border-transparent bg-brand-subtle text-primary-700 hover:bg-brand-subtle-hover"
            : "border border-border-strong bg-bg text-neutral-700 hover:bg-surface-1",
        className,
      )}
    >
      {children}
    </button>
  );
}
