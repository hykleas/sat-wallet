import { Platform } from 'react-native';

import type { Nft } from './nft';
import { tokenMeta, type Activity, type TokenHolding } from './solana';

// Yalnızca web tasarım önizlemesi: sessionStorage'da `sat_mock` varsa ağ yerine örnek portföy gösterilir.
// publicnode tarayıcıdan token hesabı/geçmiş sorgusuna izin vermediği için listeler başka türlü görülemiyor.
export const isMockMode = () => Platform.OS === 'web' && __DEV__ && typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('sat_mock');

const now = Math.floor(Date.now() / 1000);
const mint = (m: string, amount: number, decimals: number): TokenHolding => ({
  mint: m,
  amount,
  decimals,
  meta: tokenMeta(m),
  account: m,
  raw: BigInt(Math.round(amount * 10 ** decimals)).toString(),
  program: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
});

export const MOCK = {
  lamports: 2_114_600_000,
  tokens: [
    mint('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 1250.5, 6),
    mint('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', 842.3, 6),
    mint('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', 12_500_000, 5),
    mint('EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', 36.2, 6),
  ],
  nfts: [
    { mint: 'mock1', name: 'Nebula #412', image: 'https://picsum.photos/seed/sat-nft-1/400', collection: 'Nebula' },
    { mint: 'mock2', name: 'Quiet Forms #88', image: 'https://picsum.photos/seed/sat-nft-2/400', collection: 'Quiet Forms' },
    { mint: 'mock3', name: 'Tide #7', image: 'https://picsum.photos/seed/sat-nft-3/400', collection: 'Tide' },
    { mint: 'mock4', name: 'İsimsiz', image: null, collection: null },
  ] satisfies Nft[],
  activity: [
    { signature: 'm1', time: now - 1500, kind: 'in', amount: 0.75, symbol: 'SOL', failed: false, counterparty: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
    { signature: 'm2', time: now - 5200, kind: 'swap', amount: 842.3, symbol: 'JUP', failed: false, fromAmount: 2, fromSymbol: 'SOL' },
    { signature: 'm3', time: now - 90_000, kind: 'out', amount: 120, symbol: 'USDC', failed: false, counterparty: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' },
    { signature: 'm4', time: now - 95_000, kind: 'out', amount: 0.1, symbol: 'SOL', failed: true, counterparty: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' },
    { signature: 'm5', time: now - 400_000, kind: 'other', amount: 0, symbol: 'SOL', failed: false },
  ] satisfies Activity[],
};
