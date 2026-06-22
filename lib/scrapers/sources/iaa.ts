import * as cheerio from "cheerio";
import axios from "axios";
import { getWorkingProxy } from "../tools/free-proxy-manager";
import { ProxyManager } from "../tools/proxy-manager";
import { enrichAndStore } from "./shared";

const proxyManager = new ProxyManager();

function proxyConfigToAxios(p?: ReturnType<ProxyManager["getProxy"]>) {
  if (!p) return undefined;
  const ax: any = { host: p.host, port: p.port };
  if (p.protocol) ax.protocol = p.protocol;
  if (p.username)
    ax.auth = { username: p.username, password: p.password || "" };
  return ax;
}

export async function scrapeIAA(searchTerm = "", limit = 100) {
  // Prefer residential proxies from PROXY_URLS via ProxyManager (production-grade path)
  let proxy = proxyManager.getProxy({ type: "residential" });
  let useFreeFallback = false;
  if (!proxy) {
    const free = await getWorkingProxy();
    if (free) {
      useFreeFallback = true;
      proxy = {
        id: "free",
        host: free.split(":")[0],
        port: parseInt(free.split(":")[1]),
        protocol: "http",
        type: "datacenter",
      } as any;
    }
  }

  const url = `https://www.iaai.com/Search?SearchSpec=${encodeURIComponent(searchTerm)}&sortBy=saleDate&sortOrder=asc`;

  const config: any = {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://www.iaai.com/",
    },
    timeout: 20000,
  };

  if (proxy) {
    config.proxy = useFreeFallback
      ? { host: (proxy as any).host, port: (proxy as any).port }
      : proxyConfigToAxios(proxy);
  }

  let res;
  try {
    res = await axios.get(url, config);
  } catch (e) {
    // One retry with a different residential proxy if available
    const nextProxy = proxyManager.getProxy({ type: "residential" });
    if (nextProxy && !useFreeFallback) {
      config.proxy = proxyConfigToAxios(nextProxy);
      res = await axios.get(url, config);
    } else {
      throw e;
    }
  }

  const $ = cheerio.load(res.data);
  const vehicles: any[] = [];

  // IAA uses both old and new layouts — handle both, more resilient selectors
  const selectors = [
    "[data-lot-number]",
    ".lot-details-container",
    ".search-result-card",
    ".grid-item", // newer grid
    "div[data-lotid]",
    ".srp-results .result-card",
  ];

  for (const selector of selectors) {
    if ($(selector).length > 0) {
      $(selector).each((_, el) => {
        const lotNum =
          $(el).attr("data-lot-number") ||
          $(el).find("[data-lot-number]").attr("data-lot-number") ||
          $(el).attr("data-lotid") ||
          String(Date.now() + Math.random());

        const priceText = $(el)
          .find('.bid-price, .current-bid, [class*="price"], .price')
          .first()
          .text();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;

        const odometerText = $(el)
          .find('.odometer, [data-odometer], [class*="mileage"], .mileage')
          .first()
          .text();
        const odometer = parseInt(odometerText.replace(/[^0-9]/g, "")) || 0;

        const href =
          $(el).find("a").attr("href") || $(el).closest("a").attr("href") || "";

        if (price > 0 || href.includes("lot") || href.includes("/vehicle/")) {
          const title = $(el)
            .find('.lot-title, .vehicle-title, h2, h3, [class*="title"]')
            .first()
            .text()
            .trim();
          const vin =
            $(el)
              .find('[data-vin], .vin, [class*="vin"]')
              .first()
              .text()
              .trim() ||
            $(el).attr("data-vin") ||
            "";
          const damage = $(el)
            .find(
              '.damage-description, .primary-damage, [class*="damage"], .damage',
            )
            .first()
            .text()
            .trim();
          const locCity = $(el)
            .find('.location-city, [class*="city"], .city')
            .first()
            .text()
            .trim();
          const locState = $(el)
            .find('.location-state, [class*="state"], .state')
            .first()
            .text()
            .trim();
          const saleDate = $(el)
            .find('.sale-date, [class*="sale-date"], .ends')
            .first()
            .text()
            .trim();
          const imgs = $(el)
            .find("img")
            .map((_, img) => $(img).attr("src") || $(img).attr("data-src"))
            .get()
            .filter((s: string) => s && s.startsWith("http"));

          vehicles.push({
            source: "iaa",
            source_category: "salvage",
            external_id: lotNum,
            title: title || "IAA Vehicle",
            vin,
            current_bid: price,
            asking_price: price,
            odometer,
            damage_type: damage,
            title_type:
              $(el)
                .find('.title-type, [class*="title-type"]')
                .first()
                .text()
                .trim()
                .toLowerCase() || "salvage",
            location_city: locCity,
            location_state: locState,
            sale_date: saleDate,
            images: imgs,
            listing_url: href.startsWith("http")
              ? href
              : `https://www.iaai.com${href}`,
          });
        }
      });
      break; // Found a working selector, stop
    }
  }

  // Enrich each vehicle and store in Supabase (real data path)
  for (const v of vehicles.slice(0, limit)) {
    await enrichAndStore(v);
  }

  console.log(
    `[IAA] Found ${vehicles.length} lots (proxy: ${proxy ? (useFreeFallback ? "free" : "managed") : "none"})`,
  );
  return vehicles.length;
}
