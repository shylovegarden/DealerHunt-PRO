import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/server-supabase";
import { Ico } from "@/components/shared/Ico";
import { LiveCount } from "@/components/landing/LiveCount";

export const metadata = {
  title: "AutoVerse — Underpriced cars & distressed homes, deal-scored",
  description:
    "Two markets, one engine. DealerHunt finds underpriced cars and HomeIQ finds distressed real-estate leads — each priced against the live market so you know exactly what to pay before you bid. Free, no paid data brokers.",
};

// One shared strip of proof points under the hero.
const PROOF = [
  { icon: "map" as const, text: "Scans all 50 states" },
  { icon: "trending-up" as const, text: "BUY / HOLD / PASS on every listing" },
  { icon: "check-circle" as const, text: "Free — no paid data brokers" },
];

export default async function Home() {
  try {
    const { data } = await getServerUser();
    // Logged in → the vertical selector (pick HomeIQ or DealerHunt).
    if (data?.user) redirect("/welcome");
  } catch {
    // Not configured or no session — show the public landing.
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--s1)] pb-safe">
      {/* Top bar */}
      <header className="w-full max-w-6xl mx-auto px-6 pt-7 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-[10px] grid place-items-center text-white shadow-sm"
            style={{ background: "var(--grad)" }}
            aria-hidden
          >
            <Ico name="search" size={17} />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-[var(--t1)]">
            AutoVerse
          </span>
        </div>
        <Link
          href="/login"
          className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)] transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* Hero — sells BOTH markets */}
      <section className="flex flex-col items-center text-center px-6 pt-16 md:pt-24 pb-10">
        <span
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase px-3 py-1.5 rounded-full mb-8"
          style={{ background: "var(--amber-lo)", color: "var(--amber-d)" }}
        >
          Two markets · one engine
        </span>

        <h1 className="serif text-[2.4rem] leading-[1.08] md:text-[3.8rem] font-semibold text-[var(--t1)] max-w-3xl tracking-tight">
          Underpriced cars. Distressed homes.
          <br />
          <span
            style={{
              background: "var(--grad)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Know exactly what to pay.
          </span>
        </h1>

        <p className="mt-6 text-base md:text-lg text-[var(--t3)] max-w-xl leading-relaxed">
          AutoVerse scans every source, prices each listing against the live
          market, and tells you the profit before you bid — cars and real
          estate, on one login.
        </p>

        <div className="mt-9 flex flex-col items-center gap-4">
          <Link
            href="/register"
            className="btn btn-primary inline-flex items-center justify-center gap-2 px-8 py-4 text-base shadow-[var(--shadow)] min-h-[52px]"
          >
            Get started free
            <Ico name="arrow" size={18} />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--t4)] hover:text-[var(--t2)] transition-colors"
          >
            Already have an account? Sign in
          </Link>
        </div>

        {/* Proof strip */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-[var(--t4)]">
          {PROOF.map((p) => (
            <span key={p.text} className="inline-flex items-center gap-1.5">
              <Ico name={p.icon} size={15} className="text-[var(--t3)]" />
              {p.text}
            </span>
          ))}
        </div>
      </section>

      {/* The two products — equal billing */}
      <section className="w-full max-w-5xl mx-auto px-6 pb-24 grid gap-5 md:grid-cols-2">
        {/* DealerHunt — cars */}
        <div className="glass-panel p-7 flex flex-col gap-4 text-left">
          <div className="flex items-center gap-3">
            <span
              className="w-11 h-11 rounded-[14px] grid place-items-center text-xl"
              style={{ background: "var(--grad)" }}
              aria-hidden
            >
              🚗
            </span>
            <div>
              <h2 className="text-lg font-black text-[var(--t1)] leading-tight">
                DealerHunt
              </h2>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--amber-d)]">
                Auto flip intelligence
              </p>
            </div>
          </div>
          <p className="text-sm text-[var(--t3)] leading-relaxed">
            Every auction &amp; marketplace, valued against real sold comps —
            BUY / HOLD / PASS the moment you see it, with the true net profit
            after fees, transport, and recon.
          </p>
          <LiveCount kind="cars" />
          <Link
            href="/register"
            className="mt-1 inline-flex items-center gap-2 self-start px-5 py-2.5 rounded-full font-bold text-[14px] text-white transition-transform hover:translate-x-0.5"
            style={{ background: "var(--grad)" }}
          >
            Explore cars
            <Ico name="arrow" size={16} />
          </Link>
        </div>

        {/* HomeIQ — homes */}
        <div className="glass-panel p-7 flex flex-col gap-4 text-left">
          <div className="flex items-center gap-3">
            <span
              className="w-11 h-11 rounded-[14px] grid place-items-center text-xl"
              style={{ background: "var(--grad-home)" }}
              aria-hidden
            >
              🏠
            </span>
            <div>
              <h2 className="text-lg font-black text-[var(--t1)] leading-tight">
                HomeIQ
              </h2>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--home)]">
                Real-estate lead intelligence
              </p>
            </div>
          </div>
          <p className="text-sm text-[var(--t3)] leading-relaxed">
            Every distressed, discounted, and foreclosure property — found,
            scored, and ranked by equity before anyone calls. Max offer, cap
            rate, and cashflow on each lead.
          </p>
          <LiveCount kind="homes" />
          <Link
            href="/register"
            className="mt-1 inline-flex items-center gap-2 self-start px-5 py-2.5 rounded-full font-bold text-[14px] text-black transition-transform hover:translate-x-0.5"
            style={{ background: "var(--grad-home)" }}
          >
            Explore homes
            <Ico name="arrow" size={16} />
          </Link>
        </div>
      </section>

      <footer className="w-full max-w-5xl mx-auto px-6 py-8 border-t border-[var(--b1)] text-xs text-[var(--t5)]">
        © {new Date().getFullYear()} AutoVerse — DealerHunt (autos) + HomeIQ
        (real estate). One engine, two markets.
      </footer>
    </main>
  );
}
