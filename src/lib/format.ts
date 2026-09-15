import type { Currency } from './storage';

export function parseUnits(input: string, decimals: number): bigint | null {
  const s = input.trim().replace(',', '.');
  if (s === '' || s === '.' || !/^\d*\.?\d*$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) return null;
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0');
}

export function formatUnits(v: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${v / base}.${frac}` : `${v / base}`;
}

const nfCache = new Map<number, Intl.NumberFormat>();
function nf(maxFrac: number) {
  let f = nfCache.get(maxFrac);
  if (!f) {
    f = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: maxFrac });
    nfCache.set(maxFrac, f);
  }
  return f;
}

/** Ham (en küçük birim) tutarı okunur hale getirir: 1500000n, 6 → "1,5". */
export function formatRaw(raw: bigint, decimals: number) {
  return nf(Math.min(decimals, 9)).format(Number(formatUnits(raw, decimals)));
}

export function formatToken(n: number) {
  const abs = Math.abs(n);
  return nf(abs >= 1000 ? 2 : abs >= 1 ? 4 : 6).format(n);
}

export const formatSol = (lamports: number) => nf(9).format(lamports / 1e9);

export function formatFiat(n: number, currency: Currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Birim fiyat: 1'in altındaki fiyatlarda (BONK gibi) anlamlı basamakları korur, $0,00'a yuvarlamaz. */
export function formatPrice(n: number, currency: Currency) {
  if (Math.abs(n) >= 1 || n === 0) return formatFiat(n, currency);
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumSignificantDigits: 4 }).format(n);
}

/** "$1.234,56" → ["$1.234", ",56"] — kuruş kısmını soluk göstermek için. */
export function splitDecimal(s: string): [string, string] {
  const i = s.lastIndexOf(',');
  return i >= 0 ? [s.slice(0, i), s.slice(i)] : [s, ''];
}

export function formatPercent(p: number) {
  const s = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(p));
  return `${p >= 0 ? '+' : '−'}%${s}`;
}

export const shortAddress = (a: string, n = 4) => `${a.slice(0, n)}…${a.slice(-n)}`;

export function timeAgo(unix: number | null) {
  if (!unix) return '';
  const s = Math.max(0, Date.now() / 1000 - unix);
  if (s < 60) return 'şimdi';
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} gün önce`;
  return new Date(unix * 1000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

/** Aktivite akışındaki gün başlığı: Bugün / Dün / 12 Eylül. */
export function dayLabel(unix: number | null) {
  if (!unix) return 'Bekliyor';
  const d = new Date(unix * 1000);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86_400_000);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Dün';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

export const clockTime = (unix: number | null) =>
  unix ? new Date(unix * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';

export function errorMessage(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (/0x1771|SlippageToleranceExceeded|slippage/i.test(m)) return 'Fiyat onay sırasında kayma sınırını aştı; paran çıkmadı. Tekrar dene.';
  if (/insufficient|0x1\b/i.test(m)) return 'Bakiye yetersiz (ağ ücreti dahil).';
  if (/429|Too many requests/i.test(m)) return 'Ağ şu an çok yoğun (oran sınırı). Birkaç saniye sonra tekrar dene.';
  if (/Network request failed|fetch/i.test(m)) return 'İnternet bağlantısı yok gibi görünüyor.';
  return m.length > 140 ? `${m.slice(0, 140)}…` : m;
}
