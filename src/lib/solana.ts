import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type ConfirmedSignatureInfo,
  type ParsedTransactionWithMeta,
} from '@solana/web3.js';
import { Buffer } from 'buffer';
import { Platform } from 'react-native';

export type Network = 'mainnet' | 'devnet';

// api.mainnet-beta tarayıcıdan gelen (Origin başlıklı) istekleri 403'le reddediyor; web tasarım
// önizlemesinde CORS'a izin veren publicnode kullanılır. Telefonda bu sorun yok.
const WEB_MAINNET = Platform.OS === 'web' ? 'https://solana-rpc.publicnode.com' : 'https://api.mainnet-beta.solana.com';

// Public RPC'ler oran sınırlı; arkadaş grubu büyürse .env'e ücretsiz Helius anahtarı koy.
const RPC_URL: Record<Network, string> = {
  mainnet: process.env.EXPO_PUBLIC_SOLANA_RPC_MAINNET || WEB_MAINNET,
  devnet: process.env.EXPO_PUBLIC_SOLANA_RPC_DEVNET || 'https://api.devnet.solana.com',
};

export const rpcUrl = (n: Network) => RPC_URL[n];

const connections = new Map<Network, Connection>();
export function getConnection(network: Network) {
  let c = connections.get(network);
  if (!c) {
    c = new Connection(RPC_URL[network], 'confirmed');
    connections.set(network, c);
  }
  return c;
}

const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

export type TokenMeta = { symbol: string; name: string; color: string; stable?: boolean };

const KNOWN_TOKENS: Record<string, TokenMeta> = {
  So11111111111111111111111111111111111111112: { symbol: 'SOL', name: 'Wrapped SOL', color: '#9945FF' },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', name: 'USD Coin', color: '#2775CA', stable: true },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', name: 'Tether', color: '#26A17B', stable: true },
  '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo': { symbol: 'PYUSD', name: 'PayPal USD', color: '#0070E0', stable: true },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: { symbol: 'JUP', name: 'Jupiter', color: '#1FC7A0' },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: { symbol: 'BONK', name: 'Bonk', color: '#F8A51C' },
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: { symbol: 'WIF', name: 'dogwifhat', color: '#B98A5E' },
};

const FALLBACK_COLORS = ['#7C5CFF', '#FF6B8B', '#3DB8FF', '#FFB547', '#4ADE80', '#F472B6'];

export function tokenMeta(mint: string): TokenMeta {
  const known = KNOWN_TOKENS[mint];
  if (known) return known;
  let h = 0;
  for (let i = 0; i < mint.length; i++) h = (h * 31 + mint.charCodeAt(i)) >>> 0;
  return {
    symbol: mint.slice(0, 4).toUpperCase(),
    name: 'Bilinmeyen token',
    color: FALLBACK_COLORS[h % FALLBACK_COLORS.length],
  };
}

export function isValidAddress(s: string) {
  const v = s.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return false;
  try {
    new PublicKey(v);
    return true;
  } catch {
    return false;
  }
}

export type TokenHolding = {
  mint: string;
  amount: number;
  decimals: number;
  meta: TokenMeta;
  /** Gönderimde kaynak olarak kullanılan (en büyük bakiyeli) token hesabı. */
  account: string;
  /** O hesabın ham bakiyesi (en küçük birim, bigint metni). */
  raw: string;
  /** Token programı (klasik ya da Token-2022). */
  program: string;
};

/** Token hesaplarını tarar: değiştirilebilir tokenlar listesi + NFT olabilecek mint'ler (0 ondalık, 1 adet). */
export async function getHoldings(conn: Connection, owner: PublicKey): Promise<{ tokens: TokenHolding[]; nftMints: string[] }> {
  const programs = [TOKEN_PROGRAM, TOKEN_2022_PROGRAM];
  const results = await Promise.all(programs.map((programId) => conn.getParsedTokenAccountsByOwner(owner, { programId })));
  const byMint = new Map<string, TokenHolding>();
  const nftMints: string[] = [];
  results.forEach(({ value }, pi) => {
    for (const acc of value) {
      const info = acc.account.data.parsed?.info;
      const amount = Number(info?.tokenAmount?.uiAmountString ?? 0);
      if (!info?.mint || !(amount > 0)) continue;
      if (info.tokenAmount.decimals === 0 && amount === 1) {
        nftMints.push(info.mint);
        continue;
      }
      const raw: string = info.tokenAmount.amount;
      const prev = byMint.get(info.mint);
      const keepPrev = prev != null && BigInt(prev.raw) >= BigInt(raw);
      byMint.set(info.mint, {
        mint: info.mint,
        amount: amount + (prev?.amount ?? 0),
        decimals: info.tokenAmount.decimals,
        meta: tokenMeta(info.mint),
        account: keepPrev ? prev.account : acc.pubkey.toBase58(),
        raw: keepPrev ? prev.raw : raw,
        program: programs[pi].toBase58(),
      });
    }
  });
  const known = (t: TokenHolding) => (KNOWN_TOKENS[t.mint] ? 0 : 1);
  return { tokens: [...byMint.values()].sort((a, b) => known(a) - known(b) || b.amount - a.amount), nftMints };
}

export type Activity = {
  signature: string;
  time: number | null;
  kind: 'in' | 'out' | 'swap' | 'other';
  amount: number;
  symbol: string;
  failed: boolean;
  counterparty?: string;
  /** Takasta verilen taraf. */
  fromAmount?: number;
  fromSymbol?: string;
};

// Token alırken hesap açma kirası (~0.002 SOL) + ücretler bunun altında kalır; üstündeki SOL hareketi takas sayılır.
const SWAP_SOL_MIN = 0.005;

export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Toplu (batch) RPC isteği public uç noktalarda reddedilebildiği için tek tek, sınırlı eşzamanlı çekiyoruz.
export async function getActivity(conn: Connection, owner: PublicKey, limit = 12): Promise<Activity[]> {
  const sigs = await conn.getSignaturesForAddress(owner, { limit });
  const txs = await mapLimit(sigs, 3, (s) =>
    conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null),
  );
  const me = owner.toBase58();
  return sigs.map((s, i) => toActivity(s, txs[i], me));
}

function toActivity(sig: ConfirmedSignatureInfo, tx: ParsedTransactionWithMeta | null, me: string): Activity {
  const base = { signature: sig.signature, time: sig.blockTime ?? null, failed: !!sig.err };
  const meta = tx?.meta;
  if (!tx || !meta) return { ...base, kind: 'other', amount: 0, symbol: 'SOL' };

  // Token hareketi varsa onu göster (hesap açma kirası gibi SOL gürültüsünü gizler).
  const tokenDelta = new Map<string, number>();
  for (const b of meta.postTokenBalances ?? []) {
    if (b.owner === me) tokenDelta.set(b.mint, (tokenDelta.get(b.mint) ?? 0) + Number(b.uiTokenAmount.uiAmountString ?? 0));
  }
  for (const b of meta.preTokenBalances ?? []) {
    if (b.owner === me) tokenDelta.set(b.mint, (tokenDelta.get(b.mint) ?? 0) - Number(b.uiTokenAmount.uiAmountString ?? 0));
  }
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
  const idx = keys.indexOf(me);
  const fee = keys[0] === me ? meta.fee : 0; // ücreti tutara katmıyoruz
  const delta = idx >= 0 ? (meta.postBalances[idx] - meta.preBalances[idx] + fee) / LAMPORTS_PER_SOL : 0;

  const moved = [...tokenDelta.entries()].filter(([, d]) => Math.abs(d) > 1e-12);
  const got = moved.find(([, d]) => d > 0);
  const gave = moved.find(([, d]) => d < 0);
  const sym = (mint: string) => tokenMeta(mint).symbol;
  if (got && gave) {
    return { ...base, kind: 'swap', amount: got[1], symbol: sym(got[0]), fromAmount: -gave[1], fromSymbol: sym(gave[0]) };
  }
  if (got && delta < -SWAP_SOL_MIN) {
    return { ...base, kind: 'swap', amount: got[1], symbol: sym(got[0]), fromAmount: -delta, fromSymbol: 'SOL' };
  }
  if (gave && delta > SWAP_SOL_MIN) {
    return { ...base, kind: 'swap', amount: delta, symbol: 'SOL', fromAmount: -gave[1], fromSymbol: sym(gave[0]) };
  }
  const token = got ?? gave;
  if (token) {
    return { ...base, kind: token[1] > 0 ? 'in' : 'out', amount: Math.abs(token[1]), symbol: sym(token[0]) };
  }

  let counterparty: string | undefined;
  for (const ix of tx.transaction.message.instructions) {
    if ('parsed' in ix && ix.program === 'system' && ix.parsed?.type === 'transfer') {
      const { source, destination } = ix.parsed.info;
      counterparty = source === me ? destination : source;
      break;
    }
  }
  return {
    ...base,
    kind: delta > 0 ? 'in' : delta < 0 ? 'out' : 'other',
    amount: Math.abs(delta),
    symbol: 'SOL',
    counterparty,
  };
}

// ---- Gönderim ----

export const BASE_FEE_LAMPORTS = 5000;
const COMPUTE_UNIT_LIMIT = 1_000; // SOL transferi ~450 CU kullanır
const MIN_PRIORITY = 10_000; // micro-lamport / CU
const MAX_PRIORITY = 2_000_000;

// Hesap açma (idempotent ATA) + transferChecked; Token-2022 uzantılarıyla birlikte bile bunun altında kalır.
export const TOKEN_TRANSFER_UNITS = 80_000;

export const feeLamports = (microLamports: number, units = COMPUTE_UNIT_LIMIT) =>
  BASE_FEE_LAMPORTS + Math.ceil((microLamports * units) / 1_000_000);

/** Yoğunlukta işlem düşmesin diye son blokların öncelik ücretinin %75'lik dilimi. Maliyet en fazla ~0.000002 SOL. */
export async function getPriorityMicroLamports(conn: Connection): Promise<number> {
  try {
    const fees = (await conn.getRecentPrioritizationFees())
      .map((f) => f.prioritizationFee)
      .filter((x) => x > 0)
      .sort((a, b) => a - b);
    const p75 = fees.length ? fees[Math.floor(fees.length * 0.75)] : 0;
    return Math.min(Math.max(p75, MIN_PRIORITY), MAX_PRIORITY);
  } catch {
    return MIN_PRIORITY;
  }
}

const rentCache = new Map<Connection, number>();
/** Boş bir sistem hesabının yaşaması için gereken asgari bakiye (~0.00089 SOL). */
export async function getRentMin(conn: Connection) {
  let v = rentCache.get(conn);
  if (v == null) {
    v = await conn.getMinimumBalanceForRentExemption(0);
    rentCache.set(conn, v);
  }
  return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitForConfirmation(conn: Connection, signature: string, lastValidBlockHeight: number, rebroadcast?: Uint8Array) {
  for (;;) {
    const { value } = await conn.getSignatureStatuses([signature]);
    const st = value[0];
    if (st?.err) throw new Error('İşlem zincirde başarısız oldu.');
    if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') return;
    const height = await conn.getBlockHeight('confirmed');
    if (height > lastValidBlockHeight) throw new Error('İşlem süresi doldu, ağ yoğun olabilir. Paran çıkmadı, tekrar dene.');
    if (rebroadcast) await conn.sendRawTransaction(rebroadcast, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
    await sleep(1500);
  }
}

export async function sendSol(conn: Connection, from: Keypair, to: PublicKey, lamports: number, microLamports: number) {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: from.publicKey, blockhash, lastValidBlockHeight }).add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
    SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports }),
  );
  tx.sign(from);
  const raw = tx.serialize();
  const signature = await conn.sendRawTransaction(raw, { maxRetries: 0 });
  await waitForConfirmation(conn, signature, lastValidBlockHeight, raw);
  return signature;
}

export const ASSOCIATED_TOKEN_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

/** Bir cüzdanın belirli token için ilişkili (standart) token hesabı adresi. */
export const getAta = (owner: PublicKey, mint: PublicKey, program: PublicKey) =>
  PublicKey.findProgramAddressSync([owner.toBuffer(), program.toBuffer(), mint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM)[0];

/** Alıcının token hesabı yoksa açılışında gönderenin ödeyeceği iade edilmez depozito (lamport). 0 = hesap zaten var. */
export async function getRecipientAtaRent(conn: Connection, to: PublicKey, h: Pick<TokenHolding, 'mint' | 'program'>) {
  const program = new PublicKey(h.program);
  const ata = getAta(to, new PublicKey(h.mint), program);
  if (await conn.getAccountInfo(ata)) return 0;
  // Token-2022 ATA'ları ImmutableOwner uzantısıyla 170 bayt, klasikler 165 bayt.
  return conn.getMinimumBalanceForRentExemption(program.equals(TOKEN_2022_PROGRAM) ? 170 : 165);
}

type TransferSource = Pick<TokenHolding, 'mint' | 'account' | 'program' | 'decimals'>;

/** Alıcının token hesabını (yoksa) açan ve tutarı aktaran iki talimat. */
export function tokenTransferInstructions(from: PublicKey, to: PublicKey, h: TransferSource, amount: bigint) {
  const mint = new PublicKey(h.mint);
  const program = new PublicKey(h.program);
  const dest = getAta(to, mint, program);

  // transferChecked: [12, miktar u64 LE, ondalık u8]
  const data = Buffer.alloc(10);
  data.writeUInt8(12, 0);
  data.writeUInt32LE(Number(amount & 0xffffffffn), 1); // u64 = alt 32 bit + üst 32 bit
  data.writeUInt32LE(Number(amount >> 32n), 5);
  data.writeUInt8(h.decimals, 9);

  return [
    // CreateIdempotent (1): hesap varsa hiçbir şey yapmaz, yoksa açar.
    new TransactionInstruction({
      programId: ASSOCIATED_TOKEN_PROGRAM,
      keys: [
        { pubkey: from, isSigner: true, isWritable: true },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: to, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: program, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([1]),
    }),
    new TransactionInstruction({
      programId: program,
      keys: [
        { pubkey: new PublicKey(h.account), isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: dest, isSigner: false, isWritable: true },
        { pubkey: from, isSigner: true, isWritable: false },
      ],
      data,
    }),
  ];
}

export async function sendToken(conn: Connection, from: Keypair, to: PublicKey, h: TransferSource, amount: bigint, microLamports: number) {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: from.publicKey, blockhash, lastValidBlockHeight }).add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: TOKEN_TRANSFER_UNITS }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
    ...tokenTransferInstructions(from.publicKey, to, h, amount),
  );
  tx.sign(from);
  const raw = tx.serialize();
  const signature = await conn.sendRawTransaction(raw, { maxRetries: 0 });
  await waitForConfirmation(conn, signature, lastValidBlockHeight, raw);
  return signature;
}

export async function requestDevnetAirdrop(conn: Connection, to: PublicKey) {
  const { lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  const signature = await conn.requestAirdrop(to, LAMPORTS_PER_SOL);
  await waitForConfirmation(conn, signature, lastValidBlockHeight);
  return signature;
}

const cluster = (n: Network) => (n === 'devnet' ? '?cluster=devnet' : '');
export const explorerTx = (sig: string, n: Network) => `https://solscan.io/tx/${sig}${cluster(n)}`;
export const explorerAccount = (addr: string, n: Network) => `https://solscan.io/account/${addr}${cluster(n)}`;
