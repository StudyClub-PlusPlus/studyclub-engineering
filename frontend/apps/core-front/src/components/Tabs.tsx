"use client";

import { useState, type ReactNode } from "react";

export type TabItem = { key: string; label: string; badge?: number; content: ReactNode };

export function Tabs({ tabs }: { tabs: TabItem[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">
        {tabs.map((tb) => {
          const on = active === tb.key;
          return (
            <button
              key={tb.key}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(tb.key)}
              className="relative -mb-px whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition-colors"
              style={{ color: on ? "var(--color-accent)" : "var(--color-fg-subtle)" }}
            >
              {tb.label}
              {typeof tb.badge === "number" && (
                <span className="ml-1.5 text-xs font-bold text-[var(--color-fg-faint)]">{tb.badge}</span>
              )}
              {on && (
                <span
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                  style={{ background: "var(--color-accent)" }}
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-7">{current?.content}</div>
    </div>
  );
}
