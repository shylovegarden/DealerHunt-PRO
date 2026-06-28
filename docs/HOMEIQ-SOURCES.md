# HomeIQ — complete free housing-source registry

Every free U.S. housing-lead source we know of, with status + method. The goal: leave NONE undiscovered.
No paid data brokers (Attom/PropStream/MLS) — public records + open/portal data only. Each shipped source
lands in the `properties` table (houses only, vertical-isolated from the cars `deals` table).

## ✅ Shipped (live)

| #   | Source                     | What                                     | Method                                        | Notes                                                                                   |
| --- | -------------------------- | ---------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | **GovDeals real estate**   | Gov disposal: single-family, land, multi | maestro API (95B/95F/959)                     | `govdeals-property.ts`                                                                  |
| 2   | **AllSurplus real estate** | Liquidity sister, US-filtered            | maestro API (businessId AD)                   | `govdeals-property.ts('AD')`                                                            |
| 3   | **HUD Homes**              | FHA-foreclosed homes                     | GET + hidden-input JSON                       | **richest**: sqft/beds/baths/lat-lng → fires the deal-analyzer. 275 live, 100% geocoded |
| 4   | **GSA Real Estate**        | Federal surplus RE (agency housing/land) | SSR `.itemm` cheerio                          | `gsa-realestate.ts`. 11 live                                                            |
| 5   | **PublicSurplus RE**       | Tax-forfeited county land, mobile homes  | open HTML cards (catid 15)                    | `publicsurplus-property.ts`. 100 live                                                   |
| 6   | **Redfin**                 | National portal                          | schema.org JSON-LD → genericExtractProperties | parse verified; FETCH needs the FLEET (PerimeterX). `REDFIN_SEARCH_URLS`                |
| 7   | **Municibid RE** (C169135) | Gov surplus: tax parcels, lots, houses   | open SSR cards (no proxy)                     | `municibid-property.ts`, solo-cracked. LOW volume (~1–a few live); reuses car parser    |

## 🟡 Queued (built-able now; need a clean IP / one capture)

| #   | Source                                | Wall                | Path                                                                                                                   |
| --- | ------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 7   | **Zillow**                            | PerimeterX          | `__NEXT_DATA__`/schema.org → `genericExtractProperties` drop-in; fleet-fetch like Redfin. Antigravity: give metro URLs |
| 8   | **Realtor.com**                       | Akamai              | `__NEXT_DATA__` → genericExtractProperties; fleet-fetch                                                                |
| 9   | **Fannie HomePath** (homepath.com)    | SPA + `/api/`       | capture the listing XHR (Antigravity) → wire like a JSON source                                                        |
| 10  | **Freddie HomeSteps** (homesteps.com) | TBD                 | probe/capture                                                                                                          |
| 11  | **Bid4Assets**                        | 403 (PerimeterX)    | county tax/foreclosure auctions (deep discounts) — confirmed 403 from our IP 2026-06-28; needs a FLEET capture         |
| 12  | **Auction.com**                       | walled (tiny shell) | foreclosure/REO — fleet/capture                                                                                        |
| 13  | **Hubzu / Xome**                      | likely walled       | auction REO — fleet/capture                                                                                            |

## 🔵 High-effort, high-value (per-county, fragmented — phase 2)

| #   | Source                                         | Value                                               |
| --- | ---------------------------------------------- | --------------------------------------------------- |
| 15  | County **tax-delinquent / sheriff-sale** lists | deep-discount, motivated; per-county public records |
| 16  | County **NOD / Lis Pendens** (pre-foreclosure) | time-sensitive; per-county public records           |
| 17  | **FSBO** (fsbo.com, forsalebyowner.com)        | by-owner, negotiable                                |

## Method playbook (how a new one gets added)

1. **Open HTML / SSR** (HUD, GSA-RE, PublicSurplus) → fetch + parse → `Property[]` → `upsertProperties`. Verifiable from any IP.
2. **JSON-LD / `__NEXT_DATA__` portal** (Redfin, Zillow, Realtor) → `genericExtractProperties` (drop-in); fetch via `smartFetch` headed tier on the FLEET (clean IP).
3. **JSON API** (GovDeals/AllSurplus, Fannie) → map the API → `Property[]`.
4. Always: houses-only (the `maestroAssetToProperty`-style real-estate guard keeps cars out), then `upsertProperties` (auto-geocodes + scores + analyzes).
