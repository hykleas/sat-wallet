import { PublicKey, type Keypair } from '@solana/web3.js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { confirmUser } from '@/lib/auth';
import { MOCK, isMockMode } from '@/lib/devMock';
import { getNfts, type Nft } from '@/lib/nft';
import { getPrices, getTokenMarkets, type Prices, type TokenMarket } from '@/lib/price';
import { getActivity, getConnection, getHoldings, type Activity, type TokenHolding } from '@/lib/solana';
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_PREFS,
  loadAccounts,
  loadAddress,
  loadMnemonic,
  loadPrefs,
  saveAccounts,
  savePrefs,
  saveWallet,
  wipeWallet,
  type Account,
  type Prefs,
} from '@/lib/storage';
import { isValidMnemonic, keypairFromSeed, normalizeMnemonic, seedFromMnemonic } from '@/lib/wallet';

type Status = 'loading' | 'empty' | 'locked' | 'ready';

// Uygulama bu süreden uzun arka planda kalırsa tekrar kilitlenir.
const AUTO_LOCK_MS = 60_000;

type WalletState = {
  status: Status;
  address: string | null;
  prefs: Prefs;
  lamports: number | null;
  tokens: TokenHolding[];
  /** Mint → logo/fiyat/24s değişim (yalnızca mainnet). */
  markets: Record<string, TokenMarket>;
  nfts: Nft[] | null;
  nftsFailed: boolean;
  activity: Activity[] | null;
  activityFailed: boolean;
  prices: Prices | null;
  refreshing: boolean;
  error: string | null;
  accounts: Account[];
  activeAccount: number;
  setupWallet: (mnemonic: string) => Promise<void>;
  unlock: () => Promise<boolean>;
  refresh: () => Promise<void>;
  updatePrefs: (p: Partial<Prefs>) => void;
  getSigner: () => Keypair;
  revealMnemonic: () => Promise<string | null>;
  resetWallet: () => Promise<void>;
  switchAccount: (index: number) => void;
  addAccount: (label?: string) => Account;
  renameAccount: (index: number, label: string) => void;
  addressForAccount: (index: number) => string | null;
};

const WalletContext = createContext<WalletState | null>(null);

// PBKDF2 JS thread'ini bloklar; önce bir kare çizilsin ki yükleniyor göstergesi görünsün.
const nextFrame = () => new Promise((r) => setTimeout(r, 32));

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [address, setAddress] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [lamports, setLamports] = useState<number | null>(null);
  const [tokens, setTokens] = useState<TokenHolding[]>([]);
  const [markets, setMarkets] = useState<Record<string, TokenMarket>>({});
  const [nfts, setNfts] = useState<Nft[] | null>(null);
  const [nftsFailed, setNftsFailed] = useState(false);
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [activityFailed, setActivityFailed] = useState(false);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS.list);
  const [activeAccount, setActiveAccount] = useState(DEFAULT_ACCOUNTS.active);

  const signer = useRef<Keypair | null>(null);
  // PBKDF2 sonucu; kilit açıkken bellekte tutulur ki hesap değiştirmek her seferinde
  // yüzlerce ms'lik yeniden türetmeyi tekrarlamasın.
  const seed = useRef<Uint8Array | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    (async () => {
      const [mnemonic, addr, p, a] = await Promise.all([loadMnemonic(), loadAddress(), loadPrefs(), loadAccounts()]);
      setPrefs(p);
      setAccounts(a.list);
      setActiveAccount(a.active);
      if (mnemonic) {
        setAddress(addr);
        setStatus('locked');
      } else {
        setStatus('empty');
      }
    })();
  }, []);

  const setupWallet = useCallback(async (raw: string) => {
    const mnemonic = normalizeMnemonic(raw);
    if (!isValidMnemonic(mnemonic)) throw new Error('Kurtarma ifadesi geçersiz. Kelimeleri ve sırasını kontrol et.');
    await nextFrame();
    seed.current = seedFromMnemonic(mnemonic);
    const kp = keypairFromSeed(seed.current, 0);
    const addr = kp.publicKey.toBase58();
    await saveWallet(mnemonic, addr);
    await saveAccounts(DEFAULT_ACCOUNTS);
    signer.current = kp;
    setAccounts(DEFAULT_ACCOUNTS.list);
    setActiveAccount(0);
    setAddress(addr);
    setStatus('ready');
  }, []);

  const unlock = useCallback(async () => {
    if (!(await confirmUser('Sat cüzdanını aç'))) return false;
    const mnemonic = await loadMnemonic();
    if (!mnemonic) {
      setStatus('empty');
      return false;
    }
    await nextFrame();
    seed.current = seedFromMnemonic(mnemonic);
    const a = await loadAccounts();
    setAccounts(a.list);
    setActiveAccount(a.active);
    const kp = keypairFromSeed(seed.current, a.active);
    signer.current = kp;
    setAddress(kp.publicKey.toBase58());
    setStatus('ready');
    return true;
  }, []);

  const activate = useCallback((list: Account[], index: number) => {
    if (!seed.current) return;
    const kp = keypairFromSeed(seed.current, index);
    signer.current = kp;
    setActiveAccount(index);
    setAddress(kp.publicKey.toBase58());
    saveAccounts({ list, active: index });
  }, []);

  const switchAccount = useCallback((index: number) => activate(accounts, index), [accounts, activate]);

  const addAccount = useCallback(
    (label?: string) => {
      const nextIndex = accounts.reduce((m, a) => Math.max(m, a.index), -1) + 1;
      const account: Account = { index: nextIndex, label: label?.trim() || `Hesap ${nextIndex + 1}` };
      const list = [...accounts, account];
      setAccounts(list);
      activate(list, nextIndex);
      return account;
    },
    [accounts, activate],
  );

  const renameAccount = useCallback(
    (index: number, label: string) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      setAccounts((cur) => {
        const list = cur.map((a) => (a.index === index ? { ...a, label: trimmed } : a));
        saveAccounts({ list, active: activeAccount });
        return list;
      });
    },
    [activeAccount],
  );

  const addressForAccount = useCallback((index: number) => {
    if (!seed.current) return null;
    return keypairFromSeed(seed.current, index).publicKey.toBase58();
  }, []);

  useEffect(() => {
    let hiddenAt = 0;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') hiddenAt = Date.now();
      else if (s === 'active' && hiddenAt) {
        if (Date.now() - hiddenAt > AUTO_LOCK_MS) {
          signer.current = null;
          seed.current = null;
          setStatus((cur) => (cur === 'ready' ? 'locked' : cur));
        }
        hiddenAt = 0;
      }
    });
    return () => sub.remove();
  }, []);

  const refresh = useCallback(async () => {
    if (!address) return;
    const id = ++requestId.current;
    const network = prefs.network;
    const conn = getConnection(network);
    const owner = new PublicKey(address);
    const current = () => id === requestId.current;
    setRefreshing(true);
    setError(null);

    if (isMockMode()) {
      const [px, m] = await Promise.all([getPrices(), getTokenMarkets(MOCK.tokens.map((t) => t.mint))]);
      if (!current()) return;
      setLamports(MOCK.lamports);
      setTokens(MOCK.tokens);
      setMarkets(m);
      setNfts(MOCK.nfts);
      setActivity(MOCK.activity);
      if (px) setPrices(px);
      setRefreshing(false);
      return;
    }

    setActivityFailed(false);
    getActivity(conn, owner)
      .then((a) => current() && setActivity(a))
      .catch(() => {
        if (!current()) return;
        setActivityFailed(true); // boş listeyle "henüz işlem yok" deyip yanıltma
        setActivity((cur) => cur ?? []);
      });

    try {
      const [bal, holdings, px] = await Promise.all([
        conn.getBalance(owner),
        getHoldings(conn, owner).catch(() => ({ tokens: [] as TokenHolding[], nftMints: [] as string[] })),
        getPrices(),
      ]);
      if (!current()) return;
      setLamports(bal);
      setTokens(holdings.tokens);
      if (px) setPrices(px);

      // Logo/fiyat ve NFT'ler bakiyeyi bekletmesin; arkadan gelsin.
      if (network === 'mainnet' && holdings.tokens.length) {
        getTokenMarkets(holdings.tokens.map((t) => t.mint)).then((m) => current() && setMarkets(m));
      }
      setNftsFailed(false);
      getNfts(conn, network, address, holdings.nftMints)
        .then((n) => current() && setNfts(n))
        .catch(() => {
          if (!current()) return;
          setNftsFailed(true);
          setNfts((cur) => cur ?? []);
        });
    } catch {
      if (current()) setError('Ağa ulaşılamadı. Aşağı çekerek tekrar dene.');
    } finally {
      if (current()) setRefreshing(false);
    }
  }, [address, prefs.network]);

  // Adres ya da ağ değişince eski ağın verisini gösterme.
  useEffect(() => {
    setLamports(null);
    setTokens([]);
    setMarkets({});
    setNfts(null);
    setActivity(null);
    refresh();
  }, [refresh]);

  const updatePrefs = useCallback((p: Partial<Prefs>) => {
    setPrefs((cur) => {
      const next = { ...cur, ...p };
      savePrefs(next);
      return next;
    });
  }, []);

  const getSigner = useCallback(() => {
    if (!signer.current) throw new Error('Cüzdan kilitli.');
    return signer.current;
  }, []);

  const revealMnemonic = useCallback(async () => {
    if (!(await confirmUser('Kurtarma ifadesini göster'))) return null;
    return loadMnemonic();
  }, []);

  const resetWallet = useCallback(async () => {
    await wipeWallet();
    signer.current = null;
    seed.current = null;
    requestId.current++;
    setAddress(null);
    setLamports(null);
    setTokens([]);
    setMarkets({});
    setNfts(null);
    setActivity(null);
    setAccounts(DEFAULT_ACCOUNTS.list);
    setActiveAccount(DEFAULT_ACCOUNTS.active);
    setStatus('empty');
  }, []);

  return (
    <WalletContext.Provider
      value={{
        status,
        address,
        prefs,
        lamports,
        tokens,
        markets,
        nfts,
        nftsFailed,
        activity,
        activityFailed,
        prices,
        refreshing,
        error,
        accounts,
        activeAccount,
        setupWallet,
        unlock,
        refresh,
        updatePrefs,
        getSigner,
        revealMnemonic,
        resetWallet,
        switchAccount,
        addAccount,
        renameAccount,
        addressForAccount,
      }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet, WalletProvider içinde kullanılmalı');
  return ctx;
}
