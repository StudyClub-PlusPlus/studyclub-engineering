"use client";

import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cx } from "./cx";

/** design-system.md §9-2 계열 — 체크박스. 라벨 클릭으로도 토글되며 포커스 링을 공유한다. */
export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export function Checkbox({ label, className, id, ...rest }: CheckboxProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <label
      htmlFor={fieldId}
      className={cx("inline-flex cursor-pointer select-none items-center gap-2", className)}
    >
      <input
        {...rest}
        id={fieldId}
        type="checkbox"
        className="h-4 w-4 shrink-0 cursor-pointer rounded-xs border-border-strong accent-[var(--color-brand)] focus-visible:outline-none focus-visible:shadow-[var(--ring)]"
      />
      <span className="text-sm text-neutral-800">{label}</span>
    </label>
  );
}
