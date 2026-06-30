# HomeIQ — what data we have, and what (if anything) we're missing

The honest, complete map. Legend: ✅ **have it, free** · 🔑 **free but needs a 30-second free key** · 💲 **genuinely paid / licensed** (and whether it actually matters).

## What "MLS / RESO" actually is — and why we don't need a license

**RESO Web API = the licensed pipe for MLS listing data.** It carries listings: price, beds/baths/sqft,
status, MLS#, agent, photos, public remarks. We pull **that exact data free** via Redfin's `gis-csv` door
(`docs/findings/redfin-gis-api.md`) — because Redfin redistributes the same MLS feed publicly under IDX
rules. So a license buys us **nothing on the data that finds deals.**

What a license uniquely adds (and why it doesn't matter for HomeIQ):

| License-only field          | What it's for                       | Matters for deal-finding?                            |
| --------------------------- | ----------------------------------- | ---------------------------------------------------- |
| Private "agent remarks"     | Showing instructions, lockbox codes | ❌ agent workflow, not the deal                      |
| Commission split            | What the buyer's agent earns        | ❌ irrelevant to a buyer/investor                    |
| Full agent contact          | Calling the listing agent           | ➖ nice-to-have; we already get agent NAME           |
| Instant pending/ShowingTime | Real-time status to the second      | ➖ we get status (Active/Pending/Pre-Market) already |
| Legal redistribution rights | Running a public IDX website        | ❌ HomeIQ is an internal deal tool, not a portal     |

**Bottom line: we get ~95% of what a paid realtor sees, free. The last 5% is agent paperwork, not deals.**
The RESO connector (`reso.ts`) stays wired and dormant — drop in credentials and it lights up, but you don't
need to.

## On-market listings (what's for sale)

| Data                                                    | Status          | Source                                                            |
| ------------------------------------------------------- | --------------- | ----------------------------------------------------------------- |
| Active listings (price, beds/baths/sqft, year, lat/lng) | ✅              | Redfin gis-csv, nationwide (67 metros)                            |
| MLS# + listing brokerage                                | ✅              | Redfin gis-csv                                                    |
| Sold comps / closed prices                              | ✅              | Redfin gis-csv (sold) + Redfin Data Center                        |
| Listing remarks (distress wording)                      | ✅              | Redfin enrichment (fleet)                                         |
| Listing agent + full photos                             | ✅              | Redfin enrichment (fleet)                                         |
| Pending / coming-soon / pre-market status               | ✅              | Redfin gis-csv `STATUS` (now scored)                              |
| Days on market                                          | ✅              | Redfin gis-csv (now scored — real DOM)                            |
| New-construction builder communities                    | ➖ available    | Realtor.com `frontdoor/graphql` (built-able; low value for flips) |
| Private agent remarks / commission                      | 💲 license-only | RESO (don't need)                                                 |

## Valuation (what it's worth)

| Data                                      | Status             | Source                                                          |
| ----------------------------------------- | ------------------ | --------------------------------------------------------------- |
| Median sale $/sqft — ZIP / county / state | ✅                 | Redfin Data Center (`zip-ppsf` 24.5k ZIPs, `county-ppsf` 3,085) |
| ARV + 70%-rule Max Allowable Offer        | ✅                 | `deal-analyzer.ts` (ZIP-level = comp-grade)                     |
| Repair estimate by rehab level            | ✅                 | `deal-analyzer.ts`                                              |
| Redfin Estimate / Zestimate (AVM)         | ➖ on listing page | fragile/hashed; our $/sqft ARV is the robust path               |

## Off-market / distress (where wholesale deals live)

| Data                                          | Status        | Source                                                                            |
| --------------------------------------------- | ------------- | --------------------------------------------------------------------------------- |
| Land-bank inventory (cheap city houses/lots)  | ✅            | Detroit / Cuyahoga / Genesee / Lucas connectors                                   |
| Tax-delinquent owners                         | ✅            | Philly Carto + open-data registry (34 feeds)                                      |
| Code violations / dangerous buildings         | ✅            | Philly Carto + open-data registry                                                 |
| Gov / federal / surplus auctions              | ✅            | GovDeals / AllSurplus / GSA / HUD / PublicSurplus / Municibid                     |
| Absentee / out-of-state owner                 | ✅ scored     | when a county feed supplies it (open-data registry)                               |
| Pre-foreclosure / NOD / lis pendens           | 🟡 per-county | public records, fragmented — add per county to the open-data registry             |
| **Owner name + mailing address** (skip-trace) | 🔑/💲         | county assessor (free, per-county) → phone/email is the one honest paid exception |

## Rental / cashflow (buy-and-hold) — the one real gap

| Data                  | Status          | Path                                                                                         |
| --------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| Rent estimate by ZIP  | 🔑              | Census ACS median gross rent (free **Census API key**) or HUD Fair Market Rents (free token) |
| Cap rate / GRM signal | ➖ ready to add | once a rent layer lands, slots into `deal-analyzer` like the ARV $/sqft did                  |

This is the honest "not-yet-built" item: a robust free rent source needs a 30-second free API key (like a
Census key — unlock the whole Census: rent, income, vacancy, demographics). Wired turnkey the moment you
want the buy-and-hold dimension; today HomeIQ is tuned for flips/wholesale, where we're complete.

## Neighborhood / context (free, available to add)

Census ACS (🔑 free key): income, vacancy rate, owner-vs-renter, home values. OpenStreetMap (✅): amenities.
GreatSchools / crime (💲 mostly paid). These sharpen _area_ evaluation; not blocking for deal-finding.

---

**Verdict: for finding and analyzing deals, we are not missing anything that a paid MLS license or data
broker would give us.** The only genuine free-but-not-yet-built dimension is rental/cashflow (a free key
away), and the only genuinely-paid thing worth anything is skip-trace phone/email — which we deliberately
leave as a user decision rather than bake in a paid broker.
