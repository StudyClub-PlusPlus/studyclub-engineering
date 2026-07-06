"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Locale, StudyclubEvent } from "@/lib/content";
import { m } from "@/lib/i18n";
import { EventCard } from "./EventCard";

type TypeFilter = "all" | "meetup" | "workshop" | "talk" | "online";

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
      style={
        active
          ? { color: "#fff", background: "var(--color-accent)" }
          : { color: "var(--color-fg-subtle)", background: "var(--color-surface-subtle)" }
      }
    >
      {children}
    </button>
  );
}

export function EventBrowser({ events, locale }: { events: StudyclubEvent[]; locale: Locale }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (type !== "all" && e.type !== type) return false;
      if (q) {
        const hay = [e.title.ko, e.title.en, e.summary.ko, e.summary.en].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, query, type]);

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: "all", label: m("filter.all", locale) },
    { value: "meetup", label: m("event_type.meetup", locale) },
    { value: "workshop", label: m("event_type.workshop", locale) },
    { value: "talk", label: m("event_type.talk", locale) },
    { value: "online", label: m("event_type.online", locale) },
  ];

  return (
    <div className="mt-10">
      {/* Search */}
      <div className="relative max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-fg-faint)]"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={m("filter.search_events", locale)}
          className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
        />
      </div>

      {/* Filter chips */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold text-[var(--color-fg-faint)]">{m("filter.type", locale)}</span>
        {typeOptions.map((o) => (
          <FilterChip key={o.value} active={type === o.value} onClick={() => setType(o.value)}>
            {o.label}
          </FilterChip>
        ))}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {filtered.map((e) => (
            <EventCard key={e.id} event={e} locale={locale} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-sm text-[var(--color-fg-subtle)]">{m("filter.none", locale)}</p>
      )}
    </div>
  );
}
