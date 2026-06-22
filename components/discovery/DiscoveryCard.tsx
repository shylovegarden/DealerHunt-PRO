"use client";

import React, { memo, useState } from "react";
import Link from "next/link";
import { DealGradeBadge } from "./DealGradeBadge";
import type { DiscoveryDeal } from "./types";

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
  const img = deal.images?.[0];
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
    <Link
      href={`/deal/${deal.id}`}
      className="deal-card glass-panel group flex flex-col overflow-hidden select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
      style={{
        padding: 0,
        width: 280,
        flex: "0 0 auto",
        scrollSnapAlign: "start",
        transition:
          "transform 170ms cubic-bezier(.16,1,.3,1), box-shadow 170ms cubic-bezier(.16,1,.3,1)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
      }}
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
        {/* Title */}
        <h3 className="truncate text-[15px] font-bold leading-tight text-[var(--t1)] transition-colors group-hover:text-[var(--amber)]">
          {title}
        </h3>

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

        {/* Price + max bid hint */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--t4)]">
              Ask Price
            </p>
            <span className="font-mono text-xl font-black leading-none text-[var(--t1)]">
              ${deal.askPrice.toLocaleString()}
            </span>
          </div>
          {deal.recommendedMaxBid != null && deal.recommendedMaxBid > 0 && (
            <div className="text-right">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--t4)]">
                Max Bid
              </p>
              <span className="font-mono text-sm font-bold leading-none text-[var(--green)]">
                ${deal.recommendedMaxBid.toLocaleString()}
              </span>
            </div>
          )}
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
              <strong className="text-[var(--t1)]">{deal.listingCount}</strong>{" "}
              sites · from{" "}
              <span className="font-mono font-bold text-[var(--t1)]">
                ${cheapest.toLocaleString()}
              </span>
            </span>
          </div>
        )}
      </div>
    </Link>
  );
});
