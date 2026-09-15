import { VersionedTransaction, type Connection, type Keypair, type PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';

import { waitForConfirmation } from './solana';

// Jupiter Metis takas API'si (anahtarsız "lite" katman). Ultra API'nin aksine kendi ücreti yoktur;
// biz de platformFeeBps göndermeyiz. Kullanıcının ödediği: havuz (DEX) ücreti fiyata dahil + Solana ağ ücreti.
const SWAP_API = 'https://lite-api.jup.ag/swap/v1';
const TOKENS_API = 'https://lite-api.jup.ag/tokens/v2';

export const SOL_MINT = 'So11111111111111111111111111111111111111112';

/** Takas seçicide varsayılan gösterilen, bilinen tokenlar. */
export const POPULAR_MINTS = [
  SOL_MINT,
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
  '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo', // PYUSD
];

export type SwapToken = { mint: string; symbol: string; name: string; icon: string | null; decimals: number; verified: boolean; usd: number | null };

export type Quote = {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  slippageBps: number;
  priceImpactPct: string;
  platformFee: { amount: string; feeBps: number } | null;
  routePlan: { percent: number; swapInfo: { label?: string } }[];
};

const toSwapToken = (t: any): SwapToken => ({
  mint: t.id,
  symbol: t.symbol,
  name: t.name,
  icon: typeof t.icon === 'string' ? t.icon : null,
  decimals: t.decimals,
  verified: !!t.isVerified,
  usd: typeof t.usdPrice === 'number' ? t.usdPrice : null,
});

/** Metin (sembol/ad) ya da virgülle ayrılmış mint listesiyle token arar. Doğrulanmışlar önce. */
export async function searchTokens(query: string, signal?: AbortSignal): Promise<SwapToken[]> {
  const res = await fetch(`${TOKENS_API}/search?query=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error('Token listesi alınamadı.');
  const list: any[] = await res.json();
  return list.filter((t) => typeof t.decimals === 'number').map(toSwapToken);
}

export async function getSwapTokens(mints: string[]): Promise<SwapToken[]> {
  if (!mints.length) return [];
  const found = await searchTokens(mints.join(','));
  const byMint = new Map(found.map((t) => [t.mint, t]));
  return mints.flatMap((m) => byMint.get(m) ?? []);
}

function quoteError(code: unknown) {
  const s = String(code);
  if (/NO_ROUTES|COULD_NOT_FIND|ROUTE_PLAN/i.test(s)) return 'Bu çift için yeterli likidite bulunamadı.';
  if (/NOT_TRADABLE|TOKEN_NOT_TRADABLE/i.test(s)) return 'Bu token şu an takas edilemiyor.';
  if (/CIRCULAR|SAME/i.test(s)) return 'Aynı tokeni kendisiyle takas edemezsin.';
  return 'Fiyat teklifi alınamadı. Birazdan tekrar dene.';
}

export async function getQuote(p: { inputMint: string; outputMint: string; amount: bigint; slippageBps: number }, signal?: AbortSignal): Promise<Quote> {
  const qs = new URLSearchParams({
    inputMint: p.inputMint,
    outputMint: p.outputMint,
    amount: p.amount.toString(),
    slippageBps: String(p.slippageBps),
    restrictIntermediateTokens: 'true',
  });
  const res = await fetch(`${SWAP_API}/quote?${qs}`, { signal });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || j.error) throw new Error(quoteError(j?.errorCode ?? j?.error ?? res.status));
  // Biz ücret istemiyoruz; API bir gün teklife ücret eklerse kullanıcıyı sessizce ödetmek yerine dur.
  if (j.platformFee && Number(j.platformFee.amount) > 0) throw new Error('Teklifte beklenmeyen bir platform ücreti var; takas durduruldu.');
  return j as Quote;
}

/** Jupiter'den teklife ait imzasız işlemi alır ve yapısını doğrular. */
export async function buildSwapTransaction(user: PublicKey, quote: Quote) {
  const res = await fetch(`${SWAP_API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: user.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      // Yoğunlukta düşmesin; üst sınır 0,0005 SOL.
      prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 500_000, priorityLevel: 'high' } },
    }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.swapTransaction) throw new Error(typeof j?.error === 'string' ? j.error : 'Takas işlemi hazırlanamadı.');

  const tx = VersionedTransaction.deserialize(Buffer.from(j.swapTransaction, 'base64'));
  // Uzak sunucudan gelen işlemi körü körüne imzalama: ücret ödeyen biz olmalıyız ve başka imzacı istenmemeli.
  const { staticAccountKeys, header } = tx.message;
  if (!staticAccountKeys[0]?.equals(user) || header.numRequiredSignatures !== 1) {
    throw new Error('Takas işlemi beklenmeyen bir yapıda; imzalanmadı.');
  }
  return { tx, lastValidBlockHeight: j.lastValidBlockHeight as number };
}

/** Teklifi imzalı işleme çevirir, gönderir ve onay bekler. İmza anahtarı cihazdan çıkmaz. */
export async function executeSwap(conn: Connection, signer: Keypair, quote: Quote): Promise<string> {
  const { tx, lastValidBlockHeight } = await buildSwapTransaction(signer.publicKey, quote);
  tx.sign([signer]);
  const raw = tx.serialize();
  const signature = await conn.sendRawTransaction(raw, { maxRetries: 0 });
  await waitForConfirmation(conn, signature, lastValidBlockHeight, raw);
  return signature;
}
