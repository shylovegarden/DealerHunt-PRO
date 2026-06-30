"use client";

import { use, useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import Link from "next/link";
import { housingPriceTerms } from "@/lib/housing/price-semantics";

const DealerMap = dynamic(() => import("@/components/map/DealerMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[var(--s2)] rounded-[var(--r3)]" />
  ),
});

const ACCENT = "#2dd4bf";
const fetcher = (u: string) => fetch(u).then((r) => r.json());

const TIER_COLOR: Record<string, string> = {
  hot: "var(--red)",
  warm: "var(--amber)",
  standard: "var(--blue)",
};
const VERDICT_COLOR: Record<string, string> = {
  strong: "var(--green)",
  fair: ACCENT,
  tight: "var(--amber)",
  pass: "var(--red)",
};

const money = (n?: number | null) =>
  n != null ? `$${Math.round(n).toLocaleString()}` : "—";

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading } = useSWR(
    `/api/homeiq/leads/${encodeURIComponent(id)}`,
    fetcher,
  );
  const lead = data?.lead;

  if (isLoading)
    return (
      <Shell>
        <p className="text-[var(--t4)] py-20 text-center">Loading lead…</p>
      </Shell>
    );
  if (!lead)
    return (
      <Shell>
        <p className="text-[var(--t4)] py-20 text-center">Lead not found.</p>
      </Shell>
    );

  const tierColor = TIER_COLOR[lead.tier] || "var(--blue)";
  const a = lead.analysis || {};
  const points =
    lead.lat != null && lead.lng != null
      ? [
          {
            id: lead.id,
            name: lead.title,
            lat: lead.lat,
            lng: lead.lng,
            type: (lead.tier === "hot" ? "hub" : "auction") as
              | "hub"
              | "auction",
            label: money(lead.price),
          },
        ]
      : [];

  return (
    <Shell>
      <div className="grid lg:grid-cols-[1fr_minmax(320px,40%)] gap-6">
        {/* Left: details */}
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: `${tierColor}22`, color: tierColor }}
              >
                {lead.tier}
              </span>
              <span className="text-xs text-[var(--t4)] capitalize">
                {(lead.property_type || "").replace("_", " ")}
              </span>
              {lead.source && (
                <span className="text-xs text-[var(--t4)]">
                  · {lead.source}
                </span>
              )}
              {lead.status && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--s2)] border border-[var(--b1)] text-[var(--t2)]">
                  {lead.status}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-[var(--t1)] leading-tight">
              {lead.title}
            </h1>
            <p className="text-[var(--t3)] mt-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--t4)] mr-1.5">
                {housingPriceTerms(lead.source, !!lead.auction_end).priceLabel}
              </span>
              <span className="text-xl font-black text-[var(--t1)]">
                {money(lead.price)}
              </span>
              {lead.address ? ` · ${lead.address}` : ""}
              {lead.city
                ? `, ${lead.city}, ${lead.state}`
                : lead.state
                  ? ` · ${lead.state}`
                  : ""}
              {typeof lead.bid_count === "number"
                ? ` · ${lead.bid_count} bids`
                : ""}
            </p>
          </div>

          {lead.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lead.image}
              alt={lead.title}
              className="w-full max-h-72 object-cover rounded-[var(--r3)] border border-[var(--b1)]"
            />
          )}

          {/* Lead score */}
          <Card title="Lead score">
            <div className="flex items-center gap-4">
              <ScoreRing score={lead.score} color={tierColor} />
              <div className="flex flex-wrap gap-1.5">
                {(lead.signals || []).map((s: string, i: number) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--s2)] text-[var(--t2)] border border-[var(--b1)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* Owner & contact — public-record owner + mailing address (direct-mail ready). Phone/email is
              NOT scraped; it requires a licensed, compliant skip-trace provider (TCPA/DNC rules apply). */}
          {(lead.owner || lead.ownerMailing) && (
            <Card title="Owner & contact">
              <div className="space-y-2 text-sm">
                {lead.owner && (
                  <div>
                    <span className="text-[var(--t4)]">Owner of record: </span>
                    <span className="font-semibold text-[var(--t1)]">
                      {lead.owner}
                    </span>
                  </div>
                )}
                {lead.ownerMailing && (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[var(--t4)]">Mailing: </span>
                      <span className="text-[var(--t2)]">
                        {lead.ownerMailing}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          `${lead.owner || ""}\n${lead.ownerMailing}`.trim(),
                        )
                      }
                      className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-[var(--r2)] border border-[var(--b1)] bg-[var(--s2)] text-[var(--t2)] hover:border-[var(--b3)]"
                    >
                      Copy for mail
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-[var(--t4)] leading-snug pt-1 border-t border-[var(--b1)]">
                  Public record (county assessor / tax roll) — ready for{" "}
                  <strong className="text-[var(--t3)]">direct mail</strong>.
                  Phone &amp; email require a licensed skip-trace provider;
                  calling/texting is subject to TCPA &amp; Do-Not-Call rules.
                </p>
              </div>
            </Card>
          )}

          {/* Deal analysis — the 70% rule */}
          <Card title="Flip analysis (70% rule)">
            {a.mao != null ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <Metric
                    label="ARV (est.)"
                    value={money(a.arv)}
                    sub={a.arvConfidence}
                  />
                  <Metric
                    label="Repairs (est.)"
                    value={money(a.repairEstimate)}
                    sub={a.rehabLevel}
                  />
                  <Metric
                    label="Max offer"
                    value={money(a.mao)}
                    accent={VERDICT_COLOR[a.verdict] || ACCENT}
                    sub={a.verdict}
                  />
                </div>
                {a.equitySpread != null && (
                  <p className="text-sm text-[var(--t3)]">
                    Gross equity potential:{" "}
                    <span className="font-black text-[var(--t1)]">
                      {money(a.equitySpread)}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--t4)]">
                ARV needs square footage or comps — full flip math lights up
                when richer listing data is available for this property.
              </p>
            )}
            {a.notes?.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-[var(--t4)]">
                {a.notes.map((n: string, i: number) => (
                  <li key={i}>• {n}</li>
                ))}
              </ul>
            )}
          </Card>

          {/* Facts */}
          {(lead.beds ||
            lead.baths ||
            lead.sqft ||
            lead.year_built ||
            lead.lot_size_acres) && (
            <Card title="Property">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {lead.beds != null && (
                  <Metric label="Beds" value={String(lead.beds)} />
                )}
                {lead.baths != null && (
                  <Metric label="Baths" value={String(lead.baths)} />
                )}
                {lead.sqft != null && (
                  <Metric label="Sqft" value={lead.sqft.toLocaleString()} />
                )}
                {lead.year_built != null && (
                  <Metric label="Built" value={String(lead.year_built)} />
                )}
                {lead.lot_size_acres != null && (
                  <Metric
                    label="Lot (ac)"
                    value={String(lead.lot_size_acres)}
                  />
                )}
              </div>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <SaveButton listingId={lead.id} />
            {lead.url && (
              <a
                href={lead.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-black text-sm"
                style={{ background: ACCENT }}
              >
                View original listing ↗
              </a>
            )}
            {lead.auction_end && (
              <span className="inline-flex items-center px-4 py-2.5 rounded-full text-sm font-semibold text-[var(--t2)] bg-[var(--s2)] border border-[var(--b1)]">
                Ends {new Date(lead.auction_end).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Right: map */}
        <div className="lg:sticky lg:top-5 h-[40vh] lg:h-[70vh]">
          {points.length ? (
            <DealerMap points={points} />
          ) : (
            <div className="w-full h-full grid place-items-center rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] text-[var(--t4)] text-sm">
              No precise location yet
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

// Save the current lead into the user's flip pipeline. 401 → bounce to sign-in; 200/alreadySaved → "Saved".
function SaveButton({ listingId }: { listingId: string }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "auth">(
    "idle",
  );
  const save = async () => {
    if (state === "saving" || state === "saved") return;
    setState("saving");
    const res = await fetch("/api/homeiq/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    if (res.status === 401) {
      setState("auth");
      return;
    }
    if (res.ok) setState("saved");
    else setState("idle");
  };
  if (state === "auth") {
    return (
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm bg-[var(--s2)] border border-[var(--b1)] text-[var(--t2)]"
      >
        Sign in to save
      </Link>
    );
  }
  const saved = state === "saved";
  return (
    <button
      onClick={save}
      disabled={saved || state === "saving"}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm border transition-colors"
      style={
        saved
          ? { background: "var(--s2)", borderColor: "var(--b1)", color: ACCENT }
          : { background: ACCENT, borderColor: ACCENT, color: "#000" }
      }
    >
      {saved
        ? "✓ In pipeline"
        : state === "saving"
          ? "Saving…"
          : "💾 Save to pipeline"}
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--s1)] text-[var(--t1)]">
      <header className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-[10px] grid place-items-center text-black font-black"
            style={{ background: ACCENT }}
          >
            H
          </span>
          <span className="font-black text-lg">HomeIQ</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/homeiq/saved"
            className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)]"
          >
            Pipeline
          </Link>
          <Link
            href="/homeiq/leads"
            className="text-sm font-semibold text-[var(--t3)] hover:text-[var(--t1)]"
          >
            ← All leads
          </Link>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">{children}</div>
    </main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--r3)] border border-[var(--b1)] bg-[var(--s0)] p-4">
      <h2 className="text-[11px] font-black uppercase tracking-widest text-[var(--t4)] mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div>
      <div
        className="text-lg font-black"
        style={{ color: accent || "var(--t1)" }}
      >
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--t4)]">
        {label}
      </div>
      {sub && (
        <div className="text-[10px] text-[var(--t4)] capitalize mt-0.5">
          {sub}
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 22,
    c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: 56, height: 56 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="var(--b1)"
          strokeWidth="5"
        />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      <span
        className="absolute inset-0 grid place-items-center text-base font-black"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}
