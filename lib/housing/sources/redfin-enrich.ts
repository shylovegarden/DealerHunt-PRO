// lib/housing/sources/redfin-enrich.ts
//
// Per-listing ENRICHMENT for the Redfin gis-csv leads. The bbox CSV gives structure + price + MLS#, but NOT
// the listing remarks — and the remarks are where the distress signal lives ("sold as-is", "investor
// special", "needs TLC", "cash only", "handyman"). This pass fetches a listing's page (PerimeterX-walled →
// needs the fleet's headed tier, which smartFetch supplies) and pulls the marketing remarks + agent + full
// photos. The remarks flow straight into the lead scorer + the deal-analyzer's rehab inference, so a genuine
// fixer surfaces even though the CSV row looked ordinary.
//
// INTELLIGENT by design — enrichment is expensive (one headed fetch per listing), so we DON'T enrich
// everything. enrichRedfinProperties() enriches only Redfin leads that lack a description, hottest-first, up
// to a hard cap (REDFIN_ENRICH_MAX). Off-fleet every fetch returns null and the lead passes through
// unchanged. Verified live (headed Patchright): remarks/agent/photos extract cleanly from the listing DOM.

import { smartFetch } from "../../scrapers/smart-fetch";
import { scoreHousingLead } from "../lead-score";
import type { Property } from "../types";

export interface RedfinDetail {
  description?: string;
  agent?: string;
  images?: string[];
}

/** Strip HTML tags → collapsed text. */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pull remarks + agent + photos out of a Redfin listing page's HTML. Pure (composes with smartFetch's
 * headed tier). Keys off the stable markers verified on the live DOM:
 *   remarks → `data-rf-test-id="listingRemarks"` … `.sectionContent`
 *   agent   → `listingAgentAndBrokerLogo">Presented by <name>`
 *   photos  → ssl.cdn-redfin.com/photo/…/bigphoto/….jpg (full-size; thumbnails ignored)
 */
export function parseRedfinDetail(html: string): RedfinDetail {
  const out: RedfinDetail = {};

  const rIdx = html.indexOf('data-rf-test-id="listingRemarks"');
  if (rIdx >= 0) {
    // Skip past the rest of the opening tag so the marker attribute itself isn't read as body text.
    const start = html.indexOf(">", rIdx);
    let text = stripTags(
      html.slice(start >= 0 ? start + 1 : rIdx, rIdx + 6000),
    );
    // Trim trailing UI chrome / attribution that follows the remarks block.
    text = text
      .split(
        /Show (?:more|less)|Listing (?:provided|courtesy)|Read more|Source:|Redfin Estimate|See more|All home/i,
      )[0]
      .trim();
    if (text.length >= 25) out.description = text.slice(0, 2000);
  }

  const agent = html.match(
    /listingAgentAndBrokerLogo"[^>]*>\s*(?:Presented by|Listed by)\s+([^<|]{2,80})/i,
  );
  if (agent)
    out.agent = stripTags(agent[1])
      .replace(/[|\s]+$/, "")
      .trim();

  const photos = new Set<string>();
  const re =
    /https:\/\/ssl\.cdn-redfin\.com\/photo\/[^\s"'\\]+?bigphoto[^\s"'\\]+?\.jpg/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && photos.size < 12) photos.add(m[0]);
  if (photos.size) out.images = Array.from(photos);

  return out;
}

/** Fetch + parse one Redfin listing's detail. Returns null off-fleet (PerimeterX) or on a thin/blocked page. */
export async function enrichRedfinListing(
  url: string,
): Promise<RedfinDetail | null> {
  try {
    const { html, blocked } = await smartFetch(url, {
      validate: (h) => h.includes('data-rf-test-id="listingRemarks"'),
    });
    if (blocked || !html) return null;
    const detail = parseRedfinDetail(html);
    return detail.description || detail.images?.length ? detail : null;
  } catch {
    return null;
  }
}

/** Merge enrichment onto a property (description + photos + agent in signals), non-destructively. */
function applyDetail(p: Property, d: RedfinDetail): Property {
  return {
    ...p,
    description: p.description || d.description,
    images: p.images?.length ? p.images : d.images,
    signals: {
      ...(p.signals || {}),
      ...(d.agent ? { agent: d.agent } : {}),
      enriched: true,
    },
  };
}

/**
 * Enrich the Redfin leads worth it: those missing a description (where remarks add the most), HOTTEST FIRST
 * (a cheap pre-score on the CSV fields), capped at `max`. Everything else passes through untouched. The
 * description feeds the distress scorer + rehab inference, so genuine fixers surface on the next upsert.
 */
export async function enrichRedfinProperties(
  props: Property[],
  opts: { max?: number } = {},
): Promise<Property[]> {
  const max = Math.max(
    0,
    opts.max ?? (parseInt(process.env.REDFIN_ENRICH_MAX || "40", 10) || 40),
  );
  if (max === 0) return props;

  // Candidates: Redfin listings with a URL and no description yet. Prioritize the ones most likely to be a
  // deal (cheap pre-score) so a bounded budget enriches the highest-value leads first.
  const candidates = props
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) => p.source === "redfin" && !!p.source_url && !p.description,
    )
    .sort((a, b) => scoreHousingLead(b.p).score - scoreHousingLead(a.p).score)
    .slice(0, max);

  if (!candidates.length) return props;
  console.log(
    `[HomeIQ:RedfinEnrich] enriching top ${candidates.length} leads…`,
  );

  const out = [...props];
  let hits = 0;
  for (const { p, i } of candidates) {
    const d = await enrichRedfinListing(p.source_url!);
    if (d) {
      out[i] = applyDetail(p, d);
      hits++;
    }
  }
  console.log(`[HomeIQ:RedfinEnrich] enriched ${hits}/${candidates.length}`);
  return out;
}
