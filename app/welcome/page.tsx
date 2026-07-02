"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import useSWR from "swr";

// The vertical selector — the first thing a user sees after login. One full-screen surface split on a
// diagonal: houses (HomeIQ) on one side, cars (DealerHunt Pro) on the other. Both run on the same engine
// and the SAME login; this is the door. Hover (or arrow-key focus) expands a side and dims the other;
// click / Enter / tap enters that vertical. Each side shows LIVE counts so the door feels alive.

type Side = "house" | "car" | null;
const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function WelcomePage() {
  const router = useRouter();
  const [hover, setHover] = useState<Side>(null);
  const [keyFocus, setKeyFocus] = useState<Side>(null);
  const focus: Side = hover ?? keyFocus;

  // Live stats so the selector reflects the real market (API stays public; the page itself is gated).
  const { data: stats } = useSWR("/api/stats/verticals", fetcher, {
    revalidateOnFocus: false,
  });
  const houseStats = stats?.houses
    ? [
        { label: "leads", value: stats.houses.total ?? 0 },
        { label: "🔥 hot", value: stats.houses.hot ?? 0 },
      ]
    : null;
  const carStats = stats?.cars
    ? [
        { label: "BUY deals", value: stats.cars.go ?? 0 },
        { label: "live", value: stats.cars.active ?? 0 },
      ]
    : null;

  const enter = (side: "house" | "car") =>
    router.push(side === "house" ? "/homeiq" : "/discover");

  // Keyboard: ←/→ focus a side, Enter/Space enters the focused one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setKeyFocus("house");
      else if (e.key === "ArrowRight") setKeyFocus("car");
      else if ((e.key === "Enter" || e.key === " ") && focus) {
        e.preventDefault();
        enter(focus);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // The diagonal seam runs top-right → bottom-left. On focus the seam slides to give the focused side more
  // room. CRITICAL: hit-detection uses the FIXED REST seam (mouse position vs the resting diagonal), NOT the
  // animated clip — otherwise the expanding panel slides the seam under the cursor and flips the hover back,
  // which is the flicker/"moves opposite" glitch. The clip-path is purely visual; the mouse logic is stable.
  const REST_TOP = 58,
    REST_BOT = 38; // resting seam %, top & bottom edge
  const seamTop = focus === "car" ? 82 : focus === "house" ? 34 : REST_TOP;
  const seamBot = focus === "car" ? 62 : focus === "house" ? 14 : REST_BOT;
  const housePanel = `polygon(0 0, ${seamTop}% 0, ${seamBot}% 100%, 0 100%)`;
  const carPanel = `polygon(${seamTop}% 0, 100% 0, 100% 100%, ${seamBot}% 100%)`;

  const ref = useRef<HTMLDivElement>(null);
  // Which side is the cursor on, by the RESTING diagonal? Stable regardless of the animation.
  function sideAt(clientX: number, clientY: number): "house" | "car" {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return "house";
    const xPct = ((clientX - r.left) / r.width) * 100;
    const yPct = ((clientY - r.top) / r.height) * 100;
    const seamX = REST_TOP + ((REST_BOT - REST_TOP) * yPct) / 100; // seam X at this height
    return xPct < seamX ? "house" : "car";
  }

  return (
    <main
      ref={ref}
      onMouseMove={(e) => setHover(sideAt(e.clientX, e.clientY))}
      onMouseLeave={() => setHover(null)}
      onClick={() => focus && enter(focus)}
      className="fixed inset-0 overflow-hidden bg-black select-none cursor-pointer"
    >
      {/* ── HomeIQ (houses) — pointer-events:none; the <main> owns the mouse so the seam can't flip-flop. */}
      <div
        className="absolute inset-0 text-left transition-[clip-path] duration-500 ease-out pointer-events-none"
        style={{
          clipPath: housePanel,
          background:
            "radial-gradient(120% 120% at 20% 30%, #0f3d3a 0%, #0a2826 45%, #061715 100%)",
        }}
      >
        <Watermark side="house" dim={focus === "car"} />
        <Panel
          kicker="Real estate leads"
          title="HomeIQ"
          tagline="Every house on the market — discounted, distressed, deal-ready."
          accent="#2dd4bf"
          align="left"
          active={focus === "house"}
          faded={focus === "car"}
          stats={houseStats}
        />
      </div>

      {/* ── DealerHunt Pro (cars) ─────────────────────────────────────── */}
      <div
        className="absolute inset-0 text-left transition-[clip-path] duration-500 ease-out pointer-events-none"
        style={{
          clipPath: carPanel,
          background:
            "radial-gradient(120% 120% at 80% 70%, #2b1b54 0%, #1a1130 45%, #0c0818 100%)",
        }}
      >
        <Watermark side="car" dim={focus === "house"} />
        <Panel
          kicker="Auto flip leads"
          title="DealerHunt Pro"
          tagline="Every auction & marketplace, valued — GO / PASS the moment you see it."
          accent="#a78bfa"
          align="right"
          active={focus === "car"}
          faded={focus === "house"}
          stats={carStats}
        />
      </div>

      {/* Keyboard/screen-reader entries (focusable, but mouse goes through to <main>). */}
      <button
        aria-label="Enter HomeIQ — houses"
        onFocus={() => setKeyFocus("house")}
        onClick={(e) => {
          e.stopPropagation();
          enter("house");
        }}
        className="sr-only"
      >
        Enter HomeIQ
      </button>
      <button
        aria-label="Enter DealerHunt Pro — cars"
        onFocus={() => setKeyFocus("car")}
        onClick={(e) => {
          e.stopPropagation();
          enter("car");
        }}
        className="sr-only"
      >
        Enter DealerHunt Pro
      </button>

      {/* Center crest — the logo + a hint, sitting on the seam. pointer-events-none so it never blocks. */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2"
      >
        <div
          className="px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.25em] text-white/90 backdrop-blur-md"
          style={{
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          AutoVerse
        </div>
        <p className="text-[12px] text-white/45 font-medium tracking-wide text-center px-4">
          {focus === "house"
            ? "Enter HomeIQ →"
            : focus === "car"
              ? "Enter DealerHunt Pro →"
              : "Pick your hunt — tap a side"}
        </p>
      </motion.div>
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
  stats,
}: {
  kicker: string;
  title: string;
  tagline: string;
  accent: string;
  align: "left" | "right";
  active: boolean;
  faded: boolean;
  stats: { label: string; value: number }[] | null;
}) {
  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 max-w-[clamp(220px,32vw,420px)] ${
        align === "left" ? "left-0" : "right-0"
      }`}
    >
      <motion.div
        initial={{ opacity: 0, x: align === "left" ? -40 : 40 }}
        animate={{
          opacity: faded ? 0.25 : 1,
          x: 0,
          scale: active ? 1.04 : 1,
        }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`px-[clamp(24px,6vw,84px)] flex flex-col gap-4 ${
          align === "right" ? "text-right items-end" : ""
        }`}
        style={{
          transformOrigin: align === "left" ? "left center" : "right center",
        }}
      >
        <span
          className="text-[11px] font-black uppercase tracking-[0.3em]"
          style={{ color: accent }}
        >
          {kicker}
        </span>
        <h1 className="text-[clamp(34px,6.5vw,76px)] font-black leading-[0.95] text-white">
          {title}
        </h1>
        <p className="text-[clamp(13px,1.4vw,17px)] leading-snug text-white/70 font-medium">
          {tagline}
        </p>

        {/* Live stat chips — real counts from the market. */}
        {stats && (
          <div
            className={`flex gap-2 flex-wrap ${align === "right" ? "justify-end" : ""}`}
          >
            {stats.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <span
                  className="text-[15px] font-black tabular-nums"
                  style={{ color: accent }}
                >
                  {s.value.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/55">
                  {s.label}
                </span>
              </span>
            ))}
          </div>
        )}

        <span
          className={`mt-2 inline-flex items-center gap-2 self-start ${align === "right" ? "self-end" : ""} px-5 py-2.5 rounded-full font-bold text-[14px] text-black transition-all duration-300`}
          style={{
            background: accent,
            boxShadow: active ? `0 8px 30px ${accent}66` : "none",
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
      </motion.div>
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
