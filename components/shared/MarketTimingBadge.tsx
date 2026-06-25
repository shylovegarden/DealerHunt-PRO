"use client";

interface MarketTimingBadgeProps {
  signal?: "hot" | "warming" | "cooling" | "cold" | null;
  priceChange?: number; // percentage change
  className?: string;
}

const SIGNAL_STYLES = {
  hot: {
    label: "🔥 Hot Market",
    bg: "var(--rlo)",
    text: "var(--red)",
    description: "Prices rising, high demand",
  },
  warming: {
    label: "📈 Warming Up",
    bg: "var(--amber-lo)",
    text: "var(--amber-d)",
    description: "Prices trending up",
  },
  cooling: {
    label: "📉 Cooling Off",
    bg: "rgba(59, 130, 246, 0.1)",
    text: "#3b82f6",
    description: "Prices trending down",
  },
  cold: {
    label: "❄️ Cold Market",
    bg: "var(--glo)",
    text: "var(--green)",
    description: "Prices falling, low demand - negotiation leverage!",
  },
};

export function MarketTimingBadge({
  signal,
  priceChange,
  className = "",
}: MarketTimingBadgeProps) {
  if (!signal) return null;

  const style = SIGNAL_STYLES[signal];
  if (!style) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${className}`}
      style={{
        background: style.bg,
        border: `1px solid ${style.text}40`,
      }}
      title={style.description}
    >
      <span className="text-xs font-bold" style={{ color: style.text }}>
        {style.label}
      </span>

      {priceChange !== undefined && priceChange !== 0 && (
        <span
          className="text-[10px] font-mono font-bold"
          style={{ color: style.text }}
        >
          {priceChange > 0 ? "+" : ""}
          {priceChange.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

/**
 * Hook to fetch market timing signal for a specific make/model
 * Can be used on deal detail pages
 */
export function useMarketTiming(make?: string, model?: string) {
  // In a real implementation, this would fetch from the market_timing_signals view
  // For now, return null - implement when backend API is ready

  // TODO: Implement API call
  // const { data } = useSWR(
  //   make && model ? `/api/market-timing?make=${make}&model=${model}` : null,
  //   fetcher
  // );

  return {
    signal: null as "hot" | "warming" | "cooling" | "cold" | null,
    priceChange: 0,
    loading: false,
  };
}
