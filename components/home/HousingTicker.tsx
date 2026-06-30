"use client";

// Visor-style scrolling marquee of live housing leads — the housing twin of DealTicker, but derived from
// the leads the home page already fetched (no extra request). Surfaces the hottest deals as a glanceable
// live strip: location · price · flip verdict, tier-colored. Hides when there's nothing worth showing.

interface TickerLead {
  city?: string;
  state?: string;
  price?: number;
  tier: string;
  verdict?: string;
  mao?: number | null;
}

const TIER_DOT: Record<string, string> = {
  hot: "var(--red)",
  warm: "var(--amber)",
  standard: "var(--blue)",
};
const shortMoney = (n?: number | null) =>
  n == null
    ? ""
    : Math.abs(n) >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : Math.abs(n) >= 1000
        ? `$${Math.round(n / 1000)}k`
        : `$${Math.round(n)}`;

export function HousingTicker({ leads }: { leads: TickerLead[] }) {
  // Hottest first, only leads with a place + price (a meaningful ticker line).
  const items = leads
    .filter((l) => l.price && (l.city || l.state))
    .sort((a, b) => (b.tier === "hot" ? 1 : 0) - (a.tier === "hot" ? 1 : 0))
    .slice(0, 16);
  if (items.length < 4) return null;

  const loop = [...items, ...items];
  return (
    <div className="relative overflow-hidden py-2 border-y border-[var(--b1)] -mx-4 sm:-mx-6">
      <div className="ticker-inner">
        {loop.map((l, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px]"
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: TIER_DOT[l.tier] || "var(--blue)" }}
            />
            <span className="text-[var(--t2)] font-semibold">
              {l.city ? `${l.city}, ${l.state || ""}` : l.state}
            </span>
            <span className="text-[var(--t3)] font-mono">
              {shortMoney(l.price)}
            </span>
            {l.mao != null && l.verdict && l.verdict !== "unknown" && (
              <span
                style={{
                  color:
                    l.verdict === "strong"
                      ? "var(--green)"
                      : l.verdict === "pass"
                        ? "var(--red)"
                        : "var(--home)",
                }}
              >
                🔨 {shortMoney(l.mao)} {l.verdict}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
