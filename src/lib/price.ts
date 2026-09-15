import type { Currency } from './storage';

export type Prices = {
  sol: Record<Currency, number>;
  solChange24h: number; // yüzde
  usdTry: number;
};

let cache: { at: number; data: Prices } | null = null;
const TTL = 60_000;

// CoinGecko'nun anahtarsız uç noktası (dakikada ~30 istek). Jupiter fiyat API'si artık anahtar istiyor.
export async function getPrices(): Promise<Prices | null> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana,tether&vs_currencies=usd,try&include_24hr_change=true',
    );
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const data: Prices = {
      sol: { USD: j.solana.usd, TRY: j.solana.try },
      solChange24h: j.solana.usd_24h_change ?? 0,
      usdTry: j.tether.try / j.tether.usd,
    };
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return cache?.data ?? null;
  }
}

/** Stabil token (USDC/USDT) 1 birim = seçili para biriminde kaç? */
export const stableRate = (p: Prices, c: Currency) => (c === 'USD' ? 1 : p.usdTry);

/** USD fiyatını seçili para birimine çevirir. */
export const usdTo = (usd: number, p: Prices, c: Currency) => usd * stableRate(p, c);

export type TokenMarket = { symbol: string; name: string; icon: string | null; usd: number | null; change24h: number | null };

const marketCache = new Map<string, { at: number; data: TokenMarket | null }>();

// Jupiter'in anahtarsız token arama uç noktası: logo, fiyat ve 24s değişim tek istekte, virgülle çoklu mint.
export async function getTokenMarkets(mints: string[]): Promise<Record<string, TokenMarket>> {
  const now = Date.now();
  const out: Record<string, TokenMarket> = {};
  const need: string[] = [];
  for (const m of mints) {
    const c = marketCache.get(m);
    if (c && now - c.at < TTL) {
      if (c.data) out[m] = c.data;
    } else need.push(m);
  }
  for (let i = 0; i < need.length; i += 40) {
    const chunk = need.slice(i, i + 40);
    try {
      const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${chunk.join(',')}`);
      if (!res.ok) throw new Error(String(res.status));
      const list: any[] = await res.json();
      const byId = new Map(list.map((t) => [t.id, t]));
      for (const m of chunk) {
        const t = byId.get(m);
        const data: TokenMarket | null = t
          ? {
              symbol: t.symbol,
              name: t.name,
              icon: typeof t.icon === 'string' ? t.icon : null,
              usd: typeof t.usdPrice === 'number' ? t.usdPrice : null,
              change24h: typeof t.stats24h?.priceChange === 'number' ? t.stats24h.priceChange : null,
            }
          : null;
        marketCache.set(m, { at: now, data });
        if (data) out[m] = data;
      }
    } catch {
      for (const m of chunk) {
        const stale = marketCache.get(m)?.data;
        if (stale) out[m] = stale;
      }
    }
  }
  return out;
}
