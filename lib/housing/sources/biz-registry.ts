// lib/housing/sources/biz-registry.ts
//
// The free "way in" to owner CONTACT for LLC-owned properties: many states publish their ENTIRE business
// registry as keyless open data, including a process/contact person + address for every entity. A large
// share of absentee/investor leads are owned by an LLC, so matching that LLC name → the registry gives us
// a real human contact + mailing address — the skip-trace-lite that PropStream-tier tools charge for.
//
// EXACT normalized name match only (never guess a wrong person), and we skip commercial registered-agent
// services (they're not the owner). Extensible per state via the REGISTRY map.

interface RegistryCfg {
  url: string; // Socrata resource endpoint (.json)
  nameField: string; // entity-name column
  contactField: string; // process/agent person column
  addr: [string, string, string, string]; // address1, city, state, zip columns
}

// State → open business registry. All keyless Socrata endpoints.
const REGISTRY: Record<string, RegistryCfg> = {
  NY: {
    url: "https://data.ny.gov/resource/n9v6-gdp6.json",
    nameField: "current_entity_name",
    contactField: "dos_process_name",
    addr: [
      "dos_process_address_1",
      "dos_process_city",
      "dos_process_state",
      "dos_process_zip",
    ],
  },
  CO: {
    url: "https://data.colorado.gov/resource/4ykn-tg5h.json",
    nameField: "entityname",
    contactField: "agentfirstname",
    addr: [
      "agentprincipaladdress1",
      "agentprincipalcity",
      "agentprincipalstate",
      "agentprincipalzipcode",
    ],
  },
};

export function registryStates(): string[] {
  return Object.keys(REGISTRY);
}

// Registry format: UPPERCASE, punctuation stripped, whitespace collapsed.
export function normEntity(s: string): string {
  return s
    .replace(/[.,'"]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();
}

// Commercial registered-agent services — a mailing drop, not the owner. Skip so we only surface real leads.
const AGENT_SERVICES =
  /CORPORATE CREATIONS|C T CORPORATION|CT CORPORATION|REGISTERED AGENT|COGENCY|NORTHWEST|LEGALINC|INCORP|UNITED STATES CORPORATION|NATIONAL REGISTERED|PARACORP|CAPITOL SERVICES|VCORP|HARBOR COMPLIANCE|BIZFILINGS|SPIEGEL|C\/O THE LLC/i;

export interface EntityContact {
  name: string;
  address?: string;
  source: string; // e.g. "NY business registry"
}

/**
 * Look up an LLC/entity owner in its state's business registry and return a real contact + address.
 * Exact normalized-name match only; null when unsupported state, no match, or the contact is just a
 * commercial agent service. Best-effort (network); callers should catch.
 */
export async function lookupEntityContact(
  owner: string | null | undefined,
  state: string | null | undefined,
): Promise<EntityContact | null> {
  const cfg = state ? REGISTRY[state] : undefined;
  if (!cfg || !owner) return null;
  // Only worth looking up genuine entities.
  if (
    !/\b(LLC|L\.L\.C|INC|CORP|LP|LLP|COMPANY|PROPERTIES|HOLDINGS|TRUST|GROUP|VENTURES|CAPITAL)\b/i.test(
      owner,
    )
  )
    return null;

  const n = normEntity(owner);
  const where = encodeURIComponent(
    `upper(${cfg.nameField})='${n.replace(/'/g, "''")}'`,
  );
  const url = `${cfg.url}?$where=${where}&$limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Record<string, string>[];
  if (!Array.isArray(rows) || !rows.length) return null;

  const r = rows[0];
  const name = (r[cfg.contactField] || "").trim();
  if (!name || AGENT_SERVICES.test(name)) return null;

  const [a1, ac, as, az] = cfg.addr;
  const address = [r[a1], r[ac], [r[as], r[az]].filter(Boolean).join(" ")]
    .map((x) => (x || "").trim())
    .filter(Boolean)
    .join(", ");

  return {
    name,
    address: address || undefined,
    source: `${state} business registry`,
  };
}
