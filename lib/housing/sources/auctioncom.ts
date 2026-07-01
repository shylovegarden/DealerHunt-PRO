import type { Property, PropertyType } from "../types";

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const QUERY = `query resiSearch_blueprint_seekListingsFromFilters($filters: ListingCompatabilityFilters!, $aggregationFields: [String!]!, $hasAuthenticatedUser: Boolean!, $requiresAggregation: Boolean!) { seek_listings_from_filters(filters: $filters) { total_count total_pages size current_page aggregation(fields: $aggregationFields) @include(if: $requiresAggregation) content { __typename ... on Listing { listing_id urn listing_status_group listing_status listing_status_label(intent: SEARCH) primary_photo primary_property_id listing_photos_count listing_page_path reserve_price @include(if: $hasAuthenticatedUser) is_hot formatted_address(format: DOUBLE_LINE) listing_configuration { product_type is_reserve_displayed is_reserve_price_available broker_commission financing_available buyer_premium_available interior_access_allowed occupancy_status asset_type is_first_look_enabled is_direct_offer_enabled is_third_party_online } attribution_source { origin_code } external_identifiers { data_source external_identifier } venue { venue_type } event { event_code trustee_sale } valuation { seller_current_value_amount } strategy { selling_method_attributes { online_segment_type } } seller_property { street_description municipality country_primary_subdivision country_secondary_subdivision postal_code } program_configuration { program_enrollment_code } seller_terms { inspection_terms { is_option_contingency is_contingency } leaseback_terms { leaseback_period_in_days leaseback_period_rent } finance_terms { finance_preference is_contingency } intent } primary_property { property_id summary { total_bedrooms total_bathrooms square_footage lot_size year_built valuation structure_type_code structure_type_group address { coordinates { lon lat } } } is_currently_saved @include(if: $hasAuthenticatedUser) is_newly_listed current_user_tracking_state { is_seen is_updated } } auction { start_date end_date starting_bid is_online visible_auction_start_date_time bid_instruction { nos_amount } } marketing_tags { tag } open_houses { local_date start_time end_time } listing_summary { is_remote_bid_enabled is_remote_before_and_during_auction_enabled show_opening_bid } external_information(resolvePolicy: CACHE_ONLY) { collateral { summary { estimated low high type } } } selling_method(resolvePolicy: CACHE_ONLY) { __typename ... on OnlineAuctionSegment { _alias_OnlineAuctionSegment__starting_bid_amount: starting_bid_amount _alias_OnlineAuctionSegment__configuration: configuration { is_match_bidding_enabled is_registration_deposit_required_enabled bid_again_count should_bid_again } listing_id __typename start_date segment_type initial_end_date current_time reserve_status starting_bid_amount subject_to_status current_highest_bid { bid_id updated_date bid_amount type terms { status } } segment_status current_increment_amount bid_count result { winning_bid_amount } } ... on LiveAuctionSegment { _alias_LiveAuctionSegment__starting_bid_amount: starting_bid_amount _alias_LiveAuctionSegment__configuration: configuration { state_deposit_rule } current_highest_bid { bid_amount } } } } } } }`;

const num = (v: unknown): number | undefined => {
  if (v == null) return undefined;
  const n = Number(v);
  return isFinite(n) && n !== 0 ? n : undefined;
};

function classify(raw: string): PropertyType {
  const s = (raw || "").toLowerCase();
  if (s.includes("multi") || s.includes("duplex")) return "multi_family";
  if (s.includes("condo")) return "condo";
  if (s.includes("town")) return "townhouse";
  if (s.includes("manufactured") || s.includes("mobile")) return "mobile";
  if (s.includes("land") || s.includes("lot")) return "land";
  if (s.includes("single") || s.includes("home") || s.includes("family"))
    return "single_family";
  return "single_family";
}

export async function scrapeAuctionComState(
  state: string,
  delayMs = 1000,
): Promise<Property[]> {
  const properties: Property[] = [];
  let offset = 0;
  const limit = 500;
  let totalProperties = 0;

  do {
    try {
      const payload = {
        query: QUERY,
        variables: {
          filters: {
            property_state: state,
            listing_type: "active",
            sort: "auction_date_order",
            limit,
            version: 1,
            offset,
          },
          hasAuthenticatedUser: false,
          aggregationFields: [
            "primary_property_summary.structure_type_code.keyword",
            "listing_summary.is_remote_bid_enabled",
          ],
          requiresAggregation: offset === 0,
        },
      };

      const res = await fetch("https://graph.auction.com/graphql", {
        method: "POST",
        headers: {
          "auction-graph-source": "auctioncom",
          referer: "https://www.auction.com/",
          accept: "application/json",
          "content-type": "application/json",
          "user-agent": UA,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.warn(
          `[HomeIQ:AuctionCom] ${state} offset ${offset} failed: ${res.status}`,
        );
        break;
      }

      const json = await res.json();
      const results = json.data?.seek_listings_from_filters;
      if (!results || !results.content || results.content.length === 0) break;

      totalProperties = results.total_count || 0;

      for (const item of results.content) {
        if (item.__typename !== "Listing") continue;

        const propSummary = item.primary_property?.summary || {};
        const coords = propSummary.address?.coordinates || {};
        const auction = item.auction || {};
        const valuation =
          item.valuation?.seller_current_value_amount || propSummary.valuation;

        let price = num(auction.starting_bid) || num(valuation);

        const sellingMethod = item.selling_method;
        if (sellingMethod) {
          if (sellingMethod._alias_OnlineAuctionSegment__starting_bid_amount) {
            price = num(
              sellingMethod._alias_OnlineAuctionSegment__starting_bid_amount,
            );
          } else if (
            sellingMethod._alias_LiveAuctionSegment__starting_bid_amount
          ) {
            price = num(
              sellingMethod._alias_LiveAuctionSegment__starting_bid_amount,
            );
          }
        }

        if (!price) price = valuation; // fallback

        // Usually reserve_price is hidden unless authenticated, but sometimes we get seller_current_value_amount
        const titleAddress = item.formatted_address
          ? item.formatted_address.join(", ")
          : undefined;
        const street =
          propSummary.street_description ||
          item.seller_property?.street_description;
        const city = item.seller_property?.municipality;
        const zip = item.seller_property?.postal_code;

        // Distinguish PRE-foreclosure (a trustee/foreclosure sale — the owner STILL OWNS and is being
        // foreclosed = the #1 motivated seller) from bank-owned REO. Auction.com flags a trustee sale on
        // the event; asset_type/status carry the rest. This turns ~17k generic "auction" rows into scored,
        // filterable pre-foreclosure leads.
        const assetType = String(
          item.listing_configuration?.asset_type || "",
        ).toLowerCase();
        const statusGroup = String(
          item.listing_status_group || "",
        ).toUpperCase();
        const trusteeSale = !!item.event?.trustee_sale;
        const isForeclosure =
          trusteeSale ||
          /foreclos|trustee|pre[-_ ]?foreclos/.test(assetType) ||
          statusGroup.includes("FORECLOS");
        const isReo =
          !isForeclosure &&
          (/bank[-_ ]?owned|reo/.test(assetType) ||
            statusGroup.includes("REO"));

        properties.push({
          source: "auctioncom",
          source_listing_id: `auc-${item.listing_id}`,
          source_url: `https://www.auction.com${item.listing_page_path}`,
          title:
            titleAddress || [street, city, state].filter(Boolean).join(", "),
          property_type: classify(propSummary.structure_type_code || ""),
          description: `Auction.com — ${item.listing_configuration?.asset_type || "Foreclosure/REO"}`,
          address: street,
          city,
          state,
          zip,
          lat: num(coords.lat),
          lng: num(coords.lon),
          price,
          beds: num(propSummary.total_bedrooms),
          baths: num(propSummary.total_bathrooms),
          sqft: num(propSummary.square_footage),
          images: item.primary_photo ? [item.primary_photo] : [],
          seller: "Auction.com",
          seller_type: "auction",
          signals: {
            channel: isReo ? "reo" : isForeclosure ? "foreclosure" : "reo",
            // The high-value flags the scorer + "Pre-foreclosure" / "REO" filters read.
            ...(isForeclosure ? { foreclosure: true } : {}),
            ...(isReo ? { reo: true } : {}),
            asset_type: item.listing_configuration?.asset_type,
            trustee_sale: trusteeSale || undefined,
            occupancy: item.listing_configuration?.occupancy_status,
            status: item.listing_status,
            auction_start: auction.start_date,
            auction_end: auction.end_date,
            marketplace: "auctioncom",
            estimated_value: num(valuation),
          },
          scraped_at: new Date().toISOString(),
        });
      }

      offset += limit;
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    } catch (e) {
      console.warn(`[HomeIQ:AuctionCom] ${state} error:`, e);
      break;
    }
  } while (properties.length < totalProperties && properties.length < 5000); // safety cap

  return properties;
}

export async function scrapeAuctionCom(
  states = US_STATES,
  delayMs = 1000,
): Promise<Property[]> {
  console.log("[HomeIQ:AuctionCom] harvesting Auction.com listings...");
  const byId = new Map<string, Property>();

  for (const st of states) {
    const props = await scrapeAuctionComState(st, delayMs);
    for (const p of props) {
      byId.set(p.source_listing_id!, p);
    }
  }

  const properties = Array.from(byId.values());
  console.log(`[HomeIQ:AuctionCom] found ${properties.length} homes`);
  return properties;
}
