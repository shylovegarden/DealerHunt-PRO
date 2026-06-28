import Link from "next/link";

// HomeIQ landing — the house vertical's front door (Phase 1: FIND). The full lead dashboard is next;
// this surfaces what's real today (the GovDeals real-estate source is live) and the free source roadmap,
// honestly (no fabricated listings — statuses reflect actual build state). Same engine as DealerHunt Pro.

const ACCENT = "#2dd4bf";

const SOURCES: {
  name: string;
  detail: string;
  status: "live" | "soon" | "planned";
}[] = [
  {
    name: "GovDeals real estate",
    detail:
      "Gov / foreclosure disposal — discounted single-family, land, multi-family",
    status: "live",
  },
  {
    name: "AllSurplus real estate",
    detail: "Liquidity sister site — same engine, different catalog",
    status: "soon",
  },
  {
    name: "HUD Homes",
    detail: "hudhomestore.gov — government-owned homes",
    status: "soon",
  },
  {
    name: "GSA real estate",
    detail: "realestatesales.gov — federal property",
    status: "planned",
  },
  {
    name: "FSBO / Craigslist",
    detail: "By-owner, motivated, negotiable",
    status: "planned",
  },
  {
    name: "Pre-foreclosure (NOD)",
    detail: "County public records — time-sensitive leads",
    status: "planned",
  },
];

const STATUS: Record<string, { label: string; color: string }> = {
  live: { label: "LIVE", color: ACCENT },
  soon: { label: "SOON", color: "var(--amber)" },
  planned: { label: "PLANNED", color: "var(--t4)" },
};

export default function HomeIQLanding() {
  return (
    <main className="min-h-screen bg-[var(--s1)] text-[var(--t1)]">
      <header className="max-w-5xl mx-auto px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-[10px] grid place-items-center text-black font-black shadow-sm"
            style={{ background: ACCENT }}
            aria-hidden
          >
            H
          </span>
          <span className="font-black text-lg tracking-tight">HomeIQ</span>
          <span
            className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            Beta
          </span>
        </div>
        <Link
          href="/welcome"
          className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)] transition-colors"
        >
          ← Switch hunt
        </Link>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10">
        <span
          className="text-[11px] font-black uppercase tracking-[0.3em]"
          style={{ color: ACCENT }}
        >
          Real estate leads
        </span>
        <h1 className="mt-3 text-[clamp(34px,6vw,68px)] font-black leading-[0.98]">
          Every distressed house,
          <br />
          deal-scored before anyone calls.
        </h1>
        <p className="mt-5 max-w-2xl text-[var(--t3)] text-lg leading-relaxed">
          HomeIQ runs on the same engine as DealerHunt Pro — the chameleon
          scraper, geocoding, and deal-math — pointed at houses. Discounted,
          distressed, and foreclosure inventory, found and ranked.{" "}
          <span className="text-[var(--t2)] font-semibold">
            All free — no paid data brokers.
          </span>
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/homeiq/leads"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-black text-sm transition-transform hover:scale-[1.03]"
            style={{ background: ACCENT, boxShadow: `0 8px 30px ${ACCENT}55` }}
          >
            View live leads
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-sm font-black uppercase tracking-widest text-[var(--t4)] mb-4">
          Lead sources
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {SOURCES.map((s) => {
            const st = STATUS[s.status];
            return (
              <div
                key={s.name}
                className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-4 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-[var(--t1)]">{s.name}</div>
                  <div className="text-sm text-[var(--t3)] mt-0.5">
                    {s.detail}
                  </div>
                </div>
                <span
                  className="shrink-0 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
                  style={{ background: `${st.color}1f`, color: st.color }}
                >
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-sm text-[var(--t4)]">
          The full lead dashboard — map, hot-leads feed, lead scores, and the
          ARV / 70%-rule deal analyzer — is the next phase. The engine already
          harvests; the surface is coming.
        </p>
      </section>
    </main>
  );
}
