import { MessageCircle } from "lucide-react";
import type { Locale } from "@/lib/content";
import { m } from "@/lib/i18n";

export function JoinCta({ locale, discordUrl }: { locale: Locale; discordUrl: string }) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl px-8 py-12 text-center"
      style={{ background: "linear-gradient(135deg, var(--color-accent), #6d28d9 90%)" }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, #ffffff, transparent 70%)" }}
      />
      <h2 className="text-2xl font-bold text-white sm:text-3xl">{m("common.join_cta_title", locale)}</h2>
      <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-white/85">{m("common.join_cta_body", locale)}</p>
      <a
        href={discordUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold shadow-sm transition-transform hover:scale-[1.03]"
        style={{ color: "var(--color-accent)" }}
      >
        <MessageCircle size={17} /> {m("nav.join", locale)}
      </a>
    </section>
  );
}
