import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Keypair } from '@solana/web3.js';

import { deriveEd25519 } from './slip10';

export const WORDLIST = wordlist;

export const normalizeMnemonic = (m: string) => m.trim().toLowerCase().split(/\s+/).join(' ');

export const newMnemonic = () => generateMnemonic(wordlist, 128); // 12 kelime

export const isValidMnemonic = (m: string) => validateMnemonic(normalizeMnemonic(m), wordlist);

/**
 * Phantom / Solflare / Backpack ile aynı türetme yolu: m/44'/501'/{hesap}'/0'.
 * Aynı 12 kelime bu uygulamada da aynı adresi verir.
 * PBKDF2 (2048 tur) telefonda birkaç yüz ms bloklar; açılışta bir kez çağır.
 */
export function keypairFromMnemonic(m: string, account = 0): Keypair {
  const seed = mnemonicToSeedSync(normalizeMnemonic(m));
  return Keypair.fromSeed(deriveEd25519(seed, [44, 501, account, 0]));
}
