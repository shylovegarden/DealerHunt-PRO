"use client";

import React, { memo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { DealGradeBadge } from "./DealGradeBadge";
import type { DiscoveryDeal } from "./types";
import { liteDealIQ, IQ_TIER_COLOR } from "@/lib/intelligence/lite-iq";
import { daysOnMarket, domTier } from "@/lib/intelligence/days-on-market";
import { proxiedImage } from "@/lib/image-url";

const TITLE_STYLES: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  clean: { label: "Clean Title", bg: "var(--glo)", text: "var(--green)" },
  rebuilt: { label: "Rebuilt", bg: "var(--amber-lo)", text: "var(--amber-d)" },
  salvage: { label: "Salvage", bg: "var(--rlo)", text: "var(--red)" },
  parts: { label: "Parts Only", bg: "var(--rlo)", text: "var(--red)" },
};

function cheapestPrice(deal: DiscoveryDeal): number {
  const prices = [deal.askPrice, ...deal.alsoOn.map((a) => a.askPrice)].filter(
    (p) => p > 0,
  );
  return prices.length ? Math.min(...prices) : deal.askPrice;
}

/** Graceful image placeholder when a deal has no photos / a broken URL. */
function Placeholder() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: "var(--s2)" }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--t5)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    </div>
  );
}

/**
 * Compact, tappable discovery card — CarGurus/Kayak feel. Image-forward, with a
 * market deal-grade badge, prominent ask price, the key Kayak "found on N sites"
 * multi-source signal, and a subtle max-bid hint for the flipper.
 */
export const DiscoveryCard = memo(function DiscoveryCard({
  deal,
}: {
  deal: DiscoveryDeal;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const img = proxiedImage(deal.images?.[0]);
  const showImg = img && !imgFailed;
  const title =
    deal.title ||
    `${deal.year ?? ""} ${deal.make ?? ""} ${deal.model ?? ""}`.trim();
  const location = [deal.locationCity, deal.locationState]
    .filter(Boolean)
    .join(", ");
  const titleStyle = deal.titleClass
    ? TITLE_STYLES[deal.titleClass]
    : undefined;
  const multi = deal.listingCount > 1;
  const cheapest = cheapestPrice(deal);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-20px" }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      style={{
        width: 280,
        flex: "0 0 auto",
        scrollSnapAlign: "start",
      }}
    >
      <Link
        href={`/deal/${deal.id}`}
        className="deal-card glass-panel group flex flex-col overflow-hidden select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
        style={{ padding: 0, height: "100%", transition: "border-color 0.2s" }}
      >
        {/* Image */}
        <div
          className="relative w-full aspect-[4/3] overflow-hidden"
          style={{ background: "var(--s2)" }}
        >
          {showImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={title}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <Placeholder />
          )}

          {/* Gradient overlay for better text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.9)] via-[rgba(0,0,0,0.2)] to-transparent pointer-events-none" />

          {/* Grade badge — floating top-left */}
          {deal.grade !== "unknown" && (
            <div className="absolute left-2.5 top-2.5">
              <div style={{ backdropFilter: "blur(8px)" }}>
                <DealGradeBadge
                  grade={deal.grade}
                  gradeLabel={deal.gradeLabel}
                  discountPct={deal.discountPct}
                />
              </div>
            </div>
          )}

          {/* Deal IQ chip — floating bottom-left (zero-cost, from card fields) */}
          {(() => {
            const iq = liteDealIQ({
              askPrice: deal.askPrice,
              sellEstimate: deal.sellEstimate,
              trueNetProfit: deal.trueNetProfit,
              distressed: (deal as any).distressed,
              dealVerdict: (deal as any).dealVerdict ?? (deal as any).verdict,
            });
            if (!iq) return null;
            return (
              <span
                className="absolute left-2.5 bottom-2.5 inline-flex items-center rounded-full px-2 py-1 text-[10px] font-black text-white"
                style={{
                  background: "rgba(20,10,20,.72)",
                  backdropFilter: "blur(8px)",
                }}
                title={`Deal IQ ${iq.score}/100 (${iq.tier})`}
              >
                <span style={{ color: IQ_TIER_COLOR[iq.tier] }}>
                  IQ&nbsp;{iq.score}
                </span>
              </span>
            );
          })()}

          {/* Days-on-market chip — floating bottom-right (negotiating signal) */}
          {(() => {
            const dom = daysOnMarket(deal.firstSeenAt);
            if (dom == null) return null;
            const tier = domTier(dom);
            return (
              <span
                className="absolute right-2.5 bottom-2.5 inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold text-white"
                style={{
                  background: "rgba(20,10,20,.72)",
                  backdropFilter: "blur(8px)",
                }}
                title={`${dom} days on market — ${tier.label}`}
              >
                <span style={{ color: tier.color }}>{dom}d</span>
              </span>
            );
          })()}

          {/* Multi-source chip — floating top-right (the Kayak signal) */}
          {multi && (
            <span
              className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-white"
              style={{
                background: "rgba(36,28,43,.72)",
                backdropFilter: "blur(8px)",
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              {deal.listingCount} sites
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-2 p-3.5">
          <div className="flex justify-between items-start gap-2">
            <h3 className="truncate text-[15px] font-bold leading-tight text-[var(--t1)] transition-colors group-hover:text-[var(--amber)]">
              {title}
            </h3>
            {deal.vin && (
              <span className="font-mono text-[10px] text-[var(--t4)] shrink-0 group-hover:text-[var(--t2)] transition-colors">
                {deal.vin.slice(-6)}
              </span>
            )}
          </div>

          {/* Meta: mileage · location · title class */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--t4)]">
            {deal.mileage ? (
              <span className="font-mono text-[var(--t3)]">
                {deal.mileage.toLocaleString()} mi
              </span>
            ) : null}
            {deal.mileage && location ? (
              <span className="opacity-30">·</span>
            ) : null}
            {location && (
              <span className="inline-flex items-center gap-1 truncate">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M12 21C12 21 5 13.5 5 9a7 7 0 0 1 14 0c0 4.5-7 12-7 12z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                {location}
              </span>
            )}
          </div>

          {titleStyle && (
            <span
              className="w-fit rounded-[var(--r1)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ background: titleStyle.bg, color: titleStyle.text }}
            >
              {titleStyle.label}
            </span>
          )}

          {/* Contextual reason (distance, win-pattern) when a rail provides one */}
          {deal.winReason && (
            <span
              className="w-fit inline-flex items-center gap-1 rounded-[var(--r1)] px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--amber-lo)", color: "var(--amber-d)" }}
            >
              {deal.winReason}
            </span>
          )}

          {/* Price + Est Profit grid */}
          <div className="mt-auto grid grid-cols-2 gap-2 pt-2 border-t border-[var(--b1)]">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--t4)]">
                Purchase Price
              </p>
              <span className="font-mono text-lg font-black leading-none text-[var(--t1)] tracking-tight">
                ${deal.askPrice.toLocaleString()}
              </span>
            </div>
            
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--t4)]">
                Est. Net Profit
              </p>
              {deal.trueNetProfit && deal.trueNetProfit > 0 ? (
                <span className="font-mono text-[17px] font-black leading-none text-[var(--green)]">
                  +${deal.trueNetProfit.toLocaleString()}
                </span>
              ) : (
                <span className="font-mono text-[17px] font-bold leading-none text-[var(--t3)]">
                  --
                </span>
              )}
            </div>
          </div>

          {/* Multi-source line (Kayak): from $cheapest */}
          {multi && (
            <div
              className="mt-1 flex items-center gap-1.5 rounded-[var(--r2)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--t3)]"
              style={{ background: "var(--s1)" }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--amber)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span>
                Found on{" "}
                <strong className="text-[var(--t1)]">
                  {deal.listingCount}
                </strong>{" "}
                sites · from{" "}
                <span className="font-mono font-bold text-[var(--t1)]">
                  ${cheapest.toLocaleString()}
                </span>
              </span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
});
