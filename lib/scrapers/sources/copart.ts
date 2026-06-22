import * as cheerio from "cheerio";
import { fetchWithPatchright } from "../tools/patchright-engine";
import { ProxyManager } from "../tools/proxy-manager";
import { enrichAndStore } from "./shared";

const proxyManager = new ProxyManager();

export async function scrapeCopart(searchTerm = "", state = "") {
  const url = `https://www.copart.com/vehicleFinderSearch?query=${encodeURIComponent(searchTerm)}${state ? `&state=${state}` : ""}`;

  // Prefer residential proxy for stealth + reliability (research-backed pattern)
  const resProxy = proxyManager.getProxy({ type: "residential" });
  const proxyUrl = resProxy
    ? `${resProxy.protocol || "http"}://${resProxy.username ? `${resProxy.username}:${resProxy.password || ""}@` : ""}${resProxy.host}:${resProxy.port}`
    : undefined;

  let html: string;
  try {
    html = await fetchWithPatchright(url, undefined, proxyUrl);
    const vehiclesFromHtml = parseCopartHtml(html);
    if (vehiclesFromHtml.length) {
      for (const v of vehiclesFromHtml) await enrichAndStore(v);
      return vehiclesFromHtml.length;
    }
  } catch (e) {
    console.error(
      "[Copart] Patchright failed or no DOM extract, falling back to API:",
      e,
    );
  }

  return await scrapeCopartAPI(searchTerm, state, proxyUrl);
}

function parseCopartHtml(html: string): any[] {
  const $ = cheerio.load(html);
  const vehicles: any[] = [];
  $('tr[ng-repeat], .lot-row, [data-uname="lotRow"], .search_result_row').each(
    (_, el) => {
      const row = $(el);
      const title = row
        .find('[data-uname="lotsearchLotTitle"], .lot-title, .vehicle-title')
        .text()
        .trim();
      const priceText = row
        .find('[data-uname="bidValue"], .buy-now-price, .price')
        .text()
        .trim();
      const mileText = row
        .find('[data-uname="odometer"], .odometer')
        .text()
        .trim();
      const lotUrl =
        row.find('a[href*="/lot/"]').attr("href") || row.find("a").attr("href");
      const imgSrc =
        row.find("img").attr("src") || row.find("img").attr("data-src");
      const locationText = row
        .find('[data-uname="lotLocation"], .location')
        .text()
        .trim();
      const damageText = row
        .find('[data-uname="primaryDamage"], .damage')
        .text()
        .trim();
      if (!title) return;
      vehicles.push({
        source: "copart",
        source_category: "salvage",
        external_id: lotUrl?.split("/lot/")[1]?.split("?")[0] || "",
        listing_url: lotUrl
          ? lotUrl.startsWith("http")
            ? lotUrl
            : `https://www.copart.com${lotUrl}`
          : "",
        title,
        year: parseInt(title.match(/^\d{4}/)?.[0] || "0", 10) || undefined,
        make: title.split(" ")[1] || "",
        model: title.split(" ").slice(2, 4).join(" "),
        asking_price: parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0,
        odometer: parseInt(mileText.replace(/[^0-9]/g, "")) || 0,
        damage_type: damageText,
        title_type: "salvage",
        location_city: locationText.split(",")[0]?.trim(),
        location_state: locationText.split(",")[1]?.trim() || "",
        images: imgSrc ? [imgSrc] : [],
      });
    },
  );
  return vehicles;
}

// Fallback: hit Copart's internal search API directly and parse results
// proxy param accepted for signature parity (future enhancement via agent if needed)
async function scrapeCopartAPI(
  searchTerm: string,
  state: string,
  _proxy?: string,
) {
  try {
    const res = await fetch(
      "https://www.copart.com/public/lots/search-results",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "X-Requested-With": "XMLHttpRequest",
          Referer: "https://www.copart.com/",
        },
        body: JSON.stringify({
          query: searchTerm || "",
          filters: { state: state ? [state] : [] },
          sort: "saleDate",
          size: 100,
        }),
      },
    );

    if (!res.ok) {
      console.error("[Copart API] Failed:", res.status);
      return 0;
    }

    const data = await res.json();
    const content = data?.data?.results?.content || [];
    const vehicles: any[] = content.map((lot: any) => ({
      source: "copart",
      source_category: "salvage",
      external_id: String(lot.lotNumber || lot.id || ""),
      listing_url: lot.lotUrl
        ? lot.lotUrl.startsWith("http")
          ? lot.lotUrl
          : `https://www.copart.com${lot.lotUrl}`
        : "",
      title: lot.lotTitle || lot.yrMkMd || "",
      year:
        lot.year ||
        (lot.yrMkMd ? parseInt(String(lot.yrMkMd).slice(0, 4), 10) : undefined),
      make: lot.make || (lot.yrMkMd ? String(lot.yrMkMd).split(" ")[1] : ""),
      model:
        lot.model ||
        (lot.yrMkMd ? String(lot.yrMkMd).split(" ").slice(2, 4).join(" ") : ""),
      asking_price: lot.currentBid || lot.buyItNowPrice || lot.minBid || 0,
      odometer: lot.odometer || lot.mileage || 0,
      damage_type: lot.damageDescription || lot.primaryDamage || "",
      title_type: lot.titleType || "salvage",
      location_city: lot.locationCity || "",
      location_state: lot.locationState || state || "",
      images: lot.images
        ? Array.isArray(lot.images)
          ? lot.images
          : [lot.images]
        : [],
      sale_date: lot.saleDate,
    }));

    for (const v of vehicles) {
      await enrichAndStore(v);
    }
    console.log(`[Copart API] Found ${vehicles.length} lots`);
    return vehicles.length;
  } catch (e) {
    console.error("[Copart API] Exception:", e);
    return 0;
  }
}
