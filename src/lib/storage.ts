import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Network } from './solana';

// Kurtarma kelimeleri iOS Keychain / Android Keystore'da, yedeğe ve başka cihaza geçmez.
const SECRET: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// SecureStore web'de yok. Web yalnızca geliştirme sırasında tasarım önizlemesi içindir;
// üretim web paketinde bu yol kapalı olduğundan orada cüzdan hiç açılmaz.
const devWeb = Platform.OS === 'web' && __DEV__;
const store = {
  get: (k: string, o?: SecureStore.SecureStoreOptions) =>
    devWeb ? Promise.resolve(sessionStorage.getItem(k)) : SecureStore.getItemAsync(k, o),
  set: (k: string, v: string, o?: SecureStore.SecureStoreOptions) =>
    devWeb ? Promise.resolve(sessionStorage.setItem(k, v)) : SecureStore.setItemAsync(k, v, o),
  del: (k: string, o?: SecureStore.SecureStoreOptions) =>
    devWeb ? Promise.resolve(sessionStorage.removeItem(k)) : SecureStore.deleteItemAsync(k, o),
};

const KEYS = {
  mnemonic: 'sat_mnemonic',
  address: 'sat_address', // gizli değil; kilit ekranının arkasında bakiyeyi önceden yüklemek için
  prefs: 'sat_prefs',
  accounts: 'sat_accounts',
} as const;

export type Currency = 'USD' | 'TRY';
export type Prefs = { network: Network; currency: Currency; hideBalance: boolean };
export const DEFAULT_PREFS: Prefs = { network: 'mainnet', currency: 'USD', hideBalance: false };

/** Aynı mnemonic'ten türeyen hesaplar; `index` = m/44'/501'/{index}'/0' türetme yolu. */
export type Account = { index: number; label: string };
export type AccountsData = { list: Account[]; active: number };
export const DEFAULT_ACCOUNTS: AccountsData = { list: [{ index: 0, label: 'Hesap 1' }], active: 0 };

export async function saveWallet(mnemonic: string, address: string) {
  await store.set(KEYS.mnemonic, mnemonic, SECRET);
  await store.set(KEYS.address, address);
}

export const loadMnemonic = () => store.get(KEYS.mnemonic, SECRET);
export const loadAddress = () => store.get(KEYS.address);

export async function wipeWallet() {
  await store.del(KEYS.mnemonic, SECRET);
  await store.del(KEYS.address);
  await store.del(KEYS.accounts);
}

export async function loadAccounts(): Promise<AccountsData> {
  try {
    const raw = await store.get(KEYS.accounts);
    if (!raw) return DEFAULT_ACCOUNTS;
    const parsed = JSON.parse(raw) as AccountsData;
    return parsed.list?.length ? parsed : DEFAULT_ACCOUNTS;
  } catch {
    return DEFAULT_ACCOUNTS;
  }
}

export const saveAccounts = (a: AccountsData) => store.set(KEYS.accounts, JSON.stringify(a));

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await store.get(KEYS.prefs);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export const savePrefs = (p: Prefs) => store.set(KEYS.prefs, JSON.stringify(p));
