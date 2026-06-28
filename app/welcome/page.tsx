"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The vertical selector — the first thing a user sees after login. One full-screen surface split on a
// diagonal: houses (HomeIQ) on one side, cars (DealerHunt Pro) on the other. Hovering a side expands it
// and dims the other; clicking enters that vertical. Both run on the same engine; this is just the door.

type Side = "house" | "car" | null;

export default function WelcomePage() {
  const router = useRouter();
  const [hover, setHover] = useState<Side>(null);

  // The diagonal seam runs top-right → bottom-left. Each panel is the full viewport, clipped to its half;
  // on hover the seam slides to give the focused side more room (cars push the seam left, houses right).
  const seamTop = hover === "car" ? 78 : hover === "house" ? 38 : 58; // % across the TOP edge
  const seamBot = hover === "car" ? 58 : hover === "house" ? 18 : 38; // % across the BOTTOM edge

  const housePanel = `polygon(0 0, ${seamTop}% 0, ${seamBot}% 100%, 0 100%)`;
  const carPanel = `polygon(${seamTop}% 0, 100% 0, 100% 100%, ${seamBot}% 100%)`;

  const enter = (side: "house" | "car") =>
    router.push(side === "house" ? "/homeiq" : "/discover");

  return (
    <main className="fixed inset-0 overflow-hidden bg-black select-none">
      {/* ── HomeIQ (houses) ───────────────────────────────────────────── */}
      <button
        aria-label="Enter HomeIQ — houses"
        onMouseEnter={() => setHover("house")}
        onMouseLeave={() => setHover(null)}
        onClick={() => enter("house")}
        className="absolute inset-0 text-left transition-[clip-path] duration-500 ease-out cursor-pointer group"
        style={{
          clipPath: housePanel,
          background:
            "radial-gradient(120% 120% at 20% 30%, #0f3d3a 0%, #0a2826 45%, #061715 100%)",
        }}
      >
        <Watermark side="house" dim={hover === "car"} />
        <Panel
          side="house"
          kicker="Real estate leads"
          title="HomeIQ"
          tagline="Every house on the market — discounted, distressed, deal-ready."
          accent="#2dd4bf"
          align="left"
          active={hover === "house"}
          faded={hover === "car"}
        />
      </button>

      {/* ── DealerHunt Pro (cars) ─────────────────────────────────────── */}
      <button
        aria-label="Enter DealerHunt Pro — cars"
        onMouseEnter={() => setHover("car")}
        onMouseLeave={() => setHover(null)}
        onClick={() => enter("car")}
        className="absolute inset-0 text-left transition-[clip-path] duration-500 ease-out cursor-pointer group"
        style={{
          clipPath: carPanel,
          background:
            "radial-gradient(120% 120% at 80% 70%, #2b1b54 0%, #1a1130 45%, #0c0818 100%)",
        }}
      >
        <Watermark side="car" dim={hover === "house"} />
        <Panel
          side="car"
          kicker="Auto flip leads"
          title="DealerHunt Pro"
          tagline="Every auction & marketplace, valued — GO / PASS the moment you see it."
          accent="#a78bfa"
          align="right"
          active={hover === "car"}
          faded={hover === "house"}
        />
      </button>

      {/* Center crest — the logo + a hint, sitting on the seam. pointer-events-none so it never blocks. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div
          className="px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.25em] text-white/90 backdrop-blur-md"
          style={{
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          AutoVerse
        </div>
        <p className="text-[12px] text-white/45 font-medium tracking-wide">
          {hover === "house"
            ? "Enter HomeIQ →"
            : hover === "car"
              ? "Enter DealerHunt Pro →"
              : "Pick your hunt"}
        </p>
      </div>
    </main>
  );
}

function Panel({
  kicker,
  title,
  tagline,
  accent,
  align,
  active,
  faded,
}: {
  side: "house" | "car";
  kicker: string;
  title: string;
  tagline: string;
  accent: string;
  align: "left" | "right";
  active: boolean;
  faded: boolean;
}) {
  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 max-w-[clamp(220px,32vw,420px)] px-[clamp(28px,6vw,84px)] transition-all duration-500 ${
        align === "left" ? "left-0" : "right-0 text-right items-end"
      } flex flex-col gap-4`}
      style={{
        opacity: faded ? 0.25 : 1,
        transform: `translateY(-50%) scale(${active ? 1.04 : 1})`,
      }}
    >
      <span
        className="text-[11px] font-black uppercase tracking-[0.3em]"
        style={{ color: accent }}
      >
        {kicker}
      </span>
      <h1 className="text-[clamp(36px,6.5vw,76px)] font-black leading-[0.95] text-white">
        {title}
      </h1>
      <p className="text-[clamp(13px,1.4vw,17px)] leading-snug text-white/70 font-medium">
        {tagline}
      </p>
      <span
        className={`mt-2 inline-flex items-center gap-2 self-start ${align === "right" ? "self-end" : ""} px-5 py-2.5 rounded-full font-bold text-[14px] text-black transition-all duration-300`}
        style={{
          background: accent,
          boxShadow: active ? `0 8px 30px ${accent}66` : "none",
          transform: active ? "translateX(0)" : "translateX(0)",
        }}
      >
        Enter
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
      </span>
    </div>
  );
}

// Big translucent line-art watermark anchored in each panel's triangle.
function Watermark({ side, dim }: { side: "house" | "car"; dim: boolean }) {
  const common = {
    fill: "none",
    stroke: "white",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    opacity: dim ? 0.04 : 0.1,
  };
  return (
    <div
      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 transition-opacity duration-500 ${
        side === "house" ? "left-[6%]" : "right-[6%]"
      }`}
      style={{ width: "min(40vw, 460px)" }}
    >
      {side === "house" ? (
        <svg viewBox="0 0 64 64" {...common} width="100%">
          <path d="M8 30 32 10l24 20" />
          <path d="M14 27v25h36V27" />
          <path d="M26 52V38h12v14" />
          <path d="M44 18v6" />
        </svg>
      ) : (
        <svg viewBox="0 0 64 64" {...common} width="100%">
          <path d="M6 40h52" />
          <path d="M12 40l5-14a6 6 0 015.6-4h18.8a6 6 0 015.6 4l5 14" />
          <path d="M10 40v7M54 40v7" />
          <circle cx="20" cy="44" r="5" />
          <circle cx="44" cy="44" r="5" />
        </svg>
      )}
    </div>
  );
}
