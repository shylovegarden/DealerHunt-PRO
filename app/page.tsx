import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/server-supabase";
import { Ico } from "@/components/shared/Ico";

const features = [
  {
    icon: "map" as const,
    title: "Scans all 50 states",
    body: "One search reaches every auction and marketplace, coast to coast.",
  },
  {
    icon: "trending-up" as const,
    title: "Instant buy / sell / profit verdict",
    body: "Real market value and margin on every car, the moment you see it.",
  },
  {
    icon: "truck" as const,
    title: "From find → fleet → sold",
    body: "Source, transport, recon, and list — the whole deal in one place.",
  },
];

export default async function Home() {
  try {
    const { data } = await getServerUser();
    if (data?.user) redirect("/find");
  } catch {
    // Not configured or no session — show the public landing page.
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--s1)] pb-safe">
      {/* Top bar */}
      <header className="w-full max-w-5xl mx-auto px-6 pt-7 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-[10px] grid place-items-center text-white shadow-sm"
            style={{ background: "var(--grad)" }}
            aria-hidden
          >
            <Ico name="search" size={17} />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-[var(--t1)]">
            DealerHunt
          </span>
        </div>
        <Link
          href="/login"
          className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)] transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 md:py-28">
        <span
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase px-3 py-1.5 rounded-full mb-8"
          style={{ background: "var(--amber-lo)", color: "var(--amber-d)" }}
        >
          Vehicle sourcing intelligence
        </span>

        <h1 className="serif text-[2.5rem] leading-[1.08] md:text-[4rem] font-semibold text-[var(--t1)] max-w-3xl tracking-tight">
          Find underpriced cars.
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
          DealerHunt scans every state, prices each car against the live market,
          and tells you the profit before you bid.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
          <Link
            href="/register"
            className="btn btn-primary inline-flex items-center justify-center gap-2 px-8 py-4 text-base shadow-[var(--shadow)] min-h-[52px]"
          >
            Get started
            <Ico name="arrow" size={18} />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--t4)] hover:text-[var(--t2)] transition-colors"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </section>

      {/* Feature tiles */}
      <section className="w-full max-w-5xl mx-auto px-6 pb-24 grid gap-4 md:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="glass-panel p-6 flex flex-col gap-3 text-left"
          >
            <span
              className="w-11 h-11 rounded-[14px] grid place-items-center"
              style={{ background: "var(--amber-lo)", color: "var(--amber-d)" }}
              aria-hidden
            >
              <Ico name={f.icon} size={22} />
            </span>
            <h3 className="text-[15px] font-bold text-[var(--t1)] mt-1">
              {f.title}
            </h3>
            <p className="text-sm text-[var(--t4)] leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="w-full max-w-5xl mx-auto px-6 py-8 border-t border-[var(--b1)] text-xs text-[var(--t5)]">
        © {new Date().getFullYear()} DealerHunt — Vehicle sourcing intelligence.
      </footer>
    </main>
  );
}
