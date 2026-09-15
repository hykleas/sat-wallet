import { useWallet } from '@/context/WalletContext';
import { stableRate, usdTo } from '@/lib/price';

export type Asset = {
  key: string;
  name: string;
  symbol: string;
  logo: string | null;
  isSol: boolean;
  amount: number | null;
  /** Seçili para biriminde birim fiyat. */
  price: number | null;
  value: number | null;
  change24h: number | null;
};

/** Bakiyeleri, fiyatları ve 24s değişimleri tek bir portföy görünümüne çevirir. */
export function usePortfolio() {
  const { lamports, tokens, markets, prices, prefs } = useWallet();
  const cur = prefs.currency;
  const sol = lamports == null ? null : lamports / 1e9;
  const solPrice = prices ? prices.sol[cur] : null;

  const solAsset: Asset = {
    key: 'SOL',
    name: 'Solana',
    symbol: 'SOL',
    logo: null,
    isSol: true,
    amount: sol,
    price: solPrice,
    value: sol != null && solPrice != null ? sol * solPrice : null,
    change24h: prices?.solChange24h ?? null,
  };

  const tokenAssets: Asset[] = tokens
    .map((t) => {
      const m = markets[t.mint];
      const price = prices && m?.usd != null ? usdTo(m.usd, prices, cur) : prices && t.meta.stable ? stableRate(prices, cur) : null;
      return {
        key: t.mint,
        name: m?.name ?? t.meta.name,
        symbol: m?.symbol ?? t.meta.symbol,
        logo: m?.icon ?? null,
        isSol: false,
        amount: t.amount,
        price,
        value: price != null ? t.amount * price : null,
        change24h: m?.change24h ?? (t.meta.stable ? 0 : null),
      };
    })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  const assets = [solAsset, ...tokenAssets];
  const total = solAsset.value == null ? null : assets.reduce((sum, a) => sum + (a.value ?? 0), 0);

  // Her varlığın bugünkü değerinden 24 saat önceki değerini geri hesaplayıp toplam değişimi bul.
  const changeValue = assets.reduce((sum, a) => (a.value != null && a.change24h != null ? sum + (a.value * a.change24h) / (100 + a.change24h) : sum), 0);
  const base = total == null ? 0 : total - changeValue;
  const changePct = base > 0 ? (changeValue / base) * 100 : 0;

  return { assets, total, changeValue, changePct, empty: lamports === 0 && tokens.length === 0 };
}
