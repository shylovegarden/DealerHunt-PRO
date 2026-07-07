import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createServerComponentClient } from "@/lib/supabase";
import { resolvePropertyImage } from "@/lib/housing/property-image";

// The homes twin of LiveDealShowcase — REAL distressed/discounted leads scored right now, so a real-estate
// visitor SEES their side of the engine (not just the cars). Server-rendered; aerial-hero for the ~90% that
// are off-market with no listing photo. A teaser (8) that CTAs to the free signup.

const money = (n?: number | null) =>
  n != null ? `$${Math.round(n).toLocaleString()}` : "";

// Cached 5 min so the PUBLIC landing page can't hammer the DB under traffic.
const getShowcaseHomes = unstable_cache(
  async () => {
    const sb = createServerComponentClient();
    const { data } = await sb
      .from("properties")
      .select(
        "source_listing_id, address, city, state, price, images, lat, lng, lead_score, signals",
      )
      .eq("active", true)
      .eq("lead_tier", "hot")
      .not("lat", "is", null)
      .order("lead_score", { ascending: false, nullsFirst: false })
      .limit(24);
    return (data || []).slice(0, 8);
  },
  ["landing-showcase-homes"],
  { revalidate: 300 },
);

function distressLabel(signals: any): string | null {
  const d = signals || {};
  if (d.foreclosure || d.sheriff_sale) return "⚖️ Foreclosure";
  if (d.tax_delinquent || d.total_due) return "Tax-delinquent";
  if (d.code_violation || d.violation_count) return "Code violations";
  if (d.absentee_owner || d.out_of_state) return "Absentee owner";
  if (d.vacant) return "Vacant";
  return null;
}

export async function LiveHomeShowcase() {
  let homes: any[] = [];
  try {
    homes = await getShowcaseHomes();
  } catch {
    return null;
  }
  if (homes.length < 4) return null;

  return (
    <section className="w-full max-w-6xl mx-auto px-6 pt-4 pb-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="serif text-2xl md:text-3xl font-semibold text-[var(--t1)]">
            Distressed leads, live right now
          </h2>
          <p className="mt-1 text-sm text-[var(--t4)]">
            Off-market, tax-delinquent, pre-foreclosure — scored by equity
            before anyone else calls.
          </p>
        </div>
        <Link
          href="/register"
          className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-transform hover:translate-x-0.5"
          style={{ background: "var(--grad-home, var(--grad))" }}
        >
          See them all →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {homes.map((h) => {
          const img = resolvePropertyImage({
            image: Array.isArray(h.images) ? h.images[0] : null,
            lat: h.lat,
            lng: h.lng,
          });
          const distress = distressLabel(h.signals);
          return (
            <Link
              key={h.source_listing_id}
              href="/register"
              className="group relative overflow-hidden rounded-2xl border border-[var(--b1)] bg-[var(--s0)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-[var(--s2)]">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.url}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-3xl opacity-40">
                    🏡
                  </div>
                )}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
                  }}
                />
                {distress && (
                  <span className="absolute left-2 top-2 rounded-full bg-[var(--red)] px-2 py-0.5 text-[10px] font-black text-white">
                    {distress}
                  </span>
                )}
                {img && img.kind !== "listing" && (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1 py-0.5 text-[9px] font-bold text-white">
                    🛰
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <div className="text-base font-black text-white drop-shadow">
                    {h.price ? money(h.price) : "Off-market"}
                  </div>
                </div>
              </div>
              <div className="p-2.5">
                <div className="truncate text-[13px] font-bold text-[var(--t1)]">
                  {h.address || `${h.city || ""}`}
                </div>
                <div className="text-[11px] text-[var(--t4)]">
                  {[h.city, h.state].filter(Boolean).join(", ") ||
                    h.state ||
                    "—"}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-7 text-center sm:hidden">
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-[var(--shadow)]"
          style={{ background: "var(--grad-home, var(--grad))" }}
        >
          See every lead — free →
        </Link>
      </div>
    </section>
  );
}
