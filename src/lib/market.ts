// Real-market lookups for slabs.
//  - eBay Browse API (free developer keys): current listings for the exact cert, else the same card + grade.
//  - PSA Public API (free token): population for the cert.
// Both are optional; without keys the app uses the rarity-based estimate.
import { one, run } from "./db";
import type { Slab } from "./slabs";

const EBAY_ID = process.env.EBAY_CLIENT_ID;
const EBAY_SECRET = process.env.EBAY_CLIENT_SECRET;
const PSA_TOKEN = process.env.PSA_API_TOKEN;
const MKT_TTL = 3 * 24 * 3600_000;
const POP_TTL = 30 * 24 * 3600_000;

export const marketConfigured = () => ({ ebay: !!(EBAY_ID && EBAY_SECRET), psa: !!PSA_TOKEN });

let ebayToken: { value: string; exp: number } | null = null;
async function getEbayToken() {
  if (ebayToken && ebayToken.exp > Date.now() + 60_000) return ebayToken.value;
  const r = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${EBAY_ID}:${EBAY_SECRET}`).toString("base64")}` },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`eBay auth ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  ebayToken = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

type EbayItem = { title: string; price?: { value: string; currency: string } };
async function ebaySearch(q: string): Promise<EbayItem[]> {
  const token = await getEbayToken();
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&category_ids=261328&limit=50&filter=buyingOptions:%7BFIXED_PRICE%7D,priceCurrency:USD`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`eBay search ${r.status}`);
  return ((await r.json()) as { itemSummaries?: EbayItem[] }).itemSummaries ?? [];
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Look up a market value for one slab. Returns the value used (market or estimate). */
async function ebayValue(s: Slab) {
  const lastName = s.player.split(" ").pop()!.toLowerCase();
  const gradeTag = s.grade === "AUTH" ? "auth" : `${s.company} ${s.grade}`.toLowerCase();
  const priceOf = (i: EbayItem) => (i.price?.currency === "USD" ? Number(i.price.value) : NaN);

  // 1) This exact slab listed for sale (search by cert number).
  const exact = (await ebaySearch(s.cert)).filter((i) => i.title.includes(s.cert)).map(priceOf).filter((x) => x > 0);
  if (exact.length) return { value: Math.round(median(exact)), detail: { match: "cert", n: exact.length, query: s.cert } };

  // 2) Same card in the same grade.
  const q = [s.year, s.set_name, s.player, s.card_no ? `#${s.card_no}` : "", s.variant, s.grade === "AUTH" ? `${s.company} authentic` : `${s.company} ${s.grade}`]
    .filter(Boolean).join(" ");
  const items = (await ebaySearch(q)).filter((i) => {
    const t = i.title.toLowerCase().replace(/\s+/g, " ");
    return t.includes(lastName) && t.includes(String(s.year)) && (t.includes(gradeTag) || t.includes(gradeTag.replace(" ", "")));
  });
  const prices = items.map(priceOf).filter((x) => x > 0);
  if (prices.length < 3) return null;
  // Trim the top and bottom 15% to ignore lots, mislabels and moonshot asks.
  const sorted = prices.sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * 0.15);
  const core = sorted.slice(cut, sorted.length - cut || undefined);
  return { value: Math.round(median(core)), detail: { match: "card+grade", n: prices.length, low: Math.round(sorted[0]), high: Math.round(sorted[sorted.length - 1]), query: q } };
}

async function psaPop(s: Slab) {
  const r = await fetch(`https://api.psacard.com/publicapi/cert/GetByCertNumber/${s.cert}`, {
    headers: { Authorization: `bearer ${PSA_TOKEN}` }, signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`PSA ${r.status}`);
  const j = (await r.json()) as { PSACert?: { TotalPopulation?: number; PopulationHigher?: number } };
  return j.PSACert ? { pop: j.PSACert.TotalPopulation ?? null, higher: j.PSACert.PopulationHigher ?? null } : null;
}

/** Refresh market data for these slabs (skips anything looked up recently). Never throws. */
export async function refreshMarket(slabIds: number[]) {
  const cfg = marketConfigured();
  await Promise.all(slabIds.map(async (id) => {
    const s = one<Slab>("SELECT * FROM slabs WHERE id = ?", id);
    if (!s) return;
    if (cfg.ebay && (!s.mkt_at || Date.now() - s.mkt_at > MKT_TTL)) {
      try {
        const v = await ebayValue(s);
        if (v) run("UPDATE slabs SET mkt_value = ?, mkt_source = 'ebay', mkt_detail = ?, mkt_at = ? WHERE id = ?", v.value, JSON.stringify(v.detail), Date.now(), id);
        else run("UPDATE slabs SET mkt_at = ? WHERE id = ?", Date.now(), id);
      } catch (e) {
        console.warn("[packdraft] eBay lookup failed", s.cert, (e as Error).message);
      }
    }
    if (cfg.psa && s.company === "PSA" && (!s.pop_at || Date.now() - (s.pop_at ?? 0) > POP_TTL)) {
      try {
        const p = await psaPop(s);
        if (p) run("UPDATE slabs SET pop = ?, pop_higher = ?, pop_at = ? WHERE id = ?", p.pop, p.higher, Date.now(), id);
      } catch (e) {
        console.warn("[packdraft] PSA lookup failed", s.cert, (e as Error).message);
      }
    }
  }));
}
