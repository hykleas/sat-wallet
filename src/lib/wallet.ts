import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Keypair } from '@solana/web3.js';

import { deriveEd25519 } from './slip10';

export const WORDLIST = wordlist;

export const normalizeMnemonic = (m: string) => m.trim().toLowerCase().split(/\s+/).join(' ');

export const newMnemonic = () => generateMnemonic(wordlist, 128); // 12 kelime

export const isValidMnemonic = (m: string) => validateMnemonic(normalizeMnemonic(m), wordlist);

/**
 * PBKDF2 (2048 tur) telefonda birkaç yüz ms bloklar; kilit açılışında bir kez çağrılıp
 * seed bellekte tutulmalı — hesap değiştirmek bu maliyeti tekrar ödememeli.
 */
export const seedFromMnemonic = (m: string) => mnemonicToSeedSync(normalizeMnemonic(m));

/**
 * Phantom / Solflare / Backpack ile aynı türetme yolu: m/44'/501'/{hesap}'/0'.
 * Aynı 12 kelime + aynı hesap indeksi bu uygulamada da aynı adresi verir.
 */
export function keypairFromSeed(seed: Uint8Array, account = 0): Keypair {
  return Keypair.fromSeed(deriveEd25519(seed, [44, 501, account, 0]));
}

export function keypairFromMnemonic(m: string, account = 0): Keypair {
  return keypairFromSeed(seedFromMnemonic(m), account);
}
